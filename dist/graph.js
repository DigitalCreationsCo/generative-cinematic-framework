"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CinematicVideoWorkflow = void 0;
var langgraph_1 = require("@langchain/langgraph");
var storage_manager_1 = require("./storage-manager");
var composition_agent_1 = require("./agents/composition-agent");
var continuity_manager_1 = require("./agents/continuity-manager");
var scene_generator_1 = require("./agents/scene-generator");
var google_1 = require("./google");
// ============================================================================
// LANGGRAPH WORKFLOW
// ============================================================================
var CinematicVideoWorkflow = /** @class */ (function () {
    function CinematicVideoWorkflow(projectId, bucketName, location) {
        if (location === void 0) { location = "us-central1"; }
        this.storageManager = new storage_manager_1.GCPStorageManager(projectId, bucketName);
        this.compositionalAgent = new composition_agent_1.CompositionalAgent(google_1.llm, this.storageManager);
        this.continuityAgent = new continuity_manager_1.ContinuityManagerAgent(google_1.llm, google_1.imageModel, this.storageManager);
        this.sceneAgent = new scene_generator_1.SceneGeneratorAgent(this.storageManager, google_1.videoModel);
        this.graph = this.buildGraph();
    }
    CinematicVideoWorkflow.prototype.buildGraph = function () {
        var _this = this;
        var workflow = new langgraph_1.StateGraph({
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
        workflow.addNode("generate_storyboard", function (state) { return __awaiter(_this, void 0, void 0, function () {
            var storyboard;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n📋 PHASE 1: Generating Storyboard...");
                        return [4 /*yield*/, this.compositionalAgent.generateStoryboard(state.initialPrompt)];
                    case 1:
                        storyboard = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, state), { storyboard: storyboard, currentSceneIndex: 0, generatedScenes: [], continuityContext: {
                                    characterStates: new Map(),
                                    locationStates: new Map(),
                                } })];
                }
            });
        }); });
        // Node: Generate Character References
        workflow.addNode("generate_character_refs", function (state) { return __awaiter(_this, void 0, void 0, function () {
            var projectId, characters;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!state.storyboard)
                            throw new Error("No storyboard available");
                        console.log("\n🎨 PHASE 2: Generating Character References...");
                        projectId = Date.now().toString();
                        return [4 /*yield*/, this.continuityAgent.generateCharacterReferences(state.storyboard.characters, projectId)];
                    case 1:
                        characters = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, state), { characters: characters })];
                }
            });
        }); });
        // Node: Process Scene
        workflow.addNode("process_scene", function (state) { return __awaiter(_this, void 0, void 0, function () {
            var scene, enhancedPrompt, projectId, previousFrameUrl, generatedScene, updatedContext;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!state.storyboard || !state.characters) {
                            throw new Error("Missing storyboard or characters");
                        }
                        scene = state.storyboard.scenes[state.currentSceneIndex];
                        console.log("\n\uD83C\uDFAC PHASE 3: Processing Scene ".concat(scene.id, "/").concat(state.storyboard.scenes.length));
                        return [4 /*yield*/, this.continuityAgent.enhanceScenePrompt(scene, state.characters, state.continuityContext)];
                    case 1:
                        enhancedPrompt = _b.sent();
                        projectId = Date.now().toString();
                        previousFrameUrl = (_a = state.continuityContext.previousScene) === null || _a === void 0 ? void 0 : _a.lastFrameUrl;
                        return [4 /*yield*/, this.sceneAgent.generateScene(scene, enhancedPrompt, projectId, previousFrameUrl)];
                    case 2:
                        generatedScene = _b.sent();
                        updatedContext = this.continuityAgent.updateContinuityContext(generatedScene, state.continuityContext, state.characters);
                        return [2 /*return*/, __assign(__assign({}, state), { generatedScenes: __spreadArray(__spreadArray([], state.generatedScenes, true), [generatedScene], false), currentSceneIndex: state.currentSceneIndex + 1, continuityContext: updatedContext })];
                }
            });
        }); });
        // Node: Finalize
        workflow.addNode("finalize", function (state) { return __awaiter(_this, void 0, void 0, function () {
            var projectId, outputPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n✅ PHASE 4: Finalizing Video...");
                        console.log("   Total scenes generated: ".concat(state.generatedScenes.length));
                        projectId = Date.now().toString();
                        outputPath = "video/".concat(projectId, "/scenes/final_output.json");
                        return [4 /*yield*/, this.storageManager.uploadJSON({
                                storyboard: state.storyboard,
                                characters: state.characters,
                                generatedScenes: state.generatedScenes,
                            }, outputPath)];
                    case 1:
                        _a.sent();
                        console.log("\n\uD83C\uDF89 Video generation complete!");
                        console.log("   Output saved to: ".concat(outputPath));
                        return [2 /*return*/, state];
                }
            });
        }); });
        // Define edges
        workflow.addEdge(langgraph_1.START, "generate_storyboard");
        workflow.addEdge("generate_storyboard", "generate_character_refs");
        workflow.addEdge("generate_character_refs", "process_scene");
        // Conditional edge: process more scenes or finalize
        workflow.addConditionalEdges("process_scene", function (state) {
            if (!state.storyboard)
                return "finalize";
            if (state.currentSceneIndex >= state.storyboard.scenes.length) {
                return "finalize";
            }
            return "process_scene";
        });
        workflow.addEdge("finalize", langgraph_1.END);
        return workflow;
    };
    CinematicVideoWorkflow.prototype.execute = function (initialPrompt) {
        return __awaiter(this, void 0, void 0, function () {
            var compiledGraph, initialState, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        compiledGraph = this.graph.compile();
                        initialState = {
                            initialPrompt: initialPrompt,
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
                        return [4 /*yield*/, compiledGraph.invoke(initialState)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    return CinematicVideoWorkflow;
}());
exports.CinematicVideoWorkflow = CinematicVideoWorkflow;
