import { AsyncCallerParams } from "@langchain/core/utils/async_caller";

//#region src/utils/failed_handler.d.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function failedAttemptHandler(error: any): void;
declare function ensureParams(params?: AsyncCallerParams): AsyncCallerParams;
//#endregion
export { ensureParams, failedAttemptHandler };
//# sourceMappingURL=failed_handler.d.ts.map