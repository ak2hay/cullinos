export type ReviewSubject = {
  assignmentId: string;
  userId: string;
  roleKey: string;
  managerUserId: string | null;
};

/**
 * One review item per grant. The employee's manager reviews; nobody reviews their own
 * access (falls back to campaign owners, i.e. reviewerId null).
 */
export function buildReviewItems(subjects: readonly ReviewSubject[]) {
  return subjects.map((s) => ({
    assignmentId: s.assignmentId,
    userId: s.userId,
    roleKey: s.roleKey,
    reviewerId: s.managerUserId && s.managerUserId !== s.userId ? s.managerUserId : null,
  }));
}

export function primaryAssignmentId(userId: string) {
  return `primary:${userId}`;
}

export function parsePrimaryAssignmentId(id: string): string | null {
  return id.startsWith("primary:") ? id.slice("primary:".length) : null;
}

export function campaignProgress(items: readonly { decision: string }[]) {
  const total = items.length;
  const pending = items.filter((i) => i.decision === "pending").length;
  return {
    total,
    pending,
    certified: items.filter((i) => i.decision === "certified").length,
    revoked: items.filter((i) => i.decision === "revoked").length,
    percentDone: total ? Math.round(((total - pending) / total) * 100) : 100,
  };
}
