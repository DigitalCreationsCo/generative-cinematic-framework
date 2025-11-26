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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneGeneratorAgent = void 0;
var fs_1 = require("fs");
var path_1 = __importDefault(require("path"));
// ============================================================================
// SCENE GENERATOR AGENT
// ============================================================================
var SceneGeneratorAgent = /** @class */ (function () {
    function SceneGeneratorAgent(llm, storageManager) {
        this.storageManager = storageManager;
        this.llm = llm;
    }
    SceneGeneratorAgent.prototype.generateScene = function (scene, enhancedPrompt, projectId, previousFrameUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var model, response, videoBuffer, videoPath, mimeType, videoUrl, lastFrameUrl;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\n\uD83C\uDFAC Generating Scene ".concat(scene.id, ": ").concat(scene.timeStart, " - ").concat(scene.timeEnd));
                        console.log("   Duration: ".concat(scene.duration, "s | Shot: ").concat(scene.shotType));
                        model = this.llm.getGenerativeModel({ model: "veo" });
                        return [4 /*yield*/, model.generateContent({
                                contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
                            })];
                    case 1:
                        response = _a.sent();
                        videoBuffer = Buffer.from(response.response.text(), "base64");
                        videoPath = "video/".concat(projectId, "/clips/scene_").concat(scene.id.toString().padStart(3, "0"), ".mp4");
                        mimeType = "video/mp4";
                        return [4 /*yield*/, this.storageManager.uploadBuffer(videoBuffer, videoPath, mimeType)];
                    case 2:
                        videoUrl = _a.sent();
                        console.log("   \u2713 Video generated and uploaded: ".concat(videoUrl));
                        return [4 /*yield*/, this.extractLastFrame(videoUrl, projectId, scene.id)];
                    case 3:
                        lastFrameUrl = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, scene), { enhancedPrompt: enhancedPrompt, generatedVideoUrl: videoUrl, lastFrameUrl: lastFrameUrl })];
                }
            });
        });
    };
    SceneGeneratorAgent.prototype.extractLastFrame = function (videoUrl, projectId, sceneId) {
        return __awaiter(this, void 0, void 0, function () {
            var tempVideoPath, tempFramePath, videoBuffer, ffmpegBin, args, frameBuffer, framePath, mimeType, frameUrl, error_1, cleanupError_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tempVideoPath = path_1.default.join("/tmp", "scene_".concat(sceneId, "_").concat(Date.now(), ".mp4"));
                        tempFramePath = path_1.default.join("/tmp", "scene_".concat(sceneId, "_").concat(Date.now(), "_lastframe.jpg"));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, 9, 14]);
                        return [4 /*yield*/, this.storageManager.downloadBuffer(videoUrl)];
                    case 2:
                        videoBuffer = _a.sent();
                        return [4 /*yield*/, fs_1.promises.writeFile(tempVideoPath, videoBuffer)];
                    case 3:
                        _a.sent();
                        console.log("   \u2713 Video downloaded to temporary path: ".concat(tempVideoPath));
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('@ffmpeg-installer/ffmpeg')); })];
                    case 4:
                        ffmpegBin = (_a.sent());
                        args = ["-sseof -1", "-i \"".concat(tempVideoPath, "\""), "-update 1", "-q:v 1", "\"".concat(tempFramePath, "\"")];
                        return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('child_process')); })];
                    case 5:
                        (_a.sent()).spawn(ffmpegBin.path, args);
                        console.log("   \u2713 Last frame extracted using ffmpeg to: ".concat(tempFramePath));
                        return [4 /*yield*/, fs_1.promises.readFile(tempFramePath)];
                    case 6:
                        frameBuffer = _a.sent();
                        framePath = "video/".concat(projectId, "/frames/scene_").concat(sceneId.toString().padStart(3, "0"), "_lastframe.jpg");
                        mimeType = "image/jpeg";
                        return [4 /*yield*/, this.storageManager.uploadBuffer(frameBuffer, framePath, mimeType)];
                    case 7:
                        frameUrl = _a.sent();
                        console.log("   \u2713 Last frame uploaded to GCS: ".concat(frameUrl));
                        return [2 /*return*/, frameUrl];
                    case 8:
                        error_1 = _a.sent();
                        console.error("Error extracting last frame:", error_1);
                        throw new Error("Failed to extract last frame for scene ".concat(sceneId, "."));
                    case 9:
                        _a.trys.push([9, 12, , 13]);
                        return [4 /*yield*/, fs_1.promises.unlink(tempVideoPath)];
                    case 10:
                        _a.sent();
                        return [4 /*yield*/, fs_1.promises.unlink(tempFramePath)];
                    case 11:
                        _a.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        cleanupError_1 = _a.sent();
                        console.error("Error cleaning up temporary files:", cleanupError_1);
                        return [3 /*break*/, 13];
                    case 13: return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    return SceneGeneratorAgent;
}());
exports.SceneGeneratorAgent = SceneGeneratorAgent;
//# sourceMappingURL=scene-generator.js.map