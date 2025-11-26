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

import * as dotenv from "dotenv";
dotenv.config();

class CinematicVideoWorkflow {
  private graph: StateGraph<GraphState>;
  private compositionalAgent: CompositionalAgent;
  private continuityAgent: ContinuityManagerAgent;
  private sceneAgent: SceneGeneratorAgent;
  private storageManager: GCPStorageManager;
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

    this.compositionalAgent = new CompositionalAgent(llm, this.storageManager);
    this.continuityAgent = new ContinuityManagerAgent(
      llm,
      llm,
      this.storageManager
    );
    this.sceneAgent = new SceneGeneratorAgent(llm, llm, this.storageManager);

    this.graph = this.buildGraph();
  }

  private buildGraph(): StateGraph<GraphState> {
    const workflow = new StateGraph<GraphState>({
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

    workflow.addNode("generate_storyboard", async (state: GraphState) => {
      console.log("\n📋 PHASE 1: Generating Storyboard...");
      const storyboard = await this.compositionalAgent.generateStoryboard(
        state.initialPrompt,
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

      const enhancedPrompt = await this.continuityAgent.enhanceScenePrompt(
        scene,
        state.characters,
        state.continuityContext
      );

      const previousFrameUrl = state.continuityContext.previousScene?.lastFrameUrl;
      const generatedScene = await this.sceneAgent.generateScene(
        scene,
        enhancedPrompt,
        previousFrameUrl
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

      try {
        const renderedVideoUrl = await this.sceneAgent.stitchScenes(videoPaths);
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

    workflow.addEdge(START, "generate_storyboard" as any);
    workflow.addEdge("generate_storyboard" as any, "generate_character_refs" as any);
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

  async execute(initialPrompt: string): Promise<GraphState> {
    const compiledGraph = this.graph.compile();

    const initialState: GraphState = {
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

  const initialPrompt = `
Create a full-length music video featuring cinematic shots interlaced with a live musical performance. 
Dynamically switch between cinematic shots and band performance shots.

Musical Performance:
Progressive metal band performing in a large stone room. Cinematic studio grade lighting changes
from white to violet to red depending on the tone of the music. Sunlight rays enter from gaps in
the stone walls.

List of Scenes:
<video_scenes>
Desert scene
2X speed fly-over
A group of exeditioners with a caravan of camels
Crossing the Egyptian deserts
To arrive at the tomb of the ancient Egyptian king
They enter the tomb cautiously,
A man a woman and two other men
They quickly realize the tomb is laid with traps
They’re forced to move deeper into the tomb,
 Becoming trapped
They enter the hall of the king
This is what they have been looking for
The man and the woman approach the sarcophagus
They expect to find treasure here
But they are cautious
They trigger a trap
Activating ancient deeath machines
The hall becomes a tomb for the expeditioners
One man dies
The other three run to avoid the death machines
They run through a labyrinth deep inside the inner tomb
Death machines pursue them relentlessly
They encounter a chasm
The woman swings across on a vine
Below them is a pit of death, filled with rattlesnakes and sharp spires
Falling is certain death
They are forced to cross
The man pulls the vine
He swings across
The other man falls to his death
The couple race deeper into the tomb
Its pitch black
They feel water in the room
The death machines will be coming soon
They descend into the water
The current is strong, they are pulled away
The water swallows them as they are pulled under
They can see a light
The current takes them through an opening
An outlet flows into the mouth of the river
They are freed from the tomb
They live to tell the tale
But at what cost?
The man and the woman come to the riverbank
They lay and breathe
The man has retrieved the treasure they claimed
The woman has plans of her own
They draws a pistol
The man has a pained expression
Why have you done this?
I serve the highest king she says
She shows a tattoo of an ancient insignia
[camera closeup on his eyes, betrayed expression]
He looks into her eyes
Her irises shift, she is not human
She shoots him
Recovers the treasure
And walks away from the scene
In the desert, She comes to a parked horse
Mounts and rides into the dunes.
END just as the song finishes.
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
  } catch (error) {
    console.error("\n❌ Workflow failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
