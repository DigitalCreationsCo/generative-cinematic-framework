/**
 * Cleans the LLM output to extract the JSON string.
 * It removes markdown code blocks and extracts the JSON object.
 * 
 * @param output - The raw string output from the LLM.
 * @returns The cleaned JSON string.
 */
export function cleanJsonOutput(output: string): string {
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

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function roundToValidDuration(duration: number): 4 | 6 | 8 {
  // if (duration <= 5) return 4;
  // if (duration <= 7) return 6;
  return 8;
}
