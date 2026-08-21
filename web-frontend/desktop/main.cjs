const { app, BrowserWindow, dialog, shell } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

let frontendServer;
let bridgeProcess;
let quitting = false;

function sourceRuntimeRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'knoux-runtime')
    : path.resolve(__dirname, '..', '..');
}

function writableRuntimeRoot() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'runtime')
    : sourceRuntimeRoot();
}

function frontendRoot() {
  return app.isPackaged ? path.join(app.getAppPath(), 'dist') : path.join(__dirname, '..', 'dist');
}

function safeAssetPath(root, requestPath) {
  const relative = decodeURIComponent((requestPath || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const candidate = path.resolve(root, relative);
  return candidate.startsWith(`${path.resolve(root)}${path.sep}`) ? candidate : null;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' })[extension] || 'application/octet-stream';
}

function startFrontendServer() {
  const root = frontendRoot();
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(`Glass Nexus build is missing: ${root}`);
  frontendServer = http.createServer((request, response) => {
    const candidate = safeAssetPath(root, request.url);
    const target = candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
    response.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' });
    fs.createReadStream(target).on('error', () => response.end()).pipe(response);
  });
  return new Promise((resolve, reject) => {
    frontendServer.once('error', reject);
    frontendServer.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${frontendServer.address().port}`));
  });
}

async function prepareWritableRuntime() {
  if (!app.isPackaged) return sourceRuntimeRoot();
  const source = sourceRuntimeRoot();
  const target = writableRuntimeRoot();
  const versionFile = path.join(target, '.glass-nexus-runtime-version');
  const version = app.getVersion();
  let currentVersion = '';
  try { currentVersion = (await fsp.readFile(versionFile, 'utf8')).trim(); } catch { }
  if (currentVersion === version && fs.existsSync(path.join(target, 'Docs', 'TOOLS-MANIFEST.json'))) return target;

  await fsp.mkdir(target, { recursive: true });
  await fsp.cp(source, target, {
    recursive: true,
    force: true,
    filter: (from) => !/[\\/](Reports|Quarantine|node_modules)([\\/]|$)/i.test(from) && !/\.env\.local$/i.test(from),
  });
  await fsp.writeFile(versionFile, version, 'utf8');
  return target;
}

function startBridge(runtimeRoot, frontendOrigin) {
  const bridgeFile = path.join(runtimeRoot, 'web-frontend', 'server', 'bridge.mjs');
  if (!fs.existsSync(bridgeFile)) throw new Error(`Local execution bridge is missing: ${bridgeFile}`);
  bridgeProcess = spawn(process.execPath, [bridgeFile], {
    cwd: runtimeRoot,
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      KNOUX_PROJECT_ROOT: runtimeRoot,
      KNOUX_DATA_ROOT: runtimeRoot,
      KNOUX_BRIDGE_PORT: '8787',
      KNOUX_AUTH_FRONTEND_ORIGIN: frontendOrigin,
    },
  });
  bridgeProcess.once('error', () => { /* The Glass Nexus UI stays responsive and displays bridge-offline state. */ });
}

function createWindow(frontendOrigin) {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'KNOUX Repair — Glass Nexus',
    icon: path.join(sourceRuntimeRoot(), 'Assets', 'KnouxOfficialLogo.ico'),
    backgroundColor: '#061422',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(frontendOrigin)) { event.preventDefault(); shell.openExternal(url); }
  });
  window.webContents.on('render-process-gone', () => {
    if (!quitting) dialog.showErrorBox('KNOUX Repair', 'Glass Nexus stopped unexpectedly. Please reopen the application.');
  });
  window.loadURL(frontendOrigin).catch((error) => dialog.showErrorBox('KNOUX Repair startup failed', error.message));
  return window;
}

function stopRuntime() {
  try { frontendServer?.close(); } catch { }
  try { bridgeProcess?.kill(); } catch { }
}

app.whenReady().then(async () => {
  try {
    const frontendOrigin = await startFrontendServer();
    createWindow(frontendOrigin);
    // This runs after the UI is visible; first-run copying cannot freeze the dashboard.
    const runtimeRoot = await prepareWritableRuntime();
    startBridge(runtimeRoot, frontendOrigin);
  } catch (error) {
    dialog.showErrorBox('KNOUX Repair startup failed', error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on('before-quit', () => { quitting = true; stopRuntime(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0 && frontendServer) createWindow(`http://127.0.0.1:${frontendServer.address().port}`); });
