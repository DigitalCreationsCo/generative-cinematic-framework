import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompositionalAgent } from './compositional-agent';
import { GCPStorageManager } from '../storage-manager';
import { GoogleGenAI } from '@google/genai';
import { Storyboard } from '../types';

describe('CompositionalAgent', () => {
    let compositionalAgent: CompositionalAgent;
    let llm: GoogleGenAI;
    let storageManager: GCPStorageManager;

    beforeEach(() => {
        llm = {
            models: {
                generateContent: vi.fn(),
            },
        } as unknown as GoogleGenAI;
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

        const mockEnrichedStoryboard: Storyboard = {
            ...storyboard,
            metadata: { ...storyboard.metadata, title: 'Enriched Storyboard' },
            scenes: [
                { ...storyboard.scenes[ 0 ], description: 'Enriched Scene 1' },
            ],
        };

        vi.spyOn(llm.models, 'generateContent').mockResolvedValue({
            text: JSON.stringify(mockEnrichedStoryboard),
        } as any);
        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        const result = await compositionalAgent.enhanceStoryboard(storyboard, creativePrompt);

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

        vi.spyOn(llm.models, 'generateContent').mockResolvedValue({
            text: JSON.stringify({ scenes: scenes.slice(0, 10) }),
        } as any);
        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        await compositionalAgent.enhanceStoryboard(storyboard, creativePrompt);

        expect(llm.models.generateContent).toHaveBeenCalledTimes(2);
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

        vi.spyOn(llm.models, 'generateContent')
            .mockRejectedValueOnce({ status: 429 })
            .mockResolvedValue({ text: JSON.stringify(storyboard) } as any);
        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        await compositionalAgent.enhanceStoryboard(storyboard, creativePrompt, { RETRY_WAIT_TIME: 1000 });

        expect(llm.models.generateContent).toHaveBeenCalledTimes(2);
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

        vi.spyOn(llm.models, 'generateContent').mockRejectedValue({ status: 429 });
        vi.spyOn(storageManager, 'getGcsObjectPath').mockReturnValue('storyboard.json');
        vi.spyOn(storageManager, 'uploadJSON').mockResolvedValue('gs://bucket-name/storyboard.json');

        await expect(compositionalAgent.enhanceStoryboard(storyboard, creativePrompt, { RETRY_WAIT_TIME: 1000, MAX_RETRIES: 3 })).rejects.toThrow('Failed to process batch 1 after 3 retries.');
    }, 150000);
});
