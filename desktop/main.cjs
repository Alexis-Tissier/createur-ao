const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const APP_ID = 'fr.alexis-tissier.createur-ao';
const PROD_PORT = 4178;
const DEFAULT_BROWSE_PATH = '\\sie15\Travaux\2 APPELS D OFFRES';
let mainWindow = null;
let backendProcess = null;

app.setName('Créateur d’AO');
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
  const localRoot = process.env.LOCALAPPDATA || app.getPath('appData');
  app.setPath('userData', path.join(localRoot, 'CreateurAO', 'data'));
}

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
  const runtimeDir = path.dirname(process.execPath);
  fs.mkdirSync(dataDir, { recursive: true });

  backendProcess = spawn(process.execPath, [serverFile], {
    // app.getAppPath() pointe vers resources/app.asar en production. Un chemin ASAR
    // n'est pas un vrai répertoire Windows et provoque spawn ENOENT s'il est utilisé
    // comme cwd. On lance donc le runtime depuis le dossier réel de l'exécutable.
    cwd: runtimeDir,
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      AO_CREATOR_PORT: String(PROD_PORT),
      AO_CREATOR_DATA_DIR: dataDir
    }
  });

  backendProcess.once('error', (error) => {
    console.error('Impossible de démarrer le service interne :', error);
  });

  await waitForBackend(`http://127.0.0.1:${PROD_PORT}/api/health`);
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
  backendProcess = null;
}

async function stopBackendAndWait() {
  const child = backendProcess;
  if (!child) return;
  if (child.exitCode !== null) { backendProcess = null; return; }
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(); } };
    child.once('exit', finish);
    child.kill();
    setTimeout(() => {
      if (settled) return;
      if (child.exitCode === null) { reject(new Error('Le service interne ne s’est pas arrêté correctement.')); return; }
      finish();
    }, 3500);
  });
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.loadURL(targetUrl);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('dialog:choose-folder', async (_event, initialPath = '') => {
  const requestedPath = typeof initialPath === 'string' && initialPath.trim() ? initialPath.trim() : '';
  const safeInitialPath = requestedPath || (fs.existsSync(DEFAULT_BROWSE_PATH) ? DEFAULT_BROWSE_PATH : undefined);
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


ipcMain.handle('backup:restore', async (_event, requestedPath = '') => {
  if (!app.isPackaged) throw new Error('La restauration complète est disponible dans l’application Windows installée.');
  const dataDir = app.getPath('userData');
  const backupRoot = path.resolve(path.join(dataDir, 'backups'));
  const source = path.resolve(String(requestedPath || ''));
  if (path.dirname(source) !== backupRoot || !path.basename(source).startsWith('backup-')) throw new Error('Sauvegarde invalide.');
  const sourceDb = path.join(source, 'createur-ao.db');
  const sourceMeta = path.join(source, 'meta.json');
  if (!fs.existsSync(sourceDb) || !fs.existsSync(sourceMeta)) throw new Error('Sauvegarde incomplète.');
  const fd = await fsp.open(sourceDb, 'r');
  try {
    const header = Buffer.alloc(16);
    await fd.read(header, 0, 16, 0);
    if (header.toString('utf8') !== 'SQLite format 3\u0000') throw new Error('Le fichier de sauvegarde SQLite est invalide.');
  } finally { await fd.close(); }
  const meta = JSON.parse(await fsp.readFile(sourceMeta, 'utf8'));
  const dbFile = path.join(dataDir, 'createur-ao.db');
  const safetyName = `backup-pre-restore-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  const safety = path.join(backupRoot, safetyName);
  let currentMaster = '';
  const sourceMaster = path.join(source, 'master');
  if (meta?.masterBasePath) currentMaster = String(meta.masterBasePath);
  await fsp.mkdir(safety, { recursive: true });
  await stopBackendAndWait();
  try {
    if (fs.existsSync(dbFile)) await fsp.copyFile(dbFile, path.join(safety, 'createur-ao.db'));
    if (currentMaster && fs.existsSync(currentMaster)) await fsp.cp(currentMaster, path.join(safety, 'master'), { recursive: true });
    await fsp.writeFile(path.join(safety, 'meta.json'), JSON.stringify({ createdAt:new Date().toISOString(), kind:'pre-restore', masterBasePath:currentMaster, hasMaster:!!currentMaster }, null, 2), 'utf8');

    await fsp.copyFile(sourceDb, dbFile);
    await fsp.rm(`${dbFile}-wal`, { force: true }).catch(() => {});
    await fsp.rm(`${dbFile}-shm`, { force: true }).catch(() => {});
    if (meta?.hasMaster && currentMaster && fs.existsSync(sourceMaster)) {
      await fsp.rm(currentMaster, { recursive: true, force: true });
      await fsp.mkdir(path.dirname(currentMaster), { recursive: true });
      await fsp.cp(sourceMaster, currentMaster, { recursive: true });
    }
    await startPackagedBackend();
    setTimeout(() => mainWindow?.reload(), 250);
    return { ok:true };
  } catch (error) {
    try {
      const safetyDb = path.join(safety, 'createur-ao.db');
      if (fs.existsSync(safetyDb)) await fsp.copyFile(safetyDb, dbFile);
      const safetyMaster = path.join(safety, 'master');
      if (currentMaster && fs.existsSync(safetyMaster)) {
        await fsp.rm(currentMaster, { recursive:true, force:true });
        await fsp.cp(safetyMaster, currentMaster, { recursive:true });
      }
      await startPackagedBackend();
    } catch {}
    throw error;
  }
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
