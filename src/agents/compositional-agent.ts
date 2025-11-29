// ============================================================================
// OPTIMIZED COMPOSITIONAL AGENT
// ============================================================================

import { GoogleGenAI } from "@google/genai";
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
import { buildStoryboardEnrichmentInstructions } from "../prompts/storyboard-composition-instruction";

export class CompositionalAgent {
  private llm: GoogleGenAI;
  private storageManager: GCPStorageManager;

  constructor(llm: GoogleGenAI, storageManager: GCPStorageManager) {
    this.llm = llm;
    this.storageManager = storageManager;
  }

  async enhanceStoryboard(storyboard: Storyboard, creativePrompt: string, { MAX_RETRIES = 3, RETRY_WAIT_TIME = 10000 } = {}): Promise<Storyboard> {
    console.log("   ... Enriching storyboard with a two-pass approach...");

    // First pass: Generate metadata, characters, and locations
    const initialContext = await this._generateInitialContext(creativePrompt, storyboard.scenes, { MAX_RETRIES, RETRY_WAIT_TIME });
    console.log("Initial Context:", JSON.stringify(initialContext, null, 2));

    const BATCH_SIZE = 10;
    let enrichedScenes: Scene[] = [];

    const ScenesOnlySchema = z.object({
      scenes: z.array(SceneSchema)
    });

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

      let retries = 0;
      let success = false;
      let batchResult: { scenes: Scene[]; } | null = null;

      while (!success && retries < MAX_RETRIES) {
        try {
          const response = await this.llm.models.generateContent({
            model: "gemini-2.5-pro",
            contents: [
              { role: 'user', parts: [ { text: systemPrompt } ] },
              { role: 'user', parts: [ { text: context } ] }
            ],
            config: {
              responseJsonSchema: zodToJSONSchema(ScenesOnlySchema),
              responseMimeType: "application/json",
            }
          });
          const content = response.text;
          if (!content) throw new Error("No content generated from LLM");

          const cleanedContent = cleanJsonOutput(content);
          batchResult = JSON.parse(cleanedContent);
          success = true;
          await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (error: any) {
          if (error.status === 429 || (error.message && error.message.includes("429"))) {
            retries++;
            const waitTime = Math.pow(2, retries) * RETRY_WAIT_TIME;
            console.warn(`   ⚠️ Rate limit hit (429) on batch ${batchNum}. Retrying in ${waitTime / 1000}s... (Attempt ${retries}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.error(`   ❌ Error processing batch ${batchNum}:`, error);
            throw error; // Rethrow for non-retriable errors
          }
        }
      }

      if (!success || !batchResult) {
        throw new Error(`Failed to process batch ${batchNum} after ${MAX_RETRIES} retries.`);
      }

      enrichedScenes.push(...batchResult.scenes);
    }

    const finalStoryboard: Storyboard = {
      ...initialContext,
      scenes: enrichedScenes,
      metadata: {
        ...initialContext.metadata,
        totalScenes: storyboard.scenes.length,
        duration: storyboard.scenes.length > 0 ? storyboard.scenes[ storyboard.scenes.length - 1 ].endTime : 0,
      },
    };

    this.validateTimingPreservation(storyboard.scenes, finalStoryboard.scenes);

    const storyboardPath = this.storageManager.getGcsObjectPath("storyboard");
    await this.storageManager.uploadJSON(finalStoryboard, storyboardPath);

    console.log(`✓ Storyboard enriched successfully:`);
    console.log(`  - Title: ${finalStoryboard.metadata.title || "Untitled"}`);
    console.log(`  - Duration: ${finalStoryboard.metadata.duration}`);
    console.log(`  - Total Scenes: ${finalStoryboard.metadata.totalScenes}`);
    console.log(`  - Characters: ${finalStoryboard.characters.length}`);
    console.log(`  - Locations: ${finalStoryboard.locations.length}`);

    return finalStoryboard;
  }

  private async _generateInitialContext(creativePrompt: string, scenes: Scene[], { MAX_RETRIES = 3, RETRY_WAIT_TIME = 10000 }): Promise<Storyboard> {
    console.log("   ... Generating initial context (metadata, characters, locations)...");

    const InitialContextSchema = z.object({
      metadata: StoryboardSchema.shape.metadata,
      characters: StoryboardSchema.shape.characters,
      locations: StoryboardSchema.shape.locations,
    });

    const jsonSchema = zodToJSONSchema(InitialContextSchema);
    const systemPrompt = buildStoryboardEnrichmentInstructions({ isFirstBatch: true, batchNum: 0, totalBatches: 0 }, jsonSchema);

    // Provide a snippet of scenes for context, without overwhelming the model
    const sceneSnippet = scenes.slice(0, 5).map(s => ({
      description: s.description,
      lyrics: s.lyrics,
      mood: s.mood
    }));

    const context = `
      ESTABLISHED CONTEXT:
      CREATIVE PROMPT:
      ${creativePrompt}

      SCENE SNIPPET FOR CONTEXT:
      ${JSON.stringify(sceneSnippet, null, 2)}
    `;

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const response = await this.llm.models.generateContent({
          model: "gemini-2.5-pro",
          contents: [
            { role: 'user', parts: [ { text: systemPrompt } ] },
            { role: 'user', parts: [ { text: context } ] }
          ],
          config: {
            responseJsonSchema: zodToJSONSchema(InitialContextSchema),
            responseMimeType: "application/json",
          }
        });
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

      } catch (error: any) {
        if (error.status === 429 || (error.message && error.message.includes("429"))) {
          retries++;
          const waitTime = Math.pow(2, retries) * RETRY_WAIT_TIME;
          console.warn(`   ⚠️ Rate limit hit (429) on initial context generation. Retrying in ${waitTime / 1000}s... (Attempt ${retries}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          console.error(`   ❌ Error generating initial context:`, error);
          throw error;
        }
      }
    }
    throw new Error(`Failed to generate initial context after ${MAX_RETRIES} retries.`);
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
}
