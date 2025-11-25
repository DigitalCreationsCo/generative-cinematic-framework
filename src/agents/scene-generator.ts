import { VertexAI } from "@langchain/google-vertexai";
import { Scene } from "../types";
import { GCPStorageManager } from "../storage-manager";
import { promises as fs } from "fs";
import path from "path";

// ============================================================================
// SCENE GENERATOR AGENT
// ============================================================================

export class SceneGeneratorAgent {
    private storageManager: GCPStorageManager;
    private videoModel: VertexAI;

    constructor(storageManager: GCPStorageManager, videoModel: VertexAI) {
        this.storageManager = storageManager;
        this.videoModel = videoModel;
    }

    async generateScene(
        scene: Scene,
        enhancedPrompt: string,
        projectId: string,
        previousFrameUrl?: string
    ): Promise<Scene> {
        console.log(`\n🎬 Generating Scene ${scene.id}: ${scene.timeStart} - ${scene.timeEnd}`);
        console.log(`   Duration: ${scene.duration}s | Shot: ${scene.shotType}`);

        const videoResult = await this.videoModel.invoke(enhancedPrompt);
        const videoBuffer = Buffer.from(videoResult, "base64");

        const videoPath = `video/${projectId}/clips/scene_${scene.id.toString().padStart(3, "0")}.mp4`;
        const mimeType = "video/mp4";
        
        const videoUrl = await this.storageManager.uploadBuffer(
            videoBuffer,
            videoPath,
            mimeType
        );
        console.log(`   ✓ Video generated and uploaded: ${videoUrl}`);

        const lastFrameUrl = await this.extractLastFrame(videoUrl, projectId, scene.id);

        return {
            ...scene,
            enhancedPrompt,
            generatedVideoUrl: videoUrl,
            lastFrameUrl,
        };
    }

    private async extractLastFrame(
        videoUrl: string,
        projectId: string,
        sceneId: number
    ): Promise<string> {
        const tempVideoPath = path.join("/tmp", `scene_${sceneId}_${Date.now()}.mp4`);
        const tempFramePath = path.join("/tmp", `scene_${sceneId}_${Date.now()}_lastframe.jpg`);

        try {
            const videoBuffer = await this.storageManager.downloadBuffer(videoUrl);
            await fs.writeFile(tempVideoPath, videoBuffer);
            console.log(`   ✓ Video downloaded to temporary path: ${tempVideoPath}`);

            const ffmpegBin = (await import('@ffmpeg-installer/ffmpeg'));
            const args = [`-sseof -1`, `-i "${tempVideoPath}"`, `-update 1`, `-q:v 1`, `"${tempFramePath}"`];

            (await import('child_process')).spawn(ffmpegBin.path, args)

            console.log(`   ✓ Last frame extracted using ffmpeg to: ${tempFramePath}`);

            const frameBuffer = await fs.readFile(tempFramePath);
            const framePath = `video/${projectId}/frames/scene_${sceneId.toString().padStart(3, "0")}_lastframe.jpg`;
            const mimeType = "image/jpeg";
            
            const frameUrl = await this.storageManager.uploadBuffer(
                frameBuffer,
                framePath,
                mimeType
            );
            console.log(`   ✓ Last frame uploaded to GCS: ${frameUrl}`);
            
            return frameUrl;
        } catch (error) {
            console.error("Error extracting last frame:", error);
            throw new Error(`Failed to extract last frame for scene ${sceneId}.`);
        } finally {
            try {
                await fs.unlink(tempVideoPath);
                await fs.unlink(tempFramePath);
            } catch (cleanupError) {
                console.error("Error cleaning up temporary files:", cleanupError);
            }
        }
    }
}
