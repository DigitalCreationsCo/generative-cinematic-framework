import { GenerateContentParameters, GenerateImagesParameters, GenerateVideosParameters, HarmBlockMethod, HarmBlockThreshold, HarmCategory, Modality, Part } from "@google/genai";

export const buildllmParams = (params: { contents: GenerateContentParameters[ 'contents' ]; } & Partial<GenerateContentParameters>): GenerateContentParameters => ({
    model: "gemini-2.5-pro",
    ...params,
    config: {
        responseModalities: [ Modality.TEXT ],
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
                method: HarmBlockMethod.SEVERITY,
            }
        ],
        ...params.config
    }
});
export const buildImageGenerationParams = (params: { prompt: GenerateImagesParameters[ 'prompt' ] } & Partial<GenerateImagesParameters>): GenerateImagesParameters => ({
    model: "imagen-3.0-generate-002",
    ...params,
    config: {
        ...params.config,
    },
});
export const buildVideoGenerationParams = (params: { prompt: GenerateVideosParameters[ 'prompt' ] } & Partial<GenerateVideosParameters>): GenerateVideosParameters => ({
    model: "veo-3.1-generate-001",
    ...params,
});
