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
