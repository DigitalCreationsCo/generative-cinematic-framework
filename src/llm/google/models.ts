if (!process.env.TEXT_MODEL_NAME) throw Error("LLM text model is not defined")
if (!process.env.IMAGE_MODEL_NAME) throw Error("LLM image model is not defined")
if (!process.env.VIDEO_MODEL_NAME) throw Error("LLM video model is not defined");

export const textModelName = process.env.TEXT_MODEL_NAME;
export const imageModelName = process.env.IMAGE_MODEL_NAME;
export const videoModelName = process.env.VIDEO_MODEL_NAME;
