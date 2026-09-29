import { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { IS_PUBLIC_KEY } from "../../common/decorators";
import { PERMISSIONS_KEY } from "../../common/decorators/permissions.decorator";
import { SyncController } from "./sync.controller";

function controller() {
  const sync = {
    processEvent: vi.fn(async (p: unknown) => p),
    processBatch: vi.fn(async (events: unknown[]) => events),
    list: vi.fn(),
  };
  return { ctrl: new SyncController(sync as never), sync };
}

describe("SyncController", () => {
  it("is not public and requires POS access", () => {
    const reflector = new Reflector();
    for (const handler of [SyncController.prototype.receive, SyncController.prototype.receiveBatch]) {
      expect(reflector.get(IS_PUBLIC_KEY, handler)).toBeUndefined();
      expect(reflector.get(PERMISSIONS_KEY, handler)).toEqual(["pos:access"]);
    }
  });

  it("takes the tenant from the JWT, ignoring organizationId in the envelope", async () => {
    const { ctrl, sync } = controller();
    const user = { sub: "u1" } as never;
    await ctrl.receive("org_jwt", user, "k1", {
      type: "order.create",
      organizationId: "org_victim",
      data: {},
    });
    expect(sync.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org_jwt", idempotencyKey: "k1" }),
      "u1",
    );

    await ctrl.receiveBatch("org_jwt", user, {
      events: [{ type: "payment.cash", organizationId: "org_victim", idempotencyKey: "k2" }],
    });
    expect(sync.processBatch).toHaveBeenCalledWith(
      [expect.objectContaining({ organizationId: "org_jwt", idempotencyKey: "k2" })],
      "u1",
    );
  });
});
