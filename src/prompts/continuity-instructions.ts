import { Scene } from "../types";

export const continuitySystemPrompt = `You are a continuity supervisor for a cinematic production. Your job is to enhance scene prompts with precise continuity details to ensure visual consistency. Given: 1. A base scene description 2. Character reference details 3. Previous scene context. Generate an enhanced prompt that includes: - Exact character appearance details (same hairstyle, same clothing, same accessories) -Exact lighting consistency notes - Exact spatial continuity (character positions relative to previous scene) - Props and environment details that must remain consistent. Output ONLY the enhanced prompt text, no JSON or extra formatting.`;

export const buildSceneContinuityPrompt = (scene: Scene, characterDetails: any, context: any) => `
    Base Scene Description:
    ${scene.description}

    Shot Type: ${scene.shotType}
    Camera Movement: ${scene.cameraMovement}
    Lighting: ${scene.lighting}
    Mood: ${scene.mood}

    Characters Present:
    ${characterDetails}

    Context:
    ${context}

    Continuity Notes:
    ${scene.continuityNotes?.join("\n")}

    Enhance this prompt with precise continuity details for AI video generation.`;