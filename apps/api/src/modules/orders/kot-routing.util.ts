import { isAlcoholProductType } from "@cullinos/shared";
import { BAR_STATION } from "../../common/kitchen-stations.util";

export type KotRoutableItem = { id: string; stationCode: string | null };

/**
 * Station code for an order item: the item's own code wins, then its category's;
 * otherwise alcohol items fall back to the Bar station.
 */
export function stationCodeFor(
  categoryStationCode: string | null | undefined,
  productType: string | null | undefined,
  itemStationCode?: string | null,
): string | null {
  if (itemStationCode?.trim()) return itemStationCode;
  if (categoryStationCode?.trim()) return categoryStationCode;
  return isAlcoholProductType(productType) ? BAR_STATION.code : null;
}
export type KotStation = { id: string; code: string };
export type KotGroup = { stationId: string | null; stationCode: string | null; itemIds: string[] };

/**
 * Split order items into one ticket per kitchen station. Items whose category has
 * no station code (or a code with no matching station at the outlet) stay on the
 * default ticket (stationId null). Group order follows first appearance.
 */
export function groupItemsByStation(
  items: KotRoutableItem[],
  stations: KotStation[],
): KotGroup[] {
  const stationByCode = new Map(stations.map((s) => [s.code.trim().toUpperCase(), s]));
  const groups = new Map<string, KotGroup>();

  for (const item of items) {
    const station = item.stationCode
      ? stationByCode.get(item.stationCode.trim().toUpperCase())
      : undefined;
    const key = station?.id ?? "";
    let group = groups.get(key);
    if (!group) {
      group = {
        stationId: station?.id ?? null,
        stationCode: station ? station.code.trim().toUpperCase() : null,
        itemIds: [],
      };
      groups.set(key, group);
    }
    group.itemIds.push(item.id);
  }

  return [...groups.values()];
}

/** Station tickets get the station code as suffix so printed tickets are distinguishable (e.g. K0012-BAR). */
export function kotNumberFor(base: string, group: KotGroup): string {
  return group.stationCode ? `${base}-${group.stationCode}` : base;
}
