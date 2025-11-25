"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompositionalAgent = void 0;
// ============================================================================
// COMPOSITIONAL AGENT
// ============================================================================
var CompositionalAgent = /** @class */ (function () {
    function CompositionalAgent(llm, storageManager) {
        this.llm = llm;
        this.storageManager = storageManager;
    }
    CompositionalAgent.prototype.generateStoryboard = function (initialPrompt) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, response, content, jsonMatch, storyboard, storyboardPath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are an expert cinematic director and storyboard artist. \nYour task is to analyze a creative prompt and generate a complete, professional storyboard.\n\nCRITICAL: You must INFER missing information from the prompt context:\n- If no duration is specified, analyze the content type and estimate appropriate length\n- For music videos with audio input: extract exact duration from audio data\n- Extract style, mood, and key moments from any audio descriptions, lyrics, or narrative beats provided\n\nOutput a JSON object with the following structure:\n{\n  \"metadata\": {\n    \"title\": \"string\",\n    \"duration\": \"MM:SS\",\n    \"totalScenes\": number,\n    \"style\": \"inferred cinematic style (e.g., 'High-energy progressive metal with technical instrumentation')\",\n    \"mood\": \"overall emotional arc (e.g., 'Aggressive yet melodic, building tension with moments of triumph')\",\n    \"colorPalette\": [\"color1\", \"color2\", ...],\n    \"tags\": [\"tag1\", \"tag2\", ...],\n    \"keyMoments\": [\n      {\n        \"timeStart\": \"MM:SS\",\n        \"timeEnd\": \"MM:SS\",\n        \"description\": \"what happens in this key moment\",\n        \"importance\": \"critical|high|medium\",\n        \"visualPriority\": \"specific visual direction for this moment\"\n      }\n    ]\n  },\n  \"characters\": [\n    {\n      \"id\": \"char_1\",\n      \"name\": \"string\",\n      \"description\": \"detailed physical description\",\n      \"physicalTraits\": {\n        \"hair\": \"specific hairstyle, color, length\",\n        \"clothing\": \"specific outfit description\",\n        \"accessories\": [\"item1\", \"item2\"],\n        \"distinctiveFeatures\": [\"feature1\", \"feature2\"]\n      },\n      \"appearanceNotes\": [\"note1\", \"note2\"]\n    }\n  ],\n  \"locations\": [\n    {\n      \"id\": \"loc_1\",\n      \"name\": \"string\",\n      \"description\": \"detailed location description\",\n      \"lightingConditions\": \"string\",\n      \"timeOfDay\": \"string\"\n    }\n  ],\n  \"scenes\": [\n    {\n      \"id\": 1,\n      \"timeStart\": \"MM:SS\",\n      \"timeEnd\": \"MM:SS\",\n      \"duration\": seconds,\n      \"shotType\": \"wide/medium/close-up/etc\",\n      \"description\": \"detailed scene description\",\n      \"cameraMovement\": \"static/pan/dolly/etc\",\n      \"lighting\": \"description\",\n      \"mood\": \"emotional tone\",\n      \"audioSync\": \"how visuals sync with audio\",\n      \"continuityNotes\": [\"note1\", \"note2\"],\n      \"charactersPresent\": [\"char_1\", \"char_2\"],\n      \"locationId\": \"loc_1\"\n    }\n  ]\n}\n\nCritical guidelines:\n1. ANALYZE the prompt for Scene descriptions, timing cues\n2. Extract key moments from any provided audio/narrative structure, estimate appropriate pacing of music and narrative elements\n3. INFER style and mood from descriptive language in the prompt\n4. Break video into logical scenes (typically 5-30 seconds each)\n5. Describe characters with EXTREME detail for visual consistency\n6. Track which characters appear in which scenes\n7. Maintain continuity notes for costume, props, lighting\n8. Specify exact timing for each scene\n9. Consider cinematic techniques: shot composition, camera angles, lighting\n10. Match scene pacing to audio/mood requirements\n11. You are aware of the length limitations of video generation and are adept at creating continuous from multiple generated videos.\n\nExamples of inference:\n- \"Progressive metal band\" \u2192 Style: \"High-energy progressive metal with technical instrumentation\"\n- \"lighting changes from white to violet to red\" \u2192 ColorPalette: [\"White\", \"Violet\", \"Red\"]\n- \"00:00 - 00:18 explosive opening\" \u2192 KeyMoment: {timeStart: \"00:00\", timeEnd: \"00:18\", description: \"Explosive opening with driving guitar riffs\"}\n";
                        return [4 /*yield*/, this.llm.invoke([
                                { role: "system", content: systemPrompt },
                                { role: "user", content: initialPrompt },
                            ])];
                    case 1:
                        response = _a.sent();
                        content = response;
                        jsonMatch = content.match(/\{[\s\S]*\}/);
                        if (!jsonMatch) {
                            throw new Error("Failed to extract JSON from LLM response");
                        }
                        storyboard = JSON.parse(jsonMatch[0]);
                        storyboardPath = "video/".concat(Date.now(), "/scenes/storyboard.json");
                        return [4 /*yield*/, this.storageManager.uploadJSON(storyboard, storyboardPath)];
                    case 2:
                        _a.sent();
                        console.log("\u2713 Storyboard generated: ".concat(storyboard.metadata.totalScenes, " scenes"));
                        return [2 /*return*/, storyboard];
                }
            });
        });
    };
    return CompositionalAgent;
}());
exports.CompositionalAgent = CompositionalAgent;
