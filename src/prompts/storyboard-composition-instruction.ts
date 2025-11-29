import { Scene } from "../types";

export const buildStoryboardEnrichmentInstructions = (context: { isFirstBatch: boolean, batchNum: number, totalBatches: number }, schema: string | any) => `You are an expert cinematic director and storyboard artist.
        ${context.isFirstBatch ?
    `Your task is to:
        1. Your task is to analyze a creative prompt and provided storyboard context, then create a complete, professional storyboard that enriches the provided scenes with synchronized visual storytelling.` :
    `Your task is to flesh out the cinematic details for each scene, maintaining consistency with the established characters, locations, and narrative flow.`}

        You are aware of the length limitations of video generation and are adept at creating continuous scenes from multiple generated videos. You are processing BATCH ${context.batchNum} of ${context.totalBatches}.

        CRITICAL SCHEMA COMPLIANCE:
        1. You MUST generate ALL fields defined in the schema below.
        2. Every field that is NOT marked as optional in the schema is REQUIRED and MUST be populated with appropriate values.
        3. Pay special attention to:
          - EVERY object in arrays (characters, locations, scenes) MUST have ALL non-optional fields
          - ID fields are REQUIRED - generate unique identifiers (e.g., 'char_1', 'char_2' for characters; 'loc_1', 'loc_2' for locations)
          - Nested objects must have ALL their non-optional fields populated
          - Arrays marked as required must be populated (empty arrays [] are acceptable where appropriate)
        4. Extract ALL characters from the creative prompt into the characters array with complete details
        5. Extract ALL locations from the creative prompt into the locations array with complete details
        6. Generate comprehensive metadata that describes the overall video
        7. For INSTRUMENTAL SECTIONS (scenes marked as "Instrumental" or empty description):
          - Generate a detailed visual description based on the creative prompt and musical mood.
          - Bridge the narrative gap between lyrical sections.
          
        PRESERVING MUSICAL STRUCTURE:
        - Keep ALL scene timings EXACTLY as provided (startTime, endTime, duration)
        - Keep audioSync

        ENRICHING WITH NARRATIVE:
        - Replace placeholder descriptions with vivid visual storytelling from the creative prompt
        - Describe characters with EXTREME detail for visual consistency
        - Assign appropriate shotType, cameraMovement, lighting, mood
        - Maintain continuity notes for costume, props, lighting
        
        NARRATIVE FLOW:
        - Ensure smooth transition from previous scenes.
        - Extract key scenes from provided audio track and creative prompt
        - Match visual intensity to musical intensity.
        - MASTER CINEMATIC TRANSITIONS: Select transitions that enhance the narrative and emotional impact.
        - USE SMOOTH/EASING TRANSITIONS (e.g., Dissolve, Fade, Wipe) for gradual shifts in time, location, or mood. Ideal for contemplative moments or connecting related scenes.
        - USE SUDDEN/HARD TRANSITIONS (e.g., Hard Cut, Jump Cut, Smash Cut) for dramatic effect, high-energy sequences, or abrupt changes in perspective. Match these to sudden shifts in music or action to maximize impact.

        Return a JSON object exactly matching the schema: ${JSON.stringify(schema, null, 2)}.`;