export type RotationLike = {
  memberUserIds: readonly string[];
  rotationDays: number;
  startsAt: Date;
  isActive: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Who is on call for a rotation at `at` (members take turns of `rotationDays`). */
export function onCallUserId(rotation: RotationLike, at: Date = new Date()): string | null {
  if (!rotation.isActive || rotation.memberUserIds.length === 0) return null;
  const elapsed = at.getTime() - rotation.startsAt.getTime();
  if (elapsed < 0) return null;
  const span = Math.max(1, rotation.rotationDays) * DAY_MS;
  const turn = Math.floor(elapsed / span);
  return rotation.memberUserIds[turn % rotation.memberUserIds.length] ?? null;
}

/** Upcoming hand-offs for display: [{ userId, from, to }]. */
export function rotationSchedule(rotation: RotationLike, from: Date, turns: number) {
  const out: { userId: string; from: Date; to: Date }[] = [];
  if (!rotation.isActive || rotation.memberUserIds.length === 0) return out;
  const span = Math.max(1, rotation.rotationDays) * DAY_MS;
  const start = rotation.startsAt.getTime();
  let turn = Math.max(0, Math.floor((from.getTime() - start) / span));
  for (let i = 0; i < turns; i++, turn++) {
    out.push({
      userId: rotation.memberUserIds[turn % rotation.memberUserIds.length],
      from: new Date(start + turn * span),
      to: new Date(start + (turn + 1) * span),
    });
  }
  return out;
}

export const SLA_HOURS: Record<"low" | "normal" | "high" | "urgent", number> = {
  urgent: 4,
  high: 8,
  normal: 24,
  low: 72,
};

export function slaDueAt(priority: keyof typeof SLA_HOURS, from: Date = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3600_000);
}
