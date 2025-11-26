"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositionalAgent = void 0;
const types_1 = require("../types");
const llm_params_1 = require("../llm-params");
const utils_1 = require("../utils");
// ============================================================================
// COMPOSITIONAL AGENT
// ============================================================================
class CompositionalAgent {
    llm;
    storageManager;
    constructor(llm, storageManager) {
        this.llm = llm;
        this.storageManager = storageManager;
    }
    async generateStoryboard(initialPrompt) {
        const jsonSchema = (0, types_1.zodToJSONSchema)(types_1.StoryboardSchema);
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

Examples of inference:
- "Progressive metal band" → Style: "High-energy progressive metal with technical instrumentation"
- "lighting changes from white to violet to red" → ColorPalette: ["White", "Violet", "Red"]
- "00:00 - 00:18 explosive opening" → KeyMoment: {timeStart: "00:00", timeEnd: "00:18", description: "Explosive opening with driving guitar riffs"}`;
        const llmParams = (0, llm_params_1.buildllmParams)({
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
        const cleanedContent = (0, utils_1.cleanJsonOutput)(content);
        const storyboard = JSON.parse(cleanedContent);
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
exports.CompositionalAgent = CompositionalAgent;
//# sourceMappingURL=compositional-agent.js.map