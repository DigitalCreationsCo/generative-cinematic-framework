import { GeminiFunctionSchema, GeminiJsonSchema } from "../types.cjs";
import { InteropZodType } from "@langchain/core/utils/types";
import { JsonSchema7Type } from "@langchain/core/utils/json_schema";

//#region src/utils/zod_to_gemini_parameters.d.ts
declare function adjustObjectType(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
obj: Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any>;
declare function removeAdditionalProperties(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
obj: Record<string, any>): GeminiJsonSchema;
declare function schemaToGeminiParameters<
// eslint-disable-next-line @typescript-eslint/no-explicit-any
RunOutput extends Record<string, any> = Record<string, any>>(schema: InteropZodType<RunOutput> | JsonSchema7Type): GeminiFunctionSchema;
declare function jsonSchemaToGeminiParameters(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
schema: Record<string, any>): GeminiFunctionSchema;
//#endregion
export { adjustObjectType, jsonSchemaToGeminiParameters, removeAdditionalProperties, schemaToGeminiParameters };
//# sourceMappingURL=zod_to_gemini_parameters.d.cts.map