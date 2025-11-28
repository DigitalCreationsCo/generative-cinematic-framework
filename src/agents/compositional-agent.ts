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

export class CompositionalAgent {
  private llm: GoogleGenAI;
  private storageManager: GCPStorageManager;

  constructor(llm: GoogleGenAI, storageManager: GCPStorageManager) {
    this.llm = llm;
    this.storageManager = storageManager;
  }

  async enhanceStoryboard(storyboard: Storyboard, creativePrompt: string): Promise<Storyboard> {
    console.log("   ... Enriching scene template with narrative from creative prompt...");
    
    const BATCH_SIZE = 10;
    let enrichedScenes: Scene[] = [];

    let storyboardMetadata = {} as Storyboard['metadata'];
    let characters: Character[] = [];
    let locations: Location[] = [];

    const ScenesOnlySchema = z.object({
        scenes: z.array(SceneSchema)
    });

    for (let i = 0; i < storyboard.scenes.length; i += BATCH_SIZE) {
      const chunk = storyboard.scenes.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(storyboard.scenes.length / BATCH_SIZE);
      console.log(`   ... Processing batch ${batchNum}/${totalBatches} (${chunk.length} scenes)...`);
        
      const isFirstBatch = i === 0;

      const systemPrompt = `You are an expert cinematic director and storyboard artist.
      Your task is to analyze a creative prompt and generate a complete, professional storyboard that synchronizes visual storytelling with musical structure.
        
        You are processing BATCH ${batchNum} of ${totalBatches}.
        
        ${isFirstBatch ? 
        `Your task is to:
        1. Define the global metadata, characters, and locations based on the creative prompt.
        2. Enrich the provided scenes with visual details.` : 
        `Your task is to enrich the provided scenes, maintaining consistency with the established characters, locations, and narrative flow.`}

        **PRESERVING MUSICAL STRUCTURE:**
        - Keep ALL scene timings EXACTLY as provided (timeStart, timeEnd, duration)
        - Keep musicDescription, musicalChange, musicalIntensity, musicalMood, musicalTempo
        - Keep transitionType
        - Keep audioSync

        **ENRICHING WITH NARRATIVE:**
        - Replace placeholder descriptions with vivid visual storytelling from the creative prompt
        - Assign appropriate shotType, cameraMovement, lighting, mood
        - Add continuityNotes
        - Assign charactersPresent (from established list)
        - Assign locationId (from established list)

        **NARRATIVE FLOW:**
        - Ensure smooth transition from previous scenes.
        - Match visual intensity to musical intensity.

        ${!isFirstBatch ? `**ESTABLISHED CONTEXT:**
        - Title: ${storyboardMetadata?.title || "Untitled"}
        - Characters: ${(characters || []).map(c => c.name).join(", ")}
        - Locations: ${(locations || []).map(l => l.name).join(", ")}` : ''}

        Return a JSON object matching the schema.`;

        let context = `CREATIVE PROMPT:\n${creativePrompt}\n\n`;
        if (i > 0 && enrichedScenes.length > 0) {
            const lastScene = enrichedScenes[enrichedScenes.length - 1];
            context += `PREVIOUS SCENE CONTEXT:\n`;
            context += `Last Scene ID: ${lastScene.id}\n`;
            context += `Last Scene Time: ${lastScene.timeEnd}\n`;
            context += `Last Scene Description: ${lastScene.description}\n\n`;
        }
        context += `SCENES TO ENRICH (Batch ${batchNum}):\n${JSON.stringify(chunk, null, 2)}`;

        const schema = isFirstBatch ? StoryboardSchema : ScenesOnlySchema;
        const jsonSchema = zodToJSONSchema(schema);

        const llmParams = {
            model: "gemini-2.5-pro",
            contents: [
                { role: 'user', parts: [ { text: systemPrompt } ] },
                { role: 'user', parts: [ { text: context } ] }
            ],
            config: {
                responseJsonSchema: jsonSchema,
                responseMimeType: "application/json",
                temperature: 0.8, 
            }
        };

        let retries = 0;
        const MAX_RETRIES = 3;
        let success = false;

        while (!success && retries < MAX_RETRIES) {
            try {
                const response = await this.llm.models.generateContent(llmParams);
                const content = response.text;

                if (!content) {
                    throw new Error("No content generated from LLM");
                }

                const cleanedContent = cleanJsonOutput(content);
                const result:Storyboard = JSON.parse(cleanedContent);

            if (isFirstBatch) {
                storyboardMetadata = result.metadata || {};
                characters = result.characters || [];
                locations = result.locations || [];
                enrichedScenes.push(...(result.scenes || []));
            } else {
                enrichedScenes.push(...(result.scenes || []));
            }
                
                success = true;
                await new Promise(resolve => setTimeout(resolve, 5000));

            } catch (error: any) {
                if (error.status === 429 || (error.message && error.message.includes("429"))) {
                    retries++;
                    const waitTime = Math.pow(2, retries) * 10000; // 20s, 40s, 80s
                    console.warn(`   ⚠️ Rate limit hit (429) on batch ${batchNum}. Retrying in ${waitTime/1000}s... (Attempt ${retries}/${MAX_RETRIES})`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    console.error(`   ❌ Error processing batch ${batchNum}:`, error);
                    throw error;
                }
            }
        }
        
        if (!success) {
            throw new Error(`Failed to process batch ${batchNum} after ${MAX_RETRIES} retries.`);
        }
    }

    storyboard = {
      metadata: {
        ...storyboardMetadata,
        totalScenes: storyboard.scenes.length,
        duration: storyboard.scenes[ storyboard.scenes.length - 1].timeEnd 
      },
      characters,
      locations,
      scenes: enrichedScenes
    };

    this.validateTimingPreservation(storyboard.scenes, storyboard.scenes);

    const storyboardPath = this.storageManager.getGcsObjectPath("storyboard");
    await this.storageManager.uploadJSON(storyboard, storyboardPath);

    console.log(`✓ Storyboard enriched successfully:`);
    console.log(`  - Title: ${storyboard.metadata.title || "Untitled"}`);
    console.log(`  - Duration: ${storyboard.metadata.duration}`);
    console.log(`  - Total Scenes: ${storyboard.metadata.totalScenes}`);
    console.log(`  - Characters: ${storyboard.characters.length}`);
    console.log(`  - Locations: ${storyboard.locations.length}`);
    console.log(`  - Key Moments: ${storyboard.metadata.keyMoments?.length || 0}`);

    return storyboard;
  }

  private validateTimingPreservation(originalScenes: Scene[], enrichedScenes: Scene[]): void {
    if (originalScenes.length !== enrichedScenes.length) {
      console.warn(`⚠️ Scene count mismatch: original=${originalScenes.length}, enriched=${enrichedScenes.length}`);
    }

    for (let i = 0; i < Math.min(originalScenes.length, enrichedScenes.length); i++) {
      const orig = originalScenes[ i ];
      const enrich = enrichedScenes[ i ];

      if (orig.timeStart !== enrich.timeStart || orig.timeEnd !== enrich.timeEnd) {
        console.warn(`⚠️ Timing mismatch in scene ${i + 1}: original=[${orig.timeStart}-${orig.timeEnd}], enriched=[${enrich.timeStart}-${enrich.timeEnd}]`);
      }

      if (orig.duration !== enrich.duration) {
        console.warn(`⚠️ Duration mismatch in scene ${i + 1}: original=${orig.duration}s, enriched=${enrich.duration}s`);
      }
    }
  }
}
