import { GoogleGenAI, Part } from "@google/genai";
import { GCPStorageManager } from "../storage-manager";
import { buildImageGenerationParams } from "../llm-params";

export class FrameCompositionAgent {
    private imageModel: GoogleGenAI;
    private storageManager: GCPStorageManager;

    constructor(imageModel: GoogleGenAI, storageManager: GCPStorageManager) {
        this.imageModel = imageModel;
        this.storageManager = storageManager;
    }

    private async prepareImageInputs(urls: string[]): Promise<Part[]> {
        return Promise.all(
            urls.map(async (url) => {
                const mimeType = await this.storageManager.getObjectMimeType(url);
                if (!mimeType) {
                    throw new Error(`Could not determine mime type for ${url}`);
                }
                return { inlineData: { mimeType, gcsUri: url } };
            })
        );
    }

    async generateCompositeReferenceFrame(
        lastFrameUrl: string,
        characterReferenceUrls: string[],
        sceneId: number,
    ): Promise<string> {
        console.log(`   [FrameCompositionAgent] Generating composite frame for scene ${sceneId}...`);

        const [lastFrameInput, characterReferenceInputs] = await Promise.all([
            this.prepareImageInputs([lastFrameUrl]),
            this.prepareImageInputs(characterReferenceUrls),
        ]);

        const textPrompt: Part = { text: `Compose a new cinematic frame. Use the main image (input 0) for background, mood, and context. Introduce the character(s) from the reference images (inputs 1+) into this scene, ensuring their appearance is consistent. The new frame should be a natural continuation of the main image's action and composition.` };

        const imageGenParams = buildImageGenerationParams({
            prompt: [textPrompt, ...lastFrameInput, ...characterReferenceInputs] as any,
            config: {
                numberOfImages: 1,
            },
        });
        
        const result = await this.imageModel.models.generateImages(imageGenParams);

        if (!result.generatedImages || result.generatedImages.length === 0) {
            throw new Error("Image generation failed to return any images.");
        }

        const generatedImage = result.generatedImages[0];
        if (!generatedImage.image?.imageBytes) {
            throw new Error("Generated image data is missing.");
        }

        const imageBuffer = Buffer.from(generatedImage.image.imageBytes, "base64");
        const outputPath = this.storageManager.getGcsObjectPath("composite_frame", { sceneId });

        console.log(`   ... Uploading composite frame to ${outputPath}`);
        const gcsUri = await this.storageManager.uploadBuffer(imageBuffer, outputPath, "image/jpeg");

        console.log(`   ✓ Composite frame generated and uploaded: ${gcsUri}`);
        return gcsUri;
    }
}
