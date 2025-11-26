
import { Storage } from "@google-cloud/storage";

export type GcsObjectType =
  | 'storyboard'
  | 'final_output'
  | 'character_image'
  | 'scene_video'
  | 'scene_last_frame'
  | 'stitched_video'
  | 'composite_frame';

// ============================================================================
// GCP STORAGE MANAGER
// ============================================================================

export class GCPStorageManager {
  private storage: Storage;
  private bucketName: string;
  private videoId: string;

  constructor(projectId: string, videoId: string, bucketName: string) {
    this.storage = new Storage({ projectId });
    this.bucketName = bucketName;
    this.videoId = videoId;
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
        if (match[1] !== this.bucketName) {
          throw new Error(`Cannot operate on object in different bucket: ${match[1]}`);
        }
        return match[2];
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
    type: GcsObjectType,
    params: {
      characterId?: string;
      sceneId?: number;
    } = {}
  ): string {
    const basePath = `${this.videoId}`;

    switch (type) {
      case 'storyboard':
        return `${basePath}/scenes/storyboard.json`;
        
      case 'character_image':
        if (!params.characterId) throw new Error('characterId is required for character_image');
        return `${basePath}/images/characters/${params.characterId}_reference.png`;
        
      case 'scene_last_frame':
        if (params.sceneId === undefined) throw new Error('sceneId is required for scene_last_frame');
        return `${basePath}/images/frames/scene_${params.sceneId.toString().padStart(3, '0')}_lastframe.jpg`;
          
      case 'composite_frame':
        if (params.sceneId === undefined) throw new Error('sceneId is required for composite_frame');
        return `${basePath}/images/frames/scene_${params.sceneId.toString().padStart(3, '0')}_composite.jpg`;
        
      case 'scene_video':
        if (params.sceneId === undefined) throw new Error('sceneId is required for scene_video');
        return `${basePath}/scenes/scene_${params.sceneId.toString().padStart(3, '0')}.mp4`;
      
      case 'stitched_video':
        return `${basePath}/final/movie.mp4`;
        
      case 'final_output':
        return `${basePath}/final/final_output.json`;
      
      default:
        throw new Error(`Unknown GCS object type: ${type}`);
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
    const [metadata] = await file.getMetadata();
    return metadata.contentType;
  }
}
