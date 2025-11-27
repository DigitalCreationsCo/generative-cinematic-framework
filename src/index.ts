// ============================================================================
// CINEMATIC VIDEO FRAMEWORK - TypeScript Implementation
// Google Vertex AI + LangGraph + GCP Storage
// ============================================================================

import ffmpeg from "fluent-ffmpeg";
import ffmpegBin from "@ffmpeg-installer/ffmpeg";
import ffprobeBin from "@ffprobe-installer/ffprobe";

ffmpeg.setFfmpegPath(ffmpegBin.path);
ffmpeg.setFfprobePath(ffprobeBin.path);

import { GoogleGenAI } from "@google/genai";
import { StateGraph, END, START } from "@langchain/langgraph";
import {
  Character,
  Scene,
  Storyboard,
  ContinuityContext,
  GraphState,
} from "./types";
import { SceneGeneratorAgent } from "./agents/scene-generator";
import { CompositionalAgent } from "./agents/compositional-agent";
import { ContinuityManagerAgent } from "./agents/continuity-manager";
import { GCPStorageManager } from "./storage-manager";
import { FrameCompositionAgent } from "./agents/frame-composition-agent";
import { AudioProcessingAgent } from "./agents/audio-processing-agent";

import * as dotenv from "dotenv";
dotenv.config();

const LOCAL_AUDIO_PATH = "Blind_Melon_-_Make_a_Difference.mp3";

class CinematicVideoWorkflow {
  private graph: StateGraph<GraphState>;
  private compositionalAgent: CompositionalAgent;
  private continuityAgent: ContinuityManagerAgent;
  private sceneAgent: SceneGeneratorAgent;
  private storageManager: GCPStorageManager;
  private frameCompositionAgent: FrameCompositionAgent;
  private audioProcessingAgent: AudioProcessingAgent;
  private projectId: string;
  private videoId: string;
  private SCENE_GEN_TIMEOUT_MS = 30000;

  constructor(
    projectId: string,
    videoId: string,
    bucketName: string,
    location: string = "us-east1",
  ) {

    const llm = new GoogleGenAI({
      vertexai: true,
      project: projectId
    });

    this.projectId = projectId;
    this.videoId = videoId;
    this.storageManager = new GCPStorageManager(projectId, videoId, bucketName);

    this.audioProcessingAgent = new AudioProcessingAgent(this.storageManager, llm);
    this.compositionalAgent = new CompositionalAgent(llm, this.storageManager);
    this.frameCompositionAgent = new FrameCompositionAgent(llm, this.storageManager);
    this.continuityAgent = new ContinuityManagerAgent(
      llm,
      llm,
      this.storageManager,
      this.frameCompositionAgent
    );
    this.sceneAgent = new SceneGeneratorAgent(llm, llm, this.storageManager);

    this.graph = this.buildGraph();
  }

  private buildGraph(): StateGraph<GraphState> {
    const workflow = new StateGraph<GraphState>({
      channels: {
        initialPrompt: null,
        creativePrompt: null,
        audioGcsUri: null,
        storyboard: null,
        currentSceneIndex: null,
        generatedScenes: null,
        characters: null,
        continuityContext: null,
        renderedVideoUrl: null,
        errors: null,
      },
    });

    workflow.addNode("create_timed_scenes_from_audio", async (state: GraphState) => {
      console.log("\n📋 PHASE 1a: Creating Timed Scenes from Audio...");
      const { scenes, audioGcsUri } = await this.audioProcessingAgent.processAudioToStoryboard(
        state.initialPrompt, 
      );

      return {
        ...state,
        storyboard: { scenes } as Storyboard, 
        audioGcsUri,
      };
    });

    workflow.addNode("enhance_storyboard_with_prompt", async (state: GraphState) => {
        if (!state.storyboard || !state.storyboard.scenes) throw new Error("No timed scenes available");
        if (!state.creativePrompt) throw new Error("No creative prompt available");
        console.log("\n📋 PHASE 1b: Enhancing Storyboard with Prompt...");
        const storyboard = await this.compositionalAgent.enhanceStoryboard(
            state.storyboard.scenes,
            state.creativePrompt
        );

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

    workflow.addNode("generate_character_refs", async (state: GraphState) => {
      if (!state.storyboard) throw new Error("No storyboard available");

      console.log("\n🎨 PHASE 2: Generating Character References...");
      const characters = await this.continuityAgent.generateCharacterReferences(
        state.storyboard.characters,
      );

      return {
        ...state,
        characters,
      };
    });

    workflow.addNode("process_scene", async (state: GraphState) => {
      if (!state.storyboard || !state.characters) {
        throw new Error("Missing storyboard or characters");
      }

      const scene = state.storyboard.scenes[ state.currentSceneIndex ];
      console.log(
        `\n🎬 PHASE 3: Processing Scene ${scene.id}/${state.storyboard.scenes.length}`
      );

      const { enhancedPrompt, startFrameUrl } = await this.continuityAgent.prepareSceneInputs(
        scene,
        state.characters,
        state.continuityContext,
        { characters: state.characters }
      );

      const generatedScene = await this.sceneAgent.generateScene(
        scene,
        enhancedPrompt,
        startFrameUrl
      );

      console.log(`   ... waiting ${this.SCENE_GEN_TIMEOUT_MS / 1000}s for rate limit reset`);
      await new Promise(resolve => setTimeout(resolve, this.SCENE_GEN_TIMEOUT_MS));

      const updatedContext = this.continuityAgent.updateContinuityContext(
        generatedScene,
        state.continuityContext,
        state.characters
      );

      return {
        ...state,
        generatedScenes: [ ...state.generatedScenes, generatedScene ],
        currentSceneIndex: state.currentSceneIndex + 1,
        continuityContext: updatedContext,
      };
    });

    workflow.addNode("render_video", async (state: GraphState) => {
      console.log("\n🎥 PHASE 4: Rendering Final Video...");
      
      const videoPaths = state.generatedScenes
        .map(s => s.generatedVideoUrl)
        .filter((url): url is string => !!url);

      if (videoPaths.length === 0) {
        console.warn("   No videos to stitch.");
        return state;
      }

      if (!state.audioGcsUri) {
        throw new Error("No audio GCS URI available to stitch.");
      }

      try {
        const renderedVideoUrl = await this.sceneAgent.stitchScenes(videoPaths, state.audioGcsUri);
        return {
          ...state,
          renderedVideoUrl
        };
      } catch (error) {
        console.error("   Failed to render video:", error);
        return {
          ...state,
          errors: [...state.errors, `Video rendering failed: ${error}`]
        };
      }
    });

    workflow.addNode("finalize", async (state: GraphState) => {
      console.log("\n✅ PHASE 4: Finalizing Video...");
      console.log(`   Total scenes generated: ${state.generatedScenes.length}`);

      const outputPath = this.storageManager.getGcsObjectPath("final_output");
      await this.storageManager.uploadJSON(
        {
          storyboard: state.storyboard,
          characters: state.characters,
          generatedScenes: state.generatedScenes,
        },
        outputPath
      );

      console.log(`\n🎉 Video generation complete!`);
      console.log(`   Output saved to: ${outputPath}`);

      return state;
    });

    workflow.addEdge(START, "create_timed_scenes_from_audio" as any);
    workflow.addEdge("create_timed_scenes_from_audio" as any, "enhance_storyboard_with_prompt" as any);
    workflow.addEdge("enhance_storyboard_with_prompt" as any, "generate_character_refs" as any);
    workflow.addEdge("generate_character_refs" as any, "process_scene" as any);

    workflow.addConditionalEdges("process_scene" as any, (state: GraphState) => {
      if (!state.storyboard) return "finalize";
      if (state.currentSceneIndex >= state.storyboard.scenes.length) {
        return "render_video";
      }
      return "process_scene";
    });

    workflow.addEdge("render_video" as any, "finalize" as any);
    workflow.addEdge("finalize" as any, END);

    return workflow;
  }

  async execute(localAudioPath: string, creativePrompt: string): Promise<GraphState> {
    const compiledGraph = this.graph.compile();

    const initialState: GraphState = {
      initialPrompt: localAudioPath,
      creativePrompt,
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
    return result as GraphState;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const projectId = process.env.GCP_PROJECT_ID || "your-project-id";
  const bucketName = process.env.GCP_BUCKET_NAME || "your-bucket-name";

  const videoId = `video_${Date.now()}`
  const workflow = new CinematicVideoWorkflow(projectId, videoId, bucketName);

  const creativePrompt = `
Create a short proof of concept video with exactly 5 scenes.
Theme: A journey through a futuristic city.
Style: Cyberpunk, neon lights, rain.
`;

  try {
    const result = await workflow.execute(LOCAL_AUDIO_PATH, creativePrompt);
    console.log("\n" + "=".repeat(60));
    console.log("✅ Workflow completed successfully!");
    console.log(`   Generated ${result.generatedScenes.length} scenes`);
  } catch (error) {
    console.error("\n❌ Workflow failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
