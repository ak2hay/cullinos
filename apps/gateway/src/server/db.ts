import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface SyncQueueRow {
  id: string;
  device_id: string;
  event_type: string;
  payload: string;
  timestamp: string;
  checksum: string;
  status: 'pending' | 'synced' | 'failed';
  attempts: number;
  last_error: string | null;
  created_at: string;
}

interface QueueStore {
  events: SyncQueueRow[];
}

let storePath: string | null = null;

function getStorePath(): string {
  if (!storePath) {
    storePath = path.join(app.getPath('userData'), 'cullinos-sync-queue.json');
  }
  return storePath;
}

function readStore(): QueueStore {
  const filePath = getStorePath();
  if (!fs.existsSync(filePath)) {
    return { events: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as QueueStore;
  } catch {
    return { events: [] };
  }
}

function writeStore(store: QueueStore): void {
  const filePath = getStorePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

export function getDbPath(): string {
  return getStorePath();
}

export function initDb(): void {
  readStore();
}

export function enqueueEvent(event: {
  id: string;
  deviceId: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: string;
  checksum: string;
}): void {
  const store = readStore();
  if (store.events.some((e) => e.id === event.id)) return;

  store.events.push({
    id: event.id,
    device_id: event.deviceId,
    event_type: event.eventType,
    payload: JSON.stringify(event.payload),
    timestamp: event.timestamp,
    checksum: event.checksum,
    status: 'pending',
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
  });
  writeStore(store);
}

export function getPendingEvents(limit = 50): SyncQueueRow[] {
  const store = readStore();
  return store.events
    .filter((e) => e.status === 'pending')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, limit);
}

export function markEventSynced(id: string): void {
  const store = readStore();
  const event = store.events.find((e) => e.id === id);
  if (event) {
    event.status = 'synced';
    writeStore(store);
  }
}

export function markEventFailed(id: string, error: string): void {
  const store = readStore();
  const event = store.events.find((e) => e.id === id);
  if (event) {
    event.status = 'failed';
    event.attempts += 1;
    event.last_error = error;
    writeStore(store);
  }
}

export function getQueueStats(): { pending: number; synced: number; failed: number } {
  const store = readStore();
  const stats = { pending: 0, synced: 0, failed: 0 };
  for (const event of store.events) {
    if (event.status === 'pending') stats.pending += 1;
    if (event.status === 'synced') stats.synced += 1;
    if (event.status === 'failed') stats.failed += 1;
  }
  return stats;
}

export function closeDb(): void {
  storePath = null;
}
