export type OrgStatusCount = { status: string; _count: { _all: number } };

export type OrgSummaryExtras = {
  deleted: number;
  outlets: number;
  users: number;
  newThisMonth: number;
  totalAtMonthStart: number;
  usersAtMonthStart: number;
};

export type OrgSummary = OrgSummaryExtras & {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  cancelled: number;
};

/** Folds a status groupBy into the tenant KPI / tab counts. `total` excludes soft-deleted tenants. */
export function summarizeOrgCounts(byStatus: OrgStatusCount[], extras: OrgSummaryExtras): OrgSummary {
  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row.status] = (counts[row.status] ?? 0) + row._count._all;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    total,
    active: counts.active ?? 0,
    trial: counts.trial ?? 0,
    suspended: counts.suspended ?? 0,
    cancelled: counts.cancelled ?? 0,
    ...extras,
  };
}
