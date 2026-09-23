import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ConsentService } from "./consent.service";
import { DPDP_PURPOSES } from "./privacy.constants";
import {
  decryptDocumentNumber,
  encryptDocumentNumber,
  maskDocumentNumber,
} from "./privacy.crypto";

@Injectable()
export class GuestPrivacyService {
  constructor(
    private prisma: PrismaService,
    private consent: ConsentService,
    private audit: AuditService,
  ) {}

  prepareDocumentForStorage(documentNumber?: string | null) {
    return encryptDocumentNumber(documentNumber);
  }

  presentGuest<T extends { documentNumber?: string | null }>(
    guest: T,
    mode: "masked" | "full" = "masked",
  ) {
    const raw = guest.documentNumber ?? null;
    return {
      ...guest,
      documentNumber:
        mode === "full" ? decryptDocumentNumber(raw) : maskDocumentNumber(raw),
      documentNumberEncrypted: Boolean(raw?.startsWith("enc:v1:")),
    };
  }

  async eraseGuest(
    organizationId: string,
    guestId: string,
    actorUserId?: string,
  ) {
    const guest = await this.prisma.guest.findFirst({
      where: { id: guestId, organizationId },
    });
    if (!guest) throw new NotFoundException("Guest not found");
    if (guest.anonymizedAt) {
      throw new BadRequestException("Guest already anonymized");
    }

    const updated = await this.prisma.guest.update({
      where: { id: guestId },
      data: {
        name: "Anonymized Guest",
        email: null,
        phone: null,
        documentType: null,
        documentNumber: null,
        anonymizedAt: new Date(),
      },
    });

    await this.consent.record({
      organizationId,
      subjectType: "guest",
      subjectId: guestId,
      purpose: DPDP_PURPOSES.HOSPITALITY_ID,
      granted: false,
      source: "erasure_request",
      actorUserId,
    });

    await this.audit.log({
      organizationId,
      userId: actorUserId,
      action: "guest_erased",
      entityType: "Guest",
      entityId: guestId,
      metadata: { method: "anonymize" },
    });

    return {
      id: updated.id,
      anonymizedAt: updated.anonymizedAt,
      message: "Guest personal data anonymized",
    };
  }
}
