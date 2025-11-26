"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GCPStorageManager = void 0;
const storage_1 = require("@google-cloud/storage");
// ============================================================================
// GCP STORAGE MANAGER
// ============================================================================
class GCPStorageManager {
    storage;
    bucketName;
    videoId;
    constructor(projectId, videoId, bucketName) {
        this.storage = new storage_1.Storage({ projectId });
        this.bucketName = bucketName;
        this.videoId = videoId;
    }
    async uploadFile(localPath, destination) {
        const bucket = this.storage.bucket(this.bucketName);
        await bucket.upload(localPath, {
            destination,
            metadata: {
                cacheControl: "public, max-age=31536000",
            },
        });
        return `gs://${this.bucketName}/${destination}`;
    }
    async uploadBuffer(buffer, destination, contentType) {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(destination);
        await file.save(buffer, {
            contentType,
            metadata: {
                cacheControl: "public, max-age=31536000",
            },
        });
        return `gs://${this.bucketName}/${destination}`;
    }
    async uploadJSON(data, destination) {
        const buffer = Buffer.from(JSON.stringify(data, null, 2));
        return this.uploadBuffer(buffer, destination, "application/json");
    }
    async downloadJSON(source) {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(source);
        const [contents] = await file.download();
        return JSON.parse(contents.toString());
    }
    parsePathFromUri(uriOrPath) {
        if (uriOrPath.startsWith("gs://")) {
            const match = uriOrPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
            if (match) {
                if (match[1] !== this.bucketName) {
                    throw new Error(`Cannot operate on object in different bucket: ${match[1]}`);
                }
                return match[2];
            }
            throw new Error(`Invalid GCS URI format: ${uriOrPath}`);
        }
        return uriOrPath;
    }
    async downloadFile(gcsPath, localDestination) {
        const path = this.parsePathFromUri(gcsPath);
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(path);
        await file.download({ destination: localDestination });
    }
    /**
     * Generates a standardized GCS object URI path based on the project structure.
     * Structure: video/[projectId]/[type-specific-path]
     *
     * @param projectId - The ID of the project.
     * @param type - The type of object to generate a path for.
     * @param params - Optional parameters required for specific types (characterId, sceneId).
     * @returns The full GCS object path.
     */
    getGcsObjectPath(type, params = {}) {
        const basePath = `${this.videoId}`;
        switch (type) {
            case 'storyboard':
                return `${basePath}/scenes/storyboard.json`;
            case 'final_output':
                return `${basePath}/scenes/final_output.json`;
            case 'character_image':
                if (!params.characterId)
                    throw new Error('characterId is required for character_image');
                return `${basePath}/images/characters/${params.characterId}_reference.png`;
            case 'scene_video':
                if (params.sceneId === undefined)
                    throw new Error('sceneId is required for scene_video');
                return `${basePath}/clips/scene_${params.sceneId.toString().padStart(3, '0')}.mp4`;
            case 'scene_last_frame':
                if (params.sceneId === undefined)
                    throw new Error('sceneId is required for scene_last_frame');
                return `${basePath}/clips/scene_${params.sceneId.toString().padStart(3, '0')}_lastframe.jpg`;
            case 'stitched_video':
                return `${basePath}/final/movie.mp4`;
            default:
                throw new Error(`Unknown GCS object type: ${type}`);
        }
    }
    getPublicUrl(path) {
        const normalizedPath = this.parsePathFromUri(path);
        return `https://storage.googleapis.com/${this.bucketName}/${normalizedPath}`;
    }
    getGcsUrl(path) {
        const normalizedPath = this.parsePathFromUri(path);
        return `gs://${this.bucketName}/${normalizedPath}`;
    }
    async getObjectMimeType(gcsPath) {
        const path = this.parsePathFromUri(gcsPath);
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(path);
        const [metadata] = await file.getMetadata();
        return metadata.contentType;
    }
}
exports.GCPStorageManager = GCPStorageManager;
//# sourceMappingURL=storage.manager.js.map