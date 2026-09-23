import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

function surveyToken(): string {
  return randomBytes(16).toString("hex");
}

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, params: { outletId?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (params.outletId) where.outletId = params.outletId;
    if (params.from || params.to) {
      const gte = params.from ? new Date(params.from) : undefined;
      const lte = params.to ? new Date(params.to) : undefined;
      if (lte) lte.setHours(23, 59, 59, 999);
      where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }
    return this.prisma.feedbackResponse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        order: { select: { id: true, orderNumber: true } },
        outlet: { select: { id: true, name: true } },
      },
    });
  }

  async ensureSurveyToken(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: {
        feedbackResponse: true,
        outlet: { select: { name: true } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.feedbackResponse) {
      return {
        surveyToken: order.feedbackResponse.surveyToken,
        alreadySubmitted: order.feedbackResponse.rating != null,
        orderNumber: order.orderNumber,
        outletName: order.outlet.name,
      };
    }
    const token = surveyToken();
    await this.prisma.feedbackResponse.create({
      data: {
        organizationId: orgId,
        outletId: order.outletId,
        orderId: order.id,
        surveyToken: token,
      },
    });
    return {
      surveyToken: token,
      alreadySubmitted: false,
      orderNumber: order.orderNumber,
      outletName: order.outlet.name,
    };
  }

  getSurveyLink(surveyToken: string, baseUrl?: string) {
    const root =
      baseUrl?.replace(/\/$/, "") ||
      process.env.GUEST_APP_URL?.replace(/\/$/, "") ||
      process.env.WEB_APP_URL?.replace(/\/$/, "") ||
      "https://guest.cullinos.com";
    return `${root}/feedback?token=${encodeURIComponent(surveyToken)}`;
  }

  async getSurveyByToken(token: string) {
    const row = await this.prisma.feedbackResponse.findUnique({
      where: { surveyToken: token },
      include: {
        order: { select: { orderNumber: true, status: true } },
        outlet: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundException("Survey not found");
    return {
      surveyToken: row.surveyToken,
      orderNumber: row.order.orderNumber,
      outletName: row.outlet.name,
      alreadySubmitted: row.rating != null,
      rating: row.rating,
      comment: row.comment,
    };
  }

  async submitSurvey(token: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) {
      throw new BadRequestException("rating must be between 1 and 5");
    }
    const row = await this.prisma.feedbackResponse.findUnique({
      where: { surveyToken: token },
    });
    if (!row) throw new NotFoundException("Survey not found");
    if (row.rating != null) {
      throw new ConflictException("Feedback already submitted for this order");
    }
    return this.prisma.feedbackResponse.update({
      where: { id: row.id },
      data: {
        rating,
        comment: comment?.trim() || null,
      },
    });
  }

  summary(orgId: string, params: { outletId?: string; from?: string; to?: string }) {
    return this.list(orgId, params).then(async (rows) => {
      const submitted = rows.filter((r) => r.rating != null);
      const avg =
        submitted.length > 0
          ? submitted.reduce((s, r) => s + (r.rating ?? 0), 0) / submitted.length
          : 0;
      const distribution = [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: submitted.filter((r) => r.rating === star).length,
      }));
      return {
        totalResponses: submitted.length,
        averageRating: Math.round(avg * 10) / 10,
        distribution,
      };
    });
  }
}
