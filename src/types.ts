import { z } from "zod";

// ============================================================================
// CHARACTER SCHEMA
// ============================================================================
export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  referenceImageUrl: z.string(),
  physicalTraits: z.object({
    hair: z.string(),
    clothing: z.string(),
    accessories: z.array(z.string()),
    distinctiveFeatures: z.array(z.string()),
  }),
  appearanceNotes: z.array(z.string()),
});
export type Character = z.infer<typeof CharacterSchema>;

// ============================================================================
// SCENE SCHEMA
// ============================================================================
export const SceneSchema = z.object({
  id: z.number(),
  timeStart: z.string(),
  timeEnd: z.string(),
  duration: z.number(),
  shotType: z.string(),
  description: z.string(),
  cameraMovement: z.string(),
  lighting: z.string(),
  mood: z.string(),
  audioSync: z.string(),
  continuityNotes: z.array(z.string()),
  charactersPresent: z.array(z.string()),
  locationId: z.string(),
  enhancedPrompt: z.string().optional(),
  generatedVideoUrl: z.string().optional(),
  lastFrameUrl: z.string().optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

// ============================================================================
// VIDEO METADATA SCHEMA
// ============================================================================
export const VideoMetadataSchema = z.object({
  title: z.string(),
  duration: z.string(),
  totalScenes: z.number(),
  style: z.string(),
  colorPalette: z.array(z.string()),
  tags: z.array(z.string()),
  keyMoments: z.array(
    z.object({
      timeStart: z.string(),
      timeEnd: z.string(),
      description: z.string(),
      importance: z.enum([ "critical", "high", "medium" ]),
      visualPriority: z.string(),
    })
  )
});
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

// ============================================================================
// LOCATION SCHEMA
// ============================================================================
export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  lightingConditions: z.string(),
  timeOfDay: z.string(),
});
export type Location = z.infer<typeof LocationSchema>;

// ============================================================================
// STORYBOARD SCHEMA
// =_=_==========================================================================
export const StoryboardSchema = z.object({
  metadata: VideoMetadataSchema,
  characters: z.array(CharacterSchema),
  locations: z.array(LocationSchema),
  scenes: z.array(SceneSchema),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

// ============================================================================
// STATE SCHEMAS
// ============================================================================
export const CharacterStateSchema = z.object({
  lastSeen: z.number(),
  currentAppearance: z.object({
    hair: z.string(),
    clothing: z.string(),
    accessories: z.array(z.string()),
  }),
  position: z.string(),
  emotionalState: z.string(),
});
export type CharacterState = z.infer<typeof CharacterStateSchema>;

export const LocationStateSchema = z.object({
  lastUsed: z.number(),
  lighting: z.string(),
  weather: z.string(),
  timeOfDay: z.string(),
});
export type LocationState = z.infer<typeof LocationStateSchema>;

export const ContinuityContextSchema = z.object({
  previousScene: SceneSchema.optional(),
  characterStates: z.map(z.string(), CharacterStateSchema),
  locationStates: z.map(z.string(), LocationStateSchema),
});
export type ContinuityContext = z.infer<typeof ContinuityContextSchema>;

export const GraphStateSchema = z.object({
  initialPrompt: z.string(),
  storyboard: StoryboardSchema.optional(),
  currentSceneIndex: z.number(),
  generatedScenes: z.array(SceneSchema),
  characters: z.array(CharacterSchema),
  continuityContext: ContinuityContextSchema,
  errors: z.array(z.string()),
});
export type GraphState = z.infer<typeof GraphStateSchema>;
