import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { map, type Observable } from "rxjs";
import { setRefreshCookie } from "./refresh-cookie.util";

/**
 * Any auth response that carries a refresh token also sets it as an HttpOnly cookie, so
 * browsers can restore a session after reload without keeping the token in JS storage.
 * Browsers always send Origin on POST, so they get the cookie only; native clients
 * (waiter app) send no Origin and keep the body copy in secure storage.
 */
@Injectable()
export class RefreshCookieInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    return next.handle().pipe(
      map((body: unknown) => {
        if (
          body &&
          typeof body === "object" &&
          ("refreshToken" in body || "sessionId" in body)
        ) {
          const { sessionId: _sessionId, ...rest } = body as Record<string, unknown>;
          if (typeof rest.refreshToken === "string" && rest.refreshToken) {
            setRefreshCookie(req, res, rest.refreshToken);
            if (req.headers.origin) delete rest.refreshToken;
          }
          return rest;
        }
        return body;
      }),
    );
  }
}
