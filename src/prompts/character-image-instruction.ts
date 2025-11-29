import { Character } from "../types";

export const buildCharacterImagePrompt = (character: Character): string => `High-quality, photorealistic portrait: 
        ${JSON.stringify(character, null, 2)}

    Style: Professional cinematic photography, studio lighting, sharp focus, high detail, 8K quality.
    Camera: Medium shot, neutral expression, clear view of costume and features.`;