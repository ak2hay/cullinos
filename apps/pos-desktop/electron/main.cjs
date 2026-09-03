const { app, BrowserWindow } = require('electron');
const path = require('path');

function resolveIndexHtml() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'index.html');
  }
  return path.join(__dirname, '../../pos/dist/index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Cullinos POS',
  });

  const indexPath = resolveIndexHtml();
  void win.loadFile(indexPath);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
