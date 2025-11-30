// ============================================================================
// CINEMATIC VIDEO FRAMEWORK - TypeScript Implementation
// Google Vertex AI + LangGraph + GCP Storage
// ============================================================================

const LOCAL_AUDIO_PATH = "audio/talk.mp3";

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
import { LlmWrapper, GoogleProvider } from "./llm";

import * as dotenv from "dotenv";
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
    this.audioProcessingAgent = new AudioProcessingAgent(this.storageManager, llm);
    this.compositionalAgent = new CompositionalAgent(llmWrapper, this.storageManager);
    this.frameCompositionAgent = new FrameCompositionAgent(llm, this.storageManager);
    this.continuityAgent = new ContinuityManagerAgent(
      llm,
      llm,
      this.storageManager,
      this.frameCompositionAgent
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
      return "create_timed_scenes_from_audio";
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

        const videoGcsUrl = this.storageManager.getGcsUrl(sceneVideoPath);

        const generatedScene: Scene = {
          ...scene,
          generatedVideoUrl: videoGcsUrl,
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

      // REFACTOR prepareSceneInputs TO RETURN CHARACTERREFERNCEURLS WITHOUT GENERATING COMPOSITE FRAME
      // OMIT GENERATING CHARACTER CONTINUITY FRAMES FOR NOW AS IT MAY BE REDUCING SCENE QUALITY
      const { enhancedPrompt, characterReferenceUrls, locationReferenceUrls } = await this.continuityAgent.prepareSceneInputs(
        scene,
        state.characters,
        state.locations,
        state.continuityContext,
        { characters: state.characters }
      );

      const generatedScene = await this.sceneAgent.generateScene(
        scene,
        enhancedPrompt,
        lastFrameUrl,
        characterReferenceUrls,
        locationReferenceUrls
      );

      console.log(`   ... waiting ${this.SCENE_GEN_COOLDOWN_MS / 1000}s for rate limit reset`);
      await new Promise(resolve => setTimeout(resolve, this.SCENE_GEN_COOLDOWN_MS));

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

    workflow.addEdge("create_timed_scenes_from_audio" as any, "enhance_storyboard_with_prompt" as any);
    workflow.addEdge("enhance_storyboard_with_prompt" as any, "generate_character_refs" as any);
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

  async execute(localAudioPath: string, creativePrompt: string): Promise<GraphState> {
    console.log(`🚀 Executing Cinematic Video Generation Workflow for videoId: ${this.videoId}`);
    console.log("=".repeat(60));

    let initialState: GraphState;

    console.log("   Checking for existing audio file...");
    const audioGcsUri = await this.storageManager.uploadAudioFile(localAudioPath);

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
        if (!localAudioPath || !creativePrompt) {
            throw new Error("Cannot start new workflow without localAudioPath and creativePrompt.");
        }

        initialState = {
            initialPrompt: localAudioPath,
            creativePrompt,
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
  const videoIdFromArgs = process.argv[ 2 ];

  const videoId = videoIdFromArgs || `video_${Date.now()}`;
  const workflow = new CinematicVideoWorkflow(projectId, videoId, bucketName);

  //   const creativePrompt = `
  // Create a full-length music video featuring cinematic shots interlaced with a live musical performance.
  // Dynamically switch between cinematic shots and band performance shots.

  // Musical Performance:
  // Progressive metal band performing in a large stone room. Cinematic studio grade lighting changes
  // from white to violet to red depending on the tone of the music. Sunlight rays enter from gaps in
  // the stone walls.

  // List of Scenes:
  // <video_scenes>
  // Desert scene
  // 2X speed fly-over
  // A group of exeditioners with a caravan of camels
  // Crossing the Egyptian deserts
  // To arrive at the tomb of the ancient Egyptian king
  // They enter the tomb cautiously,
  // A man a woman and two other men
  // They quickly realize the tomb is laid with traps
  // They’re forced to move deeper into the tomb,
  //  Becoming trapped
  // They enter the hall of the king
  // This is what they have been looking for
  // The man and the woman approach the sarcophagus
  // They expect to find treasure here
  // But they are cautious
  // They trigger a trap
  // Activating ancient deeath machines
  // The hall becomes a tomb for the expeditioners
  // One man dies
  // The other three run to avoid the death machines
  // They run through a labyrinth deep inside the inner tomb
  // Death machines pursue them relentlessly
  // They encounter a chasm
  // The woman swings across on a vine
  // Below them is a pit of death, filled with rattlesnakes and sharp spires
  // Falling is certain death
  // They are forced to cross
  // The man pulls the vine
  // He swings across
  // The other man falls to his death
  // The couple race deeper into the tomb
  // Its pitch black
  // They feel water in the room
  // The death machines will be coming soon
  // They descend into the water
  // The current is strong, they are pulled away
  // The water swallows them as they are pulled under
  // They can see a light
  // The current takes them through an opening
  // An outlet flows into the mouth of the river
  // They are freed from the tomb
  // They live to tell the tale
  // But at what cost?
  // The man and the woman come to the riverbank
  // They lay and breathe
  // The man has retrieved the treasure they claimed
  // The woman has plans of her own
  // They draws a pistol
  // The man has a pained expression
  // Why have you done this?
  // I serve the highest king she says
  // She shows a tattoo of an ancient insignia
  // [camera closeup on his eyes, betrayed expression]
  // He looks into her eyes
  // Her irises shift, she is not human
  // She shoots him
  // Recovers the treasure
  // And walks away from the scene
  // In the desert, She comes to a parked horse
  // Mounts and rides into the dunes.
  // END just as the song finishes.
  // `;

  const creativePrompt = `
========================================
THE LAST CONVERSATION
A Short Film / Music Video
========================================

LOGLINE:
On a rain-soaked suburban street at 2 AM, two people who once knew each other completely now struggle to find the words for goodbye—or perhaps, one last chance.

========================================
CHARACTERS
========================================

ELENA MORSE (Late 20s)
Physical: Slender build, 5'6", shoulder-length dark brown hair that clings to her face when wet. Warm brown eyes that carry the weight of sleepless nights. A small scar above her left eyebrow—barely visible unless you're close. Wears a worn grey wool coat over a faded band t-shirt, dark jeans, and scuffed leather boots. A delicate silver necklace with a small compass pendant—a gift from years ago that she's never taken off.

Personality: Guarded but deeply feeling. She's learned to protect herself by keeping distance, but tonight that armor is cracking. She speaks carefully, weighing each word, afraid that one wrong phrase will break whatever fragile thing still exists between them. When emotional, she looks away, jaw tight, fighting tears she doesn't want him to see. Her hands betray her—fidgeting with her coat sleeves, touching her necklace when anxious.

Backstory: She left three months ago. Not dramatically—just quietly packed her things one afternoon and moved across the city. She told herself it was necessary. She told herself she'd move on. But standing here tonight, in the rain, on the street where they used to walk home together, she's not sure anymore.

Current state: Exhausted. Conflicted. Part of her came here hoping he'd fight for her. Part of her came to finally close the door. She doesn't know which part will win.

---

JAMES ASHFORD (Early 30s)
Physical: 6'1", lean athletic build gone slightly softer from too many late nights and not enough care. Messy dark blonde hair, unshaven stubble (3 days growth), striking blue-grey eyes that once lit up easily but now carry a perpetual exhaustion. Wears a black rain-soaked hoodie under a dark green canvas jacket, grey chinos, white sneakers turning grey from the wet. His knuckles are slightly red—he's been clenching his fists in his pockets.

Personality: Used to be the optimist in every room. Used to believe in happy endings. Now he's learning what it means to lose something irreplaceable. He's gentle but desperate tonight—not aggressive, but raw. When he speaks, his voice cracks on certain words (her name, especially). He makes himself vulnerable in a way that terrifies him, because this is his last chance and he knows it.

Backstory: He didn't see it coming. Or maybe he did, but refused to believe it. The distance that grew between them felt temporary, fixable, something they'd laugh about later. When she left, he convinced himself she needed space. He gave her three months. Tonight, he broke. He texted her at 1:47 AM: "I'm on our street. Please." He didn't think she'd come. But she did.

Current state: Barely holding it together. He's rehearsed what he'd say a hundred times, but now that she's here, every word feels inadequate. He's terrified of crying in front of her, but even more terrified of letting her walk away.

========================================
SETTING & ATMOSPHERE
========================================

LOCATION: Maple Grove - A quiet suburban residential street
- Two blocks from where they used to live together
- Tree-lined (bare branches in late autumn/early winter)
- Old-fashioned street lamps casting warm amber pools of light every 30 feet
- Small single-family homes with porch lights glowing softly
- A few parked cars along the curb, glistening wet
- Empty playground visible in background (swings moving slightly in the breeze)

TIME: 2:17 AM - The dead of night
- Most houses dark except for one or two bedroom windows
- Occasional distant sound of a car on a nearby street
- The world feels paused, like they're the only two people awake

WEATHER: Steady rain - not a downpour, but persistent
- The kind of rain that soaks you slowly without you noticing
- Creates a constant white noise—intimate, isolating
- Rain streams down their faces, mingles with tears
- Pavement gleams with reflections: streetlights, house lights, headlights from a distant car
- Small rivers flowing along the curb
- Their breath visible in the cold air

LIGHTING DESIGN:
- Warm amber streetlights create pools of soft illumination
- Rain catches light like diamonds falling
- Wet pavement mirrors lights—doubles the world in reflection
- Shadows are deep but not harsh—chiaroscuro inspired by Edward Hopper paintings
- Occasional car headlight sweeps across them (distant, transitory)
- Porch lights from nearby homes provide gentle fill light
- Blue moonlight breaks through clouds intermittently, cooling the warm tones

SOUND DESIGN:
- Rain: constant, rhythmic, hypnotic
- Their breathing: audible in the quiet
- Distant traffic: faint reminder the world still exists
- Wind through bare trees: lonely, haunting
- Their footsteps on wet pavement: hesitant, tentative
- A dog barks once, far away, then silence

========================================
EMOTIONAL ARC & NARRATIVE STRUCTURE
========================================

ACT I: THE ARRIVAL (Opening - 25%)
- Elena arrives, sees James standing under a streetlight
- They stand apart, neither sure how to begin
- The distance between them feels physical and metaphorical
- Rain provides an excuse not to make eye contact immediately
- Small talk attempts that die on their lips
- The weight of three months of silence

KEY MOMENT: He says her name. Just "Elena." The way he used to. She closes her eyes.

ACT II: THE UNRAVELING (Middle - 50%)
- They begin to talk—hesitant at first, then flooding
- Accusations they've held back ("Why didn't you tell me you were struggling?")
- Admissions that hurt ("I felt invisible." "I didn't know how to reach you.")
- Memories surface: inside jokes that still land, places they used to go, promises they made
- Physical proximity shifts—closer during vulnerable moments, farther during painful truths
- Rain intensifies slightly during moments of conflict, softens during moments of connection

KEY MOMENTS:
- He reaches for her hand; she pulls away—not angrily, but protectively
- She finally cries, and he instinctively steps closer
- A car passes, headlights illuminating them, then darkness again
- "Do you still love me?" One of them asks. Silence. Then: "I don't know if love is enough."

ACT III: THE CHOICE (Final - 25%)
- The conversation reaches its breaking point
- Either they find a way forward or they say goodbye for real
- Physical choice: Do they step toward each other, or turn away?
- Rain begins to let up—timing is symbolic
- Streetlight flickers once—a moment of uncertainty
- Whatever happens, it needs to feel earned, not forced

POSSIBLE ENDINGS (Choose based on musical tone):

Ending A - HOPE (Bittersweet but open):
She steps toward him. He meets her halfway. They embrace in the rain—not triumphant, but exhausted, relieved, fragile. Foreheads touch. "We have to do better this time." "I know." They stand there, holding each other, as rain becomes mist. Final shot: them walking together down the street, side by side but not yet hand-in-hand. Work to do, but willing to try.

Ending B - CLOSURE (Heartbreaking but necessary):
She takes his face in her hands, kisses his forehead—a goodbye kiss. "I love you. But I can't." He nods, tears streaming. "I know." She turns and walks away. He watches until she disappears around the corner. He stands alone in the rain, then slowly walks the opposite direction. Final shot: empty street, rain falling on the spot where they stood, two sets of footprints fading.

Ending C - AMBIGUITY (Artistic, haunting):
They stand facing each other in silence. Rain falls between them. Neither moves. Neither speaks. The camera slowly pulls back, wider and wider, until they're small figures under a streetlight in the vastness of the night. Cut to black. We never know what they chose. The audience carries the question.

========================================
VISUAL STYLE & CINEMATIC REFERENCES
========================================

COLOR PALETTE:
- Dominant: Deep blues, warm ambers, charcoal greys
- Accents: Muted greens from distant traffic lights, soft whites from porch lights
- Skin tones: Slightly desaturated, naturalistic, not glamorized
- Rain: Catches every light source—becomes visual poetry

CINEMATOGRAPHY APPROACH:
- Handheld camera for intimacy and realism—slight movement, breathing quality
- Shallow depth of field isolates characters from background (f/1.4 - f/2.0)
- Long lenses (85mm, 135mm) compress space, create isolation
- Wide shots sparingly—emphasize their smallness in the world
- Reflections utilized—puddles show inverted world, mirrors emotional inversion

SHOT VOCABULARY:

Establishing shots:
- Wide of the street—empty, rain falling through amber light
- Medium wide two-shot—them standing 10 feet apart
- Deep focus shot showing distance between them, playground empty behind

Emotional beats:
- Tight close-ups: eyes, hands, lips trembling
- Over-the-shoulder shots during conversation—see one fully, one partially
- Profile shots: side-lighting creates dramatic shadows
- Extreme close-up: rain on her eyelashes, his jaw clenching
- Two-shot close-ups: faces inches apart, struggling with what to say

Movement:
- Slow dolly in during vulnerable confessions
- Circular tracking shot when the conversation becomes cyclical, frustrated
- Static frame when they're frozen, unable to move forward
- Slow zoom out at the end—whatever their choice, the world is bigger than them

========================================
PERFORMANCE DIRECTION
========================================

SUBTLETY IS EVERYTHING:
- No melodrama. No screaming matches. This is two people trying not to fall apart.
- Tears should come despite resistance, not performed
- Silence should feel full, not empty
- Physical proximity is a language: closeness = vulnerability, distance = protection
- Micro-expressions matter: a trembling lip, eyes darting away, hands shaking

ELENA'S PERFORMANCE NOTES:
- She looks down when she's about to cry
- She touches her necklace when she's anxious or remembering
- Her voice gets quieter when she's most emotional (not louder)
- She crosses her arms when protecting herself
- When she softens, her shoulders drop, her arms uncross

JAMES'S PERFORMANCE NOTES:
- He runs his hand through his wet hair when frustrated
- His voice cracks on her name
- He looks at her constantly, even when she looks away
- He keeps his hands in his pockets until he can't anymore
- When he's vulnerable, he looks down, then forces himself to look at her

========================================
THEMATIC CORE
========================================

This is a story about:
- The gap between loving someone and being able to be with them
- How silence can be more damaging than conflict
- The courage it takes to be vulnerable when you've been hurt
- The weight of choosing between holding on and letting go
- How sometimes love isn't enough, and how devastating that realization is
- The beauty in pain—how heartbreak can be its own form of intimacy

WHAT MAKES IT HUMAN:
- Neither person is the villain. Both made mistakes. Both are trying.
- There are no easy answers. Life doesn't provide closure neatly.
- Small details matter—how she pulls her coat tighter, how he can't stop looking at her
- The environment reflects the emotion—rain as tears, streetlight as spotlight on their pain
- It captures a moment everyone who's loved and lost will recognize

========================================
TECHNICAL SPECIFICATIONS
========================================

CAMERA: Handheld, cinema camera, high dynamic range
LENSES: Prime lenses (35mm, 50mm, 85mm, 135mm)
FRAME RATE: 24fps (cinematic), possible 60fps for rain slow-motion inserts
ASPECT RATIO: 2.39:1 (anamorphic feel) or 1.85:1 (intimate feel)
LIGHTING: Practical sources, minimal artificial light, embrace shadows
COLOR GRADE: Desaturated but warm, lifted blacks for mood, film-like grain

========================================
FINAL NOTE TO DIRECTOR/AI
========================================

Treat this like you're crafting the final scene of a feature film—the one people will remember years later. Every frame should feel intentional. Every performance beat should feel earned. The rain isn't just weather; it's texture, metaphor, a character itself.

Make the audience lean forward. Make them hold their breath. Make them hope, or hurt, or both.

This is cinema.
`;

  const testPrompt = `
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
