"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoModel = exports.imageModel = exports.llm = void 0;
var projectId = process.env.GCP_PROJECT_ID;
// export const authClient = new GoogleAuth({
//     projectId,
// }) as unknown as AuthClient;
exports.llm = new VertexAI({
    authOptions: {
        projectId: projectId,
    },
    model: "gemini-2.5-pro",
    responseModalities: ["TEXT"],
    temperature: 0.7,
    maxOutputTokens: 60000,
});
exports.imageModel = new VertexAI({
    authOptions: { projectId: projectId },
    model: "imagen-4.0-fast-generate-001",
    responseModalities: ["IMAGE"],
    temperature: 0.7,
});
exports.videoModel = new VertexAI({
    authOptions: { projectId: projectId },
    model: "veo-3.1-generate-preview",
});
//# sourceMappingURL=google.js.map