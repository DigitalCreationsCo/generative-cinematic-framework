import { Character } from "./types";

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

/**
 * Format character specifications for prompt
 */
export function formatCharacterSpecs(characterIds: string[], characters: Character[]): string {
    if (characterIds.length === 0) return "No characters in this scene.";

    return characterIds
      .map(id => {
        const char = characters.find(c => c.id === id);
        if (!char) return `${id}: [Character not found]`;

        return `${char.name} (${char.id}):
  - Hair: ${char.physicalTraits.hair}
  - Clothing: ${char.physicalTraits.clothing}
  - Accessories: ${char.physicalTraits.accessories.join(", ")}
  - Reference: ${char.referenceImageUrls?.[0] || "None"}`;
      })
      .join("\n\n");
  }

/**
 * Calculates learning trends using linear regression.
 * @param metrics - Array of scene generation metrics.
 * @returns An object with trend analysis.
 */
export function calculateLearningTrends(metrics: { attempts: number; finalScore: number }[]): {
  averageAttempts: number;
  attemptTrendSlope: number;
  qualityTrendSlope: number;
} {
  const n = metrics.length;
  if (n < 2) {
    return {
      averageAttempts: metrics.reduce((acc, m) => acc + m.attempts, 0) / (n || 1),
      attemptTrendSlope: 0,
      qualityTrendSlope: 0,
    };
  }

  let sumX = 0, sumY_a = 0, sumY_q = 0, sumXY_a = 0, sumXY_q = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y_a = metrics[i].attempts;
    const y_q = metrics[i].finalScore;

    sumX += x;
    sumY_a += y_a;
    sumY_q += y_q;
    sumXY_a += x * y_a;
    sumXY_q += x * y_q;
    sumX2 += x * x;
  }

  const avgAttempts = sumY_a / n;
  
  const slope_a = (n * sumXY_a - sumX * sumY_a) / (n * sumX2 - sumX * sumX);
  const slope_q = (n * sumXY_q - sumX * sumY_q) / (n * sumX2 - sumX * sumX);

  return {
    averageAttempts: avgAttempts,
    attemptTrendSlope: isNaN(slope_a) ? 0 : slope_a,
    qualityTrendSlope: isNaN(slope_q) ? 0 : slope_q,
  };
}
