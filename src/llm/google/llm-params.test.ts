import { describe, it, expect } from 'vitest';
import { buildllmParams, buildImageGenerationParams, buildVideoGenerationParams } from './llm-params';
import { Modality, HarmCategory, HarmBlockThreshold, HarmBlockMethod } from '@google/genai';

describe('LLM Parameter Builders', () => {
    describe('buildllmParams', () => {
        it('should merge default and provided parameters correctly', () => {
            const params = {
                contents: [ { role: 'user', parts: [ { text: 'hello' } ] } ],
                config: {
                    temperature: 0.5,
                },
            };
            const result = buildllmParams(params);
            expect(result.model).toBe('gemini-3-pro-preview');
            expect(result.contents).toEqual(params.contents);
            expect(result.config).toEqual({
                responseMimeType: "application/json",
                responseModalities: [ Modality.TEXT ],
                safetySettings: [
                    {
                        category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                        method: HarmBlockMethod.SEVERITY,
                    },
                ],
                temperature: 0.5,
            });
        });
    });

    describe('buildImageGenerationParams', () => {
        it('should merge default and provided parameters correctly', () => {
            const params = {
                prompt: 'a cat',
            };
            const result = buildImageGenerationParams(params);
            expect(result.model).toBe('gemini-3-pro-image-preview');
            expect(result.prompt).toBe('a cat');
        });
    });

    describe('buildVideoGenerationParams', () => {
        it('should merge default and provided parameters correctly', () => {
            const params = {
                prompt: 'a dog running',
            };
            const result = buildVideoGenerationParams(params);
            expect(result.model).toBe('veo-2.0-generate-exp');
            expect(result.prompt).toBe('a dog running');
        });
    });
});
