import express from 'express';
import type { Server } from 'http';
import { cashDrawerAdapter } from '../hardware/CashDrawerAdapter';
import { printerAdapter } from '../hardware/PrinterAdapter';
import { mountStaticOrProxy } from '../proxy/staticServer';
import { initDb } from './db';
import {
  getSyncStatus,
  pushToCloud,
  queueLocalEvent,
  startSyncService,
} from '../sync/syncService';

const PORT = Number(process.env.GATEWAY_PORT ?? 4000);

let server: Server | null = null;

export function createGatewayApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  initDb();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'cullinos-gateway', port: PORT });
  });

  app.get('/api/sync/status', (_req, res) => {
    res.json(getSyncStatus());
  });

  app.post('/api/sync/trigger', async (_req, res) => {
    const result = await pushToCloud();
    res.json({ ...result, status: getSyncStatus() });
  });

  app.post('/api/sync/queue', (req, res) => {
    const { eventType, payload } = req.body as {
      eventType?: string;
      payload?: Record<string, unknown>;
    };

    if (!eventType || !payload) {
      res.status(400).json({ error: 'eventType and payload are required' });
      return;
    }

    const id = queueLocalEvent(eventType, payload);
    res.status(201).json({ id, queued: true });
  });

  app.post('/api/hardware/print', async (req, res) => {
    const result = await printerAdapter.print(req.body);
    res.json(result);
  });

  app.post('/api/hardware/cash-drawer/open', async (_req, res) => {
    const result = await cashDrawerAdapter.open();
    res.json(result);
  });

  mountStaticOrProxy(app);

  return app;
}

export function startGatewayServer(): Server {
  if (server) return server;

  const app = createGatewayApp();
  startSyncService();

  server = app.listen(PORT, () => {
    console.log(`[Gateway] Local API listening on http://localhost:${PORT}`);
    console.log(`[Gateway] POS: http://localhost:${PORT}/pos`);
    console.log(`[Gateway] KDS: http://localhost:${PORT}/kds`);
  });

  return server;
}

export function stopGatewayServer(): void {
  if (server) {
    server.close();
    server = null;
  }
}
