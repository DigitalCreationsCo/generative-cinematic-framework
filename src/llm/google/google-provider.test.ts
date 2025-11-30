import { describe, it, expect, vi } from 'vitest';
import { GoogleProvider } from './google-provider';
import { GoogleGenAI } from '@google/genai';

describe('GoogleProvider', () => {
    it('should proxy generateContent calls to the underlying model', async () => {
        const mockGenerateContent = vi.fn().mockResolvedValue('content');
        const mockGoogleGenAI = {
            models: {
                generateContent: mockGenerateContent,
            },
        } as unknown as GoogleGenAI;

        const provider = new GoogleProvider(mockGoogleGenAI, mockGoogleGenAI);
        const params = { model: 'test-model', contents: [] };

        const result = await provider.generateContent(params);

        expect(result).toBe('content');
        expect(mockGenerateContent).toHaveBeenCalledWith(params);
    });

    it('should proxy generateVideos calls to the underlying model', async () => {
        const mockGenerateVideos = vi.fn().mockResolvedValue('videos');
        const mockGoogleGenAI = {
            models: {
                generateVideos: mockGenerateVideos,
            },
        } as unknown as GoogleGenAI;

        const provider = new GoogleProvider(mockGoogleGenAI, mockGoogleGenAI);
        const params = { model: 'test-model', prompt: 'test' };

        const result = await provider.generateVideos(params);

        expect(result).toBe('videos');
        expect(mockGenerateVideos).toHaveBeenCalledWith(params);
    });

    it('should proxy getVideosOperation calls to the underlying operations', async () => {
        const mockGetVideosOperation = vi.fn().mockResolvedValue('operation');
        const mockGoogleGenAI = {
            operations: {
                getVideosOperation: mockGetVideosOperation,
            },
        } as unknown as GoogleGenAI;

        const provider = new GoogleProvider(mockGoogleGenAI, mockGoogleGenAI);
        const params = { operation: { name: 'ops/123' } } as any;

        const result = await provider.getVideosOperation(params);

        expect(result).toBe('operation');
        expect(mockGetVideosOperation).toHaveBeenCalledWith(params);
    });
});
