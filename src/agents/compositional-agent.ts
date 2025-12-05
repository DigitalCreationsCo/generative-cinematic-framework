// ============================================================================
// OPTIMIZED COMPOSITIONAL AGENT
// ============================================================================

import { z } from "zod";
import {
  Scene,
  Storyboard,
  StoryboardSchema,
  SceneSchema,
  zodToJSONSchema,
  Character,
  Location,
} from "../types";
import { cleanJsonOutput } from "../utils";
import { GCPStorageManager } from "../storage-manager";
import { buildStoryboardEnrichmentInstructions, InitialContextSchema, ScenesOnlySchema } from "../prompts/storyboard-composition-instruction";
import { retryLlmCall, RetryConfig } from "../lib/llm-retry";
import { LlmWrapper } from "../llm";
import { buildPromptExpansionInstruction } from "../prompts/prompt-expansion-instruction";
import { buildllmParams } from "../llm/google/llm-params";
import { imageModelName, textModelName, videoModelName } from "../llm/google/models";

export class CompositionalAgent {
  private llm: LlmWrapper;
  private storageManager: GCPStorageManager;

  constructor(llm: LlmWrapper, storageManager: GCPStorageManager) {
    this.llm = llm;
    this.storageManager = storageManager;
  }

  async generateStoryboard(storyboard: Storyboard, creativePrompt: string, retryConfig?: RetryConfig): Promise<Storyboard> {
    console.log("   ... Enriching storyboard with a two-pass approach...");

    const initialContext = await this._generateInitialContext(creativePrompt, storyboard.scenes, retryConfig);
    console.log("Initial Context:", JSON.stringify(initialContext, null, 2));

    const BATCH_SIZE = 10;
    let enrichedScenes: Scene[] = [];

    for (let i = 0; i < storyboard.scenes.length; i += BATCH_SIZE) {
      const chunkScenes = storyboard.scenes.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(storyboard.scenes.length / BATCH_SIZE);
      console.log(`   ... Processing scene batch ${batchNum}/${totalBatches} (${chunkScenes.length} scenes)...`);

      const jsonSchema = zodToJSONSchema(ScenesOnlySchema);

      const systemPrompt = buildStoryboardEnrichmentInstructions({
        isFirstBatch: false,
        batchNum,
        totalBatches,
      }, jsonSchema);

      let context = `ESTABLISHED CONTEXT:\nCREATIVE PROMPT:\n${creativePrompt}\n`;
      context += `TITLE: ${initialContext.metadata.title}\n`;
      context += `CHARACTERS:\n${JSON.stringify(initialContext.characters, null, 2)}\n`;
      context += `LOCATIONS:\n${JSON.stringify(initialContext.locations, null, 2)}\n`;
      if (enrichedScenes.length > 0) {
        const lastScene = enrichedScenes[ enrichedScenes.length - 1 ];
        context += `PREVIOUS SCENE:\n`;
        context += `${JSON.stringify(lastScene, null, 2)}\n`;
      }
      context += `SCENES TO ENRICH (Batch ${batchNum}):\n${JSON.stringify(chunkScenes, null, 2)}`;

      const llmCall = async () => {
        const response = await this.llm.generateContent(buildllmParams({
          contents: [
            { role: 'user', parts: [ { text: systemPrompt } ] },
            { role: 'user', parts: [ { text: context } ] }
          ],
          config: {
            responseJsonSchema: zodToJSONSchema(ScenesOnlySchema),
          }
        })
      );
        const content = response.text;
        if (!content) throw new Error("No content generated from LLM");

        const cleanedContent = cleanJsonOutput(content);
        return JSON.parse(cleanedContent);
      };

      const batchResult = await retryLlmCall(llmCall, undefined, retryConfig);
      enrichedScenes.push(...batchResult.scenes);
    }

    const updatedStoryboard: Storyboard = {
      ...initialContext,
      scenes: enrichedScenes,
      metadata: {
        ...initialContext.metadata,
        totalScenes: storyboard.scenes.length,
        duration: storyboard.scenes.length > 0 ? storyboard.scenes[ storyboard.scenes.length - 1 ].endTime : 0,
        creativePrompt: creativePrompt,
        videoModel: (storyboard.metadata as any).videoModel || videoModelName,
        imageModel: (storyboard.metadata as any).videoModel || imageModelName,
        textModel: (storyboard.metadata as any).videoModel || textModelName,
      } as Storyboard['metadata']
    };

    this.validateTimingPreservation(storyboard.scenes, updatedStoryboard.scenes);

    const storyboardPath = this.storageManager.getGcsObjectPath({ type: "storyboard" });
    await this.storageManager.uploadJSON(updatedStoryboard, storyboardPath);

    console.log(`✓ Storyboard enriched successfully:`);
    console.log(`  - Title: ${updatedStoryboard.metadata.title || "Untitled"}`);
    console.log(`  - Duration: ${updatedStoryboard.metadata.duration}`);
    console.log(`  - Total Scenes: ${updatedStoryboard.metadata.totalScenes}`);
    console.log(`  - Characters: ${updatedStoryboard.characters.length}`);
    console.log(`  - Locations: ${updatedStoryboard.locations.length}`);
    console.log(`  - Creative prompt added to metadata: ${((updatedStoryboard.metadata as any).creativePrompt as string).slice(0, 50)}...`)

    return updatedStoryboard;
  }

  private async _generateInitialContext(creativePrompt: string, scenes: Scene[], retryConfig?: RetryConfig): Promise<Storyboard> {
    console.log("   ... Generating initial context (metadata, characters, locations)...");

    const jsonSchema = zodToJSONSchema(InitialContextSchema);
    const systemPrompt = buildStoryboardEnrichmentInstructions({ isFirstBatch: true, batchNum: 0, totalBatches: 0 }, jsonSchema);

    // Provide a snippet of scenes for context, without overwhelming the model
    const sceneSnippet = scenes.slice(0, 4).map(s => ({
      description: s.description,
      lyrics: s.lyrics,
      mood: s.mood
    }));

    const context = `
      ESTABLISHED CONTEXT:
      CREATIVE PROMPT:
      ${creativePrompt}

      SNIPPET OF FIRST FIVE SCENES:
      ${JSON.stringify(sceneSnippet, null, 2)}
    `;

    const llmCall = async () => {
      const response = await this.llm.generateContent(buildllmParams({
        contents: [
          { role: 'user', parts: [ { text: systemPrompt } ] },
          { role: 'user', parts: [ { text: context } ] }
        ],
        config: {
          responseJsonSchema: zodToJSONSchema(InitialContextSchema),
        }
      })
      );
      const content = response.text;
      if (!content) throw new Error("No content generated from LLM for initial context");

      const cleanedContent = cleanJsonOutput(content);
      const parsedContext = JSON.parse(cleanedContent);

      if (!parsedContext.metadata) {
        throw new Error("Failed to generate metadata in initial context");
      }

      return {
        ...parsedContext,
        scenes: [] // Scenes will be populated in the second pass
      };
    };

    return retryLlmCall(llmCall, undefined, retryConfig);
  }

  private validateTimingPreservation(originalScenes: Scene[], enrichedScenes: Scene[]): void {
    if (originalScenes.length !== enrichedScenes.length) {
      console.warn(`⚠️ Scene count mismatch: original=${originalScenes.length}, enriched=${enrichedScenes.length}`);
    }

    for (let i = 0; i < Math.min(originalScenes.length, enrichedScenes.length); i++) {
      const orig = originalScenes[ i ];
      const enrich = enrichedScenes[ i ];

      if (orig.startTime !== enrich.startTime || orig.endTime !== enrich.endTime) {
        console.warn(`⚠️ Timing mismatch in scene ${i + 1}: original=[${orig.startTime}-${orig.endTime}], enriched=[${enrich.startTime}-${enrich.endTime}]`);
      }

      if (orig.duration !== enrich.duration) {
        console.warn(`⚠️ Duration mismatch in scene ${i + 1}: original=${orig.duration}s, enriched=${enrich.duration}s`);
      }
    }
  }

  async expandCreativePrompt (
    userPrompt: string,
  ): Promise<string> {

    const systemPrompt = buildPromptExpansionInstruction();

    const userMessage = `CREATIVE_PROMPT:
${userPrompt}

Please expand this into a comprehensive cinematic blueprint following the framework provided.`;

    const llmCall = async () => {
      const params = buildllmParams({
         contents: [
          { role: "user", parts: [ { text: systemPrompt } ] },
          { role: "user", parts: [ { text: userMessage } ] }
        ],
        config: {
          temperature: 0.9,
        }
      })

      const response = await this.llm.generateContent(params);

      const expandedPrompt = response.text;

      if (!expandedPrompt || expandedPrompt.trim().length === 0) {
        throw new Error("No content generated from LLM for prompt expansion");
      }

      console.log(`✓ Creative prompt expanded: ${userPrompt.substring(0, 50)}... → ${expandedPrompt.length} chars`);

      return expandedPrompt;
    };

    try {
      return await retryLlmCall(llmCall, undefined, { maxRetries: 3, initialDelay: 1000 });
    } catch (error) {
      console.error("Failed to expand creative prompt:", error);
      // Fallback: return original prompt if expansion fails
      return userPrompt;
    }
  }

  /**
   * Generates a storyboard from creative prompt without audio timing constraints.
   * Used when no audio file is provided.
   */
  async generateStoryboardFromPrompt(creativePrompt: string, retryConfig?: RetryConfig): Promise<Storyboard> {
    console.log("   ... Generating full storyboard from creative prompt (no audio)...");

    const jsonSchema = zodToJSONSchema(StoryboardSchema);

    const systemPrompt = `You are a master film director and cinematographer. Generate a complete storyboard for a cinematic video based solely on the creative prompt provided.

Since there is no audio timing to follow, you have full creative freedom to determine:
- Number of scenes (aim for 8-15 scenes for a compelling narrative)
- Duration of each scene (4, 6, or 8 seconds only - these are the valid durations)
- Pacing and rhythm of the story
- Character introductions and development
- Location transitions
- Narrative arc and emotional beats

Create a cohesive, visually stunning story with:
1. Clear character definitions with detailed physical descriptions
2. Distinct locations with atmospheric details
3. Scene-by-scene breakdown with:
   - Precise timing (startTime, endTime, duration)
   - Shot types and camera movements
   - Lighting and mood
   - Continuity notes linking scenes
   - Character interactions and positions

Ensure all scene durations are exactly 4, 6, or 8 seconds.
Ensure scenes flow chronologically with no timing gaps or overlaps.

Return a complete Storyboard object matching the provided schema.`;

    const userMessage = `CREATIVE PROMPT:
${creativePrompt}

Generate a complete cinematic storyboard for this concept.`;

    const llmCall = async () => {
      const response = await this.llm.generateContent(buildllmParams({
        contents: [
          { role: 'user', parts: [ { text: systemPrompt } ] },
          { role: 'user', parts: [ { text: userMessage } ] }
        ],
        config: {
          responseJsonSchema: jsonSchema,
          temperature: 0.8,
        }
      })
    );

      const content = response.text;
      if (!content) throw new Error("No content generated from LLM");

      const cleanedContent = cleanJsonOutput(content);
      const storyboard: Storyboard = JSON.parse(cleanedContent);

      // Validate that all scenes have valid durations
      for (const scene of storyboard.scenes) {
        if (scene.duration !== 4 && scene.duration !== 6 && scene.duration !== 8) {
          throw new Error(`Invalid scene duration: ${scene.duration}s. Must be 4, 6, or 8 seconds.`);
        }
      }

      return storyboard;
    };

    const storyboard = await retryLlmCall(llmCall, undefined, { maxRetries: 3, initialDelay: 1000, ...retryConfig });
    (storyboard.metadata as any).creativePrompt = creativePrompt;
    (storyboard.metadata as any).videoModel = videoModelName;
    (storyboard.metadata as any).videoModel = imageModelName;
    (storyboard.metadata as any).videoModel = textModelName;

    // Save storyboard
    const storyboardPath = this.storageManager.getGcsObjectPath({ type: "storyboard" });
    await this.storageManager.uploadJSON(storyboard, storyboardPath);

    console.log(`✓ Storyboard generated successfully:`);
    console.log(`  - Title: ${storyboard.metadata.title || "Untitled"}`);
    console.log(`  - Duration: ${storyboard.metadata.duration}s`);
    console.log(`  - Total Scenes: ${storyboard.metadata.totalScenes}`);
    console.log(`  - Characters: ${storyboard.characters.length}`);
    console.log(`  - Locations: ${storyboard.locations.length}`);
    console.log(`  - Creative prompt added to metadata: ${((storyboard.metadata as any).creativePrompt as string).slice(0, 50)}...`)

    return storyboard;
  }
}
