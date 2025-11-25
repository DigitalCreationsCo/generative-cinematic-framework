"use strict";
// ============================================================================
// MAIN EXECUTION
// ============================================================================
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
var dotenv_1 = require("dotenv");
(0, dotenv_1.configDotenv)();
var graph_1 = require("./graph");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var projectId, bucketName, workflow, initialPrompt, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    projectId = process.env.GCP_PROJECT_ID || "your-project-id";
                    bucketName = process.env.GCP_BUCKET_NAME || "your-bucket-name";
                    workflow = new graph_1.CinematicVideoWorkflow(projectId, bucketName);
                    initialPrompt = "\nCreate a full-length music video featuring cinematic shots interlaced with a live musical performance. \nDynamically switch between cinematic shots and band performance shots.\n\nMusical Performance:\nProgressive metal band performing in a large stone room. Cinematic studio grade lighting changes \nfrom white to violet to red depending on the tone of the music. Sunlight rays enter from gaps in \nthe stone walls.\n\nList of Scenes:\n<video_scenes>\nDesert scene\n2X speed fly-over\nA group of exeditioners with a caravan of camels\nCrossing the Egyptian deserts\nTo arrive at the tomb of the ancient Egyptian king\nThey enter the tomb cautiously,\nA man a woman and two other men\nThey quickly realize the tomb is laid with traps\nThey\u2019re forced to move deeper into the tomb,\n Becoming trapped\nThey enter the hall of the king\nThis is what they have been looking for\nThe man and the woman approach the sarcophagus\nThey expect to find treasure here\nBut they are cautious\nThey trigger a trap\nActivating ancient deeath machines\nThe hall becomes a tomb for the expeditioners\nOne man dies\nThe other three run to avoid the death machines\nThey run through a labyrinth deep inside the inner tomb\nDeath machines pursue them relentlessly\nThey encounter a chasm\nThe woman swings across on a vine\nBelow them is a pit of death, filled with rattlesnakes and sharp spires\nFalling is certain death\nThey are forced to cross\nThe man pulls the vine\nHe swings across\nThe other man falls to his death\nThe couple race deeper into the tomb\nIts pitch black\nThey feel water in the room\nThe death machines will be coming soon\nThey descend into the water\nThe current is strong, they are pulled away\nThe water swallows them as they are pulled under\nThey can see a light\nThe current takes them through an opening\nAn outlet flows into the mouth of the river\nThey are freed from the tomb\nThey live to tell the tale\nBut at what cost?\nThe man and the woman come to the riverbank\nThey lay and breathe\nThe man has retrieved the treasure they claimed\nThe woman has plans of her own\nThey draws a pistol\nThe man has a pained expression\nWhy have you done this?\nI serve the highest king she says\nShe shows a tattoo of an ancient insignia\n[camera closeup on his eyes, betrayed expression]\nHe looks into her eyes\nHer irises shift, she is not human\nShe shoots him\nRecovers the treasure\nAnd walks away from the scene\nIn the desert, She comes to a parked horse\nMounts and rides into the dunes.\nEND just as the song finishes.\n";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, workflow.execute(initialPrompt)];
                case 2:
                    result = _a.sent();
                    console.log("\n" + "=".repeat(60));
                    console.log("✅ Workflow completed successfully!");
                    console.log("   Generated ".concat(result.generatedScenes.length, " scenes"));
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("\n❌ Workflow failed:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
