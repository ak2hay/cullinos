import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

export type PlatformNotice = {
  kind: string;
  title: string;
  body?: string;
  /** Path inside the super admin SPA, e.g. /approvals/abc */
  link?: string;
  email?: boolean;
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** In-app inbox for platform staff, with optional email copy. */
@Injectable()
export class PlatformNotificationsService {
  private readonly logger = new Logger(PlatformNotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  private baseUrl() {
    return process.env.SUPER_ADMIN_URL?.trim().replace(/\/$/, "") || "https://platform.cullinos.com";
  }

  async notify(userIds: readonly string[], notice: PlatformNotice): Promise<void> {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return;
    await this.prisma.platformNotification.createMany({
      data: ids.map((userId) => ({
        userId,
        kind: notice.kind,
        title: notice.title.slice(0, 200),
        body: notice.body?.slice(0, 2000) ?? null,
        link: notice.link ?? null,
      })),
    });
    if (!notice.email) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, status: "active" },
      select: { email: true },
    });
    const url = notice.link ? `${this.baseUrl()}${notice.link}` : this.baseUrl();
    for (const u of users) {
      void this.mail
        .sendMail({
          to: u.email,
          subject: `[Cullinos Platform] ${notice.title}`,
          text: `${notice.body ?? notice.title}\n\nOpen: ${url}`,
          html: `<p>${escapeHtml(notice.body ?? notice.title)}</p><p><a href="${escapeHtml(url)}">Open in Super Admin</a></p>`,
        })
        .catch((err: Error) => this.logger.warn(`Notification email failed: ${err.message}`));
    }
  }

  async list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const [items, unread] = await Promise.all([
      this.prisma.platformNotification.findMany({
        where: { userId, ...(opts.unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: Math.min(opts.limit ?? 30, 100),
      }),
      this.prisma.platformNotification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(userId: string, ids?: string[]) {
    await this.prisma.platformNotification.updateMany({
      where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
