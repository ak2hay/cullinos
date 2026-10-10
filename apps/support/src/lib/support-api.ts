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
  accessGrants: {
    id: string;
    status: string;
    accessLevel: 'read_only' | 'full';
    justification: string;
    expiresAt: string | null;
    employee?: PersonRef | null;
  }[];
  activityCount: number;
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
