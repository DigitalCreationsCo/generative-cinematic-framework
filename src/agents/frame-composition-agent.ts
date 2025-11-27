import { GoogleGenAI, Modality, Part } from "@google/genai";
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
                return { fileData: { mimeType, fileUri: url } };
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

        const outputMimeType = "image/png";
        const result = await this.imageModel.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: [ textPrompt, ...lastFrameInput, ...characterReferenceInputs ],
            config: {
                candidateCount: 1,
                responseModalities: [ Modality.IMAGE ],
                imageConfig: {
                    outputMimeType: outputMimeType
                }
            }
        });

        if (!result.candidates || result.candidates?.[ 0 ]?.content?.parts?.length === 0) {
            throw new Error("Image generation failed to return any images.");
        }

        const generatedImageData = result.candidates[ 0 ].content?.parts?.[ 0 ]?.inlineData?.data;
        if (!generatedImageData) {
            throw new Error("Generated image is missing inline data.");
        }

        const imageBuffer = Buffer.from(generatedImageData, "base64");
        const outputPath = this.storageManager.getGcsObjectPath("composite_frame", { sceneId });

        console.log(`   ... Uploading composite frame to ${outputPath}`);
        const gcsUri = await this.storageManager.uploadBuffer(imageBuffer, outputPath, outputMimeType);

        console.log(`   ✓ Composite frame generated and uploaded: ${gcsUri}`);
        return gcsUri;
    }
}
