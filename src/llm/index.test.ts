import { describe, it, expect, vi } from 'vitest';
import { LlmWrapper } from './index';
import { LlmProvider } from './types';

describe('LlmWrapper', () => {
    it('should proxy generateContent calls to the provider', async () => {
        const provider = {
            generateContent: vi.fn().mockResolvedValue('content'),
            generateVideos: vi.fn(),
            getVideosOperation: vi.fn(),
        } as LlmProvider;
        const wrapper = new LlmWrapper(provider);
        const result = await wrapper.generateContent('test-params');
        expect(result).toBe('content');
        expect(provider.generateContent).toHaveBeenCalledWith('test-params');
    });

    it('should proxy generateVideos calls to the provider', async () => {
        const provider = {
            generateContent: vi.fn(),
            generateVideos: vi.fn().mockResolvedValue('videos'),
            getVideosOperation: vi.fn(),
        } as LlmProvider;
        const wrapper = new LlmWrapper(provider);
        const result = await wrapper.generateVideos('test-params');
        expect(result).toBe('videos');
        expect(provider.generateVideos).toHaveBeenCalledWith('test-params');
    });

    it('should proxy getVideosOperation calls to the provider', async () => {
        const provider = {
            generateContent: vi.fn(),
            generateVideos: vi.fn(),
            getVideosOperation: vi.fn().mockResolvedValue('operation'),
        } as LlmProvider;
        const wrapper = new LlmWrapper(provider);
        const result = await wrapper.getVideosOperation('test-params');
        expect(result).toBe('operation');
        expect(provider.getVideosOperation).toHaveBeenCalledWith('test-params');
    });
});
