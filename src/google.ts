import { VertexAI } from "@langchain/google-vertexai";
import { AuthClient, GoogleAuth } from "google-auth-library";
import { credentialsJson } from "./credentials";

const projectId = process.env.GCP_PROJECT_ID;

// export const authClient = new GoogleAuth({
//     projectId,
// }) as unknown as AuthClient;

export const llm = new VertexAI({
    authOptions: {
        projectId,
    },
    model: "gemini-2.5-pro",
    responseModalities: [ "TEXT" ],
    temperature: 0.7,
    maxOutputTokens: 8192,
});

export const imageModel = new VertexAI({
    authOptions: { projectId },
    model: "gemini-3-pro-image-preview",
    responseModalities: [ "IMAGE" ],
    temperature: 0.7,
    maxOutputTokens: 8192,
});

export const videoModel = new VertexAI({
    authOptions: { projectId },
    model: "gemini-3-pro-image-preview",
});