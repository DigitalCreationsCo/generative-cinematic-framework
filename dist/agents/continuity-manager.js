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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuityManagerAgent = void 0;
// ============================================================================
// CONTINUITY MANAGER AGENT
// ============================================================================
var ContinuityManagerAgent = /** @class */ (function () {
    function ContinuityManagerAgent(llm, imageModel, storageManager) {
        this.llm = llm;
        this.imageModel = imageModel;
        this.storageManager = storageManager;
    }
    ContinuityManagerAgent.prototype.generateCharacterReferences = function (characters, projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var updatedCharacters, _i, characters_1, character, imagePrompt, imageData, buffer, imagePath, mimeType, imageUrl, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n\uD83C\uDFA8 Generating reference images for ".concat(characters.length, " characters..."));
                        updatedCharacters = [];
                        _i = 0, characters_1 = characters;
                        _a.label = 1;
                    case 1:
                        if (!(_i < characters_1.length)) return [3 /*break*/, 7];
                        character = characters_1[_i];
                        console.log("  \u2192 Generating: ".concat(character.name));
                        imagePrompt = this.buildCharacterImagePrompt(character);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, this.imageModel.invoke(imagePrompt, {})];
                    case 3:
                        imageData = _a.sent();
                        buffer = Buffer.from(imageData, "base64");
                        imagePath = "video/".concat(projectId, "/images/characters/").concat(character.id, "_reference.png");
                        mimeType = "image/png";
                        return [4 /*yield*/, this.storageManager.uploadBuffer(buffer, imagePath, mimeType)];
                    case 4:
                        imageUrl = _a.sent();
                        updatedCharacters.push(__assign(__assign({}, character), { referenceImageUrl: imageUrl }));
                        console.log("    \u2713 Saved: ".concat(imageUrl));
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _a.sent();
                        console.error("    \u2717 Failed to generate image for ".concat(character.name, ":"), error_1);
                        // Continue with empty reference
                        updatedCharacters.push(__assign(__assign({}, character), { referenceImageUrl: "" }));
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, updatedCharacters];
                }
            });
        });
    };
    ContinuityManagerAgent.prototype.buildCharacterImagePrompt = function (character) {
        return "High-quality, photorealistic portrait of ".concat(character.description, ".\nPhysical details:\n- Hair: ").concat(character.physicalTraits.hair, "\n- Clothing: ").concat(character.physicalTraits.clothing, "\n- Accessories: ").concat(character.physicalTraits.accessories.join(", "), "\n- Distinctive features: ").concat(character.physicalTraits.distinctiveFeatures.join(", "), "\n\nAdditional notes: ").concat(character.appearanceNotes.join(". "), "\n\nStyle: Professional cinematic photography, studio lighting, sharp focus, high detail, 8K quality.\nCamera: Medium shot, neutral expression, clear view of costume and features.");
    };
    ContinuityManagerAgent.prototype.enhanceScenePrompt = function (scene, characters, context) {
        return __awaiter(this, void 0, void 0, function () {
            var systemPrompt, characterDetails, contextInfo, userPrompt, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        systemPrompt = "You are a continuity supervisor for a cinematic production.\nYour job is to enhance scene prompts with precise continuity details to ensure visual consistency.\n\nGiven:\n1. A base scene description\n2. Character reference details\n3. Previous scene context\n\nGenerate an enhanced prompt that includes:\n- Exact character appearance details (same hairstyle, same clothing, same accessories)\n- Lighting consistency notes\n- Spatial continuity (character positions relative to previous scene)\n- Props and environment details that must remain consistent\n\nOutput ONLY the enhanced prompt text, no JSON or extra formatting.";
                        characterDetails = scene.charactersPresent
                            .map(function (charId) {
                            var char = characters.find(function (c) { return c.id === charId; });
                            if (!char)
                                return "";
                            var state = context.characterStates.get(charId);
                            return "\nCharacter: ".concat(char.name, " (ID: ").concat(char.id, ")\n- Reference Image: ").concat(char.referenceImageUrl, "\n- Hair: ").concat((state === null || state === void 0 ? void 0 : state.currentAppearance.hair) || char.physicalTraits.hair, "\n- Clothing: ").concat((state === null || state === void 0 ? void 0 : state.currentAppearance.clothing) || char.physicalTraits.clothing, "\n- Accessories: ").concat(((state === null || state === void 0 ? void 0 : state.currentAppearance.accessories) || char.physicalTraits.accessories).join(", "), "\n- Last seen in scene ").concat((state === null || state === void 0 ? void 0 : state.lastSeen) || "N/A", "\n- Current position: ").concat((state === null || state === void 0 ? void 0 : state.position) || "unknown", "\n- Emotional state: ").concat((state === null || state === void 0 ? void 0 : state.emotionalState) || "neutral");
                        })
                            .join("\n");
                        contextInfo = context.previousScene
                            ? "\nPrevious Scene (".concat(context.previousScene.id, "):\n- Description: ").concat(context.previousScene.description, "\n- Lighting: ").concat(context.previousScene.lighting, "\n- Camera: ").concat(context.previousScene.cameraMovement, "\n- Last frame available at: ").concat(context.previousScene.lastFrameUrl || "N/A")
                            : "This is the first scene.";
                        userPrompt = "\nBase Scene Description:\n".concat(scene.description, "\n\nShot Type: ").concat(scene.shotType, "\nCamera Movement: ").concat(scene.cameraMovement, "\nLighting: ").concat(scene.lighting, "\nMood: ").concat(scene.mood, "\n\nCharacters Present:\n").concat(characterDetails, "\n\nContext:\n").concat(contextInfo, "\n\nContinuity Notes:\n").concat(scene.continuityNotes.join("\n"), "\n\nEnhance this prompt with precise continuity details for AI video generation.");
                        return [4 /*yield*/, this.llm.invoke([
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userPrompt },
                            ])];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response];
                }
            });
        });
    };
    ContinuityManagerAgent.prototype.updateContinuityContext = function (scene, context, characters) {
        // Update character states
        scene.charactersPresent.forEach(function (charId) {
            var char = characters.find(function (c) { return c.id === charId; });
            if (!char)
                return;
            context.characterStates.set(charId, {
                lastSeen: scene.id,
                currentAppearance: {
                    hair: char.physicalTraits.hair,
                    clothing: char.physicalTraits.clothing,
                    accessories: char.physicalTraits.accessories,
                },
                position: scene.description.includes("left") ? "left" : "center",
                emotionalState: scene.mood,
            });
        });
        context.previousScene = scene;
        return context;
    };
    return ContinuityManagerAgent;
}());
exports.ContinuityManagerAgent = ContinuityManagerAgent;
