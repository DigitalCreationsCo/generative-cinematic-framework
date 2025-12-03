import { z } from "zod";

export const zodToJSONSchema = (schema: z.ZodType) => z.toJSONSchema(schema);

// ============================================================================
// CHARACTER SCHEMAS
// ============================================================================

export const CharacterSchema = z.object({
  id: z.string().describe("unique identifier for the character (e.g. char_1)"),
  name: z.string().describe("character name"),
  aliases: z.array(z.string()).describe("list of aliases for the character").default([]),
  description: z.string().describe("detailed physical description"),
  referenceImageUrls: z.array(z.string()).describe("URLs to reference images for the character").optional(),
  physicalTraits: z.object({
    hair: z.string().describe("specific hairstyle, color, length"),
    clothing: z.string().describe("specific outfit description"),
    accessories: z.array(z.string()).describe("list of accessories"),
    distinctiveFeatures: z.array(z.string()).describe("list of distinctive features"),
  }),
  appearanceNotes: z.array(z.string()).describe("additional notes on appearance"),
});
export type Character = z.infer<typeof CharacterSchema>;

export const CharacterStateSchema = z.object({
  lastSeen: z.number().describe("scene ID where character was last seen"),
  currentAppearance: z.object({
    hair: z.string(),
    clothing: z.string(),
    accessories: z.array(z.string()),
  }),
  position: z.string().describe("character's spatial position in scene"),
  emotionalState: z.string().describe("character's current emotional state"),
});
export type CharacterState = z.infer<typeof CharacterStateSchema>;

export const CastListSchema = z.object({
  characters: z.array(CharacterSchema),
});
export type CastList = z.infer<typeof CastListSchema>;

// ============================================================================
// LOCATION SCHEMAS
// ============================================================================

export const LocationSchema = z.object({
  id: z.string().describe("unique identifier for the location (e.g., loc_1)"),
  name: z.string().describe("location name"),
  description: z.string().describe("detailed location description"),
  lightingConditions: z.string().describe("lighting conditions"),
  timeOfDay: z.string().describe("time of day"),
  referenceImageUrls: z.array(z.string()).describe("URLs to reference images for the location").optional(),
});
export type Location = z.infer<typeof LocationSchema>;

export const LocationStateSchema = z.object({
  lastUsed: z.number().describe("scene ID where location was last used"),
  lighting: z.string().describe("current lighting state"),
  weather: z.string().describe("current weather conditions"),
  timeOfDay: z.string().describe("current time of day"),
});
export type LocationState = z.infer<typeof LocationStateSchema>;

// ============================================================================
// AUDIO ANALYSIS SCHEMAS (Internal to AudioProcessingAgent)
// ============================================================================

export const AudioSegmentSchema = z.object({
  startTime: z.number().describe("start time in seconds"),
  endTime: z.number().describe("end time in seconds"),
  duration: z.union([ z.literal(4), z.literal(6), z.literal(8) ]).describe("Duration in seconds (4, 6, or 8)"),
  type: z.enum([ "lyrical", "instrumental", "transition", "breakdown", "solo", "climax" ]),
  lyrics: z.string().describe("Transcribed lyrics if lyrical, empty otherwise"),
  description: z.string().describe("Detailed description of the sound, instruments, tempo, mood"),
  musicChange: z.string().describe("Notable changes: key signature, tempo shift, instrumentation changes, dynamic shifts"),
  intensity: z.enum([ "low", "medium", "high", "extreme" ]).describe("Energy level of this segment"),
  mood: z.string().describe("Emotional tone (e.g., aggressive, melancholic, triumphant, mysterious"),
  tempo: z.enum([ "slow", "moderate", "fast", "very_fast" ]).describe("Pace of the music"),
  transitionType: z.string().describe("cinematic transition type (e.g., Cut, Dissolve, Fade, Smash Cut, Wipe)"),
});
export type AudioSegment = z.infer<typeof AudioSegmentSchema>;

export const AudioAnalysisSchema = z.object({
  totalDuration: z.number().describe("Total duration of the track in seconds"),
  segments: z.array(AudioSegmentSchema).describe("list of analyzed musical segments"),
});
export type AudioAnalysis = z.infer<typeof AudioAnalysisSchema> & {
  audioGcsUri: string;
};

// ============================================================================
// SCENE SCHEMAS
// ============================================================================

export const SceneSchema = z.intersection(
  AudioSegmentSchema,
  z.object({
    id: z.number().describe("unique numeric identifier for the scene"),
    shotType: z.string().describe("camera shot type (e.g., wide, medium, close-up, POV, over-the-shoulder)"),
    description: z.string().describe("Detailed description of the scene's music and narrative elements"),

    // Cinematic Fields (from CompositionalAgent)
    cameraMovement: z.string().describe("camera movement description (e.g., static, pan, dolly, handheld, crane, drone)"),
    lighting: z.string().describe("lighting description (e.g., harsh, soft, dramatic, natural, colored gels)"),
    mood: z.string().describe("overall emotional tone of the scene combining music and narrative"),
    audioSync: z.string().describe("how visuals sync with audio (e.g., Lip Sync, Mood Sync, Beat Sync)"),

    // Continuity Fields
    continuityNotes: z.array(z.string()).describe("notes for maintaining continuity across scenes"),
    characters: z.array(z.string()).describe("list of character IDs present in the scene").default([]),
    locationId: z.string().describe("ID of the location where scene takes place"),

    // Generation Fields
    enhancedPrompt: z.string().optional().describe("enhanced prompt for video generation with continuity details"),
    generatedVideoUrl: z.string().optional().describe("GCS URL of the generated video"),
    lastFrameUrl: z.string().optional().describe("GCS URL of the last frame extracted from video"),
    evaluation: z.lazy(() => QualityEvaluationSchema).optional().describe("Quality evaluation result for the scene"),
  }));
export type Scene = z.infer<typeof SceneSchema>;

// ============================================================================
// METADATA SCHEMAS
// ============================================================================

export const VideoMetadataSchema = z.object({
  title: z.string().describe("title of the video"),
  duration: z.number().describe("total duration in seconds"),
  totalScenes: z.number().describe("total number of scenes"),
  style: z.string().describe("inferred cinematic style (e.g., 'High-energy progressive metal music video')"),
  mood: z.string().describe("overall emotional arc across the entire video"),
  colorPalette: z.array(z.string()).describe("list of dominant colors in the palette"),
  tags: z.array(z.string()).describe("list of descriptive tags"),
});
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

// ============================================================================
// STORYBOARD SCHEMA
// ============================================================================

export const StoryboardSchema = z.object({
  metadata: VideoMetadataSchema,
  characters: z.array(CharacterSchema),
  locations: z.array(LocationSchema),
  scenes: z.array(SceneSchema),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

// ============================================================================
// CONTINUITY CONTEXT
// ============================================================================

export const ContinuityContextSchema = z.object({
  previousScene: SceneSchema.optional(),
  characters: z.map(z.string(), CharacterStateSchema).describe("map of character ID to current state"),
  locations: z.map(z.string(), LocationStateSchema).describe("map of location ID to current state"),
});
export type ContinuityContext = z.infer<typeof ContinuityContextSchema>;

// ============================================================================
// GRAPH STATE (for LangGraph workflow)
// ============================================================================

export const GraphStateSchema = z.object({
  initialPrompt: z.string().describe("path to the audio file to process (optional)"),
  creativePrompt: z.string().optional().describe("user's creative prompt with narrative, characters, settings"),
  audioGcsUri: z.string().optional().describe("GCS URI of uploaded audio file (optional)"),
  hasAudio: z.boolean().default(false).describe("whether this workflow uses audio"),
  storyboard: StoryboardSchema.optional().describe("complete storyboard with all scenes"),
  currentSceneIndex: z.number().describe("index of the scene currently being processed"),
  generatedScenes: z.array(SceneSchema).describe("list of scenes that have been generated"),
  characters: z.array(CharacterSchema).describe("list of characters with reference images"),
  locations: z.array(LocationSchema).describe("list of locations with reference images"),
  continuityContext: ContinuityContextSchema.describe("tracking state for continuity across scenes"),
  renderedVideoUrl: z.string().optional().describe("GCS URL of final stitched video"),
  errors: z.array(z.string()).describe("list of errors encountered during workflow"),
  generationRules: z.array(z.string()).optional().describe("raw, unfiltered list of generation rule suggestions"),
  refinedRules: z.array(z.string()).optional().describe("consolidated, actionable list of generation rules"),
});
export type GraphState = z.infer<typeof GraphStateSchema>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface SceneGenerationInput {
  scene: Scene;
  enhancedPrompt: string;
  startFrameUrl?: string;
}

export interface ContinuityCheck {
  characterConsistency: boolean;
  locationConsistency: boolean;
  timingConsistency: boolean;
  issues: string[];
}

export interface VideoGenerationConfig {
  resolution: "480p" | "720p" | "1080p";
  durationSeconds: 4 | 6 | 8;
  numberOfVideos: number;
  personGeneration: "ALLOW_ALL" | "DONT_ALLOW";
  generateAudio: boolean;
  negativePrompt?: string;
}

export type GeneratedScene = Scene & {
  enhancedPrompt: string;
  generatedVideoUrl: string;
  lastFrameUrl?: string | undefined;
};

export interface SceneGenerationResult {
  scene: GeneratedScene;
  attempts: number;
  finalScore: number;
  evaluation: QualityEvaluation | null;
  warning?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isValidDuration(duration: number): duration is 4 | 6 | 8 {
  return duration === 4 || duration === 6 || duration === 8;
}

export function isLyricalScene(scene: Scene): boolean {
  return scene.audioSync === "Lip Sync" || (scene.description && !scene.description.includes("[Instrumental") || false);
}

export function isInstrumentalScene(scene: Scene): boolean {
  return scene.audioSync === "Mood Sync" || scene.description?.includes("[Instrumental") || false;
}

export function requiresTransition(scene: Scene): boolean {
  return scene.transitionType !== "Cut" && scene.transitionType !== "none";
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const VALID_DURATIONS = [ 4, 6, 8 ] as const;
export type ValidDuration = typeof VALID_DURATIONS[ number ];

export const TRANSITION_TYPES = [
  "Cut",
  "Hard Cut",
  "Jump Cut",
  "Smash Cut",
  "Dissolve",
  "Cross Fade",
  "Fade",
  "Fade to Black",
  "Wipe",
  "Iris In",
  "Iris Out",
  "Push",
  "Slide",
] as const;
export type TransitionType = typeof TRANSITION_TYPES[ number ];

export const SHOT_TYPES = [
  "Extreme Wide Shot",
  "Wide Shot",
  "Medium Shot",
  "Close-up",
  "Extreme Close-up",
  "POV",
  "Over-the-Shoulder",
  "Two Shot",
  "Dutch Angle",
  "Bird's Eye View",
  "Low Angle",
  "High Angle",
] as const;
export type ShotType = typeof SHOT_TYPES[ number ];

export const CAMERA_MOVEMENTS = [
  "Static",
  "Pan Left",
  "Pan Right",
  "Tilt Up",
  "Tilt Down",
  "Dolly In",
  "Dolly Out",
  "Track Left",
  "Track Right",
  "Crane Up",
  "Crane Down",
  "Handheld",
  "Steadicam",
  "Drone Flyover",
  "Orbit",
  "Zoom In",
  "Zoom Out",
] as const;
export type CameraMovement = typeof CAMERA_MOVEMENTS[ number ];

// ============================================================================
// QUALITY EVALUATION SCHEMAS
// ============================================================================

export const QualityScoreSchema = z.object({
  rating: z.enum([ "PASS", "MINOR_ISSUES", "MAJOR_ISSUES", "FAIL" ]),
  weight: z.number(),
  details: z.string(),
});
export type QualityScore = z.infer<typeof QualityScoreSchema>;

export const QualityIssueSchema = z.object({
  category: z.string(),
  severity: z.enum([ "critical", "major", "minor" ]),
  description: z.string(),
  videoTimestamp: z.string().optional(),
  suggestedFix: z.string(),
});
export type QualityIssue = z.infer<typeof QualityIssueSchema>;

export const PromptCorrectionSchema = z.object({
  issueType: z.string(),
  originalPromptSection: z.string(),
  correctedPromptSection: z.string(),
  reasoning: z.string(),
});
export type PromptCorrection = z.infer<typeof PromptCorrectionSchema>;

export const QualityEvaluationSchema = z.object({
  overall: z.enum([ "ACCEPT", "ACCEPT_WITH_NOTES", "REGENERATE_MINOR", "REGENERATE_MAJOR", "FAIL" ]),
  scores: z.object({
    narrativeFidelity: QualityScoreSchema,
    characterConsistency: QualityScoreSchema,
    technicalQuality: QualityScoreSchema,
    emotionalAuthenticity: QualityScoreSchema,
    continuity: QualityScoreSchema,
  }),
  issues: z.array(QualityIssueSchema),
  feedback: z.string(),
  promptCorrections: z.array(PromptCorrectionSchema).optional(),
  ruleSuggestion: z.string().optional(),
});
export type QualityEvaluation = z.infer<typeof QualityEvaluationSchema>;

export interface QualityConfig {
  enabled: boolean;
  acceptThreshold: number;
  minorIssueThreshold: number;
  majorIssueThreshold: number;
  failThreshold: number;
  maxRetries: number;
  safetyRetries: number;
}
