import { GoogleGenAI } from "@google/genai";
import { GCPStorageManager } from "../storage-manager";
import { Character, ContinuityContext, Scene } from "../types";
import { VertexAI } from "@langchain/google-vertexai";

// ============================================================================
// CONTINUITY MANAGER AGENT
// ============================================================================

export class ContinuityManagerAgent {
    private llm: VertexAI;
    private imageModel: VertexAI;
    private storageManager: GCPStorageManager;

    constructor(
        llm: VertexAI,
        imageModel: VertexAI,
        storageManager: GCPStorageManager
    ) {
        this.llm = llm;
        this.imageModel = imageModel;
        this.storageManager = storageManager;
    }

    async generateCharacterReferences(
        characters: Character[],
        projectId: string
    ): Promise<Character[]> {
        console.log(`\n🎨 Generating reference images for ${characters.length} characters...`);

        const updatedCharacters: Character[] = [];

        for (const character of characters) {
            console.log(`  → Generating: ${character.name}`);

            // Create highly detailed prompt for character reference
            const imagePrompt = this.buildCharacterImagePrompt(character);

            try {
                // Generate high-resolution reference image
                const imageData = await this.imageModel.invoke(imagePrompt, {});
                const buffer = Buffer.from(imageData, "base64");

                // Upload to GCS
                const imagePath = `video/${projectId}/images/characters/${character.id}_reference.png`;
                const mimeType = "image/png";
                const imageUrl = await this.storageManager.uploadBuffer(
                    buffer,
                    imagePath,
                    mimeType
                );

                updatedCharacters.push({
                    ...character,
                    referenceImageUrl: imageUrl,
                });

                console.log(`    ✓ Saved: ${imageUrl}`);
            } catch (error) {
                console.error(`    ✗ Failed to generate image for ${character.name}:`, error);
                // Continue with empty reference
                updatedCharacters.push({
                    ...character,
                    referenceImageUrl: "",
                });
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
        const systemPrompt = `You are a continuity supervisor for a cinematic production.
Your job is to enhance scene prompts with precise continuity details to ensure visual consistency.

Given:
1. A base scene description
2. Character reference details
3. Previous scene context

Generate an enhanced prompt that includes:
- Exact character appearance details (same hairstyle, same clothing, same accessories)
- Lighting consistency notes
- Spatial continuity (character positions relative to previous scene)
- Props and environment details that must remain consistent

Output ONLY the enhanced prompt text, no JSON or extra formatting.`;

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

        const response = await this.llm.invoke([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ]);

        return response as string;
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
