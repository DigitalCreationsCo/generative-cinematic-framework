import { GoogleLLMResponse } from "../types.js";

//#region src/utils/safety.d.ts
declare class GoogleAISafetyError extends Error {
  response: GoogleLLMResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reply: any;
  constructor(response: GoogleLLMResponse, message?: string);
}
//#endregion
export { GoogleAISafetyError };
//# sourceMappingURL=safety.d.ts.map