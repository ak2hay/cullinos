import { AsyncLocalStorage } from "node:async_hooks";
import type { NestMiddleware } from "@nestjs/common";
import { Injectable, SetMetadata } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/** Client portals that super admin can switch off or put in maintenance platform-wide. */
export const SWITCHABLE_PORTALS = [
  "management",
  "admin",
  "pos",
  "kds",
  "app_ops",
  "waiter",
  "waiter_landing",
] as const;
export type SwitchablePortal = (typeof SWITCHABLE_PORTALS)[number];

export const PORTAL_HEADER = "x-cullinos-portal";

export function parsePortal(value: unknown): SwitchablePortal | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (SWITCHABLE_PORTALS as readonly string[]).includes(normalized)
    ? (normalized as SwitchablePortal)
    : null;
}

const portalStorage = new AsyncLocalStorage<{ portal: SwitchablePortal | null }>();

/** Portal declared by the calling client for the current request (via X-Cullinos-Portal). */
export function currentRequestPortal(): SwitchablePortal | null {
  return portalStorage.getStore()?.portal ?? null;
}

@Injectable()
export class PortalContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    portalStorage.run({ portal: parsePortal(req.headers[PORTAL_HEADER]) }, next);
  }
}

export const ALLOW_DISABLED_PORTAL_KEY = "allowDisabledPortal";
/** Route stays reachable even when the caller's portal is switched off (e.g. status probe). */
export const AllowDisabledPortal = () => SetMetadata(ALLOW_DISABLED_PORTAL_KEY, true);
