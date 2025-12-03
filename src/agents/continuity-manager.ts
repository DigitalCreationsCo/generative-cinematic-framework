import {
    retryLlmCall,
    RetryConfig,
} from "../lib/llm-retry";
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
import { buildSceneContinuityPrompt, continuitySystemPrompt, buildRefineAndEnhancePrompt } from "../prompts/continuity-instructions";
import { LlmWrapper } from "../llm";
import { GraphState } from "../types";

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

    async prepareAndRefineSceneInputs(
        scene: Scene,
        state: GraphState,
    ): Promise<{ enhancedPrompt: string; refinedRules: string[], startFrameUrl?: string; characterReferenceUrls?: string[]; locationReferenceUrls?: string[]; }> {
        const { characters, locations, continuityContext, generationRules } = state;
        const previousEvaluation = state.generatedScenes[ state.generatedScenes.length - 1 ]?.evaluation;

        const charactersInScene = characters.filter(char =>
            scene.characters.includes(char.id)
        );
        const characterReferenceUrls = charactersInScene.flatMap(c => c.referenceImageUrls || []);

        const locationInScene = locations.find(loc => loc.id === scene.locationId);
        const locationReferenceUrls = locationInScene?.referenceImageUrls || [];

        const { prompt, parser } = buildRefineAndEnhancePrompt(
            scene,
            characters,
            continuityContext,
            generationRules || [],
            previousEvaluation
        );

        const response = await this.llm.generateContent(buildllmParams({
            contents: [ { role: 'user', parts: [ { text: prompt } ] } ],
            config: {
                responseMimeType: "application/json",
            }
        }));

        const { refinedRules, enhancedPrompt } = parser(response.text || "");

        return {
            enhancedPrompt,
            refinedRules,
            startFrameUrl: continuityContext.previousScene?.lastFrameUrl,
            characterReferenceUrls,
            locationReferenceUrls,
        };
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

                const result = await retryLlmCall(
                    this.imageModel.generateContent.bind(this.imageModel),
                    {
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
                    },
                    {
                        initialDelay: this.ASSET_GEN_COOLDOWN_MS,
                    }
                );

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
                    referenceImageUrls: [ imageUrl ],
                });

                console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

            } catch (error) {
                console.error(`    ✗ Failed to generate image for ${character.name}:`, error);
                updatedCharacters.push({
                    ...character,
                    referenceImageUrls: [],
                });
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

                const result = await retryLlmCall(
                    this.imageModel.generateContent.bind(this.imageModel),
                    {
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
                    },
                    {
                        initialDelay: this.ASSET_GEN_COOLDOWN_MS,
                    }
                );

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
                    referenceImageUrls: [ imageUrl ],
                });

                console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

            } catch (error) {
                console.error(`    ✗ Failed to generate image for ${location.name}:`, error);
                updatedLocations.push({
                    ...location,
                    referenceImageUrls: [],
                });
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
