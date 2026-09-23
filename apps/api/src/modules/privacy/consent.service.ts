import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  DPDP_NOTICE_VERSION,
  type DpdpPurpose,
} from "./privacy.constants";

@Injectable()
export class ConsentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async record(input: {
    organizationId: string;
    subjectType: "customer" | "guest" | "user";
    subjectId: string;
    purpose: DpdpPurpose | string;
    granted: boolean;
    source: string;
    ipAddress?: string;
    noticeVersion?: string;
    actorUserId?: string;
  }) {
    if (!input.granted) {
      await this.prisma.consentRecord.updateMany({
        where: {
          organizationId: input.organizationId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          purpose: input.purpose,
          granted: true,
          withdrawnAt: null,
        },
        data: { withdrawnAt: new Date(), granted: false },
      });
    }

    const row = await this.prisma.consentRecord.create({
      data: {
        organizationId: input.organizationId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        purpose: input.purpose,
        noticeVersion: input.noticeVersion ?? DPDP_NOTICE_VERSION,
        granted: input.granted,
        source: input.source,
        ipAddress: input.ipAddress,
        withdrawnAt: input.granted ? null : new Date(),
      },
    });

    await this.audit.log({
      organizationId: input.organizationId,
      userId: input.actorUserId,
      action: input.granted ? "consent_granted" : "consent_withdrawn",
      entityType: "ConsentRecord",
      entityId: row.id,
      metadata: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        purpose: input.purpose,
        source: input.source,
        noticeVersion: row.noticeVersion,
      },
      ipAddress: input.ipAddress,
    });

    return row;
  }

  listForSubject(
    organizationId: string,
    subjectType: string,
    subjectId: string,
  ) {
    return this.prisma.consentRecord.findMany({
      where: { organizationId, subjectType, subjectId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
