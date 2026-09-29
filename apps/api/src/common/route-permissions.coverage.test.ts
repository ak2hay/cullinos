import { describe, expect, it } from "vitest";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { IS_PUBLIC_KEY } from "./decorators";
import { PERMISSIONS_KEY } from "./decorators/permissions.decorator";

/**
 * Deny-by-default: every authenticated tenant route must declare role permissions,
 * unless it is listed here as a self-service route that any signed-in user may call.
 */
const SELF_SERVICE_ROUTES = new Set<string>([
  "AuthController.changePassword",
  "AuthController.logoutAll",
  // Branding/business type + POS/KDS operational settings for every signed-in staff role.
  "OrganizationsController.current",
  "OrganizationsController.list",
  "OrganizationsController.getSettings",
]);

/** Route prefixes guarded by something other than tenant role permissions. */
const NON_TENANT_PREFIXES = ["public", "super-admin", "internal", "health", "aggregators/webhooks"];

type ControllerClass = { name: string; prototype: Record<string, unknown> };

function controllerPath(ctrl: ControllerClass): string {
  const raw = Reflect.getMetadata(PATH_METADATA, ctrl) as string | string[] | undefined;
  const path = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  return path.replace(/^\/+/, "");
}

function collectControllers(): ControllerClass[] {
  const modules = import.meta.glob("../modules/**/*.controller.ts", { eager: true }) as Record<
    string,
    Record<string, unknown>
  >;
  const out: ControllerClass[] = [];
  for (const mod of Object.values(modules)) {
    for (const exported of Object.values(mod)) {
      if (typeof exported !== "function") continue;
      if (Reflect.getMetadata(PATH_METADATA, exported) === undefined) continue;
      out.push(exported as unknown as ControllerClass);
    }
  }
  return out;
}

function unprotectedRoutes(): string[] {
  const missing: string[] = [];
  for (const ctrl of collectControllers()) {
    const base = controllerPath(ctrl);
    if (NON_TENANT_PREFIXES.some((p) => base === p || base.startsWith(`${p}/`))) continue;
    const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ctrl) === true;
    const classPerms = Reflect.getMetadata(PERMISSIONS_KEY, ctrl) as string[] | undefined;

    for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
      if (name === "constructor") continue;
      const handler = ctrl.prototype[name];
      if (typeof handler !== "function") continue;
      if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue;
      const routePath = String(Reflect.getMetadata(PATH_METADATA, handler) ?? "");
      const fullPath = [base, routePath.replace(/^\/+/, "")].filter(Boolean).join("/");
      if (NON_TENANT_PREFIXES.some((p) => fullPath === p || fullPath.startsWith(`${p}/`))) continue;
      if (classPublic || Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true) continue;
      const perms = (Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[] | undefined) ?? classPerms;
      if (perms?.length) continue;
      const id = `${ctrl.name}.${name}`;
      if (SELF_SERVICE_ROUTES.has(id)) continue;
      missing.push(`${id} (${fullPath})`);
    }
  }
  return missing.sort();
}

describe("route permission coverage", () => {
  it("discovers the controller tree", () => {
    expect(collectControllers().length).toBeGreaterThan(50);
  });

  it("every tenant route declares @RequirePermissions (deny by default)", () => {
    expect(unprotectedRoutes()).toEqual([]);
  });
});
