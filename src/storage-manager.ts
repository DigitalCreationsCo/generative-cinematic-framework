import { Storage } from "@google-cloud/storage";

// ============================================================================
// GCP STORAGE MANAGER
// ============================================================================

export class GCPStorageManager {
    private storage: Storage;
    private bucketName: string;

    constructor(projectId: string, bucketName: string) {
        this.storage = new Storage({ projectId });
        this.bucketName = bucketName;
    }

    async uploadFile(
        localPath: string,
        destination: string
    ): Promise<string> {
        const bucket = this.storage.bucket(this.bucketName);
        await bucket.upload(localPath, {
            destination,
            metadata: {
                cacheControl: "public, max-age=31536000",
            },
        });
        return `gs://${this.bucketName}/${destination}`;
    }

    async uploadBuffer(
        buffer: Buffer,
        destination: string,
        contentType: string
    ): Promise<string> {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(destination);
        await file.save(buffer, {
            contentType,
            metadata: {
                cacheControl: "public, max-age=31536000",
            },
        });
        return `gs://${this.bucketName}/${destination}`;
    }

    async uploadJSON(data: any, destination: string): Promise<string> {
        const buffer = Buffer.from(JSON.stringify(data, null, 2));
        return this.uploadBuffer(buffer, destination, "application/json");
    }

    async downloadJSON<T>(source: string): Promise<T> {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(source);
        const [ contents ] = await file.download();
        return JSON.parse(contents.toString()) as T;
    }

    async downloadBuffer(sourceUrl: string): Promise<Buffer> {
        const url = new URL(sourceUrl);
        if (url.protocol !== "gs:") {
            throw new Error("Source URL must be a GCS URL (gs://...).");
        }
        const bucketName = url.hostname;
        const filePath = url.pathname.substring(1);

        const bucket = this.storage.bucket(bucketName);
        const file = bucket.file(filePath);
        const [ contents ] = await file.download();
        return contents;
    }

    getPublicUrl(path: string): string {
        return `https://storage.googleapis.com/${this.bucketName}/${path}`;
    }
}
