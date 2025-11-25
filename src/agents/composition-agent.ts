import { VertexAI } from "@langchain/google-vertexai";
import { GCPStorageManager } from "../storage-manager";
import { Storyboard } from "../types";

// ============================================================================
// COMPOSITIONAL AGENT
// ============================================================================

export class CompositionalAgent {
  private llm: VertexAI;
  private storageManager: GCPStorageManager;

  constructor(llm: VertexAI, storageManager: GCPStorageManager) {
    this.llm = llm;
    this.storageManager = storageManager;
  }

  async generateStoryboard(initialPrompt: string): Promise<Storyboard> {
    const systemPrompt = `You are an expert cinematic director and storyboard artist. 
Your task is to analyze a creative prompt and generate a complete, professional storyboard.

CRITICAL: You must INFER missing information from the prompt context:
- If no duration is specified, analyze the content type and estimate appropriate length
- For music videos with audio input: extract exact duration from audio data
- Extract style, mood, and key moments from any audio descriptions, lyrics, or narrative beats provided

Output a JSON object with the following structure:
{
  "metadata": {
    "title": "string",
    "duration": "MM:SS",
    "totalScenes": number,
    "style": "inferred cinematic style (e.g., 'High-energy progressive metal with technical instrumentation')",
    "mood": "overall emotional arc (e.g., 'Aggressive yet melodic, building tension with moments of triumph')",
    "colorPalette": ["color1", "color2", ...],
    "tags": ["tag1", "tag2", ...],
    "keyMoments": [
      {
        "timeStart": "MM:SS",
        "timeEnd": "MM:SS",
        "description": "what happens in this key moment",
        "importance": "critical|high|medium",
        "visualPriority": "specific visual direction for this moment"
      }
    ]
  },
  "characters": [
    {
      "id": "char_1",
      "name": "string",
      "description": "detailed physical description",
      "physicalTraits": {
        "hair": "specific hairstyle, color, length",
        "clothing": "specific outfit description",
        "accessories": ["item1", "item2"],
        "distinctiveFeatures": ["feature1", "feature2"]
      },
      "appearanceNotes": ["note1", "note2"]
    }
  ],
  "locations": [
    {
      "id": "loc_1",
      "name": "string",
      "description": "detailed location description",
      "lightingConditions": "string",
      "timeOfDay": "string"
    }
  ],
  "scenes": [
    {
      "id": 1,
      "timeStart": "MM:SS",
      "timeEnd": "MM:SS",
      "duration": seconds,
      "shotType": "wide/medium/close-up/etc",
      "description": "detailed scene description",
      "cameraMovement": "static/pan/dolly/etc",
      "lighting": "description",
      "mood": "emotional tone",
      "audioSync": "how visuals sync with audio",
      "continuityNotes": ["note1", "note2"],
      "charactersPresent": ["char_1", "char_2"],
      "locationId": "loc_1"
    }
  ]
}

Critical guidelines:
1. ANALYZE the prompt for Scene descriptions, timing cues
2. Extract key moments from any provided audio/narrative structure, estimate appropriate pacing of music and narrative elements
3. INFER style and mood from descriptive language in the prompt
4. Break video into logical scenes (typically 5-30 seconds each)
5. Describe characters with EXTREME detail for visual consistency
6. Track which characters appear in which scenes
7. Maintain continuity notes for costume, props, lighting
8. Specify exact timing for each scene
9. Consider cinematic techniques: shot composition, camera angles, lighting
10. Match scene pacing to audio/mood requirements
11. You are aware of the length limitations of video generation and are adept at creating continuous from multiple generated videos.

Examples of inference:
- "Progressive metal band" → Style: "High-energy progressive metal with technical instrumentation"
- "lighting changes from white to violet to red" → ColorPalette: ["White", "Violet", "Red"]
- "00:00 - 00:18 explosive opening" → KeyMoment: {timeStart: "00:00", timeEnd: "00:18", description: "Explosive opening with driving guitar riffs"}
`;

    const response = await this.llm.invoke([
      { role: "system", content: systemPrompt },
      { role: "user", content: initialPrompt },
    ]);

    const content = response as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from LLM response");
    }

    const storyboard = JSON.parse(jsonMatch[ 0 ]) as Storyboard;

    // Save storyboard to GCP
    const storyboardPath = `video/${Date.now()}/scenes/storyboard.json`;
    await this.storageManager.uploadJSON(storyboard, storyboardPath);

    console.log(`✓ Storyboard generated: ${storyboard.metadata.totalScenes} scenes`);
    return storyboard;
  }
}