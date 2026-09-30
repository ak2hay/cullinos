export type DeliveryZoneLike = {
  id: string;
  name?: string;
  polygon: unknown;
  deliveryFee: unknown;
  minOrder: unknown;
};

export type DeliveryLocation = {
  pincode?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type ZoneRules = {
  pincodes: string[];
  center: { lat: number; lng: number } | null;
  radiusKm: number | null;
  estimatedMinutes: number | null;
};

function zoneRules(zone: DeliveryZoneLike): ZoneRules {
  const poly = (zone.polygon ?? {}) as Record<string, unknown>;
  const pincodes = [
    ...(Array.isArray(poly.pincodes) ? poly.pincodes : []),
    ...(poly.pincode != null ? [poly.pincode] : []),
  ]
    .map((p) => String(p).trim())
    .filter(Boolean);
  const lat = Number(poly.lat);
  const lng = Number(poly.lng);
  const radiusKm = Number(poly.radiusKm);
  const minutes =
    typeof poly.estimatedMinutes === 'number'
      ? poly.estimatedMinutes
      : Number(poly.estimatedMinutes) || null;
  return {
    pincodes,
    center:
      Number.isFinite(lat) && Number.isFinite(lng) && poly.lat != null && poly.lng != null
        ? { lat, lng }
        : null,
    radiusKm: Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : null,
    estimatedMinutes: minutes,
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isRestricted(rules: ZoneRules) {
  return rules.pincodes.length > 0 || (rules.center != null && rules.radiusKm != null);
}

export type DeliveryZoneMatch<Z extends DeliveryZoneLike> =
  | { ok: true; zone: Z; fee: number; minOrder: number; estimatedMinutes: number | null }
  | { ok: false; reason: 'no_zones' | 'location_required' | 'outside' };

/**
 * Single source of truth for delivery-zone matching (quote + order create).
 * Zones restrict by pincode(s) and/or a centre + radius; an unrestricted zone is a catch-all.
 * Client-chosen zone IDs are never trusted.
 */
export function matchDeliveryZone<Z extends DeliveryZoneLike>(
  zones: Z[],
  location: DeliveryLocation,
): DeliveryZoneMatch<Z> {
  if (zones.length === 0) return { ok: false, reason: 'no_zones' };

  const pincode = location.pincode?.trim() || null;
  const hasCoords =
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng);

  const withRules = zones.map((zone) => ({ zone, rules: zoneRules(zone) }));
  const restricted = withRules.filter((z) => isRestricted(z.rules));

  if (!pincode && !hasCoords && restricted.length > 0) {
    return { ok: false, reason: 'location_required' };
  }

  const found =
    (pincode ? withRules.find((z) => z.rules.pincodes.includes(pincode)) : undefined) ??
    (hasCoords
      ? withRules.find(
          (z) =>
            z.rules.center != null &&
            z.rules.radiusKm != null &&
            haversineKm(location.lat!, location.lng!, z.rules.center.lat, z.rules.center.lng) <=
              z.rules.radiusKm,
        )
      : undefined) ??
    withRules.find((z) => !isRestricted(z.rules));

  if (!found) return { ok: false, reason: 'outside' };
  return {
    ok: true,
    zone: found.zone,
    fee: Number(found.zone.deliveryFee),
    minOrder: Number(found.zone.minOrder),
    estimatedMinutes: found.rules.estimatedMinutes,
  };
}
