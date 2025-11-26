"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVideoGenerationParams = exports.buildImageGenerationParams = exports.buildllmParams = void 0;
const genai_1 = require("@google/genai");
const buildllmParams = (params) => ({
    model: "gemini-2.5-pro",
    ...params,
    config: {
        responseModalities: [genai_1.Modality.TEXT],
        maxOutputTokens: 60000,
        safetySettings: [
            {
                category: genai_1.HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                threshold: genai_1.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                method: genai_1.HarmBlockMethod.SEVERITY,
            }
        ],
        ...params.config
    }
});
exports.buildllmParams = buildllmParams;
const buildImageGenerationParams = (params) => ({
    model: "imagen-3.0-generate-002",
    ...params,
    config: {
        ...params.config,
    },
});
exports.buildImageGenerationParams = buildImageGenerationParams;
const buildVideoGenerationParams = (params) => ({
    model: "veo-3.1-generate-001",
    ...params,
});
exports.buildVideoGenerationParams = buildVideoGenerationParams;
//# sourceMappingURL=llm-params.js.map