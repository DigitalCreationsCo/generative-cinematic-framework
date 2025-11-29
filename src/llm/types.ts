import {
    GenerateContentResponse,
    GenerateVideosResponse,
    Operation,
} from '@google/genai';

export interface LlmProvider {
    generateContent(params: any): Promise<GenerateContentResponse>;
    generateVideos(params: any): Promise<Operation<GenerateVideosResponse>>;
    getVideosOperation(params: { operation: Operation<GenerateVideosResponse>; }): Promise<Operation<GenerateVideosResponse>>;
}
