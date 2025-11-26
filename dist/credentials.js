"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentialsJson = void 0;
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64) {
    throw Error('Google application credentials not found');
}
exports.credentialsJson = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64, "base64").toString("utf8");
//# sourceMappingURL=credentials.js.map