import { GoogleGenAI, PersonGeneration } from "@google/genai";
import { GCPStorageManager } from "../storage-manager";
import { Scene } from "../types";
import ffmpeg from "fluent-ffmpeg";
import { buildllmParams, buildVideoGenerationParams } from "../llm-params";

export class SceneGeneratorAgent {
    private llm: GoogleGenAI;
    private videoModel: GoogleGenAI;
    private storageManager: GCPStorageManager;

    constructor(llm: GoogleGenAI, videoModel: GoogleGenAI, storageManager: GCPStorageManager) {
        this.llm = llm;
        this.videoModel = videoModel;
        this.storageManager = storageManager;
    }

    async generateScene(
        scene: Scene,
        enhancedPrompt: string,
        previousFrameUrl?: string
    ): Promise<Scene> {
        try {
            console.log(`\n🎬 Generating Scene ${scene.id}: ${scene.timeStart} - ${scene.timeEnd}`);
            console.log(`   Duration: ${scene.duration}s | Shot: ${scene.shotType}`);

            const videoUrl = await this.generateVideo(
                enhancedPrompt,
                scene.duration,
                scene.id,
                previousFrameUrl
            );

            let lastFrameUrl: string | undefined;
            try {
                lastFrameUrl = await this.extractLastFrame(videoUrl, scene.id);
            } catch (error) {
                console.error(`   ⚠️ Failed to extract last frame for scene ${scene.id}, continuing without it:`, error);
            }

            return {
                ...scene,
                enhancedPrompt,
                generatedVideoUrl: videoUrl,
                lastFrameUrl,
            };
        } catch (error) {
            console.error(`   ✗ Failed to generate scene ${scene.id}:`, error);
            throw error; // Re-throw to be handled by the workflow
        }
    }

    private async sanitizePrompt(originalPrompt: string): Promise<string> {
        console.log("   ⚠️ Safety filter triggered. Sanitizing prompt...");
        try {
            const systemPrompt = `Rewrite the following video generation prompt to remove any references to real people, celebrities, or public figures. 
            Describe characters using only generic physical attributes (e.g. "a tall man with short hair" instead of "looks like Tom Cruise"). 
            Ensure the prompt is safe and will not trigger celebrity recognition filters. 
            Keep the visual style, action, and lighting instructions intact.
            Output ONLY the sanitized prompt text.`;

            const response = await this.llm.models.generateContent(buildllmParams({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + "\n\n" + originalPrompt }] }
                ],
            }));
            
            const sanitized = response.text;
            console.log("   ✓ Prompt sanitized.");
            return sanitized || originalPrompt;
        } catch (e) {
            console.warn("   ⚠️ Failed to sanitize prompt, using original:", e);
            return originalPrompt;
        }
    }

    private async generateVideo(
        prompt: string,
        duration: number,
        sceneId: number,
        startFrame?: string
    ): Promise<string> {
        let currentPrompt = prompt;
        let attempt = 0;
        const maxAttempts = 2;

        while (attempt < maxAttempts) {
            try {
                return await this.executeVideoGeneration(currentPrompt, duration, sceneId, startFrame);
            } catch (error: any) {
                attempt++;
                const errorMessage = JSON.stringify(error);

                // Check for safety filter / celebrity error (29310472) or general 400 errors that might be prompt related
                // The error message usually contains the support code or "violate"
                if (errorMessage.includes("29310472") || errorMessage.includes("violate") || errorMessage.includes("safety")) {
                    console.warn(`   ⚠️ Attempt ${attempt} failed due to safety/policy error.`);
                    if (attempt < maxAttempts) {
                        currentPrompt = await this.sanitizePrompt(currentPrompt);
                        continue; // Retry with new prompt
                    }
                }

                // If it's not a safety error or we ran out of attempts, throw
                console.error(`   ✗ Failed to generate video for scene ${sceneId}:`, error);
                throw error;
            }
        }
        throw new Error("Video generation failed after max attempts.");
    }

    private async executeVideoGeneration(
        prompt: string,
        duration: number,
        sceneId: number,
        startFrame?: string
    ): Promise<string> {
        console.log(`   [Google GenAI] Generating video with prompt: ${prompt.substring(0, 50)}...`);

        const outputMimeType = "video/mp4";
        const objectPath = this.storageManager.getGcsObjectPath("scene_video", { sceneId: sceneId });

        let durationSeconds = 6;
        if (typeof duration === 'number' && [ 4, 6, 8 ].includes(duration)) {
            durationSeconds = duration;
        }

        // Get start frame info if present
        let imageParam = undefined;
        if (startFrame) {
            const mimeType = await this.storageManager.getObjectMimeType(startFrame);
            imageParam = { gcsUri: startFrame, mimeType: mimeType || "image/jpeg" };
        }

        const videoGenParams = buildVideoGenerationParams({
            prompt,
            image: imageParam,
            config: {
                resolution: '720p',
                durationSeconds,
                numberOfVideos: 1,
                personGeneration: PersonGeneration.ALLOW_ALL,
                generateAudio: false,
                negativePrompt: "celebrity, famous person, photorealistic representation of real person, distorted face, watermark, text, bad quality",
            }
        });

        let operation = await this.videoModel.models.generateVideos(videoGenParams);

        const startTime = Date.now();
        const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

        console.log(`   ... Operation started: ${operation.name}`);

        while (!operation.done) {
            if (Date.now() - startTime > TIMEOUT_MS) {
                throw new Error(`Video generation timed out after ${TIMEOUT_MS / 1000 / 60} minutes`);
            }

            console.log("   ... waiting for video generation to complete");
            await new Promise(resolve => setTimeout(resolve, 10000));

            operation = await this.videoModel.operations.getVideosOperation({ operation });
        }

        if (operation.error) {
            throw operation.error; // Throw raw error object to be caught by retry logic
        }

        const generatedVideos = operation.response?.generatedVideos;
        if (!generatedVideos || generatedVideos.length === 0 || !generatedVideos[ 0 ].video?.videoBytes) {
            throw new Error("Operation completed but no video data returned.");
        }

        const videoBytesBase64 = generatedVideos[ 0 ].video.videoBytes;
        const videoBuffer = Buffer.from(videoBytesBase64, "base64");

        console.log(`   ... Uploading generated video to ${objectPath}`);
        const gcsUri = await this.storageManager.uploadBuffer(videoBuffer, objectPath, outputMimeType);

        console.log(`   ✓ Video generated and uploaded: ${gcsUri}`);
        return gcsUri;
    }

    async extractLastFrame(
        videoUrl: string,
        sceneId: number
    ): Promise<string> {
        const fs = require('fs');
        const tempVideoPath = `/tmp/scene_${sceneId}.mp4`;
        const tempFramePath = `/tmp/scene_${sceneId}_lastframe.jpg`;

        try {
            await this.storageManager.downloadFile(videoUrl, tempVideoPath);

            return new Promise((resolve, reject) => {
                const framePath = this.storageManager.getGcsObjectPath("scene_last_frame", { sceneId: sceneId });
                let ffmpegError = '';

                const command = ffmpeg(tempVideoPath)
                    .on('start', function(commandLine) {
                        console.log(`   [ffmpeg] Spawned command: ${commandLine}`);
                    })
                    .on('stderr', function(stderrLine) {
                        ffmpegError += stderrLine + '\n';
                    })
                    .on('error', (err: Error) => {
                        ffmpegError += err.message;
                        // The 'error' event is the final one, so we reject here.
                        // No need to also handle in 'end'.
                        const finalError = new Error(`ffmpeg failed to extract frame: ${ffmpegError}`);
                        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                        if (fs.existsSync(tempFramePath)) fs.unlinkSync(tempFramePath);
                        reject(finalError);
                    })
                    .on('end', async () => {
                        try {
                            // By the time 'end' fires, the file MUST exist.
                            if (!fs.existsSync(tempFramePath)) {
                                // If not, ffmpeg failed silently without triggering the 'error' event.
                                const finalError = new Error(`Frame extraction failed. File not found at ${tempFramePath}. FFMPEG stderr:\n${ffmpegError}`);
                                reject(finalError);
                                return;
                            }
                            
                            const fileBuffer = fs.readFileSync(tempFramePath);
                            const gcsUrl = await this.storageManager.uploadBuffer(fileBuffer, framePath, "image/jpeg");
                            console.log(`   ✓ Last frame extracted: ${gcsUrl}`);
                            resolve(gcsUrl);
                        } catch (err) {
                            reject(err);
                        } finally {
                            if (fs.existsSync(tempFramePath)) fs.unlinkSync(tempFramePath);
                            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                        }
                    })
                    .screenshots({
                        timestamps: ['99%'],
                        filename: `scene_${sceneId}_lastframe.jpg`,
                        folder: '/tmp',
                    });
            });
        } catch (error) {
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            throw error;
        }
    }

    async stitchScenes(videoPaths: string[]): Promise<string> {
        console.log(`\n🎬 Stitching ${videoPaths.length} scenes...`);
        
        const fs = require('fs');
        const path = require('path');
        const tmpDir = '/tmp';
        const fileListPath = path.join(tmpDir, 'concat_list.txt');
        const outputFilePath = path.join(tmpDir, 'final_movie.mp4');
        const downloadedFiles: string[] = [];

        try {
            console.log("   ... Downloading clips...");
            await Promise.all(videoPaths.map(async (pathUrl, i) => {
                const localPath = path.join(tmpDir, `clip_${i}.mp4`);
                await this.storageManager.downloadFile(pathUrl, localPath);
                downloadedFiles[i] = localPath; // Ensure order is preserved
            }));

            const fileListContent = downloadedFiles.map(f => `file '${f}'`).join('\n');
            fs.writeFileSync(fileListPath, fileListContent);

            console.log("   ... Stitching videos with ffmpeg");
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(fileListPath)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .outputOptions('-c copy')
                    .save(outputFilePath)
                    .on('end', () => resolve())
                    .on('error', (err: Error) => reject(err));
            });

            const objectPath = this.storageManager.getGcsObjectPath('stitched_video');
            console.log(`   ... Uploading stitched video to ${objectPath}`);
            const gcsUri = await this.storageManager.uploadFile(outputFilePath, objectPath);
            
            console.log(`   ✓ Stitched video uploaded: ${gcsUri}`);
            return gcsUri;

        } catch (error) {
            console.error("   ✗ Failed to stitch scenes:", error);
            throw error;
        } finally {
            if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
            if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
            downloadedFiles.forEach(f => {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            });
        }
    }
}
