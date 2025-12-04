import {
    GenerateContentParameters,
    GenerateContentResponse,
    GenerateVideosParameters,
    GenerateVideosResponse,
    Operation,
} from '@google/genai';

export type LlmProviderName = "google";

export interface LlmProvider {
    generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse>;
    generateVideos(params: GenerateVideosParameters): Promise<Operation<GenerateVideosResponse>>;
    getVideosOperation(params: { operation: Operation<GenerateVideosResponse>; }): Promise<Operation<GenerateVideosResponse>>;
}
