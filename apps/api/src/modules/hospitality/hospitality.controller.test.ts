import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { HospitalityController } from "./hospitality.controller";

describe("HospitalityController", () => {
  it("relies on the global guards instead of an unregistered Passport strategy", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, HospitalityController)).toBeUndefined();
  });

  it("records the signed-in staff member (JWT sub) as the actor", async () => {
    const service = {
      createGuest: vi.fn(async () => ({})),
      settleRoomPosting: vi.fn(async () => ({})),
    };
    const ctrl = new HospitalityController(service as never);
    const user = { sub: "u1", organizationId: "o1", email: "a@b.c" };

    await ctrl.createGuest("o1", user, { name: "Guest" } as never);
    await ctrl.settleRoomPosting("p1", "o1", user);

    expect(service.createGuest).toHaveBeenCalledWith("o1", "u1", { name: "Guest" });
    expect(service.settleRoomPosting).toHaveBeenCalledWith("p1", "o1", "u1");
  });
});
