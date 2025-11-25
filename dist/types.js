"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphStateSchema = exports.ContinuityContextSchema = exports.LocationStateSchema = exports.CharacterStateSchema = exports.StoryboardSchema = exports.LocationSchema = exports.VideoMetadataSchema = exports.SceneSchema = exports.CharacterSchema = void 0;
var zod_1 = require("zod");
// ============================================================================
// CHARACTER SCHEMA
// ============================================================================
exports.CharacterSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    referenceImageUrl: zod_1.z.string(),
    physicalTraits: zod_1.z.object({
        hair: zod_1.z.string(),
        clothing: zod_1.z.string(),
        accessories: zod_1.z.array(zod_1.z.string()),
        distinctiveFeatures: zod_1.z.array(zod_1.z.string()),
    }),
    appearanceNotes: zod_1.z.array(zod_1.z.string()),
});
// ============================================================================
// SCENE SCHEMA
// ============================================================================
exports.SceneSchema = zod_1.z.object({
    id: zod_1.z.number(),
    timeStart: zod_1.z.string(),
    timeEnd: zod_1.z.string(),
    duration: zod_1.z.number(),
    shotType: zod_1.z.string(),
    description: zod_1.z.string(),
    cameraMovement: zod_1.z.string(),
    lighting: zod_1.z.string(),
    mood: zod_1.z.string(),
    audioSync: zod_1.z.string(),
    continuityNotes: zod_1.z.array(zod_1.z.string()),
    charactersPresent: zod_1.z.array(zod_1.z.string()),
    locationId: zod_1.z.string(),
    enhancedPrompt: zod_1.z.string().optional(),
    generatedVideoUrl: zod_1.z.string().optional(),
    lastFrameUrl: zod_1.z.string().optional(),
});
// ============================================================================
// VIDEO METADATA SCHEMA
// ============================================================================
exports.VideoMetadataSchema = zod_1.z.object({
    title: zod_1.z.string(),
    duration: zod_1.z.string(),
    totalScenes: zod_1.z.number(),
    style: zod_1.z.string(),
    colorPalette: zod_1.z.array(zod_1.z.string()),
    tags: zod_1.z.array(zod_1.z.string()),
    keyMoments: zod_1.z.array(zod_1.z.object({
        timeStart: zod_1.z.string(),
        timeEnd: zod_1.z.string(),
        description: zod_1.z.string(),
        importance: zod_1.z.enum(["critical", "high", "medium"]),
        visualPriority: zod_1.z.string(),
    }))
});
// ============================================================================
// LOCATION SCHEMA
// ============================================================================
exports.LocationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    lightingConditions: zod_1.z.string(),
    timeOfDay: zod_1.z.string(),
});
// ============================================================================
// STORYBOARD SCHEMA
// =_=_==========================================================================
exports.StoryboardSchema = zod_1.z.object({
    metadata: exports.VideoMetadataSchema,
    characters: zod_1.z.array(exports.CharacterSchema),
    locations: zod_1.z.array(exports.LocationSchema),
    scenes: zod_1.z.array(exports.SceneSchema),
});
// ============================================================================
// STATE SCHEMAS
// ============================================================================
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
    errors: zod_1.z.array(zod_1.z.string()),
});
