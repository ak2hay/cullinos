import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { readFileSync } from "fs";
import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export type VerifiedFirebaseUser = {
  uid: string;
  phone?: string;
  email?: string;
  name?: string;
  emailVerified: boolean;
};

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private ready = false;

  onModuleInit() {
    try {
      this.ensureApp();
      this.ready = true;
      this.logger.log("Firebase Admin initialized");
    } catch (err) {
      this.logger.warn(
        `Firebase Admin not configured: ${
          err instanceof Error ? err.message : String(err)
        }. Guest Firebase exchange will be unavailable until credentials are set.`,
      );
    }
  }

  private ensureApp(): App {
    if (getApps().length > 0) {
      return getApps()[0]!;
    }

    const projectId =
      process.env.FIREBASE_PROJECT_ID?.trim() || "rkyves-cullinos";

    const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
    const jsonBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
    const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
    const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

    if (jsonInline) {
      const parsed = JSON.parse(jsonInline) as Record<string, unknown>;
      return initializeApp({
        credential: cert(parsed as Parameters<typeof cert>[0]),
        projectId,
      });
    }

    if (jsonBase64) {
      const parsed = JSON.parse(
        Buffer.from(jsonBase64, "base64").toString("utf8"),
      ) as Record<string, unknown>;
      return initializeApp({
        credential: cert(parsed as Parameters<typeof cert>[0]),
        projectId,
      });
    }

    if (jsonPath || gac) {
      const path = jsonPath || gac!;
      const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >;
      return initializeApp({
        credential: cert(parsed as Parameters<typeof cert>[0]),
        projectId,
      });
    }

    throw new Error(
      "Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, or FIREBASE_SERVICE_ACCOUNT_PATH (or GOOGLE_APPLICATION_CREDENTIALS)",
    );
  }

  async verifyIdToken(idToken?: string): Promise<VerifiedFirebaseUser> {
    if (!idToken?.trim()) {
      throw new UnauthorizedException("Firebase idToken is required");
    }
    if (!this.ready) {
      try {
        this.ensureApp();
        this.ready = true;
      } catch {
        throw new ServiceUnavailableException(
          "Firebase Admin is not configured on the API",
        );
      }
    }

    try {
      const decoded = await getAuth().verifyIdToken(idToken.trim());
      return {
        uid: decoded.uid,
        phone: decoded.phone_number,
        email: decoded.email,
        name: decoded.name,
        emailVerified: Boolean(decoded.email_verified),
      };
    } catch {
      throw new UnauthorizedException("Invalid Firebase idToken");
    }
  }
}
