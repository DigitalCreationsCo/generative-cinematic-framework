import { PersonGeneration, VideoGenerationReferenceType } from "@google/genai";
import { GCPStorageManager } from "../storage-manager";
import { Scene } from "../types";
import ffmpeg from "fluent-ffmpeg";
import { buildVideoGenerationParams, buildllmParams } from "../llm-params";
import fs from "fs";
import { formatTime } from "../utils";
import { retryLlmCall } from "../lib/llm-retry";
import { LlmWrapper } from "../llm";

export class SceneGeneratorAgent {
    private llm: LlmWrapper;
    private storageManager: GCPStorageManager;

    constructor(llm: LlmWrapper, storageManager: GCPStorageManager) {
        this.llm = llm;
        this.storageManager = storageManager;
    }

    async generateScene(
        scene: Scene,
        enhancedPrompt: string,
        previousFrameUrl?: string,
        characerterReferenceUrls?: string[],
    ): Promise<Scene> {
        try {
            console.log(`\n🎬 Generating Scene ${scene.id}: ${formatTime(scene.duration)}`);
            console.log(`   Duration: ${scene.duration}s | Shot: ${scene.shotType}`);

            const videoUrl = await this.generateVideo(
                enhancedPrompt,
                scene.duration,
                scene.id,
                previousFrameUrl,
                characerterReferenceUrls
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

    private async generateVideo(
        prompt: string,
        duration: number,
        sceneId: number,
        startFrame?: string,
        characerterReferenceUrls?: string[],
    ): Promise<string> {
        const llmCall = (currentPrompt: string) => this.executeVideoGeneration(currentPrompt, duration, sceneId, startFrame, characerterReferenceUrls);

        const onRetry = async (error: any, attempt: number, currentPrompt: string) => {
            const errorMessage = JSON.stringify(error);
            if (errorMessage.includes("29310472") || errorMessage.includes("violate") || errorMessage.includes("safety")) {
                console.warn(`   ⚠️ Attempt ${attempt} failed due to safety/policy error. Sanitizing prompt...`);
                return await this.sanitizePrompt(currentPrompt, errorMessage);
            }
        };

        return retryLlmCall(llmCall, prompt, { maxRetries: 2, initialDelay: 1000, backoffFactor: 2 }, onRetry);
    }

    private async sanitizePrompt(originalPrompt: string, errorMessage: string): Promise<string> {
        console.log("   ⚠️ Safety filter triggered. Sanitizing prompt...");
        try {
            const prompt = `Rewrite the following video generation prompt to avoid violating AI usage guidelines, including remove any references to real people, celebrities, or public figures. 
            Describe characters using only generic physical attributes (e.g. "a tall man with short hair" instead of "looks like Tom Cruise"). 
            Read the error message carefully to understand what triggered the safety filter. Ensure the prompt is safe and will not trigger safety filters. 
            Keep the visual style, action, and lighting instructions intact.
            Output ONLY the sanitized prompt text.
            Refer to this list of safety error codes for guidance:
            
            Safety Error Codes:
            - 58061214, 17301594: Child - Rejects requests to generate content depicting children if personGeneration isn't set to "allow_all" or if the project isn't on the allowlist for this feature.
            - 29310472, 15236754: Celebrity - Rejects requests to generate a photorealistic representation of a prominent person or if the project isn't on the allowlist for this feature.
            - 64151117, 42237218: Video safety violation - Detects content that's a safety violation.
            - 62263041:	Dangerous content - Detects content that's potentially dangerous in nature.
            - 57734940, 22137204: Hate - Detects hate-related topics or content.
            - 74803281, 29578790, 42876398:	Other - Detects other miscellaneous safety issues with the request
            - 92201652:	Personal information - Detects Personally Identifiable Information (PII) in the text, such as mentioning a credit card number, home addresses, or other such information.
            - 89371032, 49114662, 72817394:	Prohibited content - Detects the request of prohibited content in the request.
            - 90789179, 63429089, 43188360:	Sexual	Detects content that's sexual in nature.
            - 78610348:	Toxic - Detects toxic topics or content in the text.
            - 61493863, 56562880: Violence - Detects violence-related content from the video or text.
            - 32635315:	Vulgar - Detects vulgar topics or content from the text.
            
            Error message: ${errorMessage}

            Original Prompt: ${originalPrompt}
            `;

            const response = await this.llm.generateContent(buildllmParams({
                model: 'gemini-3-pro-preview',
                contents: [
                    { role: 'user', parts: [{ text: prompt }] }
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

    private async executeVideoGeneration(
        prompt: string,
        duration: number,
        sceneId: number,
        startFrame?: string,
        characerterReferenceUrls?: string[],
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
            imageParam = { gcsUri: startFrame, mimeType: mimeType || "image/png" };
        }

        const referenceImages = characerterReferenceUrls ? await Promise.all(characerterReferenceUrls.map(async url => ({
            image: {
                gcsUri: this.storageManager.getGcsUrl(url),
                mimeType: await this.storageManager.getObjectMimeType(url) || "image/png",
            },
            referenceType: VideoGenerationReferenceType.ASSET
        }))) : [];

        const videoGenParams = buildVideoGenerationParams({
            prompt,
            image: imageParam,
            config: {
                referenceImages,
                resolution: '720p',
                durationSeconds,
                numberOfVideos: 1,
                personGeneration: PersonGeneration.ALLOW_ALL,
                generateAudio: false,
                negativePrompt: "celebrity, famous person, photorealistic representation of real person, distorted face, watermark, text, bad quality",
            }
        });

        let operation = await this.llm.generateVideos(videoGenParams);

        const startTime = Date.now();
        const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

        console.log(`   ... Operation started: ${operation.name}`);

        while (!operation.done) {
            if (Date.now() - startTime > TIMEOUT_MS) {
                throw new Error(`Video generation timed out after ${TIMEOUT_MS / 1000 / 60} minutes`);
            }

            console.log("   ... waiting for video generation to complete");
            await new Promise(resolve => setTimeout(resolve, 10000));

            operation = await this.llm.getVideosOperation({ operation });
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
        const tempVideoPath = `/tmp/scene_${sceneId}.mp4`;
        const tempFramePath = `/tmp/scene_${sceneId}_lastframe.jpg`;

        try {
            await this.storageManager.downloadFile(videoUrl, tempVideoPath);

            return new Promise((resolve, reject) => {
                const framePath = this.storageManager.getGcsObjectPath("scene_last_frame", { sceneId: sceneId });
                let ffmpegError = '';

                ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
                    if (err) {
                        const probeError = new Error(`Failed to probe video: ${err.message}`);
                        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                        reject(probeError);
                        return;
                    }

                    const duration = metadata.format.duration;
                    if (!duration || duration <= 0) {
                        const durationError = new Error(`Invalid video duration: ${duration}`);
                        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                        reject(durationError);
                        return;
                    }

                    const seekTime = Math.max(0, duration - 0.1);

                    const command = ffmpeg(tempVideoPath)
                        .on('start', function (commandLine) {
                            console.log(`   [ffmpeg] Extracting last frame: ${commandLine}`);
                        })
                        .on('stderr', function (stderrLine) {
                            ffmpegError += stderrLine + '\n';
                        })
                        .on('error', (err: Error) => {
                            ffmpegError += err.message;
                            const finalError = new Error(`ffmpeg failed to extract frame: ${err.message}\nFFMPEG stderr:\n${ffmpegError}`);
                            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                            if (fs.existsSync(tempFramePath)) fs.unlinkSync(tempFramePath);
                            reject(finalError);
                        })
                        .on('end', async () => {
                            try {
                                if (!fs.existsSync(tempFramePath)) {
                                    const finalError = new Error(`Frame extraction failed. File not found at ${tempFramePath}.\nFFMPEG stderr:\n${ffmpegError}`);
                                    reject(finalError);
                                    return;
                                }

                                const fileBuffer = fs.readFileSync(tempFramePath);
                                const gcsUrl = await this.storageManager.uploadBuffer(fileBuffer, framePath, "image/png");
                                console.log(`   ✓ Last frame extracted: ${gcsUrl}`);
                                resolve(gcsUrl);
                            } catch (err) {
                                reject(err);
                            } finally {
                                if (fs.existsSync(tempFramePath)) fs.unlinkSync(tempFramePath);
                                if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
                            }
                        })
                        .seekInput(seekTime)
                        .outputOptions([
                            '-vframes', '1',
                            '-q:v', '2'
                        ])
                        .save(tempFramePath);
                });
            });
        } catch (error) {
            if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
            throw error;
        }
    }

    async stitchScenes(videoPaths: string[], audioPath: string): Promise<string> {
        console.log(`\n🎬 Stitching ${videoPaths.length} scenes...`);
        
        const fs = require('fs');
        const path = require('path');
        const tmpDir = '/tmp';
        const fileListPath = path.join(tmpDir, 'concat_list.txt');
        const intermediateVideoPath = path.join(tmpDir, 'intermediate_movie.mp4');
        const finalVideoPath = path.join(tmpDir, 'final_movie.mp4');
        const downloadedFiles: string[] = [];
        const localAudioPath = path.join(tmpDir, 'audio.mp3');

        try {
            console.log("   ... Downloading clips and audio...");
            await this.storageManager.downloadFile(audioPath, localAudioPath);
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
                    .save(intermediateVideoPath)
                    .on('end', () => resolve())
                    .on('error', (err: Error) => reject(err));
            });

            console.log("   ... Adding audio track to the final video");
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(intermediateVideoPath)
                    .input(localAudioPath)
                    .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-strict', 'experimental'])
                    .save(finalVideoPath)
                    .on('end', () => resolve())
                    .on('error', (err: Error) => reject(err));
            });

            const objectPath = this.storageManager.getGcsObjectPath('stitched_video');
            console.log(`   ... Uploading stitched video to ${objectPath}`);
            const gcsUri = await this.storageManager.uploadFile(finalVideoPath, objectPath);
            
            console.log(`   ✓ Stitched video uploaded: ${gcsUri}`);
            return gcsUri;

        } catch (error) {
            console.error("   ✗ Failed to stitch scenes:", error);
            throw error;
        } finally {
            if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
            if (fs.existsSync(intermediateVideoPath)) fs.unlinkSync(intermediateVideoPath);
            if (fs.existsSync(finalVideoPath)) fs.unlinkSync(finalVideoPath);
            if (fs.existsSync(localAudioPath)) fs.unlinkSync(localAudioPath);
            downloadedFiles.forEach(f => {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            });
        }
    }
}
