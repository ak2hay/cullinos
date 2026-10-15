import { apiRequest, json, qs } from './api';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type PersonRef = { id: string; name?: string; email?: string; employeeCode?: string | null };
export type Page<T> = { data: T[]; nextCursor: string | null };
export type Attachment = { name: string; url: string };

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'New',
  in_progress: 'In progress',
  waiting_customer: 'Awaiting customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: '4 - Low',
  normal: '3 - Moderate',
  high: '2 - High',
  urgent: '1 - Critical',
};

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'General question',
  billing: 'Billing & subscription',
  pos: 'POS',
  kds: 'Kitchen display (KDS)',
  menu: 'Menu',
  orders: 'Orders',
  payments: 'Payments',
  inventory: 'Inventory',
  integrations: 'Integrations',
  account: 'Account & login',
  bug: 'Something is broken',
  feature_request: 'Feature request',
};

// ─── Agent (platform staff) ─────────────────────────────────────────────────

export type AgentTicket = {
  id: string;
  ref: string;
  seq: number;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  channel: string;
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
  satisfaction: number | null;
  satisfactionComment: string | null;
  closedReason: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number; accessGrants: number };
};

export type AgentTicketDetail = AgentTicket & {
  assigneeTeam: { id: string; name: string } | null;
  createdBy: PersonRef | null;
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    fromCustomer: boolean;
    attachments: Attachment[] | null;
    createdAt: string;
    author: PersonRef | null;
  }[];
  accessGrants: AccessGrant[];
  activityCount: number;
};

export type AccessGrantStatus = 'pending' | 'active' | 'rejected' | 'revoked' | 'expired';

export type AccessGrant = {
  id: string;
  ticketId: string;
  userId: string;
  organizationId: string;
  accessLevel: 'read_only' | 'full';
  status: AccessGrantStatus;
  justification: string;
  durationMinutes: number;
  approvalRequestId: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  employee?: PersonRef | null;
  ticketRef?: string;
  organization?: { id: string; name: string; slug: string } | null;
  revokedBy?: PersonRef | null;
};

/** Max tenant access window, in minutes (4 hours). */
export const GRANT_DURATIONS = [15, 30, 60, 120, 240] as const;

export type SupportPassword = {
  id: string;
  grantId: string;
  targetUser: { id: string; email: string; name: string } | null;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
  createdAt: string;
  active: boolean;
};

export type TenantUser = {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: { slug: string; name: string }[];
};

export type ImpersonationResponse = {
  adminUrl: string;
  expiresAt: string;
  accessLevel: 'read_only' | 'full';
  user: { id: string; email: string; name: string };
};

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

export type Team = { id: string; name: string };
export type StaffMember = { userId: string; name: string; email: string; employeeCode: string };
export type Article = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  body: string;
  category: string;
  published: boolean;
  viewCount: number;
  updatedAt: string;
};
export type ArticleInput = { title: string; slug?: string; summary?: string | null; body: string; category?: string; published?: boolean };

export type AgentTicketFilter = {
  status?: string;
  priority?: string;
  assignee?: string;
  teamId?: string;
  q?: string;
  breached?: boolean;
  cursor?: string;
  limit?: number;
};

export const agentApi = {
  tickets: (f: AgentTicketFilter) => apiRequest<Page<AgentTicket>>(`/super-admin/support/tickets${qs(f)}`),
  ticket: (id: string) => apiRequest<AgentTicketDetail>(`/super-admin/support/tickets/${id}`),
  create: (b: {
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
  }) => apiRequest<AgentTicket>('/super-admin/support/tickets', json('POST', b)),
  update: (
    id: string,
    b: Partial<{ status: TicketStatus; priority: TicketPriority; category: string; tags: string[]; assigneeUserId: string | null; assigneeTeamId: string | null }>,
  ) => apiRequest<AgentTicketDetail>(`/super-admin/support/tickets/${id}`, json('PATCH', b)),
  comment: (id: string, b: { body: string; isInternal: boolean; attachments?: Attachment[] }) =>
    apiRequest<AgentTicketDetail>(`/super-admin/support/tickets/${id}/comments`, json('POST', b)),
  teams: () => apiRequest<Team[]>('/super-admin/iam/teams'),
  staff: (q: string) =>
    apiRequest<Page<StaffMember>>(`/super-admin/people/directory${qs({ q, limit: 10, status: 'active' })}`),
  tenants: (q: string) =>
    apiRequest<{ data: { id: string; name: string; slug: string }[] }>(
      `/super-admin/organizations${qs({ page: 1, limit: 10, q })}`,
    ),
  articles: () => apiRequest<Article[]>('/super-admin/support/articles'),
  createArticle: (b: ArticleInput) => apiRequest<Article>('/super-admin/support/articles', json('POST', b)),
  updateArticle: (id: string, b: ArticleInput) => apiRequest<Article>(`/super-admin/support/articles/${id}`, json('PATCH', b)),
  deleteArticle: (id: string) => apiRequest<{ deleted: boolean }>(`/super-admin/support/articles/${id}`, { method: 'DELETE' }),

  requestGrant: (ticketId: string, b: { accessLevel: 'read_only' | 'full'; durationMinutes: number; justification: string }) =>
    apiRequest<AccessGrant>(`/super-admin/support/tickets/${ticketId}/access-grants`, json('POST', b)),
  grants: (f: { status?: string; mine?: boolean; organizationId?: string } = {}) =>
    apiRequest<AccessGrant[]>(`/super-admin/support/access-grants${qs(f)}`),
  revokeGrant: (id: string) => apiRequest<AccessGrant>(`/super-admin/support/access-grants/${id}/revoke`, json('POST')),
  impersonate: (organizationId: string, grantId: string) =>
    apiRequest<ImpersonationResponse>(`/super-admin/organizations/${organizationId}/impersonate`, json('POST', { grantId })),
  tenantUsers: (organizationId: string) => apiRequest<TenantUser[]>(`/super-admin/organizations/${organizationId}/users`),

  supportPassword: (grantId: string) =>
    apiRequest<SupportPassword | null>(`/super-admin/support/access-grants/${grantId}/password`),
  createSupportPassword: (grantId: string, targetUserId?: string) =>
    apiRequest<SupportPassword & { password: string }>(
      `/super-admin/support/access-grants/${grantId}/password`,
      json('POST', targetUserId ? { targetUserId } : {}),
    ),
  revokeSupportPassword: (grantId: string) =>
    apiRequest<SupportPassword>(`/super-admin/support/access-grants/${grantId}/password/revoke`, json('POST')),

  startStepUp: () => apiRequest<{ challengeToken: string }>('/super-admin/iam/step-up', json('POST')),
  verifyStepUp: (challengeToken: string, otp: string) =>
    apiRequest<{ stepUpToken: string; expiresInSeconds: number }>('/super-admin/iam/step-up/verify', json('POST', { challengeToken, otp })),

  overview: () => apiRequest<OpsOverview>('/super-admin/reports/overview'),

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
};

// ─── Customer (restaurant self-service) ─────────────────────────────────────

export type CustomerTicket = {
  id: string;
  ref: string;
  seq: number;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  satisfaction: number | null;
  replyCount: number;
  isMine: boolean;
};

export type CustomerTicketDetail = {
  id: string;
  ref: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  channel: string;
  requesterName: string | null;
  requesterEmail: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  satisfaction: number | null;
  satisfactionComment: string | null;
  isMine: boolean;
  comments: {
    id: string;
    body: string;
    attachments: Attachment[] | null;
    createdAt: string;
    fromCustomer: boolean;
    authorName: string;
  }[];
};

export type ArticleSummary = Pick<Article, 'id' | 'slug' | 'title' | 'summary' | 'category' | 'updatedAt'>;

export const customerApi = {
  tickets: (f: { status?: 'open' | 'closed'; q?: string; mine?: boolean } = {}) =>
    apiRequest<CustomerTicket[]>(`/support/tickets${qs(f)}`),
  ticket: (id: string) => apiRequest<CustomerTicketDetail>(`/support/tickets/${id}`),
  create: (b: { subject: string; description: string; category?: string; priority?: 'low' | 'normal' | 'high'; requesterPhone?: string }) =>
    apiRequest<CustomerTicketDetail>('/support/tickets', json('POST', b)),
  comment: (id: string, b: { body: string; attachments?: Attachment[] }) =>
    apiRequest<CustomerTicketDetail>(`/support/tickets/${id}/comments`, json('POST', b)),
  setStatus: (id: string, action: 'close' | 'reopen', reason?: string) =>
    apiRequest<CustomerTicketDetail>(`/support/tickets/${id}/status`, json('POST', { action, reason })),
  rate: (id: string, rating: number, comment?: string) =>
    apiRequest<CustomerTicketDetail>(`/support/tickets/${id}/rating`, json('POST', { rating, comment })),
  articles: (f: { q?: string; category?: string } = {}) => apiRequest<ArticleSummary[]>(`/support/articles${qs(f)}`),
  article: (slug: string) => apiRequest<Article>(`/support/articles/${slug}`),
};
