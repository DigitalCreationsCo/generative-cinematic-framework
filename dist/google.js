"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.videoModel = exports.imageModel = exports.llm = void 0;
var google_vertexai_1 = require("@langchain/google-vertexai");
var projectId = process.env.GCP_PROJECT_ID;
// export const authClient = new GoogleAuth({
//     projectId,
// }) as unknown as AuthClient;
exports.llm = new google_vertexai_1.VertexAI({
    authOptions: {
        projectId: projectId,
    },
    model: "gemini-2.5-pro",
    responseModalities: ["TEXT"],
    temperature: 0.7,
    maxOutputTokens: 8192,
});
exports.imageModel = new google_vertexai_1.VertexAI({
    authOptions: { projectId: projectId },
    model: "gemini-3-pro-image-preview",
    responseModalities: ["IMAGE"],
    temperature: 0.7,
    maxOutputTokens: 8192,
});
exports.videoModel = new google_vertexai_1.VertexAI({
    authOptions: { projectId: projectId },
    model: "gemini-3-pro-image-preview",
});
