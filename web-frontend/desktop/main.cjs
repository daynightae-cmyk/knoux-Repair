const { app, BrowserWindow, dialog, shell } = require('electron');
const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { isAllowedNavigation, filterExternalUrl, resolveAssetPath } = require('./security.cjs');

let frontendServer;
let bridgeProcess;
let quitting = false;
// Per-launch capability secret for localhost bridge mutations. Generated fresh
// on every start, kept in memory, never written to disk or committed to Git.
const bridgeToken = crypto.randomBytes(32).toString('base64url');

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
  const resolved = resolveAssetPath(root, requestPath);
  return resolved.ok ? resolved.path : null;
}

function isMalformedAssetUrl(requestPath) {
  const resolved = resolveAssetPath(frontendRoot(), requestPath);
  return !resolved.ok && resolved.reason === 'BAD_ENCODING';
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' })[extension] || 'application/octet-stream';
}

function frontendSecurityHeaders(target) {
  const headers = {
    'Content-Type': contentType(target),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
  if (path.extname(target).toLowerCase() === '.html') {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: https:",
      "connect-src 'self' http://127.0.0.1:8787",
    ].join('; ');
  }
  return headers;
}

function startFrontendServer() {
  const root = frontendRoot();
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(`KNOUX Repair build is missing: ${root}`);
  frontendServer = http.createServer((request, response) => {
    if (isMalformedAssetUrl(request.url)) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('Bad request.');
      return;
    }
    const candidate = safeAssetPath(root, request.url);
    const target = candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile() ? candidate : path.join(root, 'index.html');
    response.writeHead(200, frontendSecurityHeaders(target));
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
  const fingerprintFile = path.join(target, '.glass-nexus-runtime-fingerprint');
  const version = app.getVersion();
  // Fingerprint the executable runtime surface so same-version code updates
  // still refresh the writable copy. Version alone is not enough: without
  // this, a stale bridge/scripts copy would run forever under one version.
  const fingerprint = `${version}:${runtimeFingerprint(source)}`;
  let currentFingerprint = '';
  try { currentFingerprint = (await fsp.readFile(fingerprintFile, 'utf8')).trim(); } catch { }
  if (currentFingerprint === fingerprint && fs.existsSync(path.join(target, 'Docs', 'TOOLS-MANIFEST.json'))) return target;

  await fsp.mkdir(target, { recursive: true });
  await fsp.cp(source, target, {
    recursive: true,
    force: true,
    filter: (from) => !/[\\/](Reports|Quarantine|node_modules)([\\/]|$)/i.test(from) && !/\.env\.local$/i.test(from),
  });
  await fsp.writeFile(versionFile, version, 'utf8');
  await fsp.writeFile(fingerprintFile, fingerprint, 'utf8');
  return target;
}

/**
 * Station 01 packaged-freshness: SHA-256 over the files that define the
 * executable runtime (bridge, manifest, menus, Core). Any change refreshes
 * the writable copy on next launch, even when the app version is unchanged.
 */
function runtimeFingerprint(source) {
  const watched = [
    'web-frontend/server/bridge.mjs',
    'Docs/TOOLS-MANIFEST.json',
    'Config/menus.json',
    'Core/KnouxRepair.Core.psm1',
    'Core/KnouxRepair.Safety.psm1',
    'Core/KnouxRepair.NativeCommands.psm1',
    'Core/KnouxRepair.Reporting.psm1',
    'Core/KnouxRepair.Config.psm1',
    'Core/KnouxRepair.Contracts.psm1',
  ];
  const hash = crypto.createHash('sha256');
  for (const relative of watched) {
    try {
      hash.update(fs.readFileSync(path.join(source, relative)));
    } catch {
      hash.update(`missing:${relative}`);
    }
  }
  // Category tool scripts define execution behavior (modes, safety gates);
  // hash them too so script updates refresh the copy even when the
  // manifest and version are unchanged.
  let scriptEntries = [];
  try {
    scriptEntries = fs.readdirSync(source, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
      .flatMap((entry) => {
        try {
          return fs.readdirSync(path.join(source, entry.name))
            .filter((file) => file.toLowerCase().endsWith('.ps1'))
            .sort()
            .map((file) => `${entry.name}/${file}`);
        } catch {
          return [];
        }
      });
  } catch {
    hash.update('missing:categories');
  }
  for (const relative of scriptEntries) {
    try {
      hash.update(relative);
      hash.update(fs.readFileSync(path.join(source, relative)));
    } catch {
      hash.update(`missing:${relative}`);
    }
  }
  return hash.digest('hex');
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
      KNOUX_PACKAGED: app.isPackaged ? '1' : '0',
      KNOUX_BRIDGE_PORT: '8787',
      KNOUX_BRIDGE_TOKEN: bridgeToken,
      KNOUX_AUTH_FRONTEND_ORIGIN: frontendOrigin,
    },
  });
  bridgeProcess.once('error', () => { /* The KNOUX Repair UI stays responsive and displays bridge-offline state. */ });
}

function openExternalSafe(targetUrl) {
  const allowed = filterExternalUrl(targetUrl);
  if (allowed) shell.openExternal(allowed).catch(() => { /* external open is best-effort */ });
}

function createWindow(frontendOrigin, bridgeState) {
  const window = new BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'KNOUX Repair',
    icon: fs.existsSync(path.join(sourceRuntimeRoot(), 'Assets', 'KnouxOfficialLogo.ico'))
      ? path.join(sourceRuntimeRoot(), 'Assets', 'KnouxOfficialLogo.ico')
      : path.join(__dirname, '..', 'public', 'brand', 'knoux-repair-logo.png'),
    backgroundColor: '#061422',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => { openExternalSafe(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, frontendOrigin)) { event.preventDefault(); openExternalSafe(url); }
  });
  window.webContents.on('render-process-gone', () => {
    if (!quitting) dialog.showErrorBox('KNOUX Repair', 'The application stopped unexpectedly. Please reopen KNOUX Repair.');
  });
  const launchUrl = new URL(frontendOrigin);
  launchUrl.searchParams.set('bridgeToken', bridgeToken);
  // Phase 00 lifecycle: the renderer must not report READY before the bridge
  // readiness probe (health + manifest + registry) completes. When the probe
  // fails the exact offline reason travels with the URL so first paint shows
  // UNAVAILABLE/OFFLINE instead of "0 tools".
  if (bridgeState && bridgeState.ready) {
    launchUrl.searchParams.set('bridgeReady', '1');
    launchUrl.searchParams.set('bridgeTools', String(bridgeState.tools));
    launchUrl.searchParams.set('bridgeCategories', String(bridgeState.categories));
  } else {
    launchUrl.searchParams.set('bridgeError', (bridgeState && bridgeState.reason) || 'Execution bridge offline');
  }
  window.loadURL(launchUrl.toString()).catch((error) => dialog.showErrorBox('KNOUX Repair startup failed', error.message));
  return window;
}

function stopRuntime() {
  try { frontendServer?.close(); } catch { }
  try { bridgeProcess?.kill(); } catch { }
}

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(data) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => request.destroy(new Error(`probe timeout after ${timeoutMs}ms`)));
    request.on('error', reject);
  });
}

/**
 * Phase 00 readiness probe: bridge starts -> health -> manifest loads ->
 * registry validates. Resolves READY only when the registry reports tools;
 * otherwise resolves with the exact offline reason (never "0 tools").
 */
async function probeBridgeReady({ timeoutMs = 20000, intervalMs = 400 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastReason = 'Bridge process did not respond.';
  while (Date.now() < deadline) {
    try {
      const health = await fetchJson('http://127.0.0.1:8787/api/health', 2500);
      if (health.status === 200 && health.body && health.body.ok === true) {
        const tools = await fetchJson('http://127.0.0.1:8787/api/tools', 5000);
        const list = tools.body && Array.isArray(tools.body.tools) ? tools.body.tools : null;
        if (tools.status === 200 && list) {
          const categories = new Set(list.map((tool) => tool.Category)).size;
          return { ready: true, tools: list.length, categories, reason: '' };
        }
        lastReason = 'Bridge is up but the tool registry did not validate.';
      } else {
        lastReason = `Bridge health check returned HTTP ${health.status}.`;
      }
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ready: false, tools: 0, categories: 0, reason: lastReason };
}

app.whenReady().then(async () => {
  try {
    // Own the lifecycle: runtime copy -> bridge start -> readiness probe ->
    // window. The UI never shows READY before the registry validates.
    const runtimeRoot = await prepareWritableRuntime();
    const frontendOrigin = await startFrontendServer();
    startBridge(runtimeRoot, frontendOrigin);
    const bridgeState = await probeBridgeReady();
    createWindow(frontendOrigin, bridgeState);
  } catch (error) {
    dialog.showErrorBox('KNOUX Repair startup failed', error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on('before-quit', () => { quitting = true; stopRuntime(); });
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0 && frontendServer) createWindow(`http://127.0.0.1:${frontendServer.address().port}`, null); });
