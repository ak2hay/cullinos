import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { PlatformConfigService } from "../platform-config/platform-config.service";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type PutObjectResult = {
  key: string;
  url: string;
};

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
  "R2_ENDPOINT",
];

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket = "";
  private publicBaseUrl = "";
  private unsub?: () => void;

  constructor(private readonly config: PlatformConfigService) {}

  onModuleInit() {
    this.reconfigure();
    this.unsub = this.config.onChange((keys) => {
      if (keys.some((k) => R2_KEYS.includes(k))) {
        this.reconfigure();
      }
    });
  }

  onModuleDestroy() {
    this.unsub?.();
  }

  reconfigure() {
    const accountId = this.config.get("R2_ACCOUNT_ID")?.trim();
    const accessKeyId = this.config.get("R2_ACCESS_KEY_ID")?.trim();
    const secretAccessKey = this.config.get("R2_SECRET_ACCESS_KEY")?.trim();
    const bucket = this.config.get("R2_BUCKET")?.trim();
    const publicUrl = this.config.get("R2_PUBLIC_URL")?.trim().replace(/\/$/, "");
    const endpoint =
      this.config.get("R2_ENDPOINT")?.trim() ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

    this.client = null;
    this.bucket = "";
    this.publicBaseUrl = "";

    if (accountId && accessKeyId && secretAccessKey && bucket && publicUrl && endpoint) {
      this.client = new S3Client({
        region: "auto",
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: false,
      });
      this.bucket = bucket;
      this.publicBaseUrl = publicUrl;
      this.logger.log(`R2 storage enabled (bucket=${bucket})`);
    } else {
      this.logger.log("R2 storage not configured; callers should use local disk fallback");
    }
  }

  isCloudEnabled(): boolean {
    return this.client !== null && Boolean(this.bucket) && Boolean(this.publicBaseUrl);
  }

  publicUrlForKey(key: string): string {
    const normalized = key.replace(/^\//, "");
    return `${this.publicBaseUrl}/${normalized}`;
  }

  keyFromPublicUrl(url: string): string | null {
    if (!this.publicBaseUrl || !url.startsWith(this.publicBaseUrl)) return null;
    const key = url.slice(this.publicBaseUrl.length).replace(/^\//, "");
    return key || null;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    if (!this.client) {
      throw new Error("R2 storage is not configured");
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return { key: input.key, url: this.publicUrlForKey(input.key) };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.client) {
      throw new Error("R2 storage is not configured");
    }
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
