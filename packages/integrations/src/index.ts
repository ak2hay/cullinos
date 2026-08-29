export type IntegrationProvider = "razorpay" | "swiggy" | "zomato" | "whatsapp" | "custom";

export type IntegrationConfig = {
  provider: IntegrationProvider;
  apiKey?: string;
  apiSecret?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
};

export interface DeliveryAdapter {
  provider: IntegrationProvider;
  createOrder(order: Record<string, unknown>): Promise<{ externalId: string }>;
  updateStatus(externalId: string, status: string): Promise<void>;
}

export class IntegrationRegistry {
  private adapters: Map<string, DeliveryAdapter> = new Map();

  register(key: string, adapter: DeliveryAdapter): void {
    this.adapters.set(key, adapter);
  }

  get(key: string): DeliveryAdapter | undefined {
    return this.adapters.get(key);
  }
}
