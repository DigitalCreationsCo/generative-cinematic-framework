"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanJsonOutput = cleanJsonOutput;
/**
 * Cleans the LLM output to extract the JSON string.
 * It removes markdown code blocks and extracts the JSON object.
 *
 * @param output - The raw string output from the LLM.
 * @returns The cleaned JSON string.
 */
function cleanJsonOutput(output) {
    // Remove markdown code blocks
    let clean = output.replace(/```json\n?|```/g, "");
    // Find the first '{' and the last '}' to extract the JSON object
    const firstOpen = clean.indexOf("{");
    const lastClose = clean.lastIndexOf("}");
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    return clean;
}
//# sourceMappingURL=utils.js.map