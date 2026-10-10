import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { randomUUID } from "crypto";
import { catchError, tap, throwError, type Observable } from "rxjs";
import { SKIP_ACTIVITY_LOG_KEY } from "../../common/decorators";
import { clientIp } from "../../common/client-ip.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformAccessService } from "./platform-access.service";
import { PlatformActivityService } from "./platform-activity.service";
import { describeRoute, redactForLog } from "./platform-activity.util";

type ActivityRequest = {
  method: string;
  url: string;
  originalUrl?: string;
  path?: string;
  ip?: string;
  route?: { path?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  user?: {
    sub?: string;
    email?: string;
    organizationId?: string;
    isSuperAdmin?: boolean;
    impersonation?: boolean;
    impersonatedBy?: string;
    employeeCode?: string;
    grantId?: string;
    ticketId?: string;
    accessLevel?: string;
  };
};

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function header(req: ActivityRequest, name: string): string | null {
  const v = req.headers[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim().slice(0, 100) : null;
}

/**
 * Writes one activity row per platform staff request (reads included), stamped with the
 * employee code, and one per request made inside a ticket-backed tenant access session.
 */
@Injectable()
export class PlatformActivityInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private activity: PlatformActivityService,
    private access: PlatformAccessService,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<ActivityRequest>();
    const user = req.user;
    const url = req.originalUrl ?? req.url ?? "";
    const isPlatform = Boolean(user?.isSuperAdmin) && url.includes("/super-admin");
    const isSupportSession = user?.impersonation === true;
    if (!isPlatform && !isSupportSession) return next.handle();
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ACTIVITY_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const finish = (statusCode: number) => {
      void this.write(req, statusCode, isSupportSession);
    };
    return next.handle().pipe(
      tap(() => finish(context.switchToHttp().getResponse<{ statusCode?: number }>().statusCode ?? 200)),
      catchError((err: { status?: number; getStatus?: () => number }) => {
        finish(typeof err?.getStatus === "function" ? err.getStatus() : (err?.status ?? 500));
        return throwError(() => err);
      }),
    );
  }

  private async write(req: ActivityRequest, statusCode: number, isSupportSession: boolean) {
    const user = req.user ?? {};
    const method = req.method.toUpperCase();
    const url = req.originalUrl ?? req.url ?? "";
    const routePattern = `${req.route?.path ?? req.path ?? url}`;
    const described = describeRoute(method, routePattern, req.params, url);
    const body = MUTATING.has(method) ? redactForLog(req.body) : undefined;
    const query = req.query && Object.keys(req.query).length ? redactForLog(req.query) : undefined;

    if (isSupportSession) {
      const staffUserId = user.impersonatedBy ?? null;
      const identity = staffUserId ? await this.access.identity(staffUserId) : null;
      await this.activity.record({
        userId: staffUserId,
        employeeCode: user.employeeCode ?? identity?.employeeCode ?? null,
        actorEmail: identity?.email ?? null,
        action: `tenant_session ${described.action}`,
        resourceType: described.resourceType,
        resourceId: described.resourceId,
        method,
        route: url.split("?")[0],
        statusCode,
        targetOrgId: user.organizationId ?? null,
        requestId: header(req, "x-request-id") ?? randomUUID(),
        ip: clientIp(req as never) ?? null,
        userAgent: header(req, "user-agent"),
        ticketId: user.ticketId ?? null,
        grantId: user.grantId ?? null,
        diff: body === undefined && query === undefined ? undefined : { body, query },
        metadata: { accessLevel: user.accessLevel ?? null, actingAsUserId: user.sub ?? null },
      });
      if (MUTATING.has(method) && user.organizationId) {
        // The restaurant's own audit log shows exactly which Rkyves employee did what.
        await this.prisma.auditLog
          .create({
            data: {
              organizationId: user.organizationId,
              userId: user.sub ?? null,
              action: "support_session.action",
              entityType: described.resourceType ?? "request",
              entityId: described.resourceId,
              metadata: {
                employeeCode: user.employeeCode ?? identity?.employeeCode ?? null,
                ticketId: user.ticketId ?? null,
                grantId: user.grantId ?? null,
                method,
                route: url.split("?")[0],
                statusCode,
              },
              ipAddress: clientIp(req as never) ?? null,
            },
          })
          .catch(() => undefined);
      }
      return;
    }

    const identity = user.sub ? await this.access.identity(user.sub) : null;
    await this.activity.record({
      userId: user.sub ?? null,
      employeeCode: identity?.employeeCode ?? null,
      actorEmail: user.email ?? identity?.email ?? null,
      action: described.action,
      resourceType: described.resourceType,
      resourceId: described.resourceId,
      method,
      route: url.split("?")[0],
      statusCode,
      targetOrgId: described.targetOrgId,
      requestId: header(req, "x-request-id") ?? randomUUID(),
      ip: clientIp(req as never) ?? null,
      userAgent: header(req, "user-agent"),
      approvalRequestId: header(req, "x-approval-id"),
      ticketId: header(req, "x-ticket-id"),
      diff: body === undefined && query === undefined ? undefined : { body, query },
    });
  }
}
