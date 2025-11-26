"use strict";
// ============================================================================
// CINEMATIC VIDEO FRAMEWORK - TypeScript Implementation
// Google Vertex AI + LangGraph + GCP Storage
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const ffprobe_1 = __importDefault(require("@ffprobe-installer/ffprobe"));
// Configure ffmpeg paths
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_1.default.path);
const genai_1 = require("@google/genai");
const langgraph_1 = require("@langchain/langgraph");
const scene_generator_1 = require("./agents/scene-generator");
const compositional_agent_1 = require("./agents/compositional-agent");
const continuity_manager_1 = require("./agents/continuity-manager");
const storage_manager_1 = require("./storage.manager");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
class CinematicVideoWorkflow {
    graph;
    compositionalAgent;
    continuityAgent;
    sceneAgent;
    storageManager;
    projectId;
    videoId;
    SCENE_GEN_TIMEOUT_MS = 30000;
    constructor(projectId, videoId, bucketName, location = "us-east1") {
        const llm = new genai_1.GoogleGenAI({
            vertexai: true,
            project: projectId
        });
        this.projectId = projectId;
        this.videoId = videoId;
        this.storageManager = new storage_manager_1.GCPStorageManager(projectId, videoId, bucketName);
        this.compositionalAgent = new compositional_agent_1.CompositionalAgent(llm, this.storageManager);
        this.continuityAgent = new continuity_manager_1.ContinuityManagerAgent(llm, llm, this.storageManager);
        this.sceneAgent = new scene_generator_1.SceneGeneratorAgent(llm, llm, this.storageManager);
        this.graph = this.buildGraph();
    }
    buildGraph() {
        const workflow = new langgraph_1.StateGraph({
            channels: {
                initialPrompt: null,
                storyboard: null,
                currentSceneIndex: null,
                generatedScenes: null,
                characters: null,
                continuityContext: null,
                errors: null,
            },
        });
        workflow.addNode("generate_storyboard", async (state) => {
            console.log("\n📋 PHASE 1: Generating Storyboard...");
            const storyboard = await this.compositionalAgent.generateStoryboard(state.initialPrompt);
            return {
                ...state,
                storyboard,
                currentSceneIndex: 0,
                generatedScenes: [],
                continuityContext: {
                    characterStates: new Map(),
                    locationStates: new Map(),
                },
            };
        });
        workflow.addNode("generate_character_refs", async (state) => {
            if (!state.storyboard)
                throw new Error("No storyboard available");
            console.log("\n🎨 PHASE 2: Generating Character References...");
            const characters = await this.continuityAgent.generateCharacterReferences(state.storyboard.characters);
            return {
                ...state,
                characters,
            };
        });
        workflow.addNode("process_scene", async (state) => {
            if (!state.storyboard || !state.characters) {
                throw new Error("Missing storyboard or characters");
            }
            const scene = state.storyboard.scenes[state.currentSceneIndex];
            console.log(`\n🎬 PHASE 3: Processing Scene ${scene.id}/${state.storyboard.scenes.length}`);
            const enhancedPrompt = await this.continuityAgent.enhanceScenePrompt(scene, state.characters, state.continuityContext);
            const previousFrameUrl = state.continuityContext.previousScene?.lastFrameUrl;
            const generatedScene = await this.sceneAgent.generateScene(scene, enhancedPrompt, previousFrameUrl);
            console.log(`   ... waiting ${this.SCENE_GEN_TIMEOUT_MS / 1000}s for rate limit reset`);
            await new Promise(resolve => setTimeout(resolve, this.SCENE_GEN_TIMEOUT_MS));
            const updatedContext = this.continuityAgent.updateContinuityContext(generatedScene, state.continuityContext, state.characters);
            return {
                ...state,
                generatedScenes: [...state.generatedScenes, generatedScene],
                currentSceneIndex: state.currentSceneIndex + 1,
                continuityContext: updatedContext,
            };
        });
        workflow.addNode("render_video", async (state) => {
            console.log("\n🎥 PHASE 4: Rendering Final Video...");
            const videoPaths = state.generatedScenes
                .map(s => s.generatedVideoUrl)
                .filter((url) => !!url);
            if (videoPaths.length === 0) {
                console.warn("   No videos to stitch.");
                return state;
            }
            try {
                const renderedVideoUrl = await this.sceneAgent.stitchScenes(videoPaths);
                return {
                    ...state,
                    renderedVideoUrl
                };
            }
            catch (error) {
                console.error("   Failed to render video:", error);
                return {
                    ...state,
                    errors: [...state.errors, `Video rendering failed: ${error}`]
                };
            }
        });
        workflow.addNode("finalize", async (state) => {
            console.log("\n✅ PHASE 4: Finalizing Video...");
            console.log(`   Total scenes generated: ${state.generatedScenes.length}`);
            const outputPath = this.storageManager.getGcsObjectPath("final_output");
            await this.storageManager.uploadJSON({
                storyboard: state.storyboard,
                characters: state.characters,
                generatedScenes: state.generatedScenes,
            }, outputPath);
            console.log(`\n🎉 Video generation complete!`);
            console.log(`   Output saved to: ${outputPath}`);
            return state;
        });
        workflow.addEdge(langgraph_1.START, "generate_storyboard");
        workflow.addEdge("generate_storyboard", "generate_character_refs");
        workflow.addEdge("generate_character_refs", "process_scene");
        workflow.addConditionalEdges("process_scene", (state) => {
            if (!state.storyboard)
                return "finalize";
            if (state.currentSceneIndex >= state.storyboard.scenes.length) {
                return "render_video";
            }
            return "process_scene";
        });
        workflow.addEdge("render_video", "finalize");
        workflow.addEdge("finalize", langgraph_1.END);
        return workflow;
    }
    async execute(initialPrompt) {
        const compiledGraph = this.graph.compile();
        const initialState = {
            initialPrompt,
            currentSceneIndex: 0,
            generatedScenes: [],
            characters: [],
            continuityContext: {
                characterStates: new Map(),
                locationStates: new Map(),
            },
            errors: [],
        };
        console.log("🚀 Starting Cinematic Video Generation Workflow");
        console.log("=".repeat(60));
        const result = await compiledGraph.invoke(initialState);
        return result;
    }
}
// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
    const projectId = process.env.GCP_PROJECT_ID || "your-project-id";
    const bucketName = process.env.GCP_BUCKET_NAME || "your-bucket-name";
    const videoId = `video_${Date.now()}`;
    const workflow = new CinematicVideoWorkflow(projectId, videoId, bucketName);
    const initialPrompt = `
Create a full-length music video featuring cinematic shots interlaced with a live musical performance. 
Dynamically switch between cinematic shots and band performance shots.
`;
    const testingPrompt = `
Create a short proof of concept video with exactly 5 scenes.
Theme: A journey through a futuristic city.
Style: Cyberpunk, neon lights, rain.
`;
    try {
        const result = await workflow.execute(testingPrompt);
        console.log("\n" + "=".repeat(60));
        console.log("✅ Workflow completed successfully!");
        console.log(`   Generated ${result.generatedScenes.length} scenes`);
    }
    catch (error) {
        console.error("\n❌ Workflow failed:", error);
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=index.js.map