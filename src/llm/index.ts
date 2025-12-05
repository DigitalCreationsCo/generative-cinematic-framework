export * from './types';
export * from './google/google-provider';
import { GoogleProvider } from './google/google-provider';
import { LlmProvider, LlmProviderName } from './types';

export class LlmWrapper {
    private provider: LlmProvider;

    constructor() {
        const providerName = process.env.LLM_PROVIDER as LlmProviderName;

        let provider;
        switch (providerName) {
            case "google":
                provider = new GoogleProvider()
                break;
            default:
                provider = new GoogleProvider();
                break;
        }
        
        this.provider = provider;
    }

    async generateContent(params: any) {
        return this.provider.generateContent(params);
    }
    
    async generateImages(params: any) {
        return this.provider.generateImages(params);
    }

    async generateVideos(params: any) {
        return this.provider.generateVideos(params);
    }

    async getVideosOperation(params: any) {
        return this.provider.getVideosOperation(params);
    }
}
