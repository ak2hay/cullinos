import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { cashDrawerAdapter } from './hardware/CashDrawerAdapter';
import { printerAdapter } from './hardware/PrinterAdapter';
import { closeDb, getPendingEvents, getQueueStats } from './server/db';
import { startGatewayServer, stopGatewayServer } from './server/index';
import { getSyncStatus, pushToCloud, stopSyncService } from './sync/syncService';

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? 4000);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    title: 'Cullinos Local Gateway',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const statusHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Cullinos Local Gateway</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0f0f1a; color: #f9fafb; padding: 2rem; }
          h1 { color: #d4a017; }
          a { color: #d4a017; }
          code { background: #1a1a2e; padding: 2px 6px; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Cullinos Local Gateway</h1>
        <p>Local API: <code>http://localhost:${GATEWAY_PORT}</code></p>
        <ul>
          <li><a href="http://localhost:${GATEWAY_PORT}/health">Health</a></li>
          <li><a href="http://localhost:${GATEWAY_PORT}/api/sync/status">Sync status</a></li>
          <li><a href="http://localhost:${GATEWAY_PORT}/pos">POS (proxy)</a></li>
          <li><a href="http://localhost:${GATEWAY_PORT}/kds">KDS (proxy)</a></li>
        </ul>
        <p style="color:#9ca3af;font-size:14px;">Gateway runs in the background and syncs to cloud when online.</p>
      </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(statusHtml)}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('gateway:status', () => ({
    ...getSyncStatus(),
    port: GATEWAY_PORT,
  }));

  ipcMain.handle('gateway:sync-queue', () => ({
    stats: getQueueStats(),
    pending: getPendingEvents(20),
  }));

  ipcMain.handle('gateway:trigger-sync', () => pushToCloud());

  ipcMain.handle('gateway:print', (_event, payload) => printerAdapter.print(payload));

  ipcMain.handle('gateway:open-drawer', () => cashDrawerAdapter.open());
}

app.whenReady().then(() => {
  startGatewayServer();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopSyncService();
  stopGatewayServer();
  closeDb();
});
