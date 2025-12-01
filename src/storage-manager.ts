
import { Storage } from "@google-cloud/storage";
import path from "path";

export type GcsObjectType =
  | 'storyboard'
  | 'final_output'
  | 'character_image'
  | 'location_image'
  | 'scene_video'
  | 'scene_last_frame'
  | 'stitched_video'
  | 'composite_frame'
  | 'quality_evaluation';

type GcsObjectPathParams =
  | { type: 'storyboard'; }
  | { type: 'final_output'; }
  | { type: 'stitched_video'; }
  | { type: 'character_image'; characterId: string; }
  | { type: 'location_image'; locationId: string; }
  | { type: 'scene_video'; sceneId: number; attempt?: number | 'latest'; }
  | { type: 'scene_last_frame'; sceneId: number; attempt?: number | 'latest'; }
  | { type: 'composite_frame'; sceneId: number; attempt?: number | 'latest'; }
  | { type: 'quality_evaluation'; sceneId: number; attempt?: number | 'latest'; };
// ============================================================================
// GCP STORAGE MANAGER
// ============================================================================

export class GCPStorageManager {
  private storage: Storage;
  private bucketName: string;
  private videoId: string;
  private latestAttempts: Map<string, number> = new Map();

  constructor(projectId: string, videoId: string, bucketName: string) {
    this.storage = new Storage({ projectId });
    this.bucketName = bucketName;
    this.videoId = videoId;
  }

  /**
   * Records the latest attempt number for a given object type and sceneId.
   * Call this after successfully uploading a file.
   */
  setLatestAttempt(type: GcsObjectType, sceneId: number, attempt: number): void {
    const key = `${type}_${sceneId}`;
    const current = this.latestAttempts.get(key) || 0;
    if (attempt > current) {
      this.latestAttempts.set(key, attempt);
    }
  }

  /**
   * Retrieves the latest attempt number for a given object type and sceneId.
   * Returns 1 if no attempt has been recorded.
   */
  private getLatestAttempt(type: GcsObjectType, sceneId: number): number {
    const key = `${type}_${sceneId}`;
    return this.latestAttempts.get(key) || 1;
  }

  async uploadFile(
    localPath: string,
    destination: string
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    await bucket.upload(localPath, {
      destination,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });
    return `gs://${this.bucketName}/${destination}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    destination: string,
    contentType: string
  ): Promise<string> {
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

  async uploadJSON(data: any, destination: string): Promise<string> {
    const buffer = Buffer.from(JSON.stringify(data, null, 2));
    return this.uploadBuffer(buffer, destination, "application/json");
  }

  async uploadAudioFile(localPath: string): Promise<string> {
    const fileName = path.basename(localPath);
    const destination = `audio/${fileName}`;
    const gcsUri = this.getGcsUrl(destination);

    const exists = await this.fileExists(gcsUri);
    if (exists) {
      console.log(`   ... Audio file already exists at ${gcsUri}, skipping upload.`);
      return gcsUri;
    }

    console.log(`   ... Uploading ${localPath} to GCS at ${destination}`);
    return this.uploadFile(localPath, destination);
  }

  async downloadJSON<T>(source: string): Promise<T> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(source);
    const [ contents ] = await file.download();
    return JSON.parse(contents.toString()) as T;
  }

  private parsePathFromUri(uriOrPath: string): string {
    if (uriOrPath.startsWith("gs://")) {
      const match = uriOrPath.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (match) {
        if (match[ 1 ] !== this.bucketName) {
          throw new Error(`Cannot operate on object in different bucket: ${match[ 1 ]}`);
        }
        return match[ 2 ];
      }
      throw new Error(`Invalid GCS URI format: ${uriOrPath}`);
    }
    return uriOrPath;
  }

  async downloadFile(gcsPath: string, localDestination: string): Promise<void> {
    const path = this.parsePathFromUri(gcsPath);
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(path);
    await file.download({ destination: localDestination });
  }

  async downloadToBuffer(gcsPath: string): Promise<Buffer> {
    const path = this.parsePathFromUri(gcsPath);
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(path);
    const [ contents ] = await file.download();
    return contents;
  }

  async fileExists(gcsPath: string): Promise<boolean> {
    const path = this.parsePathFromUri(gcsPath);
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(path);
    const [ exists ] = await file.exists();
    return exists;
  }

  /**
   * Resolves the attempt number to use for file operations.
   * If attempt is 'latest' or undefined, returns the stored latest attempt.
   * If attempt is a number, returns that number.
   */
  private resolveAttempt(type: GcsObjectType, sceneId: number, attempt?: number | 'latest'): number {
    if (attempt === 'latest' || attempt === undefined) {
      return this.getLatestAttempt(type, sceneId);
    }
    return attempt;
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
  getGcsObjectPath(
    params: GcsObjectPathParams
  ): string {
    const basePath = `${this.videoId}`;

    switch (params.type) {
      case 'storyboard':
        return `${basePath}/scenes/storyboard.json`;

      case 'character_image':
        return `${basePath}/images/characters/${params.characterId}_reference.png`;

      case 'location_image':
        return `${basePath}/images/locations/${params.locationId}_reference.png`;

      case 'scene_last_frame': {
        const attemptNum = this.resolveAttempt(params.type, params.sceneId, params.attempt);
        return `${basePath}/images/frames/scene_${params.sceneId.toString().padStart(3, '0')}_lastframe_${attemptNum.toString().padStart(2, '0')}.jpg`;
      }

      case 'composite_frame': {
        const attemptNum = this.resolveAttempt(params.type, params.sceneId, params.attempt);
        return `${basePath}/images/frames/scene_${params.sceneId.toString().padStart(3, '0')}_composite_${attemptNum.toString().padStart(2, '0')}.jpg`;
      }

      case 'scene_video': {
        const attemptNum = this.resolveAttempt(params.type, params.sceneId, params.attempt);
        return `${basePath}/scenes/scene_${params.sceneId.toString().padStart(3, '0')}_${attemptNum.toString().padStart(2, '0')}.mp4`;
      }

      case 'quality_evaluation': {
        const attemptNum = this.resolveAttempt(params.type, params.sceneId, params.attempt);
        return `${basePath}/scenes/scene_${params.sceneId.toString().padStart(3, '0')}_evaluation_${attemptNum.toString().padStart(2, '0')}.mp4`;
      }

      case 'stitched_video':
        return `${basePath}/final/movie.mp4`;

      case 'final_output':
        return `${basePath}/final/final_output.json`;

      default:
        throw new Error(`Unknown GCS object type: ${(params as any).type}`);
    }
  }

  getPublicUrl(path: string): string {
    const normalizedPath = this.parsePathFromUri(path);
    return `https://storage.googleapis.com/${this.bucketName}/${normalizedPath}`;
  }

  getGcsUrl(path: string): string {
    const normalizedPath = this.parsePathFromUri(path);
    return `gs://${this.bucketName}/${normalizedPath}`;
  }

  async getObjectMimeType(gcsPath: string): Promise<string | undefined> {
    const path = this.parsePathFromUri(gcsPath);
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(path);
    const [ metadata ] = await file.getMetadata();
    return metadata.contentType;
  }
}
