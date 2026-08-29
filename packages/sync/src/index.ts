import { createHash } from 'crypto';

export type SyncEventStatus = 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface SyncEventPayload {
  id: string;
  deviceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  checksum: string;
}

export interface SyncPushRequest {
  deviceId: string;
  events: SyncEventPayload[];
}

export interface SyncPushResponse {
  acknowledged: string[];
  conflicts: Array<{ eventId: string; reason: string }>;
  serverEvents: SyncEventPayload[];
}

export interface SyncPullResponse {
  events: SyncEventPayload[];
  menuVersion: string;
  lastSyncAt: string;
}

export function computeChecksum(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(str).digest('hex');
}

export function createSyncEvent(
  id: string,
  deviceId: string,
  eventType: string,
  payload: Record<string, unknown>,
): SyncEventPayload {
  return {
    id,
    deviceId,
    eventType,
    payload,
    timestamp: new Date().toISOString(),
    checksum: computeChecksum(payload),
  };
}

export function validateChecksum(event: SyncEventPayload): boolean {
  return event.checksum === computeChecksum(event.payload);
}

export const SYNC_CONFLICT_RULES = {
  ORDER: 'server_merge_by_sequence',
  PAYMENT: 'server_merge_by_sequence',
  INVENTORY: 'server_authoritative',
  MENU: 'cloud_authoritative',
} as const;
