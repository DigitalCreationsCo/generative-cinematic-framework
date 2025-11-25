if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64) {
    throw Error('Google application credentials not found')
}

export const credentialsJson = Buffer.from(
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64!,
    "base64"
).toString("utf8");