const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const APP_ID = 'fr.alexis-tissier.createur-ao';
const PROD_PORT = 4178;
let mainWindow = null;
let backendProcess = null;

app.setName('Créateur d’AO');
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function appIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
}

async function resolveMappedDriveToUnc(selectedPath) {
  if (process.platform !== 'win32' || typeof selectedPath !== 'string') return selectedPath;
  const match = selectedPath.match(/^([A-Za-z]):\\/);
  if (!match) return selectedPath;

  const drive = `${match[1].toUpperCase()}:`;
  try {
    const { stdout } = await execFileAsync('net.exe', ['use', drive], {
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 256 * 1024
    });
    const line = String(stdout || '').split(/\r?\n/).find((entry) => entry.includes('\\\\'));
    if (!line) return selectedPath;

    const uncIndex = line.indexOf('\\\\');
    const remoteRoot = line.slice(uncIndex).trim();
    if (!remoteRoot.startsWith('\\\\')) return selectedPath;
    return `${remoteRoot.replace(/\\+$/, '')}${selectedPath.slice(2)}`;
  } catch {
    return selectedPath;
  }
}

async function waitForBackend(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (backendProcess?.exitCode !== null && backendProcess?.exitCode !== undefined) {
      throw new Error(`Le service interne s'est arrêté avec le code ${backendProcess.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error('Le service interne de Créateur d’AO ne répond pas.');
}

async function startPackagedBackend() {
  if (!app.isPackaged || process.env.AO_DEV_URL || backendProcess) return;

  const serverFile = path.join(app.getAppPath(), 'server.mjs');
  const dataDir = app.getPath('userData');
  fs.mkdirSync(dataDir, { recursive: true });

  backendProcess = spawn(process.execPath, [serverFile], {
    cwd: app.getAppPath(),
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      AO_CREATOR_PORT: String(PROD_PORT),
      AO_CREATOR_DATA_DIR: dataDir
    }
  });

  await waitForBackend(`http://127.0.0.1:${PROD_PORT}/api/health`);
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
  backendProcess = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Créateur d’AO',
    icon: appIconPath(),
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: '#f6f6f3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const targetUrl = process.env.AO_DEV_URL || `http://127.0.0.1:${PROD_PORT}`;
  mainWindow.loadURL(targetUrl);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('dialog:choose-folder', async (_event, initialPath = '') => {
  const safeInitialPath = typeof initialPath === 'string' && initialPath.trim() ? initialPath.trim() : undefined;
  const options = {
    title: 'Choisir le dossier de destination',
    buttonLabel: 'Sélectionner',
    properties: ['openDirectory']
  };
  if (safeInitialPath && fs.existsSync(safeInitialPath)) options.defaultPath = safeInitialPath;

  const result = await dialog.showOpenDialog(mainWindow, options);
  if (result.canceled || !result.filePaths?.length) return '';
  return resolveMappedDriveToUnc(result.filePaths[0]);
});

ipcMain.handle('dialog:choose-config-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir le modèle Créateur d’AO',
    buttonLabel: 'Ouvrir',
    properties: ['openFile'],
    filters: [
      { name: 'Configuration Créateur d’AO', extensions: ['json'] },
      { name: 'Tous les fichiers', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths?.length) return null;

  const filePath = result.filePaths[0];
  const content = await fsp.readFile(filePath, 'utf8');
  return { path: filePath, content };
});

ipcMain.handle('dialog:save-config-file', async (_event, content = '') => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer le modèle Créateur d’AO',
    buttonLabel: 'Enregistrer',
    defaultPath: 'createur-ao-initialisation.json',
    filters: [{ name: 'Configuration Créateur d’AO', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return '';

  await fsp.writeFile(result.filePath, String(content || ''), 'utf8');
  return result.filePath;
});

app.whenReady().then(async () => {
  try {
    await startPackagedBackend();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Créateur d’AO', String(error?.message || error));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', stopBackend);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
