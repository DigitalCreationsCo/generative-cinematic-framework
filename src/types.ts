import { z } from "zod";

export const zodToJSONSchema = (schema: z.ZodType) => {
  return schema as any; // Type assertion for compatibility
};

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
// SCENE SCHEMAS
// ============================================================================

export const SceneSchema = z.object({
  id: z.number().describe("unique numeric identifier for the scene"),
  timeStart: z.string().describe("start time in MM:SS format"),
  timeEnd: z.string().describe("end time in MM:SS format"),
  duration: z.union([ z.literal(4), z.literal(6), z.literal(8) ]).describe("duration in seconds (4, 6, or 8)"),
  shotType: z.string().describe("camera shot type (e.g., wide, medium, close-up, POV, over-the-shoulder)"),
  description: z.string().describe("detailed scene description with narrative and visual elements"),

  // Musical Analysis Fields (from AudioProcessingAgent)
  musicDescription: z.string().describe("detailed description of the musical soundscape, instruments, patterns").optional(),
  musicalChange: z.string().describe("notable musical changes: tempo shifts, key changes, instrumentation changes").optional(),
  musicalIntensity: z.enum([ "low", "medium", "high", "extreme" ]).describe("energy level of the music").optional(),
  musicalMood: z.string().describe("emotional tone of the music (e.g., aggressive, melancholic, triumphant)").optional(),
  musicalTempo: z.enum([ "slow", "moderate", "fast", "very_fast" ]).describe("pace of the music").optional(),
  transitionType: z.string().describe("cinematic transition type (e.g., Cut, Dissolve, Fade, Smash Cut, Wipe)").optional(),

  // Cinematic Fields (from CompositionalAgent)
  cameraMovement: z.string().describe("camera movement description (e.g., static, pan, dolly, handheld, crane, drone)"),
  lighting: z.string().describe("lighting description (e.g., harsh, soft, dramatic, natural, colored gels)"),
  mood: z.string().describe("overall emotional tone of the scene combining music and narrative"),
  audioSync: z.string().describe("how visuals sync with audio (e.g., Lip Sync, Mood Sync, Beat Sync)"),

  // Continuity Fields
  continuityNotes: z.array(z.string()).describe("notes for maintaining continuity across scenes"),
  charactersPresent: z.array(z.string()).describe("list of character IDs present in the scene"),
  locationId: z.string().describe("ID of the location where scene takes place"),

  // Generation Fields
  enhancedPrompt: z.string().optional().describe("enhanced prompt for video generation with continuity details"),
  generatedVideoUrl: z.string().optional().describe("GCS URL of the generated video"),
  lastFrameUrl: z.string().optional().describe("GCS URL of the last frame extracted from video"),
});
export type Scene = z.infer<typeof SceneSchema>;

// ============================================================================
// METADATA SCHEMAS
// ============================================================================

export const KeyMomentSchema = z.object({
  timeStart: z.string().describe("start time in MM:SS format"),
  timeEnd: z.string().describe("end time in MM:SS format"),
  description: z.string().describe("what happens in this key moment"),
  importance: z.enum([ "critical", "high", "medium" ]).describe("importance level of this moment"),
  visualPriority: z.string().describe("specific visual direction for this moment"),
  musicalSignificance: z.string().optional().describe("why this moment is musically significant"),
});
export type KeyMoment = z.infer<typeof KeyMomentSchema>;

export const VideoMetadataSchema = z.object({
  title: z.string().describe("title of the video"),
  duration: z.string().describe("total duration in MM:SS format"),
  totalScenes: z.number().describe("total number of scenes"),
  style: z.string().describe("inferred cinematic style (e.g., 'High-energy progressive metal music video')"),
  mood: z.string().describe("overall emotional arc across the entire video"),
  colorPalette: z.array(z.string()).describe("list of dominant colors in the palette"),
  tags: z.array(z.string()).describe("list of descriptive tags"),
  keyMoments: z.array(KeyMomentSchema).describe("list of key moments in the video"),
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
  characterStates: z.map(z.string(), CharacterStateSchema).describe("map of character ID to current state"),
  locationStates: z.map(z.string(), LocationStateSchema).describe("map of location ID to current state"),
});
export type ContinuityContext = z.infer<typeof ContinuityContextSchema>;

// ============================================================================
// GRAPH STATE (for LangGraph workflow)
// ============================================================================

export const GraphStateSchema = z.object({
  initialPrompt: z.string().describe("path to the audio file to process"),
  creativePrompt: z.string().optional().describe("user's creative prompt with narrative, characters, settings"),
  audioGcsUri: z.string().optional().describe("GCS URI of uploaded audio file"),
  storyboard: StoryboardSchema.optional().describe("complete storyboard with all scenes"),
  currentSceneIndex: z.number().describe("index of the scene currently being processed"),
  generatedScenes: z.array(SceneSchema).describe("list of scenes that have been generated"),
  characters: z.array(CharacterSchema).describe("list of characters with reference images"),
  continuityContext: ContinuityContextSchema.describe("tracking state for continuity across scenes"),
  renderedVideoUrl: z.string().optional().describe("GCS URL of final stitched video"),
  errors: z.array(z.string()).describe("list of errors encountered during workflow"),
});
export type GraphState = z.infer<typeof GraphStateSchema>;

// ============================================================================
// AUDIO ANALYSIS SCHEMAS (Internal to AudioProcessingAgent)
// ============================================================================

export const AudioSegmentSchema = z.object({
  start_time: z.number().describe("Start time in seconds"),
  end_time: z.number().describe("End time in seconds"),
  type: z.enum([ "lyrical", "instrumental", "transition", "breakdown", "solo", "climax" ]),
  lyrics: z.string().describe("Transcribed lyrics if lyrical, empty otherwise"),
  musicalDescription: z.string().describe("Detailed description of the sound, instruments, tempo, mood"),
  intensity: z.enum([ "low", "medium", "high", "extreme" ]).describe("Energy level of this segment"),
  mood: z.string().describe("Emotional tone (e.g., aggressive, melancholic, triumphant, mysterious"),
  tempo: z.enum([ "slow", "moderate", "fast", "very_fast" ]).describe("Pace of the music"),
  musicalChange: z.string().describe("Notable changes: key signature, tempo shift, instrumentation changes, dynamic shifts"),
  transitionType: z.enum([ "smooth", "sudden", "buildup", "breakdown", "none" ]).describe("How this segment transitions to the next"),
});
export type AudioSegment = z.infer<typeof AudioSegmentSchema>;

export const AudioAnalysisSchema = z.object({
  totalDuration: z.number().describe("Total duration of the track in seconds"),
  segments: z.array(AudioSegmentSchema).describe("list of analyzed musical segments"),
});
export type AudioAnalysis = z.infer<typeof AudioAnalysisSchema>;

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