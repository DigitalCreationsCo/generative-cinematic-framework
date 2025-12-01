import { PromptCorrection, Scene } from "../types";

export const buildCorrectionPrompt = (originalPrompt: string, scene: Scene, corrections: PromptCorrection[]) => `You are a prompt refinement specialist. Apply the following corrections to improve this video generation prompt.

ORIGINAL PROMPT:
${originalPrompt}

CORRECTIONS TO APPLY:
${corrections.map((c, i) => `
${i + 1}. ${c.issueType}
   Original: "${c.originalPromptSection}"
   Corrected: "${c.correctedPromptSection}"
   Why: ${c.reasoning}
`).join("\n")}

SCENE CONTEXT:
Scene ${scene.id}: ${scene.description}
Shot: ${scene.shotType} | Camera: ${scene.cameraMovement}
Mood: ${scene.mood} | Lighting: ${scene.lighting}

INSTRUCTIONS:
1. Apply ALL corrections to the original prompt
2. Maintain all other aspects of the prompt that aren't being corrected
3. Ensure the corrected prompt is more specific, clear, and actionable
4. Add additional detail where corrections reveal vagueness
5. Keep the prompt concise but comprehensive

Output ONLY the corrected prompt text, no JSON, no preamble.`;