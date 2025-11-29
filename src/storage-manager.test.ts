import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GCPStorageManager } from './storage-manager';

const mockFile = {
  save: vi.fn(),
  download: vi.fn(),
  exists: vi.fn().mockResolvedValue([true]),
  getMetadata: vi.fn().mockResolvedValue([{ contentType: 'video/mp4' }]),
};

const mockBucket = {
  upload: vi.fn(),
  file: vi.fn(() => mockFile),
};

const mockStorage = {
  bucket: vi.fn(() => mockBucket),
};

vi.mock('@google-cloud/storage', () => {
  class MockStorage {
    constructor() {
      return mockStorage;
    }
  }
  return { Storage: MockStorage };
});

describe('GCPStorageManager', () => {
  let storageManager: GCPStorageManager;
  const projectId = 'test-project';
  const videoId = 'test-video';
  const bucketName = 'test-bucket';

  beforeEach(() => {
    storageManager = new GCPStorageManager(projectId, videoId, bucketName);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be initialized correctly', () => {
    expect(storageManager).toBeInstanceOf(GCPStorageManager);
  });

  describe('getGcsObjectPath', () => {
    it('should generate correct paths for all object types', () => {
      expect(storageManager.getGcsObjectPath('storyboard')).toBe('test-video/scenes/storyboard.json');
      expect(storageManager.getGcsObjectPath('character_image', { characterId: 'char1' })).toBe('test-video/images/characters/char1_reference.png');
      expect(storageManager.getGcsObjectPath('scene_last_frame', { sceneId: 1 })).toBe('test-video/images/frames/scene_001_lastframe.jpg');
      expect(storageManager.getGcsObjectPath('composite_frame', { sceneId: 1 })).toBe('test-video/images/frames/scene_001_composite.jpg');
      expect(storageManager.getGcsObjectPath('scene_video', { sceneId: 1 })).toBe('test-video/scenes/scene_001.mp4');
      expect(storageManager.getGcsObjectPath('stitched_video')).toBe('test-video/final/movie.mp4');
      expect(storageManager.getGcsObjectPath('final_output')).toBe('test-video/final/final_output.json');
    });

    it('should throw an error for missing required parameters', () => {
      expect(() => storageManager.getGcsObjectPath('character_image')).toThrow('characterId is required for character_image');
      expect(() => storageManager.getGcsObjectPath('scene_last_frame')).toThrow('sceneId is required for scene_last_frame');
      expect(() => storageManager.getGcsObjectPath('composite_frame')).toThrow('sceneId is required for composite_frame');
      expect(() => storageManager.getGcsObjectPath('scene_video')).toThrow('sceneId is required for scene_video');
    });

    it('should throw an error for unknown object type', () => {
      // @ts-expect-error
      expect(() => storageManager.getGcsObjectPath('unknown_type')).toThrow('Unknown GCS object type: unknown_type');
    });
  });

  describe('getPublicUrl', () => {
    it('should return the correct public URL', () => {
      const path = 'test-video/final/movie.mp4';
      const expectedUrl = 'https://storage.googleapis.com/test-bucket/test-video/final/movie.mp4';
      expect(storageManager.getPublicUrl(path)).toBe(expectedUrl);
    });
  });

  describe('getGcsUrl', () => {
    it('should return the correct GCS URL', () => {
      const path = 'test-video/final/movie.mp4';
      const expectedUrl = 'gs://test-bucket/test-video/final/movie.mp4';
      expect(storageManager.getGcsUrl(path)).toBe(expectedUrl);
    });
  });

  describe('uploadFile', () => {
    it('should call bucket.upload with the correct parameters', async () => {
      const localPath = '/tmp/test.txt';
      const destination = 'test/test.txt';
      await storageManager.uploadFile(localPath, destination);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.upload).toHaveBeenCalledWith(localPath, {
        destination,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });
    });
  });

  describe('uploadBuffer', () => {
    it('should call file.save with the correct parameters', async () => {
      const buffer = Buffer.from('test');
      const destination = 'test/test.txt';
      const contentType = 'text/plain';
      await storageManager.uploadBuffer(buffer, destination, contentType);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.file).toHaveBeenCalledWith(destination);
      expect(mockFile.save).toHaveBeenCalledWith(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });
    });
  });

  describe('uploadJSON', () => {
    it('should call uploadBuffer with the correct parameters', async () => {
      const data = { key: 'value' };
      const destination = 'test/test.json';
      const buffer = Buffer.from(JSON.stringify(data, null, 2));
      const spy = vi.spyOn(storageManager, 'uploadBuffer');
      await storageManager.uploadJSON(data, destination);
      expect(spy).toHaveBeenCalledWith(buffer, destination, 'application/json');
    });
  });

  describe('downloadJSON', () => {
    it('should download and parse a JSON file', async () => {
      const source = 'test/test.json';
      const data = { key: 'value' };
      const buffer = Buffer.from(JSON.stringify(data));
      mockFile.download.mockResolvedValue([buffer]);
      const result = await storageManager.downloadJSON(source);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.file).toHaveBeenCalledWith(source);
      expect(result).toEqual(data);
    });
  });

  describe('downloadFile', () => {
    it('should call file.download with the correct parameters', async () => {
      const gcsPath = 'gs://test-bucket/test/test.txt';
      const localDestination = '/tmp/test.txt';
      await storageManager.downloadFile(gcsPath, localDestination);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.file).toHaveBeenCalledWith('test/test.txt');
      expect(mockFile.download).toHaveBeenCalledWith({ destination: localDestination });
    });

    it('should throw an error for invalid GCS URI', async () => {
      const gcsPath = 'gs://';
      const localDestination = '/tmp/test.txt';
      await expect(storageManager.downloadFile(gcsPath, localDestination)).rejects.toThrow('Invalid GCS URI format: gs://');
    });

    it('should throw an error for different bucket', async () => {
      const gcsPath = 'gs://different-bucket/test/test.txt';
      const localDestination = '/tmp/test.txt';
      await expect(storageManager.downloadFile(gcsPath, localDestination)).rejects.toThrow('Cannot operate on object in different bucket: different-bucket');
    });
  });

  describe('downloadToBuffer', () => {
    it('should download a file to a buffer', async () => {
      const gcsPath = 'gs://test-bucket/test/test.txt';
      const buffer = Buffer.from('test');
      mockFile.download.mockResolvedValue([buffer]);
      const result = await storageManager.downloadToBuffer(gcsPath);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.file).toHaveBeenCalledWith('test/test.txt');
      expect(result).toBe(buffer);
    });
  });

  describe('fileExists', () => {
    it('should call file.exists', async () => {
      const gcsPath = 'gs://test-bucket/test/test.txt';
      await storageManager.fileExists(gcsPath);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.file).toHaveBeenCalledWith('test/test.txt');
      expect(mockFile.exists).toHaveBeenCalled();
    });
  });

  describe('getObjectMimeType', () => {
    it('should return the content type of a file', async () => {
      const gcsPath = 'gs://test-bucket/test/test.txt';
      const mimeType = await storageManager.getObjectMimeType(gcsPath);
      expect(mockStorage.bucket).toHaveBeenCalledWith(bucketName);
      expect(mockBucket.file).toHaveBeenCalledWith('test/test.txt');
      expect(mimeType).toBe('video/mp4');
    });
  });
});
