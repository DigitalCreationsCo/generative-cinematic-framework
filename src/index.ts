// ============================================================================
// CINEMATIC VIDEO FRAMEWORK - TypeScript Implementation
// Google Vertex AI + LangGraph + GCP Storage
// ============================================================================

import ffmpeg from "fluent-ffmpeg";
import ffmpegBin from "@ffmpeg-installer/ffmpeg";
import ffprobeBin from "@ffprobe-installer/ffprobe";

ffmpeg.setFfmpegPath(ffmpegBin.path);
ffmpeg.setFfprobePath(ffprobeBin.path);

import * as dotenv from "dotenv";
dotenv.config();

import { GoogleGenAI } from "@google/genai";
import { StateGraph, END, START, Command } from "@langchain/langgraph";
import {
  Character,
  Scene,
  Storyboard,
  GraphState,
  QualityEvaluationResult,
  GeneratedScene,
  InitialGraphState,
  SceneGenerationMetric,
  WorkflowMetrics,
} from "./types";
import { SceneGeneratorAgent } from "./agents/scene-generator";
import { CompositionalAgent } from "./agents/compositional-agent";
import { ContinuityManagerAgent } from "./agents/continuity-manager";
import { GCPStorageManager } from "./storage-manager";
import { FrameCompositionAgent } from "./agents/frame-composition-agent";
import { AudioProcessingAgent } from "./agents/audio-processing-agent";
import { LlmWrapper, GoogleProvider } from "./llm";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { defaultCreativePrompt } from "./prompts/default-creative-prompt";
import { imageModelName, textModelName, videoModelName } from "./llm/google/models";
import { calculateLearningTrends } from "./utils";

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
  private SCENE_GEN_COOLDOWN_MS = 30000;

  constructor(
    projectId: string,
    videoId: string,
    bucketName: string,
    location: string = "us-east1",
  ) {

    this.projectId = projectId;
    this.videoId = videoId;
    this.storageManager = new GCPStorageManager(projectId, videoId, bucketName);

    const llmWrapper = new LlmWrapper();

    this.audioProcessingAgent = new AudioProcessingAgent(llmWrapper, this.storageManager);
    this.compositionalAgent = new CompositionalAgent(llmWrapper, this.storageManager);
    this.frameCompositionAgent = new FrameCompositionAgent(llmWrapper, this.storageManager);
    this.continuityAgent = new ContinuityManagerAgent(
      llmWrapper,
      llmWrapper,
      this.frameCompositionAgent,
      this.storageManager,
    );
    this.sceneAgent = new SceneGeneratorAgent(llmWrapper, this.storageManager);

    this.graph = this.buildGraph();
  }

  private buildGraph(): StateGraph<GraphState> {
    const workflow = new StateGraph<GraphState>({
      channels: {
        initialPrompt: null,
        creativePrompt: null,
        audioGcsUri: null,
        hasAudio: null,
        storyboard: null,
        storyboardState: null,
        currentSceneIndex: null,
        renderedVideoUrl: null,
        errors: null,
        generationRules: null,
        refinedRules: null,
        metrics: {
          reducer: (x: any, y: any) => y,
          default: () => ({ sceneMetrics: [] }),
        },
      },
    });

    workflow.addConditionalEdges(START, (state: InitialGraphState) => {
      if (state.storyboardState && state.storyboardState.scenes.some(s => s.generatedVideoUrl)) {
        console.log("   Resuming workflow from process_scene...");
        return "process_scene";
      }

      if (state.storyboardState && (state.storyboardState.metadata as any).creativePrompt) return "generate_character_assets";

      return "expand_creative_prompt";
    });

    workflow.addNode("expand_creative_prompt", async (state: GraphState) => {
      let expandedPrompt: string;
      if (!state.creativePrompt) throw new Error("No creative prompt was provided");
      console.log("\n🎨 PHASE 0: Expanding Creative Prompt to Cinema Quality...");
      console.log(`   Original prompt: ${state.creativePrompt.substring(0, 100)}...`);

      expandedPrompt = await this.compositionalAgent.expandCreativePrompt(state.creativePrompt);

      console.log(`   ✓ Expanded to ${expandedPrompt.length} characters of cinematic detail`);

      return {
        ...state,
        creativePrompt: expandedPrompt,
      };
    });
    
    workflow.addConditionalEdges("expand_creative_prompt" as any, (state: GraphState) => {
      if (state.hasAudio) {
        return "create_scenes_from_audio";
      }
      return "generate_storyboard_exclusively_from_prompt";
    });

    // Non-audio workflow path
    workflow.addEdge("generate_storyboard_exclusively_from_prompt" as any, "generate_character_assets" as any);

    workflow.addNode("generate_storyboard_exclusively_from_prompt", async (state: GraphState) => {
      if (!state.creativePrompt) throw new Error("No creative prompt available");
      console.log("\n📋 PHASE 1: Generating Storyboard from Creative Prompt (No Audio)...");

      let storyboard = await this.compositionalAgent.generateStoryboardFromPrompt(
        state.creativePrompt
      );

      return {
        ...state,
        storyboard,
        storyboardState: storyboard,
        currentSceneIndex: 0,
      };
    });

    // Audio-based workflow path
    workflow.addEdge("create_scenes_from_audio" as any, "enrich_storyboard_and_scenes" as any);
    workflow.addEdge("enrich_storyboard_and_scenes" as any, "generate_character_assets" as any);

    workflow.addNode("create_scenes_from_audio", async (state: GraphState) => {
      if (!state.creativePrompt) throw new Error("No creative prompt available");
      console.log("\n📋 PHASE 1a: Creating Timed Scenes from Audio...");
      const { segments, totalDuration } = await this.audioProcessingAgent.processAudioToScenes(
        state.initialPrompt,
        state.creativePrompt,
      );

      return {
        ...state,
        storyboard: {
          metadata: {
            duration: totalDuration
          },
          scenes: segments,
        } as Storyboard,
      };
    });

    workflow.addNode("enrich_storyboard_and_scenes", async (state: GraphState) => {
      if (!state.storyboard || !state.storyboard.scenes) throw new Error("No timed scenes available");
      if (!state.creativePrompt) throw new Error("No creative prompt available");
      
      console.log("\n📋 PHASE 1b: Enhancing Storyboard with Prompt...");
      let storyboard = await this.compositionalAgent.generateStoryboard(
        state.storyboard,
        state.creativePrompt
      );

      return {
        ...state,
        storyboard,
        storyboardState: storyboard,
        currentSceneIndex: 0,
      };
    });

    workflow.addNode("generate_character_assets", async (state: GraphState) => {
      if (!state.storyboardState) throw new Error("No storyboard state available");

      console.log("\n🎨 PHASE 2a: Generating Character References...");

      const characters = await this.continuityAgent.generateCharacterAssets(
        state.storyboardState.characters
      );

      return {
        ...state,
        storyboardState: {
          ...state.storyboardState,
          characters,
        }
      };
    });

    workflow.addNode("generate_location_assets", async (state: GraphState) => {
      if (!state.storyboardState) throw new Error("No storyboard state available");

      console.log("\n🎨 PHASE 2b: Generating Location References...");

      const locations = await this.continuityAgent.generateLocationAssets(
        state.storyboardState.locations
      );

      return {
        ...state,
        storyboardState: {
          ...state.storyboardState,
          locations,
        }
      };
    });

    workflow.addNode("process_scene", async (state: GraphState) => {
      if (!state.storyboardState) {
        throw new Error("Missing storyboard state");
      }

      const scene = state.storyboardState.scenes[ state.currentSceneIndex ];
      console.log(
        `\n🎬 PHASE 3: Processing Scene ${scene.id}/${state.storyboardState.scenes.length}`
      );

      let currentSceneLastFrameUrl: string | undefined;
      const currentSceneLastFramePath = await this.storageManager.getGcsObjectPath({ type: "scene_last_frame", sceneId: scene.id });
      if (await this.storageManager.fileExists(currentSceneLastFramePath)) {
        currentSceneLastFrameUrl = this.storageManager.getGcsUrl(currentSceneLastFramePath);
        console.log(`   ... Found last frame for continuity: ${currentSceneLastFrameUrl}`);
      }

      const sceneVideoPath = await this.storageManager.getGcsObjectPath({ type: "scene_video", sceneId: scene.id });
      if (await this.storageManager.fileExists(sceneVideoPath)) {
        console.log(`   ... Scene video already exists at ${sceneVideoPath}, skipping.`);

        const generatedScene = {
          ...scene,
          generatedVideoUrl: this.storageManager.getGcsUrl(sceneVideoPath),
          lastFrameUrl: scene.lastFrameUrl || currentSceneLastFrameUrl
        } as GeneratedScene;

        const updatedStoryboardState = this.continuityAgent.updateStoryboardState(
          generatedScene,
          state.storyboardState
        );

        return {
          ...state,
          currentSceneIndex: state.currentSceneIndex + 1,
          storyboardState: updatedStoryboardState
        };
      }

      const {
        enhancedPrompt,
        refinedRules,
        characterReferenceUrls,
        locationReferenceUrls
      } = await this.continuityAgent.prepareAndRefineSceneInputs(scene, state);

      const result = await this.sceneAgent.generateSceneWithQualityCheck(
        scene,
        enhancedPrompt,
        state.storyboardState.characters,
        state.storyboardState.scenes[state.currentSceneIndex - 1],
        state.storyboardState.scenes[ state.currentSceneIndex - 1 ].lastFrameUrl,
        characterReferenceUrls,
        locationReferenceUrls,
        !state.hasAudio
      );

      if (result.evaluation) {
        console.log(`   📊 Final: ${(result.finalScore * 100).toFixed(1)}% after ${result.attempts} attempt(s)`);
      }

      console.log(`   ... waiting ${this.SCENE_GEN_COOLDOWN_MS / 1000}s for rate limit reset`);
      await new Promise(resolve => setTimeout(resolve, this.SCENE_GEN_COOLDOWN_MS));

      result.scene.evaluation = result.evaluation ?? undefined;

      const updatedStoryboardState = this.continuityAgent.updateStoryboardState(
        result.scene,
        state.storyboardState
      );

      const newGenerationRules = result.evaluation?.ruleSuggestion
        ? [ ...(state.generationRules || []), result.evaluation.ruleSuggestion ]
        : state.generationRules;

      const sceneMetric: SceneGenerationMetric = {
        sceneId: scene.id,
        attempts: result.attempts,
        bestAttempt: result.attempts, 
        finalScore: result.finalScore,
        duration: scene.duration,
        ruleAdded: !!result.evaluation?.ruleSuggestion
      };

      const metrics: WorkflowMetrics = {
        sceneMetrics: [ ...(state.metrics?.sceneMetrics || []), sceneMetric ],
      };

      const trends = calculateLearningTrends(metrics.sceneMetrics);
      metrics.globalTrend = trends;

      console.log(`\n🧠 Learning Report (Scene ${scene.id}):`);
      console.log(`   - Average Attempts: ${trends.averageAttempts.toFixed(2)}`);
      console.log(`   - Attempt Trend Slope: ${trends.attemptTrendSlope.toFixed(3)} (${trends.attemptTrendSlope < 0 ? 'Improving' : 'Worsening or Stable'})`);
      console.log(`   - Quality Trend Slope: ${trends.qualityTrendSlope.toFixed(3)} (${trends.qualityTrendSlope > 0 ? 'Improving' : 'Worsening or Stable'})`);

      return {
        ...state,
        currentSceneIndex: state.currentSceneIndex + 1,
        storyboardState: updatedStoryboardState,
        generationRules: newGenerationRules,
        refinedRules: refinedRules,
        metrics,
      };
    });

    workflow.addNode("render_video", async (state: GraphState) => {
      console.log("\n🎥 PHASE 4: Rendering Final Video...");
      if (!state.storyboardState) return state;

      const videoPaths = state.storyboardState.scenes
        .map(s => s.generatedVideoUrl)
        .filter((url): url is string => !!url);

      if (videoPaths.length === 0) {
        console.warn("   No videos to stitch.");
        return state;
      }

      try {
        // If audio is available, stitch with audio; otherwise, stitch without audio
        const renderedVideoUrl = state.audioGcsUri
          ? await this.sceneAgent.stitchScenes(videoPaths, state.audioGcsUri)
          : await this.sceneAgent.stitchScenesWithoutAudio(videoPaths);

        return {
          ...state,
          renderedVideoUrl
        };
      } catch (error) {
        console.error("   Failed to render video:", error);
        return {
          ...state,
          errors: [ ...state.errors, `Video rendering failed: ${error}` ]
        };
      }
    });

    workflow.addNode("finalize", async (state: GraphState) => {
      console.log("\n✅ PHASE 4: Finalizing Workflow...");
      console.log(`   Total scenes generated: ${state.storyboardState?.scenes.length}`);

      const outputPath = await this.storageManager.getGcsObjectPath({ type: "final_output" });
      await this.storageManager.uploadJSON(
        state.storyboardState || {},
        outputPath
      );

      console.log(`\n🎉 Video generation complete!`);
      console.log(`   Output saved to: ${outputPath}`);

      return state;
    });

    workflow.addEdge("generate_character_assets" as any, "generate_location_assets" as any);
    workflow.addEdge("generate_location_assets" as any, "process_scene" as any);

    workflow.addConditionalEdges("process_scene" as any, (state: GraphState) => {
      if (!state.storyboardState) return "finalize";
      if (state.currentSceneIndex >= state.storyboardState.scenes.length) {
        return "render_video";
      }
      return "process_scene";
    });

    workflow.addEdge("render_video" as any, "finalize" as any);
    workflow.addEdge("finalize" as any, END);

    return workflow;
  }

  async execute(localAudioPath: string | undefined, creativePrompt: string): Promise<GraphState> {
    console.log(`🚀 Executing Cinematic Video Generation Workflow for videoId: ${this.videoId}`);
    console.log("=".repeat(60));

    // Initialize storage manager to sync state from GCS
    await this.storageManager.initialize();

    let initialState: InitialGraphState;
    let audioGcsUri: string | undefined;
    const hasAudio = !!localAudioPath;

    if (hasAudio && localAudioPath) {
      console.log("   Checking for existing audio file...");
      audioGcsUri = await this.storageManager.uploadAudioFile(localAudioPath);
    } else {
      console.log("   No audio file provided - generating video from creative prompt only.");
    }

    try {
      console.log("   Checking for existing storyboard...");
      const storyboardPath = await this.storageManager.getGcsObjectPath({ type: "storyboard" });
      const storyboard = await this.storageManager.downloadJSON<Storyboard>(storyboardPath);
      console.log("   Found existing storyboard. Resuming workflow.");

      initialState = {
        initialPrompt: localAudioPath || '',
        creativePrompt: creativePrompt || '',
        hasAudio,
        storyboard,
        storyboardState: storyboard,
        currentSceneIndex: 0,
        audioGcsUri,
        errors: [],
        generationRules: [],
        refinedRules: [],
      };
    } catch (error) {
      console.error('Error: ', error);
      console.log("   No existing storyboard found or error loading it. Starting fresh workflow.");
      if (!creativePrompt) {
        throw new Error("Cannot start new workflow without creativePrompt.");
      }

      initialState = {
        initialPrompt: localAudioPath || '',
        creativePrompt,
        hasAudio,
        currentSceneIndex: 0,
        errors: [],
        generationRules: [],
        refinedRules: [],
      };
    }

    const compiledGraph = this.graph.compile();
    const result = await compiledGraph.invoke(initialState, {
      recursionLimit: 100,
    });
    return result as GraphState;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const projectId = process.env.GCP_PROJECT_ID || "your-project-id";
  const bucketName = process.env.GCP_BUCKET_NAME || "your-bucket-name";
  const LOCAL_AUDIO_PATH = process.env.LOCAL_AUDIO_PATH;

  const argv = await yargs(hideBin(process.argv))
    .option('id', {
      alias: [ 'resume', 'videoId' ],
      type: 'string',
      description: 'Video ID to resume or use',
    })
    .option('audio', {
      alias: [ 'file', 'audioPath' ],
      type: 'string',
      description: 'Path to local audio file',
    })
    .option('prompt', {
      alias: 'creativePrompt',
      type: 'string',
      description: 'Creative prompt for the video',
    })
    .help()
    .argv;

  const videoId = argv.id || `video_${Date.now()}`;
  const audioPath = argv.audio || LOCAL_AUDIO_PATH || undefined;

  const workflow = new CinematicVideoWorkflow(projectId, videoId, bucketName);

  const creativePrompt = argv.prompt || defaultCreativePrompt;

  try {
    const result = await workflow.execute(audioPath, creativePrompt);
    console.log("\n" + "=".repeat(60));
    console.log("✅ Workflow completed successfully!");
    console.log(`   Generated ${result.storyboardState.scenes.length} scenes`);
  } catch (error) {
    console.error("\n❌ Workflow failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
