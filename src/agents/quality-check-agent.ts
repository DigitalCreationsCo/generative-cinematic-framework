// ============================================================================import { GoogleGenAI } from "@google/genai";
import { Scene, Character, QualityEvaluation, PromptCorrection, QualityConfig } from "../types";
import { GCPStorageManager } from "../storage-manager";
import { buildEvaluationPrompt } from "../prompts/evaluation-instruction";
import { buildllmParams } from "../llm/google/llm-params";
import { buildCorrectionPrompt } from "../prompts/correction-instruction";
import { LlmWrapper } from "../llm";

export class QualityCheckAgent {
  private llm: LlmWrapper;
  private storageManager: GCPStorageManager;
  qualityConfig: Readonly<QualityConfig>;
    
  constructor(
    llm: LlmWrapper,
    storageManager: GCPStorageManager,
    qualityConfig?: Partial<QualityConfig>,
  ) {
    this.llm = llm;
    this.storageManager = storageManager;
    this.qualityConfig = {
      enabled: true,
      acceptThreshold: 0.85,
      minorIssueThreshold: 0.70,
      majorIssueThreshold: 0.50,
      failThreshold: 0.50,
      maxRetries: 3,
      safetyRetries: 2,
      ...qualityConfig
    };
  }

  /**
   * Perform comprehensive quality check on generated video
   */
  async evaluateScene(
    scene: Scene,
    generatedVideoUrl: string,
    enhancedPrompt: string,
    characters: Character[],
    previousScene?: Scene
  ): Promise<QualityEvaluation> {
    
    console.log(`\n🔍 Quality Check: Scene ${scene.id}`);

    const evaluationPrompt = buildEvaluationPrompt(
      scene,
      generatedVideoUrl,
      enhancedPrompt,
      characters,
      previousScene
    );

    try {
      
      const response = await this.llm.generateContent(buildllmParams({
        contents: [
          {
            role: "user",
            parts: [
              { text: evaluationPrompt },
              {
                fileData: {
                  fileUri: generatedVideoUrl,
                  mimeType: await this.storageManager.getObjectMimeType(generatedVideoUrl)
                }
              }
            ]
          }
        ],
        config: {
          temperature: 0.3,
        }
      }));

      if (!response.text) throw new Error("No quality evaluation generated from LLM from Quality Check Agent");

      const evaluation = JSON.parse(response.text) as QualityEvaluation;
      
      const overallScore = this.calculateOverallScore(evaluation.scores);
      evaluation.overall = this.determineOverallRating(overallScore);

      this.logEvaluationResults(scene.id, evaluation, overallScore);

      await this.saveEvaluation(scene.id, evaluation);

      return evaluation;

    } catch (error) {
      console.error(`   ✗ Quality check failed for scene ${scene.id}:`, error);
      
      return {
        overall: "ACCEPT_WITH_NOTES",
        scores: this.getDefaultScores(),
        issues: [{
          category: "system",
          severity: "minor",
          description: "Quality check system unavailable",
          suggestedFix: "Manual review recommended"
        }],
        feedback: "Quality check unavailable - defaulting to acceptance"
      };
    }
  }

  /**
   * Apply prompt corrections and regenerate enhanced prompt
   */
  async applyPromptCorrections(
    originalPrompt: string,
    corrections: PromptCorrection[],
    scene: Scene,
    characters: Character[]
  ): Promise<string> {
    
    console.log(`   🔧 Applying ${corrections.length} prompt corrections...`);

    const correctionPrompt = buildCorrectionPrompt(originalPrompt, scene, corrections);

    try {
      const response = await this.llm.generateContent(buildllmParams({
        contents: [{ role: "user", parts: [{ text: correctionPrompt }] }],
        config: { temperature: 0.5 }
      }));

      if (!response.text) throw new Error("No correction prompt generated from LLM from Quality Check Agent");

      const correctedPrompt = response.text.trim();
      
      console.log(`   ✓ Prompt corrected: ${originalPrompt.length} → ${correctedPrompt.length} chars`);
      
      return correctedPrompt;

    } catch (error) {
      console.error("   ✗ Failed to apply prompt corrections:", error);
      return originalPrompt; // Fallback to original
    }
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverallScore(scores: QualityEvaluation["scores"]): number {
    const ratingToScore = {
      "PASS": 1.0,
      "MINOR_ISSUES": 0.7,
      "MAJOR_ISSUES": 0.4,
      "FAIL": 0.0
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.values(scores).forEach(score => {
      totalScore += ratingToScore[score.rating] * score.weight;
      totalWeight += score.weight;
    });

    return totalScore / totalWeight;
  }

  /**
   * Determine overall rating from score
   */
  private determineOverallRating(score: number): QualityEvaluation["overall"] {
    if (score >= this.qualityConfig.acceptThreshold) return "ACCEPT";
    if (score >= this.qualityConfig.minorIssueThreshold) return "ACCEPT_WITH_NOTES";
    if (score >= this.qualityConfig.majorIssueThreshold) return "REGENERATE_MINOR";
    return "REGENERATE_MAJOR";
  }

  /**
   * Apply quality corrections to prompt.
   */
  async applyQualityCorrections(
    currentPrompt: string,
    evaluation: QualityEvaluation,
    scene: Scene,
    characters: Character[],
    attempt: number
  ): Promise<string> {

    if (!evaluation.promptCorrections || evaluation.promptCorrections.length === 0) {
      console.log(`   🔄 Attempt ${attempt + 1}: Retrying with original prompt`);
      return currentPrompt;
    }

    console.log(`   🔧 Attempt ${attempt + 1}: Applying ${evaluation.promptCorrections.length} corrections`);

    const correctedPrompt = await this.applyPromptCorrections(
      currentPrompt,
      evaluation.promptCorrections,
      scene,
      characters
    );

    return correctedPrompt;
  }

  /**
   * Internal: Log attempt result concisely.
   */
  private logAttemptResult(attempt: number, score: number, rating: string): void {
    const scorePercent = (score * 100).toFixed(1);
    const icon = score >= this.qualityConfig.acceptThreshold ? '✓' : '⚠';
    console.log(`   ${icon} Attempt ${attempt}: ${scorePercent}% (${rating})`);
  }
  
  /**
   * Log evaluation results
   */
  private logEvaluationResults(
    sceneId: number,
    evaluation: QualityEvaluation,
    overallScore: number
  ): void {
    const scorePercentage = (overallScore * 100).toFixed(1);
    
    console.log(`   Overall Rating: ${evaluation.overall} (${scorePercentage}%)`);
    
    Object.entries(evaluation.scores).forEach(([category, score]) => {
      const icon = score.rating === "PASS" ? "✓" : 
                   score.rating === "MINOR_ISSUES" ? "⚠" : "✗";
      console.log(`     ${icon} ${category}: ${score.rating}`);
    });

    if (evaluation.issues.length > 0) {
      console.log(`   Issues found: ${evaluation.issues.length}`);
      evaluation.issues.forEach((issue, i) => {
        console.log(`     ${i + 1}. [${issue.severity}] ${issue.description}`);
      });
    }
  }

  /**
   * Save evaluation to storage for audit trail
   */
  private async saveEvaluation(
    sceneId: number,
    evaluation: QualityEvaluation
  ): Promise<void> {
    const evaluationPath = this.storageManager.getGcsObjectPath(
      "quality_evaluation",
      { sceneId }
    );
    
    await this.storageManager.uploadJSON(evaluation, evaluationPath);
  }

  /**
   * Get default passing scores (fallback)
   */
  private getDefaultScores(): QualityEvaluation["scores"] {
    return {
      narrativeFidelity: { rating: "PASS", weight: 0.30, details: "Not evaluated" },
      characterConsistency: { rating: "PASS", weight: 0.25, details: "Not evaluated" },
      technicalQuality: { rating: "PASS", weight: 0.20, details: "Not evaluated" },
      emotionalAuthenticity: { rating: "PASS", weight: 0.15, details: "Not evaluated" },
      continuity: { rating: "PASS", weight: 0.10, details: "Not evaluated" }
    };
  }
}