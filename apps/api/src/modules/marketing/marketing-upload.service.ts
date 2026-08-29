import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MarketingUploadService {
  private uploadDir: string;
  private publicBaseUrl: string;

  constructor() {
    this.uploadDir =
      process.env.MARKETING_UPLOAD_DIR ||
      path.resolve(process.cwd(), "../web/public/cms");
    this.publicBaseUrl = process.env.MARKETING_PUBLIC_URL || "/cms";
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  validateFile(file: Express.Multer.File) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new Error("Unsupported file type. Use PNG, JPG, WebP, or SVG.");
    }
    if (file.size > MAX_BYTES) {
      throw new Error("File too large. Maximum size is 5MB.");
    }
  }

  saveUploadedFile(file: Express.Multer.File, slotKey?: string) {
    this.validateFile(file);
    const ext = path.extname(file.originalname) || this.extFromMime(file.mimetype);
    const filename = slotKey ? `${slotKey}${ext}` : `${randomUUID()}${ext}`;
    const dest = path.join(this.uploadDir, filename);
    fs.writeFileSync(dest, file.buffer);
    return {
      filename,
      url: `${this.publicBaseUrl}/${filename}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  copyFromPublicImages(sourceDir: string, slotKey: string, filename: string) {
    const src = path.join(sourceDir, filename);
    if (!fs.existsSync(src)) return null;
    const destName = `${slotKey}${path.extname(filename)}`;
    const dest = path.join(this.uploadDir, destName);
    fs.copyFileSync(src, dest);
    const stat = fs.statSync(dest);
    return {
      filename: destName,
      url: `${this.publicBaseUrl}/${destName}`,
      mimeType: this.mimeFromExt(path.extname(filename)),
      sizeBytes: stat.size,
    };
  }

  deleteByUrl(url: string) {
    const base = this.publicBaseUrl.replace(/\/$/, "");
    if (!url.startsWith(base)) return;
    const filename = url.slice(base.length + 1);
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  private extFromMime(mime: string) {
    if (mime === "image/png") return ".png";
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/webp") return ".webp";
    if (mime === "image/svg+xml") return ".svg";
    return ".bin";
  }

  private mimeFromExt(ext: string) {
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".svg") return "image/svg+xml";
    return "application/octet-stream";
  }
}
