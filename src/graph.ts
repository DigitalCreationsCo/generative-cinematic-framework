import { StateGraph, END, START } from "@langchain/langgraph";
import { GoogleGenAI } from "@google/genai";
import { GCPStorageManager } from "./storage-manager";
import { CompositionalAgent } from "./agents/composition-agent";
import { ContinuityManagerAgent } from "./agents/continuity-manager";
import { SceneGeneratorAgent } from "./agents/scene-generator";
import { GraphState } from "./types";
import { llm, imageModel, videoModel } from "./google";

// ============================================================================
// LANGGRAPH WORKFLOW
// ============================================================================

export class CinematicVideoWorkflow {
    private graph: StateGraph<GraphState>;
    private compositionalAgent: CompositionalAgent;
    private continuityAgent: ContinuityManagerAgent;
    private sceneAgent: SceneGeneratorAgent;
    private storageManager: GCPStorageManager;

    constructor(
        projectId: string,
        bucketName: string,
        location: string = "us-central1"
    ) {
        this.storageManager = new GCPStorageManager(projectId, bucketName);

        this.compositionalAgent = new CompositionalAgent(llm, this.storageManager);
        this.continuityAgent = new ContinuityManagerAgent(
            llm,
            imageModel,
            this.storageManager
        );
        this.sceneAgent = new SceneGeneratorAgent(this.storageManager, videoModel);

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

        // Node: Generate Storyboard
        workflow.addNode("generate_storyboard", async (state: GraphState) => {
            console.log("\n📋 PHASE 1: Generating Storyboard...");
            const storyboard = await this.compositionalAgent.generateStoryboard(
                state.initialPrompt
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

        // Node: Generate Character References
        workflow.addNode("generate_character_refs", async (state: GraphState) => {
            if (!state.storyboard) throw new Error("No storyboard available");

            console.log("\n🎨 PHASE 2: Generating Character References...");
            const projectId = Date.now().toString();
            const characters = await this.continuityAgent.generateCharacterReferences(
                state.storyboard.characters,
                projectId
            );

            return {
                ...state,
                characters,
            };
        });

        // Node: Process Scene
        workflow.addNode("process_scene", async (state: GraphState) => {
            if (!state.storyboard || !state.characters) {
                throw new Error("Missing storyboard or characters");
            }

            const scene = state.storyboard.scenes[ state.currentSceneIndex ];
            console.log(
                `\n🎬 PHASE 3: Processing Scene ${scene.id}/${state.storyboard.scenes.length}`
            );

            // Enhance prompt with continuity details
            const enhancedPrompt = await this.continuityAgent.enhanceScenePrompt(
                scene,
                state.characters,
                state.continuityContext
            );

            // Generate video
            const projectId = Date.now().toString();
            const previousFrameUrl = state.continuityContext.previousScene?.lastFrameUrl;
            const generatedScene = await this.sceneAgent.generateScene(
                scene,
                enhancedPrompt,
                projectId,
                previousFrameUrl
            );

            // Update continuity context
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

        // Node: Finalize
        workflow.addNode("finalize", async (state: GraphState) => {
            console.log("\n✅ PHASE 4: Finalizing Video...");
            console.log(`   Total scenes generated: ${state.generatedScenes.length}`);

            // Save final output
            const projectId = Date.now().toString();
            const outputPath = `video/${projectId}/scenes/final_output.json`;
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

        // Define edges
        workflow.addEdge(START, "generate_storyboard" as any);
        workflow.addEdge("generate_storyboard" as any, "generate_character_refs" as any);
        workflow.addEdge("generate_character_refs" as any, "process_scene" as any);

        // Conditional edge: process more scenes or finalize
        workflow.addConditionalEdges("process_scene" as any, (state: GraphState) => {
            if (!state.storyboard) return "finalize";
            if (state.currentSceneIndex >= state.storyboard.scenes.length) {
                return "finalize";
            }
            return "process_scene";
        });

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