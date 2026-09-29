import type { Prisma } from "@prisma/client";

type TableTx = Pick<Prisma.TransactionClient, "table" | "tableSession">;

/**
 * Detach every table merged into `primaryId` and give them `status`.
 * Returns the released table ids so callers can emit `table.updated`.
 */
export async function releaseMergedTables(
  tx: TableTx,
  primaryId: string,
  status: "available" | "cleaning",
): Promise<string[]> {
  const children = await tx.table.findMany({
    where: { mergedIntoTableId: primaryId },
    select: { id: true },
  });
  if (children.length === 0) return [];
  const ids = children.map((c) => c.id);
  await tx.table.updateMany({
    where: { id: { in: ids } },
    data: { mergedIntoTableId: null, status },
  });
  await tx.tableSession.updateMany({
    where: { tableId: { in: ids }, status: "active" },
    data: { status: "closed", endedAt: new Date() },
  });
  return ids;
}

/** Point every table merged into `fromId` at `toId` instead. Returns the moved table ids. */
export async function repointMergedTables(
  tx: TableTx,
  fromId: string,
  toId: string,
): Promise<string[]> {
  const children = await tx.table.findMany({
    where: { mergedIntoTableId: fromId },
    select: { id: true },
  });
  if (children.length === 0) return [];
  const ids = children.map((c) => c.id);
  await tx.table.updateMany({
    where: { id: { in: ids } },
    data: { mergedIntoTableId: toId },
  });
  return ids;
}
