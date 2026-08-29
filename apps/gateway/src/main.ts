import { app, BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";
import { SyncQueue, createIdempotencyKey, type SyncEventPayload } from "@cullinos/sync";

const QUEUE_DIR = path.join(app.getPath("userData"), "gateway-queue");
const QUEUE_FILE = path.join(QUEUE_DIR, "pending.json");
const API_URL = process.env.CULLINOS_API_URL || "http://localhost:3000/api";

const queue = new SyncQueue();

function ensureQueueDir() {
  if (!fs.existsSync(QUEUE_DIR)) fs.mkdirSync(QUEUE_DIR, { recursive: true });
}

function loadQueue() {
  ensureQueueDir();
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf-8")) as SyncEventPayload[];
      data.forEach((e) => queue.enqueue(e));
    } catch {
      // ignore corrupt queue
    }
  }
}

function persistQueue() {
  ensureQueueDir();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue.peek(), null, 2));
}

async function syncToCloud() {
  const events = queue.peek();
  for (const event of events) {
    try {
      const res = await fetch(`${API_URL}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": event.idempotencyKey,
        },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        queue.dequeue();
        persistQueue();
      }
    } catch {
      break; // offline — stop until reconnect
    }
  }
}

export function enqueueOfflineOrder(data: Record<string, unknown>) {
  const event: SyncEventPayload = {
    type: "order.create",
    idempotencyKey: createIdempotencyKey("order"),
    organizationId: String(data.organizationId || ""),
    deviceId: String(data.deviceId || "gateway"),
    data,
    createdAt: new Date().toISOString(),
  };
  queue.enqueue(event);
  persistQueue();
  syncToCloud();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    title: "Cullinos Local Gateway",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  win.loadURL(`data:text/html,<html><body style="background:#0F0F1A;color:#D4A017;font-family:Inter;padding:2rem"><h1>Cullinos Gateway</h1><p>Offline sync active. Queue: ${queue.size()} events.</p><p style="color:#888">Powered by Rkyves</p></body></html>`);
}

app.whenReady().then(() => {
  loadQueue();
  createWindow();
  setInterval(syncToCloud, 30000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
