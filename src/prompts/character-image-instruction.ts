import { Character } from "../types";

export const buildCharacterImagePrompt = (character: Character): string => {
    const traits = character.physicalTraits;
    const aliases = character.aliases.length > 0 ? ` (also known as: ${character.aliases.join(", ")})` : "";

    return `PHOTOREALISTIC CHARACTER REFERENCE - CINEMA QUALITY

Character: ${character.name}${aliases}

PHYSICAL DESCRIPTION:
${character.description}

SPECIFIC TRAITS (MUST BE EXACT):
- Hair: ${traits.hair}
- Clothing: ${traits.clothing}
- Accessories: ${traits.accessories.join(", ") || "None"}
- Distinctive Features: ${traits.distinctiveFeatures.join(", ")}

ADDITIONAL NOTES:
${character.appearanceNotes.join(". ")}

TECHNICAL REQUIREMENTS:
- Style: Professional cinematic character reference, studio lighting setup
- Camera: Medium shot (waist-up), straight-on angle, neutral background
- Expression: Neutral but alive—eyes engaged, natural resting face
- Focus: Tack-sharp focus on face, slight depth blur on background
- Lighting: Three-point lighting (key, fill, rim) for dimensional modeling
- Quality: 8K detail, film grain texture, color-graded for cinema
- Mood: Professional headshot meets character concept art

CRITICAL CONSISTENCY MARKERS:
Every detail matters for continuity. This reference will be used to ensure the character looks EXACTLY the same across all video scenes. Pay meticulous attention to:
- Exact hair color, style, length, texture
- Specific clothing items, colors, fit, wear patterns
- Accessories placement and appearance
- Facial structure, skin tone, unique markings/features`;
};
