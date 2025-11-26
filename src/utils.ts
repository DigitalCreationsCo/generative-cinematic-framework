/**
 * Cleans markdown code block syntax from a string, specifically designed for JSON output from LLMs.
 * Removes ```json (or just ```) from the start and ``` from the end.
 * 
 * @param text The text to clean
 * @returns The cleaned string
 */
export function cleanJsonOutput(text: string): string {
    let clean = text.trim();
    
    // Remove starting ```json or ```
    if (clean.startsWith("```json")) {
        clean = clean.substring(7);
    } else if (clean.startsWith("```")) {
        clean = clean.substring(3);
    }
    
    // Remove ending ```
    if (clean.endsWith("```")) {
        clean = clean.substring(0, clean.length - 3);
    }
    
    return clean.trim();
}

/**
 * Helper to safely parse JSON that might be wrapped in markdown code blocks
 */
export function safeJsonParse<T>(text: string): T {
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            // Try cleaning first
            const cleaned = cleanJsonOutput(text);
            return JSON.parse(cleaned);
        } catch (e2) {
            // Try finding JSON object with regex
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    // LLMs sometimes produce JSON with trailing commas, which is invalid.
                    const cleanedJson = match[0].replace(/,(?=\s*?[\]\}])/g, '');
                    return JSON.parse(cleanedJson);
                } catch (e3) {
                    throw new Error(`Failed to parse JSON even after extraction and cleaning: ${e3}`);
                }
            }
            throw new Error(`Failed to parse JSON: ${e}`);
        }
    }
}
