import { GenerateContentParameters, GenerateImagesParameters, GenerateVideosParameters, HarmBlockMethod, HarmBlockThreshold, HarmCategory, Modality, Part, GenerateImagesConfig } from "@google/genai";

export const buildllmParams = (params: { contents: GenerateContentParameters[ 'contents' ]; } & Partial<GenerateContentParameters>): GenerateContentParameters => ({
    model: "gemini-3-pro-preview",
    ...params,
    config: {
        candidateCount: 1,
        responseMimeType: "application/json",
        responseModalities: [ Modality.TEXT ],
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                threshold: HarmBlockThreshold.OFF,
                method: HarmBlockMethod.HARM_BLOCK_METHOD_UNSPECIFIED,
            }
        ],
        ...params.config
    }
});
export const buildImageGenerationParams = (params: { prompt: GenerateImagesParameters[ 'prompt' ]; config?: Partial<GenerateImagesConfig>; } & Partial<GenerateImagesParameters>): GenerateImagesParameters => ({
    model: "imagen-3.0-generate-002",
    ...params,
    config: {
        ...params.config,
    },
});
export const buildVideoGenerationParams = (params: { prompt: GenerateVideosParameters[ 'prompt' ]; } & Partial<GenerateVideosParameters>): GenerateVideosParameters => ({
    model: "veo-3.1-generate-preview",
    ...params,
    config: {
        ...params.config
    },
});
