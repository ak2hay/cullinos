import { describe, expect, it } from "vitest";

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchZone(
  zones: Array<{ id: string; polygon: unknown; deliveryFee: number; minOrder: number }>,
  pincode?: string,
  zoneId?: string,
) {
  if (pincode) {
    return zones.find((z) => {
      const poly = (z.polygon ?? {}) as Record<string, unknown>;
      return String(poly.pincode ?? "") === pincode;
    });
  }
  if (zoneId) return zones.find((z) => z.id === zoneId);
  return zones.length === 1 ? zones[0] : undefined;
}

describe("guest marketplace helpers", () => {
  it("computes nearby distance roughly", () => {
    const km = haversineKm(12.9716, 77.5946, 12.9352, 77.6245);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(8);
  });

  it("matches delivery zone by pincode", () => {
    const zones = [
      {
        id: "z1",
        polygon: { pincode: "560001", estimatedMinutes: 40 },
        deliveryFee: 40,
        minOrder: 199,
      },
      {
        id: "z2",
        polygon: { pincode: "560002" },
        deliveryFee: 50,
        minOrder: 249,
      },
    ];
    expect(matchZone(zones, "560001")?.id).toBe("z1");
    expect(matchZone(zones, "999999")).toBeUndefined();
    expect(matchZone(zones, undefined, "z2")?.id).toBe("z2");
  });
});
