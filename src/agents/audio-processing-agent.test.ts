import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioProcessingAgent } from './audio-processing-agent';
import { GCPStorageManager } from '../storage-manager';
import { GoogleGenAI } from '@google/genai';
import ffmpeg from 'fluent-ffmpeg';

vi.mock('fluent-ffmpeg', () => ({
  default: {
    ffprobe: vi.fn(),
  },
}));

describe('AudioProcessingAgent', () => {
  let audioProcessingAgent: AudioProcessingAgent;
  let storageManager: GCPStorageManager;
  let genAI: GoogleGenAI;

  beforeEach(() => {
    (ffmpeg as any).ffprobe.mockImplementation((filePath: any, callback: any) => {
      callback(null, { format: { duration: 120 } });
    });
    storageManager = new GCPStorageManager('project-id', 'video-id', 'bucket-name');
    genAI = {
      models: {
        generateContent: vi.fn(),
      },
    } as unknown as GoogleGenAI;
    audioProcessingAgent = new AudioProcessingAgent(storageManager, genAI);
  });

  it('should process audio to storyboard', async () => {
    const localAudioPath = '/path/to/audio.mp3';
    const audioGcsUri = 'gs://bucket-name/audio/audio.mp3';
    const mockAnalysis = {
      segments: [{
        startTime: 0,
        endTime: 120,
        type: 'instrumental',
        lyrics: '',
        musicalDescription: 'A mock description',
        intensity: 'medium',
        mood: 'calm',
        tempo: 'moderate',
        musicalChange: 'none',
        transitionType: 'smooth',
      }],
      totalDuration: 120,
    };
    const creativePrompt = 'A creative prompt.';

    vi.spyOn(storageManager, 'getGcsUrl').mockReturnValue(audioGcsUri);
    vi.spyOn(storageManager, 'fileExists').mockResolvedValue(false);
    vi.spyOn(storageManager, 'uploadFile').mockResolvedValue(audioGcsUri);
    vi.spyOn(genAI.models, 'generateContent').mockResolvedValue({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify(mockAnalysis) }],
        },
      }],
    } as any);

    const result = await audioProcessingAgent.processAudioToScenes(localAudioPath, creativePrompt);

    expect(result).toEqual(mockAnalysis);
    expect(storageManager.uploadFile).toHaveBeenCalledWith(localAudioPath, 'audio/audio.mp3');
    expect(genAI.models.generateContent).toHaveBeenCalled();
  });

  it('should skip upload if file exists', async () => {
    const localAudioPath = '/path/to/audio.mp3';
    const audioGcsUri = 'gs://bucket-name/audio/audio.mp3';
    const mockAnalysis = {
      segments: [],
      totalDuration: 120,
    };
    const creativePrompt = 'A creative prompt.';

    vi.spyOn(storageManager, 'getGcsUrl').mockReturnValue(audioGcsUri);
    vi.spyOn(storageManager, 'fileExists').mockResolvedValue(true);
    const uploadFileSpy = vi.spyOn(storageManager, 'uploadFile');
    vi.spyOn(genAI.models, 'generateContent').mockResolvedValue({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify(mockAnalysis) }],
        },
      }],
    } as any);

    await audioProcessingAgent.processAudioToScenes(localAudioPath, creativePrompt);

    expect(uploadFileSpy).not.toHaveBeenCalled();
  });

  it('should throw an error if LLM analysis fails', async () => {
    const localAudioPath = '/path/to/audio.mp3';
    const audioGcsUri = 'gs://bucket-name/audio/audio.mp3';
    const creativePrompt = 'A creative prompt.';

    vi.spyOn(storageManager, 'getGcsUrl').mockReturnValue(audioGcsUri);
    vi.spyOn(storageManager, 'fileExists').mockResolvedValue(false);
    vi.spyOn(storageManager, 'uploadFile').mockResolvedValue(audioGcsUri);
    vi.spyOn(genAI.models, 'generateContent').mockResolvedValue({
      candidates: [],
    } as any);

    await expect(audioProcessingAgent.processAudioToScenes(localAudioPath, creativePrompt)).rejects.toThrow('No valid analysis result from LLM');
  });

  it('should throw an error if genAI.models.generateContent throws', async () => {
    const localAudioPath = '/path/to/audio.mp3';
    const audioGcsUri = 'gs://bucket-name/audio/audio.mp3';
    const errorMessage = 'genAI error';
    const creativePrompt = 'A creative prompt.';

    vi.spyOn(storageManager, 'getGcsUrl').mockReturnValue(audioGcsUri);
    vi.spyOn(storageManager, 'fileExists').mockResolvedValue(false);
    vi.spyOn(storageManager, 'uploadFile').mockResolvedValue(audioGcsUri);
    vi.spyOn(genAI.models, 'generateContent').mockRejectedValue(new Error(errorMessage));

    await expect(audioProcessingAgent.processAudioToScenes(localAudioPath, creativePrompt)).rejects.toThrow(errorMessage);
  });

  describe('getAudioDuration', () => {
    it('should reject with an error if ffprobe fails', async () => {
      const errorMessage = 'ffprobe error';
      (ffmpeg as any).ffprobe.mockImplementation((filePath: any, callback: any) => {
        callback(new Error(errorMessage));
      });

      // @ts-expect-error - testing private method
      await expect(audioProcessingAgent.getAudioDuration('/path/to/audio.mp3')).rejects.toThrow(errorMessage);
    });

    it('should resolve with 0 if duration is not available', async () => {
      (ffmpeg as any).ffprobe.mockImplementation((filePath: any, callback: any) => {
        callback(null, { format: {} });
      });

      // @ts-expect-error - testing private method
      await expect(audioProcessingAgent.getAudioDuration('/path/to/audio.mp3')).resolves.toBe(0);
    });
  });
});
