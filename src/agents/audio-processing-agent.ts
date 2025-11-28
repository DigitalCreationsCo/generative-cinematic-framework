// ============================================================================
// OPTIMIZED AUDIO PROCESSING AGENT
// ============================================================================

import { GCPStorageManager } from "../storage-manager";
import { AudioAnalysis, AudioAnalysisSchema, Scene, zodToJSONSchema } from "../types";
import { FileData, GenerateContentResponse, GoogleGenAI, ThinkingLevel } from "@google/genai";
import path from "path";
import { cleanJsonOutput } from "../utils";
import ffmpeg from "fluent-ffmpeg";

export class AudioProcessingAgent {
    private storageManager: GCPStorageManager;
    private genAI: GoogleGenAI;

    constructor(storageManager: GCPStorageManager, genAI: GoogleGenAI) {
        this.storageManager = storageManager;
        this.genAI = genAI;
    }

    /**
     * Processes an audio file to generate a detailed musical analysis and timed scene template.
     * @param localAudioPath The local path to the audio file (mp3, wav).
     * @returns A promise that resolves to an array of timed scenes and the audio GCS URI.
     */
    async processAudioToStoryboard(localAudioPath: string): Promise<{ scenes: Scene[], audioGcsUri: string; }> {
        console.log(`🎤 Starting audio processing for: ${localAudioPath}`);

        const durationSeconds = await this.getAudioDuration(localAudioPath);
        console.log(`   ... Actual audio duration (ffprobe): ${durationSeconds}s`);

        const audioGcsUri = await this.uploadAudioToGcs(localAudioPath);
        const musicalAnalysis = await this.analyzeAudio(audioGcsUri, durationSeconds);

        // // Override totalDuration in analysis with actual duration
        // if (musicalAnalysis?.candidates?.[ 0 ]?.content?.parts?.[ 0 ]?.text) {
        //     // We can't easily modify the raw text, but we can pass the duration to the creator method
        //     // or parse it first.
        //     // Better: createTimedSceneTemplate will parse it. We can pass durationSeconds as a second arg.
        // }

        const scenes = this.createTimedSceneTemplate(musicalAnalysis, durationSeconds);

        console.log(` ✓ Scene template generated with ${scenes.length} scenes covering full track duration.`);
        return { scenes, audioGcsUri };
    }

    private getAudioDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    const duration = metadata.format.duration;
                    resolve(duration || 0);
                }
            });
        });
    }

    private async uploadAudioToGcs(localPath: string): Promise<string> {
        const fileName = path.basename(localPath);
        const destination = `audio/${fileName}`;
        const gcsUri = this.storageManager.getGcsUrl(destination);

        const exists = await this.storageManager.fileExists(gcsUri);
        if (exists) {
            console.log(`   ... Audio file already exists at ${gcsUri}, skipping upload.`);
            return gcsUri;
        }

        console.log(`   ... Uploading ${localPath} to GCS at ${destination}`);
        return this.storageManager.uploadFile(localPath, destination);
    }

    private async analyzeAudio(gcsUri: string, durationSeconds: number): Promise<GenerateContentResponse> {
        console.log(`   ... Analyzing audio with Gemini (detailed musical analysis)...`);

        const audioFile: FileData = {
            displayName: "music track",
            fileUri: gcsUri,
            mimeType: "audio/mp3",
        };

        const strictPrompt = `
The audio file is EXACTLY ${durationSeconds} seconds long. This is the authoritative duration.
Never infer timing from listening; use this duration as ground truth.

Analyze the audio and return a JSON object that matches AudioAnalysisSchema exactly. Your analysis will be used to sync a music video to the music track's emotional arc and structural changes.

For each segment, provide:
- **start_time** and **end_time** (in seconds, precise to 1 decimal place)
- **type**: Classify as lyrical, instrumental, transition, breakdown, solo, or climax
- **lyrics**: Transcribe any vocals/lyrics. If instrumental, leave empty.
- **musicalDescription**: Describe instruments, musical patterns, riffs, melodic elements, rhythmic characteristics
- **intensity**: Rate the energy (low/medium/high/extreme)
- **mood**: Describe the emotional quality (aggressive, melancholic, triumphant, mysterious, etc.)
- **tempo**: Rate the pace (slow/moderate/fast/very_fast)
- **musicalChange**: Note any significant changes: tempo shifts, key changes, instrumentation additions/removals, dynamic shifts
- **transitionType**: How does this segment flow to the next? (smooth/sudden/buildup/breakdown/none)

CRITICAL REQUIREMENTS:
- Cover the ENTIRE duration of the music track without skipping any sections
- For instrumental sections, provide rich musical descriptions (not just "instrumental")
- Identify buildups, climaxes, breakdowns, solos as distinct segment types
- Mark transition points between sections clearly
- Be precise with timing - segments should align to natural musical phrases
- Break long sections (>10s) into smaller meaningful chunks if they contain distinct musical ideas

Segmentation rules:
- Start at 0.0
- End at ${durationSeconds}
- No gaps, no overlaps
- All timestamps must be 1 decimal place
- Each segment boundary must reflect a real musical change
- Any >10s block with internal variation must be subdivided
- segments[i].end_time must equal segments[i+1].start_time
- totalDuration must be ${durationSeconds}

Return JSON ONLY.
`;

        const result = await this.genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: strictPrompt },
                        { fileData: audioFile },
                    ],
                },
            ],
            config: {
                candidateCount: 1,
                responseMimeType: "application/json",
                responseJsonSchema: AudioAnalysisSchema,
            }
        });

        return result;
    }

    private createTimedSceneTemplate(analysisResult: GenerateContentResponse, actualDuration: number): Scene[] {
        console.log("   ... Creating timed scene template from musical analysis...");
        const scenes: Scene[] = [];

        let totalDuration = 0;
        let segments: any[] = [];

        try {
            if (!analysisResult?.candidates?.[ 0 ]?.content?.parts?.[ 0 ]?.text) {
                console.warn("   ⚠️ No valid analysis result from LLM. Falling back to raw duration.");
            } else {
                const rawText = analysisResult.candidates[ 0 ].content.parts[ 0 ].text;
                const cleanedJson = cleanJsonOutput(rawText);
                const analysis = JSON.parse(cleanedJson);
                totalDuration = analysis.totalDuration;
                segments = analysis.segments;
            }
        } catch (e) {
            console.error(`   ⚠️ Failed to parse audio analysis JSON: ${e}`);
        }

        // Fallback if analysis failed or is invalid
        if (!totalDuration || !segments || segments.length === 0) {
            console.warn("   ⚠️ Analysis invalid or missing segments. Using actual duration fallback.");
            totalDuration = actualDuration;
            // Create a single dummy segment covering the whole track so the loop can slice it
            segments = [{
                start_time: 0,
                end_time: actualDuration,
                type: "instrumental",
                musicalDescription: "Unanalyzed audio section",
                intensity: "medium",
                mood: "neutral",
                tempo: "moderate",
                musicalChange: "None",
                transitionType: "none"
            }];
        } else {
             // Override duration if significantly different (trust ffprobe)
             if (Math.abs(totalDuration - actualDuration) > 5) {
                console.warn(`   ⚠️ LLM duration (${totalDuration}s) differs from actual (${actualDuration}s). Using actual.`);
                totalDuration = actualDuration;
             }
        }

        console.log(`   ... Total track duration: ${totalDuration}s`);
        console.log(`   ... Musical segments identified: ${segments.length}`);

        const targetDurations = [ 4, 6, 8 ];
        let sceneId = 1;
        let currentTime = 0;

        const formatTime = (seconds: number) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        while (currentTime < totalDuration) {
            let bestDuration = 4;
            let minDistanceToBoundary = Infinity;

            for (const duration of targetDurations) {
                const targetTime = currentTime + duration;

                let closestBoundaryDistance = Infinity;
                for (const seg of segments) {
                    const startDist = Math.abs(seg.start_time - targetTime);
                    const endDist = Math.abs(seg.end_time - targetTime);
                    const minDist = Math.min(startDist, endDist);

                    if (minDist < closestBoundaryDistance) {
                        closestBoundaryDistance = minDist;
                    }
                }

                if (closestBoundaryDistance < minDistanceToBoundary) {
                    minDistanceToBoundary = closestBoundaryDistance;
                    bestDuration = duration;
                } else if (Math.abs(closestBoundaryDistance - minDistanceToBoundary) < 0.5) {
                    if (duration > bestDuration) bestDuration = duration;
                }
            }

            const endTime = Math.min(currentTime + bestDuration, totalDuration);
            const durationSeconds = endTime - currentTime;

            const relevantSegments = segments.filter((s: any) =>
                (s.start_time >= currentTime && s.start_time < endTime) ||
                (s.end_time > currentTime && s.end_time <= endTime) ||
                (s.start_time <= currentTime && s.end_time >= endTime)
            );

            if (relevantSegments.length === 0) {
                console.warn(`   ⚠️ No segments found for scene at ${currentTime}s, creating generic instrumental scene...`);

                const scene: Scene = {
                    id: sceneId++,
                    timeStart: formatTime(currentTime),
                    timeEnd: formatTime(endTime),
                    duration: this.roundToValidDuration(durationSeconds),
                    shotType: "Wide Shot",
                    description: "[Instrumental / Unanalyzed Section] - Compositional Agent to infer visuals based on global mood",
                    musicDescription: "Instrumental continuation",
                    musicalChange: "None",
                    musicalIntensity: "medium",
                    musicalMood: "neutral",
                    musicalTempo: "moderate",
                    transitionType: "Dissolve",
                    cameraMovement: "Slow Pan",
                    lighting: "Neutral",
                    mood: "Neutral",
                    audioSync: "Mood Sync",
                    continuityNotes: [],
                    charactersPresent: [],
                    locationId: "loc_1"
                };
                scenes.push(scene);
                currentTime = endTime;
                continue;
            }

            const isLyrical = relevantSegments.some((s: any) => s.type === "lyrical");
            const dominantSegment = relevantSegments.reduce((prev: any, curr: any) => {
                const prevOverlap = Math.min(prev.end_time, endTime) - Math.max(prev.start_time, currentTime);
                const currOverlap = Math.min(curr.end_time, endTime) - Math.max(curr.start_time, currentTime);
                return currOverlap > prevOverlap ? curr : prev;
            });

            const lyrics = relevantSegments
                .filter((s: any) => s.lyrics)
                .map((s: any) => s.lyrics)
                .join(" ")
                .trim();

            const musicalDescription = relevantSegments
                .map((s: any) => s.musicalDescription)
                .join(". ")
                .trim();

            const lastSegment = relevantSegments[ relevantSegments.length - 1 ];
            const transitionType = lastSegment?.transitionType || "none";

            const cinematicTransition = this.mapToCinematicTransition(
                transitionType,
                dominantSegment.intensity,
                dominantSegment.mood
            );

            const scene: Scene = {
                id: sceneId++,
                timeStart: formatTime(currentTime),
                timeEnd: formatTime(endTime),
                duration: this.roundToValidDuration(durationSeconds),
                shotType: "Medium Shot",
                description: lyrics || "[To be filled by compositional agent]",
                musicDescription: musicalDescription,
                musicalChange: dominantSegment.musicalChange || "None",
                musicalIntensity: dominantSegment.intensity,
                musicalMood: dominantSegment.mood,
                musicalTempo: dominantSegment.tempo,
                transitionType: cinematicTransition,
                cameraMovement: "Static", 
                lighting: "Neutral", 
                mood: dominantSegment.mood,
                audioSync: isLyrical ? "Lip Sync" : "Mood Sync",
                continuityNotes: [],
                charactersPresent: [],
                locationId: "loc_1"
            };

            scenes.push(scene);
            currentTime = endTime;
        }

        console.log(`   ✓ Created ${scenes.length} timed scenes covering ${formatTime(totalDuration)}`);
        return scenes;
    }

    private roundToValidDuration(duration: number): 4 | 6 | 8 {
        if (duration <= 5) return 4;
        if (duration <= 7) return 6;
        return 8;
    }

    private mapToCinematicTransition(
        musicalTransition: string,
        intensity: string,
        mood: string
    ): string {
        const transitionMap: { [ key: string ]: string[]; } = {
            "smooth": [ "Dissolve", "Fade", "Cross Fade" ],
            "sudden": [ "Hard Cut", "Smash Cut", "Jump Cut" ],
            "buildup": [ "Wipe", "Iris In", "Push" ],
            "breakdown": [ "Fade to Black", "Dissolve", "Slow Fade" ],
            "none": [ "Cut" ]
        };

        const baseTransitions = transitionMap[ musicalTransition ] || [ "Cut" ];

        if (intensity === "extreme" || intensity === "high") {
            return baseTransitions.includes("Hard Cut") ? "Smash Cut" : baseTransitions[ 0 ];
        }

        return baseTransitions[ 0 ];
    }
}
