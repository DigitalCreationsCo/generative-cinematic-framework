"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphStateSchema = exports.ContinuityContextSchema = exports.LocationStateSchema = exports.CharacterStateSchema = exports.StoryboardSchema = exports.LocationSchema = exports.VideoMetadataSchema = exports.KeyMomentSchema = exports.SceneSchema = exports.CharacterSchema = exports.zodToJSONSchema = void 0;
const zod_1 = require("zod");
const zodToJSONSchema = (schema) => zod_1.z.toJSONSchema(schema);
exports.zodToJSONSchema = zodToJSONSchema;
exports.CharacterSchema = zod_1.z.object({
    id: zod_1.z.string().describe("unique identifier for the character (e.g. char_1)"),
    name: zod_1.z.string().describe("character name"),
    description: zod_1.z.string().describe("detailed physical description"),
    referenceImageUrl: zod_1.z.string().describe("URL to a reference image for the character (optional)").optional(),
    physicalTraits: zod_1.z.object({
        hair: zod_1.z.string().describe("specific hairstyle, color, length"),
        clothing: zod_1.z.string().describe("specific outfit description"),
        accessories: zod_1.z.array(zod_1.z.string()).describe("list of accessories"),
        distinctiveFeatures: zod_1.z.array(zod_1.z.string()).describe("list of distinctive features"),
    }),
    appearanceNotes: zod_1.z.array(zod_1.z.string()).describe("additional notes on appearance"),
});
exports.SceneSchema = zod_1.z.object({
    id: zod_1.z.number().describe("unique numeric identifier for the scene"),
    timeStart: zod_1.z.string().describe("start time in MM:SS format"),
    timeEnd: zod_1.z.string().describe("end time in MM:SS format"),
    duration: zod_1.z.union([zod_1.z.literal(4), zod_1.z.literal(6), zod_1.z.literal(8)]).describe("duration in seconds (4, 6, or 8)"),
    shotType: zod_1.z.string().describe("camera shot type (e.g., wide, medium, close-up)"),
    description: zod_1.z.string().describe("detailed scene description"),
    cameraMovement: zod_1.z.string().describe("camera movement description (e.g., static, pan, dolly)"),
    lighting: zod_1.z.string().describe("lighting description"),
    mood: zod_1.z.string().describe("emotional tone of the scene"),
    audioSync: zod_1.z.string().describe("how visuals sync with audio"),
    continuityNotes: zod_1.z.array(zod_1.z.string()).describe("notes for maintaining continuity"),
    charactersPresent: zod_1.z.array(zod_1.z.string()).describe("list of character IDs present in the scene"),
    locationId: zod_1.z.string().describe("ID of the location"),
    enhancedPrompt: zod_1.z.string().optional().describe("enhanced prompt for video generation"),
    generatedVideoUrl: zod_1.z.string().optional().describe("URL of the generated video"),
    lastFrameUrl: zod_1.z.string().optional().describe("URL of the last frame"),
});
exports.KeyMomentSchema = zod_1.z.object({
    timeStart: zod_1.z.string().describe("start time in MM:SS format"),
    timeEnd: zod_1.z.string().describe("end time in MM:SS format"),
    description: zod_1.z.string().describe("what happens in this key moment"),
    importance: zod_1.z.enum(["critical", "high", "medium"]).describe("importance level"),
    visualPriority: zod_1.z.string().describe("specific visual direction for this moment"),
});
exports.VideoMetadataSchema = zod_1.z.object({
    title: zod_1.z.string().describe("title of the video"),
    duration: zod_1.z.string().describe("total duration in MM:SS format"),
    totalScenes: zod_1.z.number().describe("total number of scenes"),
    style: zod_1.z.string().describe("inferred cinematic style"),
    mood: zod_1.z.string().describe("overall emotional arc"),
    colorPalette: zod_1.z.array(zod_1.z.string()).describe("list of colors in the palette"),
    tags: zod_1.z.array(zod_1.z.string()).describe("list of descriptive tags"),
    keyMoments: zod_1.z.array(exports.KeyMomentSchema).describe("list of key moments"),
});
exports.LocationSchema = zod_1.z.object({
    id: zod_1.z.string().describe("unique identifier for the location (e.g., loc_1)"),
    name: zod_1.z.string().describe("location name"),
    description: zod_1.z.string().describe("detailed location description"),
    lightingConditions: zod_1.z.string().describe("lighting conditions"),
    timeOfDay: zod_1.z.string().describe("time of day"),
});
exports.StoryboardSchema = zod_1.z.object({
    metadata: exports.VideoMetadataSchema,
    characters: zod_1.z.array(exports.CharacterSchema),
    locations: zod_1.z.array(exports.LocationSchema),
    scenes: zod_1.z.array(exports.SceneSchema),
});
exports.CharacterStateSchema = zod_1.z.object({
    lastSeen: zod_1.z.number(),
    currentAppearance: zod_1.z.object({
        hair: zod_1.z.string(),
        clothing: zod_1.z.string(),
        accessories: zod_1.z.array(zod_1.z.string()),
    }),
    position: zod_1.z.string(),
    emotionalState: zod_1.z.string(),
});
exports.LocationStateSchema = zod_1.z.object({
    lastUsed: zod_1.z.number(),
    lighting: zod_1.z.string(),
    weather: zod_1.z.string(),
    timeOfDay: zod_1.z.string(),
});
exports.ContinuityContextSchema = zod_1.z.object({
    previousScene: exports.SceneSchema.optional(),
    characterStates: zod_1.z.map(zod_1.z.string(), exports.CharacterStateSchema),
    locationStates: zod_1.z.map(zod_1.z.string(), exports.LocationStateSchema),
});
exports.GraphStateSchema = zod_1.z.object({
    initialPrompt: zod_1.z.string(),
    storyboard: exports.StoryboardSchema.optional(),
    currentSceneIndex: zod_1.z.number(),
    generatedScenes: zod_1.z.array(exports.SceneSchema),
    characters: zod_1.z.array(exports.CharacterSchema),
    continuityContext: exports.ContinuityContextSchema,
    renderedVideoUrl: zod_1.z.string().optional(),
    errors: zod_1.z.array(zod_1.z.string()),
});
//# sourceMappingURL=types.js.map