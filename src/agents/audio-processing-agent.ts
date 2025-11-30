// ============================================================================
// OPTIMIZED AUDIO PROCESSING AGENT
// ============================================================================

import { GCPStorageManager } from "../storage-manager";
import { AudioAnalysis, AudioAnalysisSchema, AudioSegment, Scene, TransitionType, VALID_DURATIONS, zodToJSONSchema } from "../types";
import { FileData, GenerateContentResponse, GoogleGenAI, ThinkingLevel } from "@google/genai";
import path from "path";
import { cleanJsonOutput, formatTime, roundToValidDuration } from "../utils";
import ffmpeg from "fluent-ffmpeg";
import { buildAudioProcessingInstruction } from "../prompts/audio-processing-instruction";

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
    async processAudioToScenes(localAudioPath: string, creativePrompt: string): Promise<AudioAnalysis> {
        console.log(`🎤 Starting audio processing for: ${localAudioPath}`);

        const durationSeconds = await this.getAudioDuration(localAudioPath);
        console.log(`   ... Actual audio duration (ffprobe): ${durationSeconds}s`);

        const audioGcsUri = this.storageManager.getGcsUrl(localAudioPath);
        const result = await this.analyzeAudio(audioGcsUri, creativePrompt, durationSeconds);

        if (!result?.candidates?.[ 0 ]?.content?.parts?.[ 0 ]?.text) {
            throw Error("No valid analysis result from LLM");
        }

        const rawText = cleanJsonOutput(result.candidates[ 0 ].content.parts[ 0 ].text);
        const analysis: AudioAnalysis = JSON.parse(rawText);

        console.log(` ✓ Scene template generated with ${analysis.segments.length} scenes covering full track duration.`);
        return analysis;
    }

    private getAudioDuration(filePath: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.ffprobe(filePath, (err: any, metadata: any) => {
                if (err) {
                    reject(err);
                } else {
                    const duration = metadata.format.duration;
                    resolve(duration || 0);
                }
            });
        });
    }

    private ffprobe(filePath: string, callback: (err: any, metadata: any) => void): void {
        ffmpeg.ffprobe(filePath, callback);
    }

    private async analyzeAudio(gcsUri: string, userPrompt: string, durationSeconds: number): Promise<GenerateContentResponse> {
        console.log(`   ... Analyzing audio with Gemini (detailed musical analysis)...`);

        const audioFile: FileData = {
            displayName: "music track",
            fileUri: gcsUri,
            mimeType: "audio/mp3",
        };

        const jsonSchema = zodToJSONSchema(AudioAnalysisSchema);

        const prompt = buildAudioProcessingInstruction(
            durationSeconds,
            VALID_DURATIONS,
            jsonSchema
        );

        const result = await this.genAI.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        { text: userPrompt },
                        { fileData: audioFile },
                    ],
                },
            ],
            config: {
                candidateCount: 1,
                responseMimeType: "application/json",
                responseJsonSchema: jsonSchema,
            }
        });

        return result;
    }
}
