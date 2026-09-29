import { describe, expect, it } from "vitest";
import { matchDeliveryZone } from "./delivery-zone.util";

const zone = (id: string, polygon: unknown, deliveryFee = 40, minOrder = 0) => ({
  id,
  polygon,
  deliveryFee,
  minOrder,
});

describe("matchDeliveryZone", () => {
  it("reports no zones", () => {
    expect(matchDeliveryZone([], { pincode: "560001" })).toEqual({ ok: false, reason: "no_zones" });
  });

  it("requires a location when any zone is restricted", () => {
    const zones = [zone("z1", { pincode: "560001" })];
    expect(matchDeliveryZone(zones, {})).toEqual({ ok: false, reason: "location_required" });
  });

  it("matches by pincode or pincode list", () => {
    const zones = [zone("z1", { pincode: "560001" }), zone("z2", { pincodes: ["560002", "560003"] }, 60)];
    expect(matchDeliveryZone(zones, { pincode: "560001" })).toMatchObject({ ok: true, fee: 40 });
    expect(matchDeliveryZone(zones, { pincode: " 560003 " })).toMatchObject({ ok: true, fee: 60 });
    expect(matchDeliveryZone(zones, { pincode: "999999" })).toEqual({ ok: false, reason: "outside" });
  });

  it("matches by radius when coordinates are given", () => {
    const zones = [zone("r1", { lat: 12.9716, lng: 77.5946, radiusKm: 6 })];
    const near = matchDeliveryZone(zones, { lat: 12.9352, lng: 77.6245 });
    expect(near.ok && near.zone.id).toBe("r1");
    expect(matchDeliveryZone(zones, { lat: 13.2, lng: 77.9 })).toEqual({ ok: false, reason: "outside" });
  });

  it("falls back to an unrestricted catch-all zone", () => {
    const zones = [zone("any", { estimatedMinutes: 30 })];
    expect(matchDeliveryZone(zones, {})).toMatchObject({ ok: true, estimatedMinutes: 30 });
  });
});
