import {
    Character,
    Scene,
    ContinuityContext,
} from "../types";
import { GCPStorageManager } from "../storage-manager";
import { GoogleGenAI } from "@google/genai";
import { buildImageGenerationParams, buildllmParams } from "../llm-params";
import { cleanJsonOutput } from "../utils";

// ============================================================================
// CONTINUITY MANAGER AGENT
// ============================================================================

export class ContinuityManagerAgent {
    private llm: GoogleGenAI;
    private imageModel: GoogleGenAI;
    private storageManager: GCPStorageManager;
    private ASSET_GEN_TIMEOUT_MS = 30000;

    constructor(
        llm: GoogleGenAI,
        imageModel: GoogleGenAI,
        storageManager: GCPStorageManager
    ) {
        this.llm = llm;
        this.imageModel = imageModel;
        this.storageManager = storageManager;
    }

    async generateCharacterReferences(
        characters: Character[],
    ): Promise<Character[]> {
        console.log(`\n🎨 Generating reference images for ${characters.length} characters...`);

        const updatedCharacters: Character[] = [];

        for (const character of characters) {
            console.log(`  → Generating: ${character.name}`);

            const imagePrompt = this.buildCharacterImagePrompt(character);

            try {
                const outputMimeType = "image/png";

                const imageGenParams = buildImageGenerationParams({
                    prompt: imagePrompt,
                    config: {
                        outputMimeType,
                        numberOfImages: 1,
                        guidanceScale: 15,
                        seed: Math.floor(Math.random() * 1000000),
                        addWatermark: false,
                    },
                });

                const response = await this.imageModel.models.generateImages(imageGenParams);
                if (!response.generatedImages?.[ 0 ]?.image?.imageBytes) {
                    throw new Error("No image generated");
                }
                const buffer = Buffer.from(response.generatedImages[ 0 ].image.imageBytes, "base64");

                // Upload to GCS
                const imagePath = this.storageManager.getGcsObjectPath("character_image", { characterId: character.id });
                const imageUrl = await this.storageManager.uploadBuffer(
                    buffer,
                    imagePath,
                    outputMimeType,
                );

                updatedCharacters.push({
                    ...character,
                    referenceImageUrl: imageUrl,
                });

                console.log(`    ✓ Saved: ${this.storageManager.getPublicUrl(imageUrl)}`);

            } catch (error) {
                console.error(`    ✗ Failed to generate image for ${character.name}:`, error);
                // Continue with empty reference
                updatedCharacters.push({
                    ...character,
                    referenceImageUrl: "",
                });
            } finally {
                console.log(`   ... waiting ${this.ASSET_GEN_TIMEOUT_MS / 1000}s for rate limit reset`);
                await new Promise(resolve => setTimeout(resolve, this.ASSET_GEN_TIMEOUT_MS));
            }
        }
        return updatedCharacters;
    }

    private buildCharacterImagePrompt(character: Character): string {
        return `High-quality, photorealistic portrait of ${character.description}.
    Physical details:
    - Hair: ${character.physicalTraits.hair}
    - Clothing: ${character.physicalTraits.clothing}
    - Accessories: ${character.physicalTraits.accessories.join(", ")}
    - Distinctive features: ${character.physicalTraits.distinctiveFeatures.join(", ")}

    Additional notes: ${character.appearanceNotes.join(". ")}

    Style: Professional cinematic photography, studio lighting, sharp focus, high detail, 8K quality.
    Camera: Medium shot, neutral expression, clear view of costume and features.`;
    }

    async enhanceScenePrompt(
        scene: Scene,
        characters: Character[],
        context: ContinuityContext
    ): Promise<string> {
        const systemPrompt = `You are a continuity supervisor for a cinematic production. Your job is to enhance scene prompts with precise continuity details to ensure visual consistency. Given: 1. A base scene description 2. Character reference details 3. Previous scene context. Generate an enhanced prompt that includes: - Exact character appearance details (same hairstyle, same clothing, same accessories) - Lighting consistency notes - Spatial continuity (character positions relative to previous scene) - Props and environment details that must remain consistent. Output ONLY the enhanced prompt text, no JSON or extra formatting.`;

        const characterDetails = scene.charactersPresent
            .map((charId) => {
                const char = characters.find((c) => c.id === charId);
                if (!char) return "";

                const state = context.characterStates.get(charId);
                return `
    Character: ${char.name} (ID: ${char.id})
    - Reference Image: ${char.referenceImageUrl}
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

        const userPrompt = `
    Base Scene Description:
    ${scene.description}

    Shot Type: ${scene.shotType}
    Camera Movement: ${scene.cameraMovement}
    Lighting: ${scene.lighting}
    Mood: ${scene.mood}

    Characters Present:
    ${characterDetails}

    Context:
    ${contextInfo}

    Continuity Notes:
    ${scene.continuityNotes.join("\n")}

    Enhance this prompt with precise continuity details for AI video generation.`;

        const response = await this.llm.models.generateContent(buildllmParams({
            contents: [ systemPrompt, userPrompt ]
        })); 0;
        return cleanJsonOutput(response.text || "");
    }

    updateContinuityContext(
        scene: Scene,
        context: ContinuityContext,
        characters: Character[]
    ): ContinuityContext {
        // Update character states
        scene.charactersPresent.forEach((charId) => {
            const char = characters.find((c) => c.id === charId);
            if (!char) return;

            context.characterStates.set(charId, {
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
