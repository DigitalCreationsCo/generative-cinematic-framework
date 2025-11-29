export * from './types';
export * from './google/google-provider';

import { LlmProvider } from './types';

export class LlmWrapper {
    private provider: LlmProvider;

    constructor(provider: LlmProvider) {
        this.provider = provider;
    }

    async generateContent(params: any): Promise<any> {
        return this.provider.generateContent(params);
    }

    async generateVideos(params: any): Promise<any> {
        return this.provider.generateVideos(params);
    }

    async getVideosOperation(params: any): Promise<any> {
        return this.provider.getVideosOperation(params);
    }
}
