import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_SERVICE_MATRIX_PORT || 3000);
const ORIGIN = `http://${HOST}:${PORT}`;
const ROOT_OUT_DIR = process.env.KNOUX_VISUAL_EVIDENCE_DIR
  ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR)
  : path.resolve('visual-evidence');
const OUT_DIR = path.join(ROOT_OUT_DIR, 'service-route-matrix');
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const ROUTES = [
  { family: 'vitality', service: '01-System-Maintenance', name: 'System Maintenance', tools: 10 },
  { family: 'vitality', service: '08-Performance', name: 'Performance', tools: 12 },
  { family: 'vitality', service: '15-System-Monitoring', name: 'System Monitoring', tools: 4 },
  { family: 'recovery', service: '02-System-Cleanup', name: 'System Cleanup', tools: 11 },
  { family: 'recovery', service: '05-Duplicate-Files', name: 'Duplicate Files', tools: 11 },
  { family: 'recovery', service: '06-Disk-Space', name: 'Disk Space', tools: 10 },
  { family: 'recovery', service: '11-Backup-Recovery', name: 'Backup & Recovery', tools: 5 },
  { family: 'assurance', service: '03-Network-Internet', name: 'Network & Internet', tools: 11 },
  { family: 'assurance', service: '09-Security', name: 'Security', tools: 10 },
  { family: 'assurance', service: '13-Privacy', name: 'Privacy', tools: 4 },
  { family: 'assurance', service: '14-Driver-Management', name: 'Driver Management', tools: 4 },
  { family: 'software', service: '04-Programs-Applications', name: 'Programs & Applications', tools: 10 },
  { family: 'software', service: '16-Software-Environment', name: 'Software Environment', tools: 8 },
  { family: 'software', service: '17-PostInstall-Setup', name: 'Post-Install Setup', tools: 6 },
  { family: 'workbench', service: '12-Developer-Tools', name: 'Developer Tools', tools: 13 },
  { family: 'workbench', service: '18-Project-Sonar', name: 'Project Sonar', tools: 7 },
  { family: 'investigation', service: '10-Diagnostics-Reports', name: 'Diagnostics & Reports', tools: 11 },
  { family: 'investigation', service: '07-Services-Processes', name: 'Services & Processes', tools: 11 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

function findEdge() {
  const edge = EDGE_CANDIDATES.find(candidate => fs.existsSync(candidate));
  if (!edge) throw new Error(`Microsoft Edge executable not found. Checked: ${EDGE_CANDIDATES.join(', ')}`);
  return edge;
}

function launchGateway() {
  const common = {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), KNOUX_AUTH_REQUIRED: '0' },
  };
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm run dev'], common)
    : spawn('npm', ['run', 'dev'], common);
  child.stdout?.on('data', chunk => process.stdout.write(`[service-matrix gateway] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[service-matrix gateway] ${chunk}`));
  return child;
}

async function stopGateway(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
    return;
  }
  child.kill('SIGTERM');
}

async function waitForGateway(timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Gateway did not become ready at ${ORIGIN}: ${lastError}`);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function classifyConsoleErrors(errors) {
  const expectedUnavailable = [];
  const unexpected = [];
  for (const message of errors) {
    if (/status of 503\s*\(Service Unavailable\)/i.test(message)) expectedUnavailable.push(message);
    else unexpected.push(message);
  }
  return { expectedUnavailable, unexpected };
}

async function readRouteSnapshot(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.knoux-workspace-stage');
    const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
      .find(button => /retry connection/i.test(button.textContent || ''));
    return {
      mode: stage?.getAttribute('data-mode') || null,
      execution: stage?.getAttribute('data-execution') || null,
      serviceToolCount: Number(stage?.getAttribute('data-service-tool-count') || 0),
      serviceApp: Boolean(document.querySelector('.knoux-stage-service-app')),
      context: (document.querySelector('.knoux-stage-context strong')?.textContent || '').trim().replace(/\s+/g, ' '),
      toolCards: document.querySelectorAll('.knoux-tool-card[data-tool-id]').length,
      selectedToolId: stage?.getAttribute('data-selected-tool-id') || '',
      bridgeRetryAvailable: Boolean(retry),
    };
  });
}

async function waitForServiceTools(page, expectedCount, serviceId) {
  const waitForCount = () => page.waitForFunction(
    count => {
      const stage = document.querySelector('.knoux-workspace-stage');
      const cards = document.querySelectorAll('.knoux-tool-card[data-tool-id]').length;
      return Number(stage?.getAttribute('data-service-tool-count') || 0) === count && cards === count;
    },
    { timeout: 15_000, polling: 100 },
    expectedCount
  );

  try {
    await waitForCount();
    return false;
  } catch {
    const beforeRetry = await readRouteSnapshot(page);
    if (!beforeRetry.bridgeRetryAvailable) {
      throw new Error(`${serviceId}: service tools did not settle at ${expectedCount}; observed ${JSON.stringify(beforeRetry)}`);
    }

    console.log(`${serviceId}: transient bridge-unavailable state observed; exercising the real Retry connection path.`);
    await page.evaluate(() => {
      const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
        .find(button => /retry connection/i.test(button.textContent || ''));
      if (retry instanceof HTMLButtonElement) retry.click();
    });
    await waitForCount().catch(async () => {
      const afterRetry = await readRouteSnapshot(page);
      throw new Error(`${serviceId}: bridge retry did not restore ${expectedCount} tools; observed ${JSON.stringify(afterRetry)}`);
    });
    return true;
  }
}

const gateway = launchGateway();
let browser;

try {
  await waitForGateway();
  browser = await puppeteer.launch({
    executablePath: findEdge(),
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });

  const results = [];

  for (let index = 0; index < ROUTES.length; index += 1) {
    const target = ROUTES[index];
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('knoux-lang', 'en'); } catch { /* initialized after navigation */ }
    });

    const url = `${ORIGIN}/?view=${encodeURIComponent(target.family)}&nosplash=1&service=${encodeURIComponent(target.service)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('.knoux-workspace-stage', { timeout: 15_000 });
    await page.waitForSelector('.knoux-stage-service-app', { timeout: 15_000 });
    const recoveredBridge = await waitForServiceTools(page, target.tools, target.service);
    await new Promise(resolve => setTimeout(resolve, 350));

    const snapshot = await readRouteSnapshot(page);

    if (snapshot.mode !== 'service') throw new Error(`${target.service}: expected service mode, got ${snapshot.mode}`);
    if (!snapshot.serviceApp) throw new Error(`${target.service}: canonical ServiceApps station did not render`);
    if (snapshot.serviceToolCount !== target.tools) throw new Error(`${target.service}: expected ${target.tools} service tools, got ${snapshot.serviceToolCount}`);
    if (snapshot.toolCards !== target.tools) throw new Error(`${target.service}: expected ${target.tools} action cards, got ${snapshot.toolCards}`);
    if (normalizeText(snapshot.context) !== target.name) throw new Error(`${target.service}: expected context '${target.name}', got '${snapshot.context}'`);
    if (snapshot.selectedToolId) throw new Error(`${target.service}: route should open service workspace before a tool is selected`);
    if (pageErrors.length > 0) throw new Error(`${target.service}: page errors: ${pageErrors.join(' | ')}`);

    const classifiedConsole = classifyConsoleErrors(consoleErrors);
    if (classifiedConsole.unexpected.length > 0) {
      throw new Error(`${target.service}: unexpected console errors: ${classifiedConsole.unexpected.join(' | ')}`);
    }

    const fileName = `${String(index + 1).padStart(2, '0')}-${target.service}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: false });
    results.push({
      ...target,
      ...snapshot,
      recoveredBridge,
      expectedUnavailableConsoleErrors: classifiedConsole.expectedUnavailable.length,
      screenshot: fileName,
    });
    console.log(`Verified ${target.service}: ${target.tools} tools${recoveredBridge ? ' (bridge recovered through Retry connection)' : ''}.`);
    await page.close();
  }

  const families = new Set(results.map(item => item.family));
  const toolTotal = results.reduce((sum, item) => sum + item.serviceToolCount, 0);
  if (results.length !== 18) throw new Error(`Expected 18 verified services, got ${results.length}`);
  if (families.size !== 6) throw new Error(`Expected 6 verified families, got ${families.size}`);
  if (toolTotal !== 158) throw new Error(`Expected 158 service-scoped tools across the matrix, got ${toolTotal}`);

  const matrix = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    verifiedFamilies: families.size,
    verifiedServices: results.length,
    verifiedServiceToolTotal: toolTotal,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'service-route-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  console.log(`Verified ${results.length} canonical service routes across ${families.size} families (${toolTotal} tools).`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
