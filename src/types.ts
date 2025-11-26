import { z } from "zod";

export const zodToJSONSchema = (schema: z.core.$ZodType) => z.toJSONSchema(schema);

export const CharacterSchema = z.object({
  id: z.string().describe("unique identifier for the character (e.g. char_1)"),
  name: z.string().describe("character name"),
  description: z.string().describe("detailed physical description"),
  referenceImageUrl: z.string().describe("URL to a reference image for the character (optional)").optional(),
  physicalTraits: z.object({
    hair: z.string().describe("specific hairstyle, color, length"),
    clothing: z.string().describe("specific outfit description"),
    accessories: z.array(z.string()).describe("list of accessories"),
    distinctiveFeatures: z.array(z.string()).describe("list of distinctive features"),
  }),
  appearanceNotes: z.array(z.string()).describe("additional notes on appearance"),
});
export type Character = z.infer<typeof CharacterSchema>;

export const SceneSchema = z.object({
  id: z.number().describe("unique numeric identifier for the scene"),
  timeStart: z.string().describe("start time in MM:SS format"),
  timeEnd: z.string().describe("end time in MM:SS format"),
  duration: z.union([z.literal(4), z.literal(6), z.literal(8)]).describe("duration in seconds (4, 6, or 8)"),
  shotType: z.string().describe("camera shot type (e.g., wide, medium, close-up)"),
  description: z.string().describe("detailed scene description"),
  cameraMovement: z.string().describe("camera movement description (e.g., static, pan, dolly)"),
  lighting: z.string().describe("lighting description"),
  mood: z.string().describe("emotional tone of the scene"),
  audioSync: z.string().describe("how visuals sync with audio"),
  continuityNotes: z.array(z.string()).describe("notes for maintaining continuity"),
  charactersPresent: z.array(z.string()).describe("list of character IDs present in the scene"),
  locationId: z.string().describe("ID of the location"),
  enhancedPrompt: z.string().optional().describe("enhanced prompt for video generation"),
  generatedVideoUrl: z.string().optional().describe("URL of the generated video"),
  lastFrameUrl: z.string().optional().describe("URL of the last frame"),
});
export type Scene = z.infer<typeof SceneSchema>;

export const KeyMomentSchema = z.object({
  timeStart: z.string().describe("start time in MM:SS format"),
  timeEnd: z.string().describe("end time in MM:SS format"),
  description: z.string().describe("what happens in this key moment"),
  importance: z.enum([ "critical", "high", "medium" ]).describe("importance level"),
  visualPriority: z.string().describe("specific visual direction for this moment"),
});
export type KeyMoment = z.infer<typeof KeyMomentSchema>;

export const VideoMetadataSchema = z.object({
  title: z.string().describe("title of the video"),
  duration: z.string().describe("total duration in MM:SS format"),
  totalScenes: z.number().describe("total number of scenes"),
  style: z.string().describe("inferred cinematic style"),
  mood: z.string().describe("overall emotional arc"),
  colorPalette: z.array(z.string()).describe("list of colors in the palette"),
  tags: z.array(z.string()).describe("list of descriptive tags"),
  keyMoments: z.array(KeyMomentSchema).describe("list of key moments"),
});
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export const LocationSchema = z.object({
  id: z.string().describe("unique identifier for the location (e.g., loc_1)"),
  name: z.string().describe("location name"),
  description: z.string().describe("detailed location description"),
  lightingConditions: z.string().describe("lighting conditions"),
  timeOfDay: z.string().describe("time of day"),
});
export type Location = z.infer<typeof LocationSchema>;

export const StoryboardSchema = z.object({
  metadata: VideoMetadataSchema,
  characters: z.array(CharacterSchema),
  locations: z.array(LocationSchema),
  scenes: z.array(SceneSchema),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

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
  renderedVideoUrl: z.string().optional(),
  errors: z.array(z.string()),
});
export type GraphState = z.infer<typeof GraphStateSchema>;
