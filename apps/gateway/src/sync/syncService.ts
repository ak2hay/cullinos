import { randomUUID, createHash } from 'crypto';
import {
  enqueueEvent,
  getPendingEvents,
  getQueueStats,
  markEventFailed,
  markEventSynced,
} from '../server/db';

const CLOUD_API_URL = process.env.CULLINOS_CLOUD_URL ?? 'http://localhost:3000/api/v1';
const DEVICE_ID = process.env.CULLINOS_DEVICE_ID ?? 'gateway-local-001';
const SYNC_INTERVAL_MS = 15_000;
const AUTH_TOKEN = process.env.CULLINOS_GATEWAY_TOKEN ?? '';

let syncTimer: NodeJS.Timeout | null = null;
let isOnline = false;
let lastSyncAt: string | null = null;
let lastError: string | null = null;

async function checkOnline(): Promise<boolean> {
  try {
    const response = await fetch(`${CLOUD_API_URL.replace('/api/v1', '')}/api/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    isOnline = response.ok;
    return isOnline;
  } catch {
    isOnline = false;
    return false;
  }
}

export async function pushToCloud(): Promise<{ synced: number; failed: number }> {
  const online = await checkOnline();
  if (!online) {
    lastError = 'Cloud API unreachable';
    return { synced: 0, failed: 0 };
  }

  if (!AUTH_TOKEN) {
    lastError = 'CULLINOS_GATEWAY_TOKEN not configured';
    return { synced: 0, failed: 0 };
  }

  const pending = getPendingEvents();
  if (pending.length === 0) {
    lastError = null;
    lastSyncAt = new Date().toISOString();
    return { synced: 0, failed: 0 };
  }

  const events = pending.map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    eventType: row.event_type,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    timestamp: row.timestamp,
    checksum: row.checksum,
  }));

  try {
    const response = await fetch(`${CLOUD_API_URL}/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        deviceId: DEVICE_ID,
        events,
        idempotencyKey: randomUUID(),
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sync push failed (${response.status}): ${text}`);
    }

    for (const event of events) {
      markEventSynced(event.id);
    }

    lastSyncAt = new Date().toISOString();
    lastError = null;
    return { synced: events.length, failed: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    lastError = message;
    for (const event of events) {
      markEventFailed(event.id, message);
    }
    return { synced: 0, failed: events.length };
  }
}

export function queueLocalEvent(
  eventType: string,
  payload: Record<string, unknown>,
): string {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const checksum = createHash('sha256')
    .update(JSON.stringify({ eventType, payload, timestamp }))
    .digest('hex');

  enqueueEvent({
    id,
    deviceId: DEVICE_ID,
    eventType,
    payload,
    timestamp,
    checksum,
  });

  return id;
}

export function startSyncService(): void {
  if (syncTimer) return;

  syncTimer = setInterval(() => {
    void pushToCloud();
  }, SYNC_INTERVAL_MS);

  void pushToCloud();
}

export function stopSyncService(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

export function getSyncStatus() {
  return {
    online: isOnline,
    deviceId: DEVICE_ID,
    cloudUrl: CLOUD_API_URL,
    lastSyncAt,
    lastError,
    queue: getQueueStats(),
  };
}
