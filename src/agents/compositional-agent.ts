import { GoogleGenAI } from "@google/genai";
import {
  Scene,
  Storyboard,
  StoryboardSchema,
  zodToJSONSchema,
} from "../types";
import { GCPStorageManager } from "../storage-manager";
import { buildllmParams } from "../llm-params";
import { cleanJsonOutput } from "../utils";

// ============================================================================
// COMPOSITIONAL AGENT
// ============================================================================

export class CompositionalAgent {
  private llm: GoogleGenAI;
  private storageManager: GCPStorageManager;

  constructor(llm: GoogleGenAI, storageManager: GCPStorageManager) {
    this.llm = llm;
    this.storageManager = storageManager;
  }

  async enhanceStoryboard(scenes: Scene[], prompt: string): Promise<Storyboard> {
    const jsonSchema = zodToJSONSchema(StoryboardSchema);
    const systemPrompt = `You are an expert cinematic director. 
Your task is to take a list of timed scenes (from an audio analysis) and a high-level creative prompt, then flesh out the cinematic details for each scene.

You will be given a JSON object with scenes that already have 'id', 'timeStart', 'timeEnd', 'duration', 'musicDescription', and 'musicalChange'.
Your job is to fill in the remaining fields for each scene: 'shotType', 'description', 'cameraMovement', 'lighting', 'mood', 'audioSync', 'continuityNotes', 'charactersPresent', and 'locationId'.

Use the high-level prompt to create a cohesive narrative across all the scenes.

Output a JSON object following this EXACT SCHEMA: ${jsonSchema}`;

    const llmParams = buildllmParams({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: `High-level prompt: ${prompt}\n\nTimed scenes: ${JSON.stringify(scenes, null, 2)}` }] }
      ],
      config: {
        responseJsonSchema: jsonSchema,
        responseMimeType: "application/json"
      }
    });

    const response = await this.llm.models.generateContent(llmParams);
    const content = response.text;

    if (!content) {
      throw new Error("No content generated from LLM");
    }

    const cleanedContent = cleanJsonOutput(content);
    const storyboard = JSON.parse(cleanedContent) as Storyboard;

    // Save storyboard to GCP
    const storyboardPath = this.storageManager.getGcsObjectPath("storyboard");
    await this.storageManager.uploadJSON(storyboard, storyboardPath);

    console.log(`✓ Storyboard enhanced:`);
    console.log(`  - Title: ${storyboard.metadata.title}`);
    console.log(`  - Total Scenes: ${storyboard.metadata.totalScenes}`);

    return storyboard;
  }

  async generateStoryboard(initialPrompt: string): Promise<Storyboard> {
    const jsonSchema = zodToJSONSchema(StoryboardSchema);
    const systemPrompt = `You are an expert cinematic director and storyboard artist. 
Your task is to analyze a creative prompt and generate a complete, professional storyboard.

CRITICAL: You must INFER missing information from the prompt context:
- If no duration is specified, analyze the content type and estimate appropriate length
- For music videos with song transcriptions: extract exact duration from timestamps
- For narrative content: estimate based on story complexity (short film: 3-10min, feature: 90-120min)
- Extract style, mood, and key moments from any audio descriptions, lyrics, or narrative beats provided

Output a JSON object following this EXACT SCHEMA: ${jsonSchema}

Critical guidelines:
1. ANALYZE the prompt for timing clues:
   - Song transcriptions with timestamps → extract exact duration
   - Audio descriptions with time markers → identify key moments
   - Narrative beats → estimate appropriate pacing
2. INFER style and mood from descriptive language in the prompt
3. EXTRACT key moments from any provided audio/narrative structure
4. Break video into logical scenes (typically 5-30 seconds each)
5. Describe characters with EXTREME detail for visual consistency
6. Track which characters appear in which scenes
7. Maintain continuity notes for costume, props, lighting
8. Specify exact timing for each scene
9. Consider cinematic techniques: shot composition, camera angles, lighting
10. Match scene pacing to audio/mood requirements
11. You are aware of the length limitations of video generation and are adept at creating continuous from multiple generated videos.
12. MASTER CINEMATIC TRANSITIONS: Select transitions that enhance the narrative and emotional impact.
    - USE SMOOTH/EASING TRANSITIONS (e.g., Dissolve, Fade, Wipe) for gradual shifts in time, location, or mood. Ideal for contemplative moments or connecting related scenes.
    - USE SUDDEN/HARD TRANSITIONS (e.g., Hard Cut, Jump Cut, Smash Cut) for dramatic effect, high-energy sequences, or abrupt changes in perspective. Match these to sudden shifts in music or action to maximize impact.

Examples of inference:
- "Progressive metal band" → Style: "High-energy progressive metal with technical instrumentation"
- "lighting changes from white to violet to red" → ColorPalette: ["White", "Violet", "Red"]
- "00:00 - 00:18 explosive opening" → KeyMoment: {timeStart: "00:00", timeEnd: "00:18", description: "Explosive opening with driving guitar riffs"}`;

    const llmParams = buildllmParams({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'user', parts: [{ text: initialPrompt }] }
      ],
      config: {
        responseJsonSchema: jsonSchema,
        responseMimeType: "application/json"
      }
    });

    const response = await this.llm.models.generateContent(llmParams);
    const content = response.text;

    if (!content) {
      throw new Error("No content generated from LLM");
    }

    const cleanedContent = cleanJsonOutput(content);
    const storyboard = JSON.parse(cleanedContent) as Storyboard;

    // Save storyboard to GCP
    const storyboardPath = this.storageManager.getGcsObjectPath("storyboard");
    await this.storageManager.uploadJSON(storyboard, storyboardPath);

    console.log(`✓ Storyboard generated:`);
    console.log(`  - Title: ${storyboard.metadata.title}`);
    console.log(`  - Duration: ${storyboard.metadata.duration}`);
    console.log(`  - Style: ${storyboard.metadata.style}`);
    console.log(`  - Mood: ${storyboard.metadata.mood}`);
    console.log(`  - Total Scenes: ${storyboard.metadata.totalScenes}`);
    console.log(`  - Key Moments: ${storyboard.metadata.keyMoments.length}`);

    if (storyboard.metadata.keyMoments.length > 0) {
      console.log(`\n  📍 Key Moments to Capture:`);
      storyboard.metadata.keyMoments.forEach((moment) => {
        console.log(`     ${moment.timeStart}-${moment.timeEnd}: ${moment.description}`);
      });
    }

    return storyboard;
  }
}
