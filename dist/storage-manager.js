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
exports.GCPStorageManager = void 0;
var storage_1 = require("@google-cloud/storage");
// ============================================================================
// GCP STORAGE MANAGER
// ============================================================================
var GCPStorageManager = /** @class */ (function () {
    function GCPStorageManager(projectId, bucketName) {
        this.storage = new storage_1.Storage({ projectId: projectId });
        this.bucketName = bucketName;
    }
    GCPStorageManager.prototype.uploadFile = function (localPath, destination) {
        return __awaiter(this, void 0, void 0, function () {
            var bucket;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bucket = this.storage.bucket(this.bucketName);
                        return [4 /*yield*/, bucket.upload(localPath, {
                                destination: destination,
                                metadata: {
                                    cacheControl: "public, max-age=31536000",
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, "gs://".concat(this.bucketName, "/").concat(destination)];
                }
            });
        });
    };
    GCPStorageManager.prototype.uploadBuffer = function (buffer, destination, contentType) {
        return __awaiter(this, void 0, void 0, function () {
            var bucket, file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bucket = this.storage.bucket(this.bucketName);
                        file = bucket.file(destination);
                        return [4 /*yield*/, file.save(buffer, {
                                contentType: contentType,
                                metadata: {
                                    cacheControl: "public, max-age=31536000",
                                },
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, "gs://".concat(this.bucketName, "/").concat(destination)];
                }
            });
        });
    };
    GCPStorageManager.prototype.uploadJSON = function (data, destination) {
        return __awaiter(this, void 0, void 0, function () {
            var buffer;
            return __generator(this, function (_a) {
                buffer = Buffer.from(JSON.stringify(data, null, 2));
                return [2 /*return*/, this.uploadBuffer(buffer, destination, "application/json")];
            });
        });
    };
    GCPStorageManager.prototype.downloadJSON = function (source) {
        return __awaiter(this, void 0, void 0, function () {
            var bucket, file, contents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bucket = this.storage.bucket(this.bucketName);
                        file = bucket.file(source);
                        return [4 /*yield*/, file.download()];
                    case 1:
                        contents = (_a.sent())[0];
                        return [2 /*return*/, JSON.parse(contents.toString())];
                }
            });
        });
    };
    GCPStorageManager.prototype.downloadBuffer = function (sourceUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var url, bucketName, filePath, bucket, file, contents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = new URL(sourceUrl);
                        if (url.protocol !== "gs:") {
                            throw new Error("Source URL must be a GCS URL (gs://...).");
                        }
                        bucketName = url.hostname;
                        filePath = url.pathname.substring(1);
                        bucket = this.storage.bucket(bucketName);
                        file = bucket.file(filePath);
                        return [4 /*yield*/, file.download()];
                    case 1:
                        contents = (_a.sent())[0];
                        return [2 /*return*/, contents];
                }
            });
        });
    };
    GCPStorageManager.prototype.getPublicUrl = function (path) {
        return "https://storage.googleapis.com/".concat(this.bucketName, "/").concat(path);
    };
    return GCPStorageManager;
}());
exports.GCPStorageManager = GCPStorageManager;
