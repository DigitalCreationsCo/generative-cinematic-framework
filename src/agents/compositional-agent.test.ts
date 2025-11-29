import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositionalAgent } from './compositional-agent';
import { GCPStorageManager } from '../storage-manager';
import { Storyboard } from '../types';
import { LlmWrapper, GoogleProvider } from '../llm';
import { GoogleGenAI } from '@google/genai';

describe('CompositionalAgent', () => {
    let compositionalAgent: CompositionalAgent;
    let llm: LlmWrapper;
    let storageManager: GCPStorageManager;
    let googleGenAI: GoogleGenAI;

    beforeEach(() => {
        googleGenAI = {
            models: {
                generateContent: vi.fn(),
            },
        } as unknown as GoogleGenAI;
        const provider = new GoogleProvider(googleGenAI, googleGenAI);
        llm = new LlmWrapper(provider);
        storageManager = new GCPStorageManager('project-id', 'video-id', 'bucket-name');
        compositionalAgent = new CompositionalAgent(llm, storageManager);
    });

    it('should enhance a storyboard', async () => {
        const storyboard: Storyboard = {
            metadata: { title: 'Test Storyboard', duration: 8, totalScenes: 1, style: 'cinematic', mood: 'epic', colorPalette: [ '#ffffff' ], tags: [ 'test' ] },
            characters: [],
            locations: [],
            scenes: [
                {
                    id: 1,
                    startTime: 0,
                    endTime: 8,
                    duration: 8,
                    description: 'Scene 1',
                    type: 'instrumental',
                    lyrics: '',
                    musicChange: 'none',
                    intensity: 'medium',
                    mood: 'calm',
                    tempo: 'moderate',
                    transitionType: 'smooth',
                    shotType: 'wide',
                    cameraMovement: 'static',
                    lighting: 'natural',
                    audioSync: 'mood',
                    continuityNotes: [],
                    characters: [],
                    locationId: 'loc_1',
                },
            ],
        };
        const creativePrompt = 'A creative prompt.';

        const mockInitialContext = {
            metadata: { ...storyboard.metadata, title: 'Enriched Storyboard' },
            characters: [],
            locations: [],
        };

        const mockEnrichedScenes = {
            scenes: [
                { ...storyboard.scenes[ 0 ], description: 'Enriched Scene 1' },
            ],
        };

        vi.spyOn(googleGenAI.models, 'generateContent')
            .mockResolvedValueOnce({ text: JSON.stringify(mockInitialContext) } as any)
            .mockResolvedValueOnce({ text: JSON.stringify(mockEnrichedScenes) } as any);

        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        const result = await compositionalAgent.generateStoryboard(storyboard, creativePrompt);

        expect(result.metadata.title).toBe('Enriched Storyboard');
        expect(result.scenes[ 0 ].description).toBe('Enriched Scene 1');
        expect(storageManager.uploadJSON).toHaveBeenCalled();
    }, 8000);

    it('should handle batching correctly', async () => {
        const scenes = Array.from({ length: 15 }, (_, i) => ({
            id: i + 1,
            startTime: i * 8,
            endTime: (i + 1) * 8,
            duration: 8 as const,
            description: `Scene ${i + 1}`,
            type: 'instrumental' as const,
            lyrics: '',
            musicChange: 'none' as const,
            intensity: 'medium' as const,
            mood: 'calm' as const,
            tempo: 'moderate' as const,
            transitionType: 'smooth' as const,
            shotType: 'wide',
            cameraMovement: 'static',
            lighting: 'natural',
            audioSync: 'mood',
            continuityNotes: [],
            characters: [],
            locationId: 'loc_1',
        }));

        const storyboard: Storyboard = {
            metadata: { title: 'Test Storyboard', duration: 120, totalScenes: 15, style: 'cinematic', mood: 'epic', colorPalette: [ '#ffffff' ], tags: [ 'test' ] },
            characters: [],
            locations: [],
            scenes,
        };
        const creativePrompt = 'A creative prompt.';

        vi.spyOn(googleGenAI.models, 'generateContent')
            .mockResolvedValueOnce({ text: JSON.stringify({ metadata: storyboard.metadata, characters: [], locations: [] }) } as any)
            .mockResolvedValueOnce({ text: JSON.stringify({ scenes: scenes.slice(0, 10) }) } as any)
            .mockResolvedValueOnce({ text: JSON.stringify({ scenes: scenes.slice(10, 15) }) } as any);
        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        await compositionalAgent.generateStoryboard(storyboard, creativePrompt);

        expect(googleGenAI.models.generateContent).toHaveBeenCalledTimes(3);
    }, 12000);

    it('should handle rate limiting with retries', async () => {
        const storyboard: Storyboard = {
            metadata: { title: 'Test Storyboard', duration: 8, totalScenes: 1, style: 'cinematic', mood: 'epic', colorPalette: [ '#ffffff' ], tags: [ 'test' ] },
            characters: [],
            locations: [],
            scenes: [
                {
                    id: 1,
                    startTime: 0,
                    endTime: 8,
                    duration: 8,
                    description: 'Scene 1',
                    type: 'instrumental',
                    lyrics: '',
                    musicChange: 'none',
                    intensity: 'medium',
                    mood: 'calm',
                    tempo: 'moderate',
                    transitionType: 'smooth',
                    shotType: 'wide',
                    cameraMovement: 'static',
                    lighting: 'natural',
                    audioSync: 'mood',
                    continuityNotes: [],
                    characters: [],
                    locationId: 'loc_1',
                },
            ],
        };
        const creativePrompt = 'A creative prompt.';

        const mockInitialContext = {
            metadata: storyboard.metadata,
            characters: [],
            locations: [],
        };

        vi.spyOn(googleGenAI.models, 'generateContent')
            .mockRejectedValueOnce({ status: 429 }) // Fail initial context once
            .mockResolvedValueOnce({ text: JSON.stringify(mockInitialContext) } as any) // Succeed initial context
            .mockResolvedValueOnce({ text: JSON.stringify({ scenes: storyboard.scenes }) } as any); // Succeed scene batch

        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        await compositionalAgent.generateStoryboard(storyboard, creativePrompt, { maxRetries: 2, initialDelay: 1000 });

        expect(googleGenAI.models.generateContent).toHaveBeenCalledTimes(3);
    }, 30000);

    it('should throw an error after max retries', async () => {
        const storyboard: Storyboard = {
            metadata: { title: 'Test Storyboard', duration: 8, totalScenes: 1, style: 'cinematic', mood: 'epic', colorPalette: [ '#ffffff' ], tags: [ 'test' ] },
            characters: [],
            locations: [],
            scenes: [
                {
                    id: 1,
                    startTime: 0,
                    endTime: 8,
                    duration: 8,
                    description: 'Scene 1',
                    type: 'instrumental',
                    lyrics: '',
                    musicChange: 'none',
                    intensity: 'medium',
                    mood: 'calm',
                    tempo: 'moderate',
                    transitionType: 'smooth',
                    shotType: 'wide',
                    cameraMovement: 'static',
                    lighting: 'natural',
                    audioSync: 'mood',
                    continuityNotes: [],
                    characters: [],
                    locationId: 'loc_1',
                },
            ],
        };
        const creativePrompt = 'A creative prompt.';

        vi.spyOn(googleGenAI.models, 'generateContent').mockRejectedValue(new Error('LLM call failed after multiple retries.'));
        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        await expect(compositionalAgent.generateStoryboard(storyboard, creativePrompt, { maxRetries: 3, initialDelay: 1000 })).rejects.toThrow('LLM call failed after multiple retries.');
    }, 150000);
});
