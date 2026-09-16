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
  { family: 'recovery', service: '05-Duplicate-Files', name: 'Duplicate Files', tools: 11, surface: '.duplicate-studio-root', ownsActions: true },
  { family: 'recovery', service: '06-Disk-Space', name: 'Disk Space', tools: 10 },
  { family: 'recovery', service: '11-Backup-Recovery', name: 'Backup & Recovery', tools: 5 },
  { family: 'assurance', service: '03-Network-Internet', name: 'Network & Internet', tools: 11 },
  { family: 'assurance', service: '09-Security', name: 'Security', tools: 10 },
  { family: 'assurance', service: '13-Privacy', name: 'Privacy', tools: 4 },
  { family: 'assurance', service: '14-Driver-Management', name: 'Driver Management', tools: 4 },
  { family: 'software', service: '04-Programs-Applications', name: 'Programs & Applications', tools: 10, surface: '.programs-station', ownsActions: true },
  { family: 'software', service: '16-Software-Environment', name: 'Software Environment', tools: 8, surface: '.software-station-root', ownsActions: true },
  { family: 'software', service: '17-PostInstall-Setup', name: 'Post-Install Setup', tools: 6, surface: '.post-install-station-root', ownsActions: true },
  { family: 'workbench', service: '12-Developer-Tools', name: 'Developer Tools', tools: 13, surface: '.developer-station-root', ownsActions: true },
  { family: 'workbench', service: '18-Project-Sonar', name: 'Project Sonar', tools: 7, surface: '.project-sonar-station-root', ownsActions: true },
  { family: 'investigation', service: '10-Diagnostics-Reports', name: 'Diagnostics & Reports', tools: 11, surface: '.knoux-stage-service-app', ownsActions: true },
  { family: 'investigation', service: '07-Services-Processes', name: 'Services & Processes', tools: 11, surface: '.knoux-station-workspace', ownsActions: true },
];

fs.mkdirSync(OUT_DIR, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let gatewayRestartCount = 0;
const MAX_GATEWAY_RESTARTS = 2;

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
    await delay(500);
  }
  throw new Error(`Gateway did not become ready at ${ORIGIN}: ${lastError}`);
}

async function restartGateway(serviceId, reason) {
  if (gatewayRestartCount >= MAX_GATEWAY_RESTARTS) {
    throw new Error(`${serviceId}: gateway recovery budget exhausted after ${gatewayRestartCount} restart(s); ${reason}`);
  }
  gatewayRestartCount += 1;
  console.warn(`${serviceId}: restarting supervised gateway (${gatewayRestartCount}/${MAX_GATEWAY_RESTARTS}): ${reason}`);
  await stopGateway(gateway);
  await delay(900);
  gateway = launchGateway();
  await waitForGateway();
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function classifyConsoleErrors(errors, allowTransportNoise) {
  const expected = [];
  const unexpected = [];
  for (const message of errors) {
    const unavailable503 = /status of 503\s*\(Service Unavailable\)/i.test(message);
    const transportReset = /Failed to load resource:\s*net::ERR_CONNECTION_(?:RESET|REFUSED)/i.test(message);
    if (unavailable503 || (allowTransportNoise && transportReset)) expected.push(message);
    else unexpected.push(message);
  }
  return { expected, unexpected };
}

async function probeInventory(serviceId) {
  try {
    const response = await fetch(`${ORIGIN}/api/categories/${encodeURIComponent(serviceId)}/tools`, {
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return { ok: false, status: response.status, count: null, category: null, error: `HTTP ${response.status}` };
    const payload = await response.json();
    return {
      ok: true,
      status: response.status,
      count: Array.isArray(payload?.tools) ? payload.tools.length : 0,
      category: typeof payload?.category === 'string' ? payload.category : null,
      error: null,
    };
  } catch (error) {
    return { ok: false, status: null, count: null, category: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function waitForSurface(page, target) {
  await page.waitForSelector(`.knoux-family-page[data-service="${target.service}"]`, { timeout: 15_000 });
  await page.waitForSelector(target.surface || '.knoux-stage-service-app', { timeout: 15_000 });
}

async function readSnapshot(page, target) {
  return page.evaluate(({ serviceId, selector }) => {
    const familyRoot = document.querySelector(`.knoux-family-page[data-service="${serviceId}"]`);
    const stage = document.querySelector('.knoux-workspace-stage');
    const workbench = document.querySelector('.knoux-engineering-workbench');
    const surface = document.querySelector(selector);
    const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
      .find(button => /retry connection/i.test(button.textContent || ''));
    const drawer = document.querySelector('.knoux-command-tool-drawer');
    const railCountText = document.querySelector('.knoux-command-tool-rail .knoux-command-rail-header small')?.textContent || '';
    const stageCount = Number(stage?.getAttribute('data-service-tool-count') || 0);
    const workbenchCount = Number(workbench?.getAttribute('data-service-tool-count') || 0);
    const railCount = Number.parseInt(railCountText.trim(), 10) || 0;
    const context = (
      document.querySelector('.knoux-stage-context strong')?.textContent
      || document.querySelector('.knoux-command-tool-rail .knoux-command-rail-header strong')?.textContent
      || ''
    ).trim().replace(/\s+/g, ' ');
    return {
      familyService: familyRoot?.getAttribute('data-service') || null,
      mode: stage?.getAttribute('data-mode') || (familyRoot && surface ? 'service' : null),
      selectedToolId: stage?.getAttribute('data-selected-tool-id') || '',
      serviceToolCount: stageCount || workbenchCount || railCount,
      surfaceVisible: Boolean(surface),
      context,
      toolCards: document.querySelectorAll('.knoux-tool-card[data-tool-id]').length,
      retryAvailable: Boolean(retry),
      drawerAvailable: Boolean(drawer),
      drawerExpanded: drawer?.getAttribute('aria-expanded') === 'true' || drawer?.getAttribute('data-expanded') === 'true',
    };
  }, { serviceId: target.service, selector: target.surface || '.knoux-stage-service-app' });
}

async function clickRetry(page) {
  await page.evaluate(() => {
    const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
      .find(button => /retry connection/i.test(button.textContent || ''));
    if (retry instanceof HTMLButtonElement) retry.click();
  });
}

async function reloadRoute(page, target) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitForSurface(page, target);
  await delay(350);
}

async function ensureInventory(page, target) {
  let recoveredBridge = false;
  let reloadedRoute = false;
  let restartedGateway = false;
  let lastProbe = null;
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForSurface(page, target);
    let snapshot = await readSnapshot(page, target);
    let probe = await probeInventory(target.service);
    lastProbe = probe;

    if (probe.ok && (probe.count !== target.tools || probe.category !== target.service)) {
      throw new Error(`${target.service}: authoritative inventory mismatch category=${probe.category} count=${probe.count}; expected category=${target.service} count=${target.tools}`);
    }

    if (probe.ok && probe.count === target.tools && snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable) {
      return { recoveredBridge, reloadedRoute, restartedGateway, authoritativeCount: probe.count };
    }

    if (snapshot.retryAvailable) {
      recoveredBridge = true;
      await clickRetry(page);
      await delay(900);
      snapshot = await readSnapshot(page, target);
      probe = await probeInventory(target.service);
      lastProbe = probe;
      if (probe.ok && probe.count === target.tools && probe.category === target.service && snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable) {
        return { recoveredBridge, reloadedRoute, restartedGateway, authoritativeCount: probe.count };
      }
    }

    if (probe.ok && probe.count === target.tools && probe.category === target.service) {
      reloadedRoute = true;
      await reloadRoute(page, target);
      continue;
    }

    if (!restartedGateway) {
      recoveredBridge = true;
      restartedGateway = true;
      reloadedRoute = true;
      await restartGateway(target.service, probe.error || (probe.status ? `HTTP ${probe.status}` : 'inventory unavailable'));
      await reloadRoute(page, target);
      continue;
    }

    if (attempt < maxAttempts) {
      await waitForGateway(12_000);
      reloadedRoute = true;
      await reloadRoute(page, target);
      continue;
    }
  }

  const snapshot = await readSnapshot(page, target);
  throw new Error(`${target.service}: route inventory never settled; UI=${JSON.stringify(snapshot)} backend=${JSON.stringify(lastProbe)}`);
}

async function revealStandardActions(page, target) {
  if (target.ownsActions) return { expandedActions: false, stationOwnedActions: true, recoveredBridge: false };

  const maxAttempts = 4;
  let expandedActions = false;
  let recoveredBridge = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let snapshot = await readSnapshot(page, target);
    if (snapshot.retryAvailable) {
      recoveredBridge = true;
      await clickRetry(page);
      await ensureInventory(page, target);
      await delay(350);
      continue;
    }
    if (snapshot.toolCards === target.tools) return { expandedActions, stationOwnedActions: false, recoveredBridge };
    if (!snapshot.drawerAvailable) {
      throw new Error(`${target.service}: ${target.tools} tools are loaded but only ${snapshot.toolCards} action cards are visible and no action drawer exists`);
    }
    if (!snapshot.drawerExpanded) {
      await page.click('.knoux-command-tool-drawer');
      expandedActions = true;
    }
    await page.waitForFunction(
      count => document.querySelectorAll('.knoux-tool-card[data-tool-id]').length === count,
      { timeout: 10_000, polling: 50 },
      target.tools,
    ).catch(() => {});
    snapshot = await readSnapshot(page, target);
    if (snapshot.toolCards === target.tools) return { expandedActions, stationOwnedActions: false, recoveredBridge };
    await delay(350);
  }
  const snapshot = await readSnapshot(page, target);
  throw new Error(`${target.service}: standard action rail did not expose all ${target.tools} tools; observed ${JSON.stringify(snapshot)}`);
}

let gateway = launchGateway();
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
    await waitForSurface(page, target);

    const inventory = await ensureInventory(page, target);
    const actionSurface = await revealStandardActions(page, target);
    await delay(350);
    const snapshot = await readSnapshot(page, target);

    if (snapshot.mode !== 'service') throw new Error(`${target.service}: expected service mode, got ${snapshot.mode}`);
    if (snapshot.familyService !== target.service) throw new Error(`${target.service}: route identity mismatch; observed ${snapshot.familyService}`);
    if (!snapshot.surfaceVisible) throw new Error(`${target.service}: canonical surface did not render`);
    if (snapshot.serviceToolCount !== target.tools) throw new Error(`${target.service}: expected ${target.tools} route tools, got ${snapshot.serviceToolCount}`);
    if (inventory.authoritativeCount !== target.tools) throw new Error(`${target.service}: authoritative inventory proof missing`);
    if (!target.ownsActions && snapshot.toolCards !== target.tools) throw new Error(`${target.service}: expected ${target.tools} visible action cards, got ${snapshot.toolCards}`);
    if (!target.ownsActions && normalizeText(snapshot.context) !== target.name) throw new Error(`${target.service}: expected context '${target.name}', got '${snapshot.context}'`);
    if (snapshot.selectedToolId) throw new Error(`${target.service}: route should open before a tool is selected`);
    if (pageErrors.length) throw new Error(`${target.service}: page errors: ${pageErrors.join(' | ')}`);

    const consoleCheck = classifyConsoleErrors(consoleErrors, inventory.restartedGateway);
    if (consoleCheck.unexpected.length) throw new Error(`${target.service}: unexpected console errors: ${consoleCheck.unexpected.join(' | ')}`);

    const fileName = `${String(index + 1).padStart(2, '0')}-${target.service}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: false });
    results.push({
      ...target,
      ...snapshot,
      recoveredBridge: inventory.recoveredBridge || actionSurface.recoveredBridge,
      reloadedRoute: inventory.reloadedRoute,
      restartedGateway: inventory.restartedGateway,
      authoritativeCount: inventory.authoritativeCount,
      expandedActions: actionSurface.expandedActions,
      stationOwnedActions: Boolean(actionSurface.stationOwnedActions),
      expectedUnavailableConsoleErrors: consoleCheck.expected.length,
      screenshot: fileName,
    });
    console.log(`Verified ${target.service}: ${target.tools} tools; surface=${target.surface || '.knoux-stage-service-app'}${target.ownsActions ? ' (station-owned actions)' : actionSurface.expandedActions ? ' (action drawer expanded)' : ''}.`);
    await page.close();
  }

  const families = new Set(results.map(item => item.family));
  const toolTotal = results.reduce((sum, item) => sum + item.authoritativeCount, 0);
  if (results.length !== 18) throw new Error(`Expected 18 verified services, got ${results.length}`);
  if (families.size !== 6) throw new Error(`Expected 6 verified families, got ${families.size}`);
  if (toolTotal !== 158) throw new Error(`Expected 158 service-scoped tools across the matrix, got ${toolTotal}`);

  const matrix = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    verifiedFamilies: families.size,
    verifiedServices: results.length,
    verifiedServiceToolTotal: toolTotal,
    gatewayRestartCount,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'service-route-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  console.log(`Verified ${results.length} canonical service routes across ${families.size} families (${toolTotal} tools); controlled gateway restarts=${gatewayRestartCount}.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
