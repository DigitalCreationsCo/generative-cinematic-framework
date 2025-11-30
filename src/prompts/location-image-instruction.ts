import { Location } from "../types";

export const buildLocationImagePrompt = (location: Location): string => {
    return `PHOTOREALISTIC LOCATION REFERENCE - CINEMA QUALITY

Location: ${location.name}

DETAILED DESCRIPTION:
${location.description}

SPECIFIC ATTRIBUTES (MUST BE EXACT):
- Lighting Conditions: ${location.lightingConditions}
- Time of Day: ${location.timeOfDay}

TECHNICAL REQUIREMENTS:
- Style: Professional cinematic environment reference, establishing shot
- Camera: Wide establishing shot, showcasing the full environment
- Focus: Deep depth of field capturing all environmental details
- Lighting: Natural lighting matching time of day and conditions specified
- Quality: 8K detail, film grain texture, color-graded for cinema
- Mood: Atmospheric and immersive, conveying the location's unique character

CRITICAL CONSISTENCY MARKERS:
Every detail matters for continuity. This reference will be used to ensure the location looks EXACTLY the same across all video scenes. Pay meticulous attention to:
- Architectural features, structures, and layout
- Natural elements (trees, rocks, water features, terrain)
- Lighting quality, direction, and color temperature
- Weather conditions and atmospheric effects
- Color palette and tonal values
- Textures and materials of surfaces
- Scale and spatial relationships`;
};
