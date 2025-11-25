//#region src/utils/palm.d.ts
interface GoogleVertexAIBasePrediction {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  safetyAttributes?: any;
}
interface GoogleVertexAILLMPredictions<PredictionType extends GoogleVertexAIBasePrediction> {
  predictions: PredictionType[];
}
//#endregion
export { GoogleVertexAIBasePrediction, GoogleVertexAILLMPredictions };
//# sourceMappingURL=palm.d.ts.map