import { Injectable, Logger } from "@nestjs/common";

export type OrderStatusChange = {
  organizationId: string;
  id: string;
  outletId: string;
  status: string;
  metadata: unknown;
};

export type OrderStatusListener = (change: OrderStatusChange) => Promise<void> | void;

/** Fire-and-forget hook so integrations can mirror order status without OrdersModule depending on them. */
@Injectable()
export class OrderStatusNotifier {
  private readonly logger = new Logger(OrderStatusNotifier.name);
  private readonly listeners: OrderStatusListener[] = [];

  register(listener: OrderStatusListener) {
    this.listeners.push(listener);
  }

  changed(change: OrderStatusChange) {
    for (const listener of this.listeners) {
      void Promise.resolve()
        .then(() => listener(change))
        .catch((err) =>
          this.logger.warn(
            `Order status listener failed for ${change.id}: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
  }
}
