export type SyncEventPayload = {
  type: string;
  idempotencyKey: string;
  organizationId: string;
  deviceId?: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export type SyncResult = {
  idempotencyKey: string;
  status: "synced" | "failed" | "conflict";
  serverId?: string;
  error?: string;
};

export class SyncQueue {
  private queue: SyncEventPayload[] = [];

  enqueue(event: SyncEventPayload): void {
    const exists = this.queue.some((e) => e.idempotencyKey === event.idempotencyKey);
    if (!exists) this.queue.push(event);
  }

  dequeue(): SyncEventPayload | undefined {
    return this.queue.shift();
  }

  peek(): SyncEventPayload[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
  }

  size(): number {
    return this.queue.length;
  }
}

export function createIdempotencyKey(prefix = "sync"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
