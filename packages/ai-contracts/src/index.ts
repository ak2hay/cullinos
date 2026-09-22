export type InsightType =
  | 'SALES_FORECAST'
  | 'DEMAND_FORECAST'
  | 'MENU_PROFITABILITY'
  | 'WASTAGE_DETECTION'
  | 'ANOMALY'
  | 'RECOMMENDATION';

export interface InsightContract {
  id: string;
  organizationId: string;
  outletId?: string;
  type: InsightType;
  summary: string;
  dataSnapshot: Record<string, unknown>;
  generatedAt: string;
}

export interface AIAnalysisRequest {
  organizationId: string;
  outletId?: string;
  analysisType: InsightType;
  dateRange?: { start: string; end: string };
  context?: Record<string, unknown>;
}

export interface AIAnalysisResponse {
  insight: InsightContract;
  confidence?: number;
}

export interface AIService {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;
}

export interface AnalyticsDataProvider {
  getSalesData(organizationId: string, outletId?: string, days?: number): Promise<Record<string, unknown>>;
  getInventoryData(organizationId: string, outletId?: string): Promise<Record<string, unknown>>;
  getMenuProfitability(organizationId: string, outletId?: string): Promise<Record<string, unknown>>;
}

/** Rkyves Grok Bot employee roles (docs/rkyves-team/ROSTER.md). */
export type RkyvesBotRole =
  | 'CEO'
  | 'CTO'
  | 'DEV_FRONTEND'
  | 'DEV_BACKEND'
  | 'DEV_FLUTTER'
  | 'DEVOPS'
  | 'SECURITY'
  | 'QA'
  | 'UI_UX'
  | 'SEO'
  | 'MARKETING'
  | 'SALES'
  | 'CUSTOMER_SUCCESS'
  | 'FINANCE'
  | 'DOCUMENTATION';

/** Exact Grok Bot display names for @mentions and profiles. */
export const RKYVES_BOT_DISPLAY_NAME: Record<RkyvesBotRole, string> = {
  CEO: 'Rkyves CEO',
  CTO: 'Rkyves CTO',
  DEV_FRONTEND: 'Dev Frontend',
  DEV_BACKEND: 'Dev Backend',
  DEV_FLUTTER: 'Dev Flutter',
  DEVOPS: 'DevOps',
  SECURITY: 'Security',
  QA: 'QA',
  UI_UX: 'UI/UX',
  SEO: 'SEO',
  MARKETING: 'Marketing',
  SALES: 'Sales',
  CUSTOMER_SUCCESS: 'Customer Success',
  FINANCE: 'Finance',
  DOCUMENTATION: 'Documentation',
};

export type RkyvesTicketStatus =
  | 'backlog'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'ready_for_qa'
  | 'blocked'
  | 'done'
  | 'cancelled';

export type RkyvesTicketPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type RkyvesTicketType =
  | 'feature'
  | 'bug'
  | 'release'
  | 'campaign'
  | 'incident'
  | 'chore';

export type RkyvesE2EGroup =
  | 'Feature Ship'
  | 'Bug Fix'
  | 'Release'
  | 'Growth Campaign'
  | 'Incident'
  | 'none';

export type RkyvesHumanApprovalKind =
  | 'merge'
  | 'deploy'
  | 'customer_message'
  | 'other';

export interface RkyvesHandoffTimelineEntry {
  at: string;
  bot: RkyvesBotRole | 'human' | string;
  action: string;
  result?: string;
}

/** Structured handoff ticket aligned with docs/rkyves-team/HANDOFF.md. */
export interface RkyvesHandoffTicket {
  id: string;
  title: string;
  status: RkyvesTicketStatus;
  priority: RkyvesTicketPriority;
  type: RkyvesTicketType;
  ownerBot: RkyvesBotRole | string;
  requester: 'human' | RkyvesBotRole | string;
  group: RkyvesE2EGroup;
  branch?: string;
  prUrl?: string;
  outcome: string;
  context?: string;
  constraints: string[];
  acceptanceCriteria: string[];
  timeline: RkyvesHandoffTimelineEntry[];
  blockers?: string[];
  humanApprovalsNeeded: RkyvesHumanApprovalKind[];
  createdAt: string;
  updatedAt: string;
}

export interface RkyvesBoardRow {
  id: string;
  status: RkyvesTicketStatus;
  ownerBot: RkyvesBotRole | string;
  priority: RkyvesTicketPriority;
  title: string;
}
