import { apiRequest } from './api';

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export type Risk = 'low' | 'medium' | 'high' | 'critical';
export type PersonRef = { id: string; name?: string; email?: string; employeeCode?: string | null };
export type Page<T> = { data: T[]; nextCursor: string | null; total?: number };

// ─── IAM ──────────────────────────────────────────────────────────────────

export type ScopedGrant = {
  roleKey: string;
  scopeType: 'region' | 'tenant_set';
  scopeValues: string[];
  permissions: string[];
};

export type MyAccess = {
  identity: {
    userId: string;
    email: string;
    name: string;
    employeeCode: string | null;
    teamId: string | null;
    departmentId: string | null;
    managerUserId: string | null;
  } | null;
  primaryRole: string | null;
  isOwner: boolean;
  roleKeys: string[];
  permissions: string[];
  scoped: ScopedGrant[];
};

export type PermissionDef = { key: string; label: string; group: string; risk: Risk; scopable?: boolean };

export type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  headUserId: string | null;
  _count: { teams: number; employees: number };
};

export type Team = {
  id: string;
  departmentId: string;
  parentId: string | null;
  name: string;
  code: string;
  description: string | null;
  leadUserId: string | null;
  ipAllowlist: string[];
  department: { id: string; name: string; code: string };
  _count: { employees: number; children: number };
};

export type RoleDef = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  ipAllowlist: string[];
  permissions: string[];
  maxRisk: Risk | null;
  activeAssignments: number;
  primaryHolders: number;
};

export type Assignment = {
  id: string;
  userId: string;
  roleId: string;
  scopeType: 'global' | 'region' | 'tenant_set';
  scopeValues: string[];
  expiresAt: string | null;
  reason: string | null;
  revokedAt: string | null;
  createdAt: string;
  approvalRequestId: string | null;
  expired: boolean;
  role: { id: string; key: string; name: string; isSystem: boolean };
  user: { id: string; name: string; email: string; platformEmployee: { employeeCode: string } | null };
};

export type ActivityRow = {
  id: string;
  seq: string;
  createdAt: string;
  userId: string | null;
  employeeCode: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  method: string | null;
  route: string | null;
  statusCode: number | null;
  targetOrgId: string | null;
  ip: string | null;
  approvalRequestId: string | null;
  ticketId: string | null;
  grantId: string | null;
  metadata: unknown;
  diff: unknown;
  hash: string;
};

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SecuritySettings = { stepUpCritical: boolean; globalIpAllowlist: string[] };

export const iamApi = {
  me: () => apiRequest<MyAccess>('/super-admin/iam/me'),
  catalog: () =>
    apiRequest<{
      permissions: PermissionDef[];
      systemRoles: { key: string; name: string; description: string; permissions: string[] }[];
    }>('/super-admin/iam/catalog'),

  departments: () => apiRequest<Department[]>('/super-admin/iam/departments'),
  createDepartment: (b: { name: string; code: string; description?: string; headUserId?: string | null }) =>
    apiRequest<Department>('/super-admin/iam/departments', json('POST', b)),
  updateDepartment: (id: string, b: Partial<{ name: string; description: string | null; headUserId: string | null }>) =>
    apiRequest<Department>(`/super-admin/iam/departments/${id}`, json('PATCH', b)),
  deleteDepartment: (id: string) => apiRequest(`/super-admin/iam/departments/${id}`, json('DELETE')),

  teams: () => apiRequest<Team[]>('/super-admin/iam/teams'),
  createTeam: (b: {
    departmentId: string;
    name: string;
    code: string;
    parentId?: string | null;
    description?: string;
    leadUserId?: string | null;
    ipAllowlist?: string[];
  }) => apiRequest<Team>('/super-admin/iam/teams', json('POST', b)),
  updateTeam: (
    id: string,
    b: Partial<{ departmentId: string; name: string; parentId: string | null; description: string | null; leadUserId: string | null; ipAllowlist: string[] }>,
  ) => apiRequest<Team>(`/super-admin/iam/teams/${id}`, json('PATCH', b)),
  deleteTeam: (id: string) => apiRequest(`/super-admin/iam/teams/${id}`, json('DELETE')),

  roles: () => apiRequest<RoleDef[]>('/super-admin/iam/roles'),
  createRole: (b: { key: string; name: string; description?: string; permissions: string[]; ipAllowlist?: string[] }) =>
    apiRequest<RoleDef>('/super-admin/iam/roles', json('POST', b)),
  updateRole: (id: string, b: Partial<{ name: string; description: string | null; permissions: string[]; ipAllowlist: string[] }>) =>
    apiRequest<RoleDef>(`/super-admin/iam/roles/${id}`, json('PATCH', b)),
  deleteRole: (id: string) => apiRequest(`/super-admin/iam/roles/${id}`, json('DELETE')),

  assignments: (f: { userId?: string; roleId?: string; includeRevoked?: boolean } = {}) =>
    apiRequest<Assignment[]>(`/super-admin/iam/assignments${qs(f)}`),
  assign: (b: {
    userId: string;
    roleId: string;
    scopeType?: 'global' | 'region' | 'tenant_set';
    scopeValues?: string[];
    expiresAt?: string | null;
    reason?: string;
  }) => apiRequest<Assignment>('/super-admin/iam/assignments', json('POST', b)),
  revokeAssignment: (id: string) => apiRequest(`/super-admin/iam/assignments/${id}`, json('DELETE')),

  notifications: (unread = false) =>
    apiRequest<{ items: NotificationRow[]; unread: number }>(`/super-admin/iam/notifications${qs({ unread })}`),
  markRead: (ids?: string[]) => apiRequest('/super-admin/iam/notifications/read', json('POST', { ids })),

  activity: (f: {
    employeeCode?: string;
    userId?: string;
    action?: string;
    targetOrgId?: string;
    grantId?: string;
    ticketId?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }) => apiRequest<Page<ActivityRow>>(`/super-admin/iam/activity${qs(f)}`),
  verifyActivity: () =>
    apiRequest<{ ok: boolean; checked: number; brokenAt: string | null }>('/super-admin/iam/activity/verify'),
  exportActivity: (f: { employeeCode?: string; action?: string; targetOrgId?: string; from?: string; to?: string }) =>
    apiRequest<{ csv: string }>(`/super-admin/iam/activity/export${qs(f)}`),

  security: () => apiRequest<SecuritySettings>('/super-admin/iam/security'),
  updateSecurity: (b: Partial<SecuritySettings>) =>
    apiRequest<SecuritySettings>('/super-admin/iam/security', json('PUT', b)),

  startStepUp: () => apiRequest<{ challengeToken: string }>('/super-admin/iam/step-up', json('POST')),
  verifyStepUp: (challengeToken: string, otp: string) =>
    apiRequest<{ stepUpToken: string; expiresInSeconds: number }>(
      '/super-admin/iam/step-up/verify',
      json('POST', { challengeToken, otp }),
    ),
};

// ─── Approvals ────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled' | 'executing' | 'executed';

export type Approval = {
  id: string;
  ref: string;
  seq: number;
  actionKey: string;
  status: ApprovalStatus;
  title: string;
  payload: {
    method?: string;
    path?: string;
    query?: Record<string, unknown>;
    bodyPreview?: unknown;
    sensitive?: boolean;
    summary?: Record<string, unknown>;
  };
  justification: string;
  ticketId: string | null;
  targetOrgId: string | null;
  requestedBy: PersonRef;
  requiredApprovals: number;
  approverRoleKeys: string[];
  expiresAt: string;
  decidedAt: string | null;
  executedAt: string | null;
  executionResult: unknown;
  createdAt: string;
  decisions: {
    approverId: string;
    approver: { name: string; email: string; employeeCode: string | null } | null;
    decision: 'approved' | 'rejected';
    comment: string | null;
    createdAt: string;
  }[];
};

export type ApprovalDetail = Approval & {
  approvers: PersonRef[];
  canDecide: boolean;
  decideBlocker: string | null;
  canExecute: boolean;
};

export type ApprovalPolicy = {
  id: string;
  actionKey: string;
  name: string;
  description: string | null;
  requiredApprovals: number;
  approverRoleKeys: string[];
  approverTeamIds: string[];
  blockSelfApproval: boolean;
  expiryHours: number;
  conditions: { field: string; op: string; value: unknown }[] | null;
  isActive: boolean;
};

export const approvalsApi = {
  list: (f: { box?: 'pending_for_me' | 'mine' | 'all'; status?: string; actionKey?: string; cursor?: string }) =>
    apiRequest<Page<Approval>>(`/super-admin/approvals${qs(f)}`),
  count: () => apiRequest<{ count: number }>('/super-admin/approvals/count'),
  get: (id: string) => apiRequest<ApprovalDetail>(`/super-admin/approvals/${id}`),
  decide: (id: string, decision: 'approved' | 'rejected', comment?: string) =>
    apiRequest<ApprovalDetail>(`/super-admin/approvals/${id}/decision`, json('POST', { decision, comment })),
  cancel: (id: string) => apiRequest(`/super-admin/approvals/${id}/cancel`, json('POST')),
  policies: () => apiRequest<ApprovalPolicy[]>('/super-admin/approval-policies'),
  updatePolicy: (id: string, b: Partial<Omit<ApprovalPolicy, 'id' | 'actionKey'>>) =>
    apiRequest<ApprovalPolicy>(`/super-admin/approval-policies/${id}`, json('PATCH', b)),
};

// ─── Support ──────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Ticket = {
  id: string;
  ref: string;
  seq: number;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  organizationId: string | null;
  organization: { id: string; name: string; slug: string } | null;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  assigneeTeamId: string | null;
  assigneeUserId: string | null;
  assignee: PersonRef | null;
  createdById: string;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaBreached: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number; accessGrants: number };
};

export type AccessGrant = {
  id: string;
  ticketId: string;
  userId: string;
  organizationId: string;
  accessLevel: 'read_only' | 'full';
  status: 'pending' | 'active' | 'rejected' | 'revoked' | 'expired';
  justification: string;
  durationMinutes: number;
  approvalRequestId: string | null;
  approvedAt: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  employee?: PersonRef | null;
  organization?: { id: string; name: string; slug: string } | null;
  ticketRef?: string;
  revokedBy?: PersonRef | null;
};

export type TicketDetail = Ticket & {
  assigneeTeam: { id: string; name: string } | null;
  createdBy: PersonRef | null;
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    attachments: { name: string; url: string }[] | null;
    createdAt: string;
    author: PersonRef | null;
  }[];
  accessGrants: AccessGrant[];
  activityCount: number;
};

export const supportApi = {
  tickets: (f: {
    status?: string;
    priority?: string;
    assignee?: string;
    teamId?: string;
    organizationId?: string;
    q?: string;
    breached?: boolean;
    cursor?: string;
  }) => apiRequest<Page<Ticket>>(`/super-admin/support/tickets${qs(f)}`),
  createTicket: (b: {
    subject: string;
    description: string;
    organizationId?: string | null;
    category?: string;
    priority?: TicketPriority;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
    assigneeTeamId?: string | null;
    assigneeUserId?: string | null;
    tags?: string[];
  }) => apiRequest<Ticket>('/super-admin/support/tickets', json('POST', b)),
  ticket: (id: string) => apiRequest<TicketDetail>(`/super-admin/support/tickets/${id}`),
  updateTicket: (
    id: string,
    b: Partial<{ status: TicketStatus; priority: TicketPriority; category: string; tags: string[]; assigneeUserId: string | null; assigneeTeamId: string | null }>,
  ) => apiRequest<TicketDetail>(`/super-admin/support/tickets/${id}`, json('PATCH', b)),
  comment: (id: string, b: { body: string; isInternal?: boolean }) =>
    apiRequest<TicketDetail>(`/super-admin/support/tickets/${id}/comments`, json('POST', b)),
  requestGrant: (ticketId: string, b: { accessLevel: 'read_only' | 'full'; durationMinutes: number; justification: string }) =>
    apiRequest<AccessGrant>(`/super-admin/support/tickets/${ticketId}/access-grants`, json('POST', b)),
  grants: (f: { status?: string; mine?: boolean; organizationId?: string } = {}) =>
    apiRequest<AccessGrant[]>(`/super-admin/support/access-grants${qs(f)}`),
  revokeGrant: (id: string) => apiRequest(`/super-admin/support/access-grants/${id}/revoke`, json('POST')),
};

// ─── People ───────────────────────────────────────────────────────────────

export type Employee = {
  id: string;
  userId: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  accountStatus: string;
  primaryRole: string | null;
  lastLoginAt: string | null;
  title: string | null;
  team: { id: string; name: string; code: string } | null;
  department: { id: string; name: string; code: string } | null;
  manager: { userId: string; employeeCode: string; name: string } | null;
  region: string | null;
  location: string | null;
  employmentStatus: 'active' | 'on_leave' | 'notice' | 'exited';
  joinedAt: string | null;
  exitedAt: string | null;
};

export type StaffSession = {
  id: string;
  familyId: string;
  portal: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

export type EmployeeProfile = Employee & {
  reports: { userId: string; name: string; employeeCode: string }[];
  assignments: (Omit<Assignment, 'user'> & { role: { id: string; key: string; name: string } })[];
  sessions: StaffSession[] | null;
  recentActivity: { id: string; action: string; statusCode: number | null; targetOrgId: string | null; createdAt: string; ip: string | null }[] | null;
  openTickets: number;
  activeGrants: number;
  upcomingShifts: Shift[];
};

export type OrgNode = {
  userId: string;
  employeeCode: string;
  name: string;
  title: string | null;
  primaryRole: string | null;
  team: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  managerUserId: string | null;
};

export type Shift = {
  id: string;
  userId: string;
  teamId: string | null;
  kind: 'shift' | 'on_call' | 'leave';
  startsAt: string;
  endsAt: string;
  note: string | null;
  user?: { name: string; employeeCode: string | null } | null;
};

export type Rotation = {
  id: string;
  teamId: string;
  name: string;
  memberUserIds: string[];
  rotationDays: number;
  startsAt: string;
  isActive: boolean;
  team: { id: string; name: string } | null;
  members: PersonRef[];
  onCall: PersonRef | null;
  schedule: { userId: string; from: string; to: string; user: { name: string } | null }[];
};

export type BulkInviteRow = {
  email: string;
  name: string;
  platformRole?: string;
  title?: string;
  departmentCode?: string;
  teamCode?: string;
  managerEmail?: string;
  region?: string;
  location?: string;
};

export const peopleApi = {
  directory: (f: {
    q?: string;
    departmentId?: string;
    teamId?: string;
    status?: string;
    managerUserId?: string;
    role?: string;
    cursor?: string;
    limit?: number;
  }) => apiRequest<Page<Employee>>(`/super-admin/people/directory${qs(f)}`),
  orgChart: () => apiRequest<OrgNode[]>('/super-admin/people/org-chart'),
  profile: (userId: string) => apiRequest<EmployeeProfile>(`/super-admin/people/directory/${userId}`),
  update: (
    userId: string,
    b: Partial<{
      title: string | null;
      departmentId: string | null;
      teamId: string | null;
      managerUserId: string | null;
      region: string | null;
      location: string | null;
      employmentStatus: 'active' | 'on_leave' | 'notice';
      joinedAt: string | null;
    }>,
  ) => apiRequest<EmployeeProfile & { reviewCampaignId?: string | null }>(`/super-admin/people/directory/${userId}`, json('PATCH', b)),
  offboard: (userId: string, b: { reason?: string; transferToUserId?: string | null }) =>
    apiRequest<{
      employeeCode: string;
      revokedAssignments: number;
      revokedGrants: number;
      transferredTickets: number;
      cancelledApprovals: number;
      rotationsUpdated: number;
    }>(`/super-admin/people/directory/${userId}/offboard`, json('POST', b)),
  bulkInvite: (rows: BulkInviteRow[]) =>
    apiRequest<{
      created: number;
      failed: number;
      results: { row: number; email: string; ok: boolean; error?: string; employeeCode?: string | null; temporaryPassword?: string; emailSent?: boolean }[];
    }>('/super-admin/people/bulk-invite', json('POST', { rows })),
  shifts: (f: { from?: string; to?: string; teamId?: string; userId?: string } = {}) =>
    apiRequest<Shift[]>(`/super-admin/people/shifts${qs(f)}`),
  createShift: (b: { userId: string; teamId?: string | null; kind: string; startsAt: string; endsAt: string; note?: string }) =>
    apiRequest<Shift>('/super-admin/people/shifts', json('POST', b)),
  deleteShift: (id: string) => apiRequest(`/super-admin/people/shifts/${id}`, json('DELETE')),
  rotations: () => apiRequest<Rotation[]>('/super-admin/people/rotations'),
  createRotation: (b: { teamId: string; name: string; memberUserIds: string[]; rotationDays: number; startsAt: string }) =>
    apiRequest('/super-admin/people/rotations', json('POST', b)),
  updateRotation: (id: string, b: Partial<{ name: string; memberUserIds: string[]; rotationDays: number; startsAt: string; isActive: boolean }>) =>
    apiRequest(`/super-admin/people/rotations/${id}`, json('PATCH', b)),
  deleteRotation: (id: string) => apiRequest(`/super-admin/people/rotations/${id}`, json('DELETE')),
};

// ─── Security ─────────────────────────────────────────────────────────────

export type ReviewProgress = { total: number; pending: number; certified: number; revoked: number; percentDone: number };

export type ReviewCampaign = {
  id: string;
  name: string;
  status: 'open' | 'closed';
  dueAt: string;
  createdById: string;
  closedAt: string | null;
  createdAt: string;
  progress: ReviewProgress;
};

export type ReviewItem = {
  id: string;
  assignmentId: string;
  userId: string;
  roleKey: string;
  reviewerId: string | null;
  decision: 'pending' | 'certified' | 'revoked';
  comment: string | null;
  decidedAt: string | null;
  isPrimary: boolean;
  assignment: { scopeType: string; scopeValues: string[]; expiresAt: string | null; reason: string | null; createdAt: string } | null;
  user: PersonRef | null;
  reviewer: PersonRef | null;
  decidedBy: PersonRef | null;
};

export type StaffSessionRow = StaffSession & {
  user: { id: string; name: string; email: string; employeeCode: string | null };
};

export const securityApi = {
  campaigns: () => apiRequest<ReviewCampaign[]>('/super-admin/security/reviews'),
  createCampaign: (b: { name: string; dueAt: string; departmentId?: string; teamId?: string; includePrimaryRoles?: boolean }) =>
    apiRequest<ReviewCampaign>('/super-admin/security/reviews', json('POST', b)),
  myReviews: () =>
    apiRequest<{ campaign: { id: string; name: string; dueAt: string }; pending: number }[]>('/super-admin/security/reviews/mine'),
  campaign: (id: string) =>
    apiRequest<ReviewCampaign & { items: ReviewItem[]; canManage: boolean }>(`/super-admin/security/reviews/${id}`),
  decide: (itemId: string, decision: 'certified' | 'revoked', comment?: string) =>
    apiRequest(`/super-admin/security/reviews/items/${itemId}/decision`, json('POST', { decision, comment })),
  closeCampaign: (id: string) =>
    apiRequest<{ closed: boolean; autoRevoked: number }>(`/super-admin/security/reviews/${id}/close`, json('POST')),
  sessions: (userId?: string) => apiRequest<StaffSessionRow[]>(`/super-admin/security/sessions${qs({ userId })}`),
  mySessions: () => apiRequest<StaffSessionRow[]>('/super-admin/security/sessions/mine'),
  revokeSession: (id: string) => apiRequest(`/super-admin/security/sessions/${id}/revoke`, json('POST')),
  revokeAllForUser: (userId: string) => apiRequest(`/super-admin/security/users/${userId}/revoke-sessions`, json('POST')),
  elevationRoles: () =>
    apiRequest<{ id: string; key: string; name: string; description: string | null; permissions: string[] }[]>(
      '/super-admin/security/elevation/roles',
    ),
  requestElevation: (b: { roleId: string; durationMinutes: number; justification: string; ticketId?: string }) =>
    apiRequest<{ status: 'active' | 'pending_approval'; approvalRequest?: { id: string; ref: string } }>(
      '/super-admin/security/elevation',
      json('POST', b),
    ),
};

// ─── Reports ──────────────────────────────────────────────────────────────

export type OpsOverview = {
  generatedAt: string;
  tickets: {
    openByPriority: Partial<Record<TicketPriority, number>>;
    slaBreached: number;
    resolvedLast30d: number;
    avgResolutionHours: number | null;
    avgFirstResponseHours: number | null;
    byTeam: { teamId: string | null; team: string; open: number }[];
    byAssignee: { userId: string | null; name: string; open: number }[];
  };
  approvals: { pending: number; decidedLast30d: number; rejectedLast30d: number; avgTurnaroundHours: number | null };
  tenants: { byStatus: Record<string, number>; newLast30d: number };
  staff: { byDepartment: { departmentId: string | null; department: string; count: number }[]; actionsLast24h: number };
  tenantAccess: { active: number; last30dByStatus: Record<string, number> };
};

export type SavedView = {
  id: string;
  userId: string;
  page: string;
  name: string;
  filters: Record<string, string>;
  isShared: boolean;
};

export type Job = {
  id: string;
  kind: 'export' | 'bulk_action';
  action: string;
  status: 'pending_approval' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  failed: number;
  errors: { message?: string; organizationId?: string }[] | null;
  approvalRequestId: string | null;
  createdById: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ExportKind = 'tenants' | 'tenant_users' | 'tickets' | 'activity';

export const reportsApi = {
  overview: () => apiRequest<OpsOverview>('/super-admin/reports/overview'),
  views: (page: string) => apiRequest<SavedView[]>(`/super-admin/reports/views${qs({ page })}`),
  createView: (b: { page: string; name: string; filters: Record<string, string>; isShared?: boolean }) =>
    apiRequest<SavedView>('/super-admin/reports/views', json('POST', b)),
  deleteView: (id: string) => apiRequest(`/super-admin/reports/views/${id}`, json('DELETE')),
  createExport: (b: { exportKind: ExportKind; filters?: Record<string, string>; justification?: string }) =>
    apiRequest<Job>('/super-admin/reports/exports', json('POST', b)),
  createBulk: (b: { action: 'suspend' | 'reactivate'; organizationIds: string[]; reason: string; justification?: string }) =>
    apiRequest<Job>('/super-admin/reports/bulk', json('POST', b)),
  jobs: () => apiRequest<Job[]>('/super-admin/reports/jobs'),
  download: (id: string) => apiRequest<{ filename: string; csv: string }>(`/super-admin/reports/jobs/${id}/download`),
  cancel: (id: string) => apiRequest(`/super-admin/reports/jobs/${id}/cancel`, json('POST')),
};

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatDateTime(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString() : '—';
}

export function personLabel(p: { name?: string; employeeCode?: string | null } | null | undefined) {
  if (!p) return '—';
  return p.employeeCode ? `${p.name ?? ''} (${p.employeeCode})` : (p.name ?? '—');
}
