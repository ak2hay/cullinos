import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { catchError, from, mergeMap, of, tap, throwError, type Observable } from "rxjs";
import { REQUIRES_APPROVAL_KEY, type RequiresApprovalSpec } from "../../common/decorators";
import { describeRoute } from "../platform-iam/platform-activity.util";
import { payloadHash, stripApiPrefix, type ReplayPayload } from "./approval.util";
import { PlatformApprovalsService } from "./platform-approvals.service";

type ApprovalHttpRequest = {
  method: string;
  url: string;
  originalUrl?: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  user?: { sub?: string; email?: string; isSuperAdmin?: boolean };
  approvalRequest?: { id: string } | null;
};

function header(req: ApprovalHttpRequest, name: string): string | undefined {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

function decodeHeader(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Maker-checker for routes marked @RequiresApproval. Without X-Approval-Id the request is
 * parked as an approval request (HTTP 202); with an approved id for the identical payload
 * it runs once and the approval is marked executed.
 */
@Injectable()
export class PlatformApprovalInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private approvals: PlatformApprovalsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const spec = this.reflector.getAllAndOverride<RequiresApprovalSpec | undefined>(REQUIRES_APPROVAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<ApprovalHttpRequest>();
    if (!spec || !req.user?.isSuperAdmin || !req.user.sub) return next.handle();
    const actor = { sub: req.user.sub, email: req.user.email };

    const replay: ReplayPayload = {
      method: req.method.toUpperCase(),
      path: stripApiPrefix(req.originalUrl ?? req.url),
      query: { ...(req.query ?? {}) },
      body: req.body ?? null,
    };
    const approvalId = header(req, "x-approval-id");

    if (approvalId) {
      return from(this.approvals.claimForExecution(actor, approvalId, spec.actionKey, payloadHash(replay))).pipe(
        mergeMap((claimed) => {
          req.approvalRequest = { id: claimed.id };
          return next.handle().pipe(
            tap((result) => void this.approvals.completeExecution(claimed.id, true, result)),
            catchError((err) => {
              void this.approvals.completeExecution(claimed.id, false, err);
              return throwError(() => err);
            }),
          );
        }),
      );
    }

    return from(
      this.approvals.policyFor(spec.actionKey, {
        body: req.body,
        query: req.query ?? {},
        params: req.params ?? {},
      }),
    ).pipe(
      mergeMap((policy) => {
        if (!policy) {
          req.approvalRequest = null;
          return next.handle();
        }
        return from(
          this.approvals.createRequest({
            policy,
            title: spec.title,
            requestedBy: actor,
            justification: decodeHeader(header(req, "x-approval-justification")),
            replay,
            sensitiveBody: spec.sensitiveBody,
            ticketId: header(req, "x-ticket-id") ?? null,
            targetOrgId: describeRoute(replay.method, replay.path, req.params, replay.path).targetOrgId,
          }),
        ).pipe(
          mergeMap((created) => {
            context.switchToHttp().getResponse<{ status: (code: number) => void }>().status(202);
            return of({
              approvalRequired: true,
              approvalRequest: { id: created.id, ref: created.ref, status: created.status, title: created.title },
              message: `Sent for approval as ${created.ref}. It will run once approved.`,
            });
          }),
        );
      }),
    );
  }
}
