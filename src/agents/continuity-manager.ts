import {
    retryLlmCall,
    RetryConfig,
} from "../lib/llm-retry";
import {
    Character,
    Scene,
    Location,
    Storyboard,
    GraphState,
} from "../types";
import { GCPStorageManager } from "../storage-manager";
import { ApiError, GoogleGenAI, Modality } from "@google/genai";
import { buildllmParams } from "../llm/google/llm-params";
import { cleanJsonOutput } from "../utils";
import { FrameCompositionAgent } from "./frame-composition-agent";
import { buildCharacterImagePrompt } from "../prompts/character-image-instruction";
import { buildLocationImagePrompt } from "../prompts/location-image-instruction";
import { buildRefineAndEnhancePrompt } from "../prompts/continuity-instructions";
import { LlmWrapper } from "../llm";
import { imageModelName } from "../llm/google/models";
import z from "zod";

// ============================================================================
// CONTINUITY MANAGER AGENT
// ============================================================================

export class ContinuityManagerAgent {
    private llm: LlmWrapper;
    private imageModel: LlmWrapper;
    private storageManager: GCPStorageManager;
    private frameComposer: FrameCompositionAgent;
    private ASSET_GEN_COOLDOWN_MS = 60000;

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
        if (!state.storyboardState) throw new Error("No storyboard state available");
        
        const { characters, locations, scenes } = state.storyboardState;
        const generationRules = state.generationRules || [];

        // Find previous scene for continuity context
        const previousSceneIndex = scenes.findIndex(s => s.id === scene.id) - 1;
        const previousScene = previousSceneIndex >= 0 ? scenes[previousSceneIndex] : undefined;
        const previousEvaluation = previousScene?.evaluation;

        const charactersInScene = characters.filter(char =>
            scene.characters.includes(char.id)
        );
        const characterReferenceUrls = charactersInScene.flatMap(c => c.referenceImageUrls || []);

        const locationInScene = locations.find(loc => loc.id === scene.locationId);
        const locationReferenceUrls = locationInScene?.referenceImageUrls || [];

        // Build context object similar to old ContinuityContext but using new schema
        const continuityContext = {
            previousScene,
            // Characters map is implicitly available via characters array with state
            characters: new Map(characters.map(c => [c.id, c.state || {}])),
             // Locations map is implicitly available via locations array with state
            locations: new Map(locations.map(l => [l.id, l.state || {}]))
        };

        const refinePromptSchema = z.object({
            refinedRules: z.array(z.string()),
            enhancedPrompt: z.string()
        })

        const { prompt, parser } = buildRefineAndEnhancePrompt(
            scene,
            characters,
            continuityContext,
            generationRules,
            previousEvaluation,
            refinePromptSchema
        );

        const response = await this.llm.generateContent(buildllmParams({
            contents: [ { role: 'user', parts: [ { text: prompt } ] } ],
            config: {
                responseJsonSchema: z.toJSONSchema(refinePromptSchema),
            }
        }));

        const { refinedRules, enhancedPrompt } = parser(response.text || "");

        return {
            enhancedPrompt,
            refinedRules,
            startFrameUrl: previousScene?.lastFrameUrl,
            characterReferenceUrls,
            locationReferenceUrls,
        };
    }

    async generateCharacterAssets(
        characters: Character[],
    ): Promise<Character[]> {
        console.log(`\n🎨 Checking for existing reference images for ${characters.length} characters...`);

        const charactersToGenerate: Character[] = [];
        const updatedCharacters: Character[] = [ ...characters ];

        for (const character of characters) {
            const imagePath = this.storageManager.getGcsObjectPath({ type: "character_image", characterId: character.id });
            const exists = await this.storageManager.fileExists(imagePath);

            if (exists) {
                console.log(`  → Found existing image for: ${character.name}`);
                const imageUrl = this.storageManager.getGcsUrl(imagePath);
                const characterIndex = updatedCharacters.findIndex(c => c.id === character.id);
                if (characterIndex > -1) {
                    updatedCharacters[characterIndex] = {
                        ...updatedCharacters[characterIndex],
                        referenceImageUrls: [ imageUrl ],
                    };
                }
            } else {
                console.log(`  → No image found for: ${character.name}. Queued for generation.`);
                charactersToGenerate.push(character);
            }
        }

        if (charactersToGenerate.length > 0) {
            console.log(`\n🎨 Generating reference images for ${charactersToGenerate.length} characters...`);

            for (const character of charactersToGenerate) {
                console.log(`  → Generating: ${character.name}`);

                const imagePrompt = buildCharacterImagePrompt(character);

                try {
                    const outputMimeType = "image/png";

                    const result = await retryLlmCall(
                        this.imageModel.generateContent.bind(this.imageModel),
                        {
                            model: imageModelName,
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
                        },
                        async (error: any, attempt: number, currentParams) => {
                            if (error instanceof ApiError) {
                                if (error.message.includes("Resource exhausted") && attempt > 1) {
                                    currentParams.model = "imagen-4.0-generate-001";
                                    console.log('image model now using imagen-4.0-generate-001')
                                }
                            }
                            return currentParams;
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

                    const characterIndex = updatedCharacters.findIndex(c => c.id === character.id);
                    if (characterIndex > -1) {
                        updatedCharacters[characterIndex].referenceImageUrls = [ imageUrl ];
                    }
                    console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

                } catch (error) {
                    console.error(`    ✗ Failed to generate image for ${character.name}:`, error);
                    const characterIndex = updatedCharacters.findIndex(c => c.id === character.id);
                    if (characterIndex > -1) {
                        updatedCharacters[characterIndex].referenceImageUrls = [];
                    }
                }
            }
        }

        // Ensure all characters have their state initialized.
        return updatedCharacters.map(character => ({
            ...character,
            state: {
                lastSeen: undefined,
                currentAppearance: {
                    hair: character.physicalTraits.hair,
                    clothing: character.physicalTraits.clothing,
                    accessories: character.physicalTraits.accessories,
                },
                position: "unknown",
                emotionalState: "neutral"
            }
        }));
    }

    async generateLocationAssets(
        locations: Location[],
    ): Promise<Location[]> {
        console.log(`\n🎨 Checking for existing reference images for ${locations.length} locations...`);

        const locationsToGenerate: Location[] = [];
        const updatedLocations: Location[] = [ ...locations ];

        for (const location of locations) {
            const imagePath = this.storageManager.getGcsObjectPath({ type: "location_image", locationId: location.id });
            const exists = await this.storageManager.fileExists(imagePath);

            if (exists) {
                console.log(`  → Found existing image for: ${location.name}`);
                const imageUrl = this.storageManager.getGcsUrl(imagePath);
                const locationIndex = updatedLocations.findIndex(l => l.id === location.id);
                if (locationIndex > -1) {
                    updatedLocations[locationIndex] = {
                        ...updatedLocations[locationIndex],
                        referenceImageUrls: [ imageUrl ],
                    };
                }
            } else {
                console.log(`  → No image found for: ${location.name}. Queued for generation.`);
                locationsToGenerate.push(location);
            }
        }

        if (locationsToGenerate.length > 0) {
            console.log(`\n🎨 Generating reference images for ${locationsToGenerate.length} locations...`);

            for (const location of locationsToGenerate) {
                console.log(`  → Generating: ${location.name}`);

                const imagePrompt = buildLocationImagePrompt(location);

                try {
                    const outputMimeType = "image/png";

                    const result = await retryLlmCall(
                        this.imageModel.generateContent.bind(this.imageModel),
                        {
                            model: imageModelName,
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
                        },
                        async (error: any, attempt: number, currentParams) => {
                            if (error instanceof ApiError) {
                                if (error.message.includes("Resource exhausted") && attempt > 1) {
                                    currentParams.model = "imagen-4.0-generate-001";
                                    console.log('image model now using imagen-4.0-generate-001');
                                }
                            }
                            return currentParams;
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

                    const locationIndex = updatedLocations.findIndex(l => l.id === location.id);
                    if (locationIndex > -1) {
                        updatedLocations[locationIndex].referenceImageUrls = [ imageUrl ];
                    }
                    console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

                } catch (error) {
                    console.error(`    ✗ Failed to generate image for ${location.name}:`, error);
                    const locationIndex = updatedLocations.findIndex(l => l.id === location.id);
                     if (locationIndex > -1) {
                        updatedLocations[locationIndex].referenceImageUrls = [];
                    }
                }
            }
        }

        // Ensure all locations have their state initialized.
        return updatedLocations.map(location => ({
            ...location,
            state: {
                lastUsed: undefined,
                lighting: location.lightingConditions,
                weather: "neutral",
                timeOfDay: location.timeOfDay
            }
        }));
    }

    updateStoryboardState(
        scene: Scene,
        currentStoryboardState: Storyboard
    ): Storyboard {
        // Create a deep copy or map new arrays to avoid mutation if desired, 
        // though simple object spread is often enough if nested objects are replaced.
        
        const updatedCharacters = currentStoryboardState.characters.map((char: Character) => {
            if (scene.characters.includes(char.id)) {
                return {
                    ...char,
                    state: {
                        lastSeen: scene.id,
                        currentAppearance: {
                            hair: char.physicalTraits.hair,
                            clothing: char.physicalTraits.clothing,
                            accessories: char.physicalTraits.accessories,
                        },
                        position: scene.description.includes("left") ? "left" : "center", // Simple heuristic
                        emotionalState: scene.mood,
                    }
                };
            }
            return char;
        });

        const updatedLocations = currentStoryboardState.locations.map((loc: Location) => {
             if (loc.id === scene.locationId) {
                 return {
                     ...loc,
                     state: {
                         lastUsed: scene.id,
                         lighting: scene.lighting,
                         weather: "neutral", // Could be parsed from scene desc
                         timeOfDay: "neutral" // Could be parsed
                     }
                 }
             }
             return loc;
        });
        
        // Update the specific scene in the scenes array with the latest generation data
        const updatedScenes = currentStoryboardState.scenes.map((s: Scene) => {
            if (s.id === scene.id) {
                return scene;
            }
            return s;
        });

        return {
            ...currentStoryboardState,
            characters: updatedCharacters,
            locations: updatedLocations,
            scenes: updatedScenes
        };
    }
}
