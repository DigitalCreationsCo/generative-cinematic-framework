import {
    Character,
    Scene,
    Location,
    ContinuityContext,
    CastList,
} from "../types";
import { GCPStorageManager } from "../storage-manager";
import { GoogleGenAI, Modality } from "@google/genai";
import { buildllmParams } from "../llm/google/llm-params";
import { cleanJsonOutput } from "../utils";
import { FrameCompositionAgent } from "./frame-composition-agent";
import { buildCharacterImagePrompt } from "../prompts/character-image-instruction";
import { buildLocationImagePrompt } from "../prompts/location-image-instruction";
import { buildSceneContinuityPrompt, continuitySystemPrompt } from "../prompts/continuity-instructions";
import { LlmWrapper } from "../llm";

// ============================================================================
// CONTINUITY MANAGER AGENT
// ============================================================================

export class ContinuityManagerAgent {
    private llm: LlmWrapper;
    private imageModel: LlmWrapper;
    private storageManager: GCPStorageManager;
    private frameComposer: FrameCompositionAgent;
    private ASSET_GEN_COOLDOWN_MS = 30000;

    constructor(
        llm: LlmWrapper,
        imageModel: LlmWrapper,
        frameComposer: FrameCompositionAgent,
        storageManager: GCPStorageManager,
    ) {
        this.llm = llm;
        this.imageModel = imageModel;
        this.storageManager = storageManager;
        this.frameComposer = frameComposer;
    }

    async prepareSceneInputs(
        scene: Scene,
        characters: Character[],
        locations: Location[],
        context: ContinuityContext,
        castList: CastList
    ): Promise<{ enhancedPrompt: string; startFrameUrl?: string; characterReferenceUrls?: string[]; locationReferenceUrls?: string[] }> {
        let startFrameUrl = context.previousScene?.lastFrameUrl;

        // Check if any character in the scene requires a composite frame
        const charactersInScene = castList.characters.filter(char =>
            scene.characters.includes(char.id)
        );

        let characterReferenceUrls;
        if (charactersInScene.length > 0 && startFrameUrl) {
            console.log(`   [ContinuityManager] Character(s) detected in scene ${scene.id}. Generating composite frame...`);
            characterReferenceUrls = charactersInScene.flatMap(c => c.referenceImageUrls || []);
        }

        // Get location reference images for the scene
        const locationInScene = locations.find(loc => loc.id === scene.locationId);
        let locationReferenceUrls;
        if (locationInScene) {
            console.log(`   [ContinuityManager] Location detected in scene ${scene.id}: ${locationInScene.name}`);
            locationReferenceUrls = locationInScene.referenceImageUrls || [];
        }

        const enhancedPrompt = await this.enhanceScenePrompt(scene, characters, context);

        return { enhancedPrompt, startFrameUrl, characterReferenceUrls, locationReferenceUrls };
    }


    async generateCharacterAssets(
        characters: Character[],
    ): Promise<Character[]> {
        console.log(`\n🎨 Generating reference images for ${characters.length} characters...`);

        const updatedCharacters: Character[] = [];

        for (const character of characters) {
            console.log(`  → Generating: ${character.name}`);

            const imagePrompt = buildCharacterImagePrompt(character);

            try {
                const outputMimeType = "image/png";

                const result = await this.imageModel.generateContent({
                    model: "gemini-3-pro-image-preview",
                    contents: [ imagePrompt ],
                    config: {
                        candidateCount: 1,
                        responseModalities: [ Modality.IMAGE ],
                        seed: Math.floor(Math.random() * 1000000),
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

                const imagePath = this.storageManager.getGcsObjectPath({ type: "character_image", characterId: character.id });
                const imageUrl = await this.storageManager.uploadBuffer(
                    imageBuffer,
                    imagePath,
                    outputMimeType,
                );

                updatedCharacters.push({
                    ...character,
                    referenceImageUrls: [imageUrl],
                });

                console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

            } catch (error) {
                console.error(`    ✗ Failed to generate image for ${character.name}:`, error);
                updatedCharacters.push({
                    ...character,
                    referenceImageUrls: [],
                });
            } finally {
                console.log(`   ... waiting ${this.ASSET_GEN_COOLDOWN_MS / 1000}s for rate limit reset`);
                await new Promise(resolve => setTimeout(resolve, this.ASSET_GEN_COOLDOWN_MS));
            }
        }
        return updatedCharacters;
    }

    async generateLocationAssets(
        locations: Location[],
    ): Promise<Location[]> {
        console.log(`\n🎨 Generating reference images for ${locations.length} locations...`);

        const updatedLocations: Location[] = [];

        for (const location of locations) {
            console.log(`  → Generating: ${location.name}`);

            const imagePrompt = buildLocationImagePrompt(location);

            try {
                const outputMimeType = "image/png";

                const result = await this.imageModel.generateContent({
                    model: "gemini-3-pro-image-preview",
                    contents: [ imagePrompt ],
                    config: {
                        candidateCount: 1,
                        responseModalities: [ Modality.IMAGE ],
                        seed: Math.floor(Math.random() * 1000000),
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

                const imagePath = this.storageManager.getGcsObjectPath({ type: "location_image", locationId: location.id });
                const imageUrl = await this.storageManager.uploadBuffer(
                    imageBuffer,
                    imagePath,
                    outputMimeType,
                );

                updatedLocations.push({
                    ...location,
                    referenceImageUrls: [imageUrl],
                });

                console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

            } catch (error) {
                console.error(`    ✗ Failed to generate image for ${location.name}:`, error);
                updatedLocations.push({
                    ...location,
                    referenceImageUrls: [],
                });
            } finally {
                console.log(`   ... waiting ${this.ASSET_GEN_COOLDOWN_MS / 1000}s for rate limit reset`);
                await new Promise(resolve => setTimeout(resolve, this.ASSET_GEN_COOLDOWN_MS));
            }
        }
        return updatedLocations;
    }

    async enhanceScenePrompt(
        scene: Scene,
        characters: Character[],
        context: ContinuityContext
    ): Promise<string> {

        const characterDetails = scene.characters
            .map((charId) => {
                const char = characters.find((c) => c.id === charId);
                if (!char) return "";

                const state = context.characters.get(charId);
                return `
    Character: ${char.name} (ID: ${char.id})
    - Reference Images: ${(char.referenceImageUrls || []).join(", ")}
    - Hair: ${state?.currentAppearance.hair || char.physicalTraits.hair}
    - Clothing: ${state?.currentAppearance.clothing || char.physicalTraits.clothing}
    - Accessories: ${(state?.currentAppearance.accessories || char.physicalTraits.accessories).join(", ")}
    - Last seen in scene ${state?.lastSeen || "N/A"}
    - Current position: ${state?.position || "unknown"}
    - Emotional state: ${state?.emotionalState || "neutral"}`;
            })
            .join("\n");

        const contextInfo = context.previousScene
            ? `
    Previous Scene (${context.previousScene.id}):
    - Description: ${context.previousScene.description}
    - Lighting: ${context.previousScene.lighting}
    - Camera: ${context.previousScene.cameraMovement}
    - Last frame available at: ${context.previousScene.lastFrameUrl || "N/A"}`
            : "This is the first scene.";
        
        const userPrompt = buildSceneContinuityPrompt(scene, characterDetails, contextInfo);

        const response = await this.llm.generateContent(buildllmParams({
            contents: [ continuitySystemPrompt, userPrompt ]
        })); 0;
        return cleanJsonOutput(response.text || "");
    }

    updateContinuityContext(
        scene: Scene,
        context: ContinuityContext,
        characters: Character[]
    ): ContinuityContext {
        scene.characters.forEach((charId) => {
            const char = characters.find((c) => c.id === charId);
            if (!char) return;

            context.characters.set(charId, {
                lastSeen: scene.id,
                currentAppearance: {
                    hair: char.physicalTraits.hair,
                    clothing: char.physicalTraits.clothing,
                    accessories: char.physicalTraits.accessories,
                },
                position: scene.description.includes("left") ? "left" : "center",
                emotionalState: scene.mood,
            });
        });

        context.previousScene = scene;
        return context;
    }
}
