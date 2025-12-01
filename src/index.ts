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
  QualityEvaluation,
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

import * as dotenv from "dotenv";
import { defaultCreativePrompt } from "./prompts/default-creative-prompt";
dotenv.config();

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

    const llm = new GoogleGenAI({
      vertexai: true,
      project: projectId
    });

    this.projectId = projectId;
    this.videoId = videoId;
    this.storageManager = new GCPStorageManager(projectId, videoId, bucketName);

    const llmWrapper = new LlmWrapper(new GoogleProvider(llm, llm));

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
        currentSceneIndex: null,
        generatedScenes: null,
        characters: null,
        locations: null,
        continuityContext: null,
        renderedVideoUrl: null,
        errors: null,
      },
    });

    workflow.addConditionalEdges(START, (state: GraphState) => {
      if (state.storyboard && state.characters && state.characters.length > 0 && state.locations && state.locations.length > 0) {
        console.log("   Resuming workflow from process_scene...");
        return "process_scene";
      }
      // Check if audio is provided
      if (state.hasAudio) {
        return "create_timed_scenes_from_audio";
      } else {
        return "expand_creative_prompt";
      }
    });

    workflow.addNode("expand_creative_prompt", async (state: GraphState) => {
      if (!state.creativePrompt) throw new Error("No creative prompt was provided");
      console.log("\n🎨 PHASE 0: Expanding Creative Prompt to Cinema Quality...");
      console.log(`   Original prompt: ${state.creativePrompt.substring(0, 100)}...`);

      const expandedPrompt = await this.compositionalAgent.expandCreativePrompt(state.creativePrompt);

      console.log(`   ✓ Expanded to ${expandedPrompt.length} characters of cinematic detail`);

      return {
        ...state,
        creativePrompt: expandedPrompt,
      };
    });
    
    workflow.addNode("create_timed_scenes_from_audio", async (state: GraphState) => {
      if (!state.creativePrompt) throw new Error("No creative prompt available");
      console.log("\n📋 PHASE 1a: Creating Timed Scenes from Audio...");
      const { segments, totalDuration } = await this.audioProcessingAgent.processAudioToScenes(
        state.initialPrompt,
        state.creativePrompt,
      );

      return {
        ...state,
        storyboard: {
          metadata: { duration: totalDuration },
          scenes: segments,
        },
      };
    });

    workflow.addNode("generate_storyboard_from_prompt", async (state: GraphState) => {
      if (!state.creativePrompt) throw new Error("No creative prompt available");
      console.log("\n📋 PHASE 1: Generating Storyboard from Creative Prompt (No Audio)...");

      const storyboard = await this.compositionalAgent.generateStoryboardFromPrompt(
        state.creativePrompt
      );

      return {
        ...state,
        storyboard,
        currentSceneIndex: 0,
        generatedScenes: [],
        continuityContext: {
          characters: new Map(),
          locations: new Map(),
        },
      };
    });

    workflow.addNode("enhance_storyboard_with_prompt", async (state: GraphState) => {
      if (!state.storyboard || !state.storyboard.scenes) throw new Error("No timed scenes available");
      if (!state.creativePrompt) throw new Error("No creative prompt available");
      console.log("\n📋 PHASE 1b: Enhancing Storyboard with Prompt...");
      const storyboard = await this.compositionalAgent.generateStoryboard(
        state.storyboard,
        state.creativePrompt
      );

      return {
        ...state,
        storyboard,
        currentSceneIndex: 0,
        generatedScenes: [],
        continuityContext: {
          characters: new Map(),
          locations: new Map(),
        },
      };
    });

    workflow.addNode("generate_character_refs", async (state: GraphState) => {
      if (!state.storyboard) throw new Error("No storyboard available");

      console.log("\n🎨 PHASE 2a: Generating Character References...");
      const characters = await this.continuityAgent.generateCharacterAssets(
        state.storyboard.characters,
      );

      return {
        ...state,
        characters,
      };
    });

    workflow.addNode("generate_location_refs", async (state: GraphState) => {
      if (!state.storyboard) throw new Error("No storyboard available");

      console.log("\n🎨 PHASE 2b: Generating Location References...");
      const locations = await this.continuityAgent.generateLocationAssets(
        state.storyboard.locations,
      );

      return {
        ...state,
        locations,
      };
    });

    workflow.addNode("process_scene", async (state: GraphState) => {
      if (!state.storyboard || !state.characters || !state.locations) {
        throw new Error("Missing storyboard, characters, or locations");
      }

      const scene = state.storyboard.scenes[ state.currentSceneIndex ];
      console.log(
        `\n🎬 PHASE 3: Processing Scene ${scene.id}/${state.storyboard.scenes.length}`
      );

      let lastFrameUrl: string | undefined;
      const lastFramePath = this.storageManager.getGcsObjectPath("scene_last_frame", { sceneId: scene.id });
      if (await this.storageManager.fileExists(lastFramePath)) {
        lastFrameUrl = this.storageManager.getGcsUrl(lastFramePath);
        console.log(`   ... Found last frame for continuity: ${lastFrameUrl}`);
      }

      const sceneVideoPath = this.storageManager.getGcsObjectPath("scene_video", { sceneId: scene.id });
      if (await this.storageManager.fileExists(sceneVideoPath)) {
        console.log(`   ... Scene video already exists at ${sceneVideoPath}, skipping.`);

        const generatedScene: Scene = {
          ...scene,
          generatedVideoUrl: this.storageManager.getGcsUrl(sceneVideoPath),
          lastFrameUrl
        };

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
      }

      const { enhancedPrompt, characterReferenceUrls, locationReferenceUrls } = await this.continuityAgent.prepareSceneInputs(
        scene,
        state.characters,
        state.locations,
        state.continuityContext,
        { characters: state.characters }
      );

      const result = await this.sceneAgent.generateSceneWithQualityCheck(
        scene,
        enhancedPrompt,
        state.characters,
        state.continuityContext.previousScene,
        lastFrameUrl,
        characterReferenceUrls,
        locationReferenceUrls
      );

      if (result.evaluation) {
        console.log(`   📊 Final: ${(result.finalScore * 100).toFixed(1)}% after ${result.attempts} attempt(s)`);
      }

      console.log(`   ... waiting ${this.SCENE_GEN_COOLDOWN_MS / 1000}s for rate limit reset`);
      await new Promise(resolve => setTimeout(resolve, this.SCENE_GEN_COOLDOWN_MS));

      const updatedContext = this.continuityAgent.updateContinuityContext(
        result.scene,
        state.continuityContext,
        state.characters
      );

      return {
        ...state,
        generatedScenes: [ ...state.generatedScenes, result.scene ],
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
      console.log(`   Total scenes generated: ${state.generatedScenes.length}`);

      const outputPath = this.storageManager.getGcsObjectPath("final_output");
      await this.storageManager.uploadJSON(
        {
          storyboard: state.storyboard,
          characters: state.characters,
          locations: state.locations,
          generatedScenes: state.generatedScenes,
        },
        outputPath
      );

      console.log(`\n🎉 Video generation complete!`);
      console.log(`   Output saved to: ${outputPath}`);

      return state;
    });

    // Audio-based workflow path
    workflow.addEdge("create_timed_scenes_from_audio" as any, "enhance_storyboard_with_prompt" as any);
    workflow.addEdge("enhance_storyboard_with_prompt" as any, "generate_character_refs" as any);

    // Non-audio workflow path
    workflow.addEdge("expand_creative_prompt" as any, "generate_storyboard_from_prompt" as any);
    workflow.addEdge("generate_storyboard_from_prompt" as any, "generate_character_refs" as any);

    // Common path for both workflows
    workflow.addEdge("generate_character_refs" as any, "generate_location_refs" as any);
    workflow.addEdge("generate_location_refs" as any, "process_scene" as any);

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

  async execute(localAudioPath: string | undefined, creativePrompt: string): Promise<GraphState> {
    console.log(`🚀 Executing Cinematic Video Generation Workflow for videoId: ${this.videoId}`);
    console.log("=".repeat(60));

    let initialState: GraphState;
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
        const storyboardPath = this.storageManager.getGcsObjectPath("storyboard");
        const storyboard = await this.storageManager.downloadJSON<Storyboard>(storyboardPath);
        console.log("   Found existing storyboard. Resuming workflow.");

        const characterPromises = storyboard.characters.map(async (char) => {
            const charImgPath = this.storageManager.getGcsObjectPath("character_image", { characterId: char.id });
            if (await this.storageManager.fileExists(charImgPath)) {
                console.log(`   ... Character image for ${char.name} already exists, skipping.`);
                const fullGcsUrl = this.storageManager.getGcsUrl(charImgPath);
                return { ...char, referenceImageUrls: [ fullGcsUrl ] };
            }
          return this.continuityAgent.generateCharacterAssets([ char ]).then(chars => chars[ 0 ]);
        });

        const locationPromises = storyboard.locations.map(async (loc) => {
            const locImgPath = this.storageManager.getGcsObjectPath("location_image", { locationId: loc.id });
            if (await this.storageManager.fileExists(locImgPath)) {
                console.log(`   ... Location image for ${loc.name} already exists, skipping.`);
                const fullGcsUrl = this.storageManager.getGcsUrl(locImgPath);
                return { ...loc, referenceImageUrls: [ fullGcsUrl ] };
            }
          return this.continuityAgent.generateLocationAssets([ loc ]).then(locs => locs[ 0 ]);
        });

        const characters = await Promise.all(characterPromises);
        const locations = await Promise.all(locationPromises);

        initialState = {
            initialPrompt: localAudioPath || '',
            creativePrompt: creativePrompt || '',
            hasAudio,
            storyboard,
            characters,
            locations,
            currentSceneIndex: 0,
            generatedScenes: [],
            audioGcsUri,
            continuityContext: {
                characters: new Map(),
                locations: new Map(),
            },
            errors: [],
        };
    } catch (error) {
        console.log("   No existing storyboard found or error loading it. Starting fresh workflow.");
        if (!creativePrompt) {
            throw new Error("Cannot start new workflow without creativePrompt.");
        }

        initialState = {
            initialPrompt: localAudioPath || '',
            creativePrompt,
            hasAudio,
            currentSceneIndex: 0,
            generatedScenes: [],
            characters: [],
            locations: [],
            audioGcsUri,
            continuityContext: {
                characters: new Map(),
                locations: new Map(),
            },
            errors: [],
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
      alias: ['resume', 'videoId'],
      type: 'string',
      description: 'Video ID to resume or use',
    })
    .option('audio', {
      alias: ['file', 'audioPath'],
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
  const audioPath = argv.audio === LOCAL_AUDIO_PATH ? LOCAL_AUDIO_PATH : argv.audio;
  
  const workflow = new CinematicVideoWorkflow(projectId, videoId, bucketName);

  const creativePrompt = argv.prompt || defaultCreativePrompt;

  try {
    const result = await workflow.execute(audioPath, creativePrompt);
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
