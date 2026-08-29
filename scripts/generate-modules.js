const fs = require("fs");
const path = require("path");

const modules = [
  { name: "outlets", model: "outlet", controller: "outlets" },
  { name: "users", model: "user", controller: "users" },
  { name: "roles", model: "role", controller: "roles" },
  { name: "audit", model: "auditLog", controller: "audit", method: "auditLogs" },
  { name: "subscriptions", model: "subscription", controller: "subscriptions" },
  { name: "menu", model: "menuItem", controller: "menu", method: "menuItems" },
  { name: "tables", model: "table", controller: "tables", extra: "include: { section: true }" },
  { name: "pos", model: "order", controller: "pos", method: "orders" },
  { name: "kot", model: "kOT", controller: "kot", method: "kots" },
  { name: "kitchen", model: "kOT", controller: "kitchen", method: "kots" },
  { name: "payments", model: "payment", controller: "payments" },
  { name: "billing", model: "invoice", controller: "billing", method: "invoices" },
  { name: "tax", model: "taxGroup", controller: "tax", method: "taxGroups" },
  { name: "inventory", model: "inventoryItem", controller: "inventory", method: "inventoryItems" },
  { name: "recipes", model: "recipe", controller: "recipes" },
  { name: "purchasing", model: "purchaseOrder", controller: "purchasing", method: "purchaseOrders" },
  { name: "wastage", model: "wastage", controller: "wastage" },
  { name: "customers", model: "customer", controller: "customers" },
  { name: "loyalty", model: "loyaltyTier", controller: "loyalty", method: "loyaltyTiers" },
  { name: "coupons", model: "coupon", controller: "coupons" },
  { name: "delivery", model: "deliveryZone", controller: "delivery", method: "deliveryZones" },
  { name: "guests", model: "guest", controller: "guests" },
  { name: "rooms", model: "room", controller: "rooms" },
  { name: "banquets", model: "banquet", controller: "banquets" },
  { name: "franchise", model: "franchiseAgreement", controller: "franchise", method: "franchiseAgreements" },
  { name: "staff", model: "employee", controller: "staff", method: "employees" },
  { name: "reports", model: "analyticsSnapshot", controller: "reports", method: "analyticsSnapshots" },
  { name: "analytics", model: "analyticsSnapshot", controller: "analytics", method: "analyticsSnapshots" },
  { name: "insights", model: "insightsSnapshot", controller: "insights", method: "insightsSnapshots" },
  { name: "super-admin", className: "SuperAdmin", controller: "super-admin" },
  { name: "notifications", model: "notification", controller: "notifications" },
  { name: "integrations", model: "integration", controller: "integrations" },
  { name: "devices", model: "device", controller: "devices" },
  { name: "sync", model: "syncEvent", controller: "sync", method: "syncEvents" },
];

const base = path.join(__dirname, "..", "apps", "api", "src", "modules");

function toClass(name) {
  if (name.className) return name.className;
  return name.name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

const skip = new Set(["organizations", "orders", "internal", "auth", "audit", "wastage", "sync"]);

for (const m of modules) {
  if (skip.has(m.name)) continue;
  const dir = path.join(base, m.name);
  fs.mkdirSync(dir, { recursive: true });
  const cls = toClass(m);
  const prismaMethod = m.method || m.model + "s";
  const prismaModel = m.model || "organization";

  let serviceContent;
  if (m.name === "super-admin") {
    serviceContent = `import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ${cls}Service {
  constructor(private prisma: PrismaService) {}
  listTenants() {
    return this.prisma.organization.findMany({
      include: { subscriptions: { include: { plan: true } }, outlets: true },
      orderBy: { id: "desc" },
    });
  }
  suspendTenant(id: string) {
    return this.prisma.organization.update({ where: { id }, data: { status: "suspended" } });
  }
  reactivateTenant(id: string) {
    return this.prisma.organization.update({ where: { id }, data: { status: "active" } });
  }
}
`;
  } else {
    serviceContent = `import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ${cls}Service {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.${prismaModel}.findMany({
      where: { organizationId: orgId },
      orderBy: { id: "desc" },
      take: 200,
    });
  }
}
`;
  }

  const controllerContent = m.name === "super-admin"
    ? `import { Controller, Get, Param, Patch } from "@nestjs/common";
import { ${cls}Service } from "./${m.name}.service";

@Controller("${m.controller}")
export class ${cls}Controller {
  constructor(private service: ${cls}Service) {}
  @Get("tenants") listTenants() { return this.service.listTenants(); }
  @Patch("tenants/:id/suspend") suspend(@Param("id") id: string) { return this.service.suspendTenant(id); }
  @Patch("tenants/:id/reactivate") reactivate(@Param("id") id: string) { return this.service.reactivateTenant(id); }
}
`
    : `import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { ${cls}Service } from "./${m.name}.service";

@Controller("${m.controller}")
export class ${cls}Controller {
  constructor(private service: ${cls}Service) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
`;

  const moduleContent = `import { Module } from "@nestjs/common";
import { ${cls}Controller } from "./${m.name}.controller";
import { ${cls}Service } from "./${m.name}.service";

@Module({
  controllers: [${cls}Controller],
  providers: [${cls}Service],
  exports: [${cls}Service],
})
export class ${cls}Module {}
`;

  fs.writeFileSync(path.join(dir, `${m.name}.service.ts`), serviceContent);
  fs.writeFileSync(path.join(dir, `${m.name}.controller.ts`), controllerContent);
  fs.writeFileSync(path.join(dir, `${m.name}.module.ts`), moduleContent);
}

console.log("Generated", modules.length, "modules");
