const { app, BrowserWindow, session } = require('electron');
const path = require('path');

const NATIVE_CLIENT = 'kds-desktop';

/** Stamp X-Cullinos-Client on API calls. file:// cannot satisfy Turnstile's hostname check. */
function attachNativeClientHeader() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      try {
        const host = new URL(details.url).hostname;
        if (host === 'api.cullinos.com' || host === 'localhost' || host === '127.0.0.1') {
          requestHeaders['X-Cullinos-Client'] = NATIVE_CLIENT;
        }
      } catch {
        // Leave non-HTTP URLs unchanged.
      }
      callback({ requestHeaders });
    },
  );
}

function resolveIndexHtml() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'index.html');
  }
  return path.join(__dirname, '../../kds/dist/index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Cullinos KDS',
  });

  const indexPath = resolveIndexHtml();
  void win.loadFile(indexPath);
}

app.whenReady().then(() => {
  attachNativeClientHeader();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
