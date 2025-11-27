import { GCPStorageManager } from "../storage-manager";
import { Scene } from "../types";
import { GoogleGenAI } from "@google/genai";
import path from "path";

export class AudioProcessingAgent {
    private storageManager: GCPStorageManager;
    private genAI: GoogleGenAI;

    constructor(storageManager: GCPStorageManager, genAI: GoogleGenAI) {
        this.storageManager = storageManager;
        this.genAI = genAI;
    }

    /**
     * Processes an audio file to generate a storyboard.
     * @param localAudioPath The local path to the audio file (mp3, wav).
     * @returns A promise that resolves to an array of scenes.
     */
    async processAudioToStoryboard(localAudioPath: string): Promise<{ scenes: Scene[], audioGcsUri: string }> {
        console.log(`🎤 Starting audio processing for: ${localAudioPath}`);

        // 1. Upload the local audio file to GCS
        const audioGcsUri = await this.uploadAudioToGcs(localAudioPath);

        // 2. Call Vertex AI Speech-to-Text for transcription and timestamps
        const transcriptionResult = await this.transcribeAudio(audioGcsUri);

        // 3. Analyze transcription and audio for musical soundscape and changes
        // This is a complex step that will involve another LLM call.
        // For now, we'll create a placeholder structure.
        
        // 4. Generate scenes based on the analysis
        const scenes = this.createStoryboardFromAnalysis(transcriptionResult);

        console.log(` ✓ Storyboard generated with ${scenes.length} scenes.`);
        return { scenes, audioGcsUri };
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

    private async transcribeAudio(gcsUri: string): Promise<any> {
        console.log(`   ... Transcribing ${gcsUri} with Vertex AI.`);
        
        const audioFile = {
            fileUri: gcsUri,
            mimeType: "audio/mp3", // Assuming mp3 for now
        };

        // Note: This is a simplified call. We will need to process the result
        // to extract the timestamps and text.
        const result = await this.genAI.models.generateContent({
            model: "gemini-2.5-pro",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: "Transcribe this audio file and provide word-level timestamps." },
                        { fileData: audioFile },
                    ],
                },
            ],
        });
        
        return result;
    }

    private createStoryboardFromAnalysis(analysisResult: any): Scene[] {
        console.log("   ... Generating storyboard from analysis.");
        const scenes: Scene[] = [];
        if (!analysisResult || !analysisResult.candidates || !analysisResult.candidates[0].content.parts[0].text) {
            console.warn("   ⚠️ No transcription result to process.");
            return [];
        }
        const transcript = analysisResult.candidates[0].content.parts[0].text;
        
        const sentences = transcript.match( /[^.!?]+[.!?]+/g ) || [];
        let currentTime = 0;
        let sceneId = 1;

        for (const sentence of sentences) {
            const words = sentence.split(" ");
            const duration = Math.max(4, Math.min(8, Math.round(words.length / 3))); // Estimate duration
            
            const scene: Scene = {
                id: sceneId++,
                timeStart: new Date(currentTime * 1000).toISOString().substr(14, 5),
                timeEnd: new Date((currentTime + duration) * 1000).toISOString().substr(14, 5),
                duration: duration as 4 | 6 | 8,
                shotType: "Medium Shot",
                description: sentence.trim(),
                musicDescription: "Analysis not yet implemented",
                musicalChange: "None",
                cameraMovement: "Static",
                lighting: "Neutral",
                mood: "Neutral",
                audioSync: "Generic",
                continuityNotes: [],
                charactersPresent: [],
                locationId: "loc_1"
            };
            scenes.push(scene);
            currentTime += duration;
        }

        return scenes;
    }
}
