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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAX_GATEWAY_RESTARTS = 2;
let gatewayRestartCount = 0;

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

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function classifyConsoleErrors(errors, { allowControlledRestartNoise = false } = {}) {
  const expectedUnavailable = [];
  const unexpected = [];
  for (const message of errors) {
    const unavailable503 = /status of 503\s*\(Service Unavailable\)/i.test(message);
    const transportReset = /Failed to load resource:\s*net::ERR_CONNECTION_(?:RESET|REFUSED)/i.test(message);
    const devSocketReset = /WebSocket connection to 'ws:\/\/127\.0\.0\.1:24678\/'.*ERR_CONNECTION_REFUSED/i.test(message);

    if (unavailable503 || (allowControlledRestartNoise && (transportReset || devSocketReset))) {
      expectedUnavailable.push(message);
    } else {
      unexpected.push(message);
    }
  }
  return { expectedUnavailable, unexpected };
}

async function readRouteSnapshot(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.knoux-workspace-stage');
    const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
      .find(button => /retry connection/i.test(button.textContent || ''));
    const drawer = document.querySelector('.knoux-command-tool-drawer');
    return {
      mode: stage?.getAttribute('data-mode') || null,
      execution: stage?.getAttribute('data-execution') || null,
      serviceToolCount: Number(stage?.getAttribute('data-service-tool-count') || 0),
      serviceApp: Boolean(document.querySelector('.knoux-stage-service-app')),
      context: (document.querySelector('.knoux-stage-context strong')?.textContent || '').trim().replace(/\s+/g, ' '),
      toolCards: document.querySelectorAll('.knoux-tool-card[data-tool-id]').length,
      selectedToolId: stage?.getAttribute('data-selected-tool-id') || '',
      bridgeRetryAvailable: Boolean(retry),
      actionDrawerAvailable: Boolean(drawer),
      actionDrawerExpanded: drawer?.getAttribute('aria-expanded') === 'true' || drawer?.getAttribute('data-expanded') === 'true',
    };
  });
}

async function probeAuthoritativeServiceInventory(serviceId) {
  try {
    const response = await fetch(
      `${ORIGIN}/api/categories/${encodeURIComponent(serviceId)}/tools`,
      { signal: AbortSignal.timeout(5_000), headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      return { ok: false, status: response.status, count: null, category: null, error: `HTTP ${response.status}` };
    }
    const payload = await response.json();
    const tools = Array.isArray(payload?.tools) ? payload.tools : [];
    return {
      ok: true,
      status: response.status,
      count: tools.length,
      category: typeof payload?.category === 'string' ? payload.category : null,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      count: null,
      category: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function reloadServiceRoute(page, serviceId) {
  console.log(`${serviceId}: reloading the same service route after verified recovery evidence.`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('.knoux-workspace-stage', { timeout: 15_000 });
  await page.waitForSelector('.knoux-stage-service-app', { timeout: 15_000 });
  await delay(350);
}

let gateway = launchGateway();
let browser;

async function restartGatewayForEvidence(serviceId, reason) {
  if (gatewayRestartCount >= MAX_GATEWAY_RESTARTS) {
    throw new Error(`${serviceId}: gateway/bridge recovery budget exhausted after ${gatewayRestartCount} controlled restart(s); last reason=${reason}`);
  }

  gatewayRestartCount += 1;
  console.warn(`${serviceId}: restarting the supervised gateway/bridge (${gatewayRestartCount}/${MAX_GATEWAY_RESTARTS}) after authoritative inventory became unavailable: ${reason}`);
  await stopGateway(gateway);
  await delay(900);
  gateway = launchGateway();
  await waitForGateway(45_000);
}

async function waitForServiceInventory(page, expectedCount, serviceId) {
  let recoveredBridge = false;
  let reloadedRoute = false;
  let restartedGateway = false;
  let authoritativeCount = null;
  let lastProbe = null;
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.waitForFunction(
        count => {
          const stage = document.querySelector('.knoux-workspace-stage');
          const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
            .find(button => /retry connection/i.test(button.textContent || ''));
          return Number(stage?.getAttribute('data-service-tool-count') || 0) === count && !retry;
        },
        { timeout: 12_000, polling: 100 },
        expectedCount,
      );
      return { recoveredBridge, reloadedRoute, restartedGateway, authoritativeCount };
    } catch {
      const snapshot = await readRouteSnapshot(page);

      if (snapshot.bridgeRetryAvailable) {
        recoveredBridge = true;
        console.log(`${serviceId}: transient bridge-unavailable state observed; exercising the real Retry connection path (attempt ${attempt}/${maxAttempts}).`);
        await page.evaluate(() => {
          const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
            .find(button => /retry connection/i.test(button.textContent || ''));
          if (retry instanceof HTMLButtonElement) retry.click();
        });
        await delay(650);
        continue;
      }

      const probe = await probeAuthoritativeServiceInventory(serviceId);
      lastProbe = probe;
      authoritativeCount = probe.count;

      if (probe.ok && probe.count !== expectedCount) {
        throw new Error(`${serviceId}: authoritative category endpoint returned ${probe.count} tools, expected ${expectedCount}; UI observed ${JSON.stringify(snapshot)}`);
      }

      if (probe.ok && probe.count === expectedCount) {
        if (attempt >= maxAttempts) {
          throw new Error(`${serviceId}: backend proves ${expectedCount} tools but UI still did not hydrate after ${attempt} attempts; observed ${JSON.stringify(snapshot)}`);
        }
        reloadedRoute = true;
        await reloadServiceRoute(page, serviceId);
        continue;
      }

      const probeReason = probe.error || (probe.status ? `HTTP ${probe.status}` : 'unknown bridge failure');
      if (!restartedGateway) {
        recoveredBridge = true;
        restartedGateway = true;
        reloadedRoute = true;
        await restartGatewayForEvidence(serviceId, probeReason);
        await reloadServiceRoute(page, serviceId);
        continue;
      }

      if (attempt >= maxAttempts) {
        throw new Error(`${serviceId}: neither UI nor authoritative category endpoint settled after ${attempt} attempts and one controlled gateway restart; UI=${JSON.stringify(snapshot)} backend=${JSON.stringify(probe)}`);
      }

      console.log(`${serviceId}: authoritative inventory still unavailable after controlled restart (${probeReason}); waiting for health before one more strict route reload.`);
      await waitForGateway(12_000);
      reloadedRoute = true;
      await reloadServiceRoute(page, serviceId);
    }
  }

  const finalSnapshot = await readRouteSnapshot(page);
  throw new Error(`${serviceId}: service inventory did not settle at ${expectedCount}; UI=${JSON.stringify(finalSnapshot)} backend=${JSON.stringify(lastProbe)}`);
}

async function waitForActionSurface(page, expectedCount, serviceId) {
  await page.waitForFunction(
    count => {
      const cards = document.querySelectorAll('.knoux-tool-card[data-tool-id]').length;
      const drawer = document.querySelector('.knoux-command-tool-drawer');
      const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
        .find(button => /retry connection/i.test(button.textContent || ''));
      return cards === count || Boolean(drawer) || Boolean(retry);
    },
    { timeout: 15_000, polling: 100 },
    expectedCount,
  ).catch(async () => {
    const snapshot = await readRouteSnapshot(page);
    throw new Error(`${serviceId}: action surface never became ready; observed ${JSON.stringify(snapshot)}`);
  });
}

async function clickRetryConnection(page) {
  await page.evaluate(() => {
    const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
      .find(button => /retry connection/i.test(button.textContent || ''));
    if (retry instanceof HTMLButtonElement) retry.click();
  });
}

async function revealAllActionCards(page, expectedCount, serviceId) {
  let recoveredBridge = false;
  let reloadedRoute = false;
  let restartedGateway = false;
  let expandedActions = false;
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForActionSurface(page, expectedCount, serviceId);
    let snapshot = await readRouteSnapshot(page);

    if (snapshot.bridgeRetryAvailable) {
      recoveredBridge = true;
      console.log(`${serviceId}: action rail entered bridge-unavailable state; exercising Retry connection before verification (attempt ${attempt}/${maxAttempts}).`);
      await clickRetryConnection(page);
      const inventoryRecovery = await waitForServiceInventory(page, expectedCount, serviceId);
      recoveredBridge = recoveredBridge || inventoryRecovery.recoveredBridge;
      reloadedRoute = reloadedRoute || inventoryRecovery.reloadedRoute;
      restartedGateway = restartedGateway || inventoryRecovery.restartedGateway;
      await delay(350);
      continue;
    }

    if (snapshot.toolCards === expectedCount) {
      return { expandedActions, recoveredBridge, reloadedRoute, restartedGateway };
    }

    if (!snapshot.actionDrawerAvailable) {
      throw new Error(`${serviceId}: ${expectedCount} tools are loaded but only ${snapshot.toolCards} action cards are visible and no action drawer exists after readiness settled.`);
    }

    if (!snapshot.actionDrawerExpanded) {
      await page.click('.knoux-command-tool-drawer');
      expandedActions = true;
    }

    await page.waitForFunction(
      count => {
        const cards = document.querySelectorAll('.knoux-tool-card[data-tool-id]').length;
        const retry = [...document.querySelectorAll('.knoux-tool-empty-state button')]
          .find(button => /retry connection/i.test(button.textContent || ''));
        return cards === count || Boolean(retry);
      },
      { timeout: 10_000, polling: 50 },
      expectedCount,
    ).catch(() => {});

    snapshot = await readRouteSnapshot(page);

    if (snapshot.bridgeRetryAvailable) {
      recoveredBridge = true;
      console.log(`${serviceId}: bridge became unavailable while expanding the action drawer; exercising Retry connection before re-verification (attempt ${attempt}/${maxAttempts}).`);
      await clickRetryConnection(page);
      const inventoryRecovery = await waitForServiceInventory(page, expectedCount, serviceId);
      recoveredBridge = recoveredBridge || inventoryRecovery.recoveredBridge;
      reloadedRoute = reloadedRoute || inventoryRecovery.reloadedRoute;
      restartedGateway = restartedGateway || inventoryRecovery.restartedGateway;
      await delay(350);
      continue;
    }

    if (snapshot.toolCards === expectedCount) {
      return { expandedActions: true, recoveredBridge, reloadedRoute, restartedGateway };
    }

    if (attempt >= maxAttempts) {
      throw new Error(`${serviceId}: action drawer did not expose all ${expectedCount} cards after ${attempt} attempts; observed ${JSON.stringify(snapshot)}`);
    }

    console.log(`${serviceId}: action drawer did not settle on attempt ${attempt}/${maxAttempts}; retrying the same real action surface.`);
    await delay(350);
  }

  const finalSnapshot = await readRouteSnapshot(page);
  throw new Error(`${serviceId}: action surface did not recover after ${maxAttempts} attempts; observed ${JSON.stringify(finalSnapshot)}`);
}

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

    const inventoryRecovery = await waitForServiceInventory(page, target.tools, target.service);
    const actionSurface = await revealAllActionCards(page, target.tools, target.service);
    const recoveredBridge = inventoryRecovery.recoveredBridge || actionSurface.recoveredBridge;
    const reloadedRoute = inventoryRecovery.reloadedRoute || actionSurface.reloadedRoute;
    const restartedGateway = inventoryRecovery.restartedGateway || actionSurface.restartedGateway;
    const expandedActions = actionSurface.expandedActions;
    await delay(350);

    const snapshot = await readRouteSnapshot(page);

    if (snapshot.mode !== 'service') throw new Error(`${target.service}: expected service mode, got ${snapshot.mode}`);
    if (!snapshot.serviceApp) throw new Error(`${target.service}: canonical ServiceApps station did not render`);
    if (snapshot.serviceToolCount !== target.tools) throw new Error(`${target.service}: expected ${target.tools} service tools, got ${snapshot.serviceToolCount}`);
    if (snapshot.toolCards !== target.tools) throw new Error(`${target.service}: expected ${target.tools} action cards after exercising the real action surface, got ${snapshot.toolCards}`);
    if (normalizeText(snapshot.context) !== target.name) throw new Error(`${target.service}: expected context '${target.name}', got '${snapshot.context}'`);
    if (snapshot.selectedToolId) throw new Error(`${target.service}: route should open service workspace before a tool is selected`);
    if (pageErrors.length > 0) throw new Error(`${target.service}: page errors: ${pageErrors.join(' | ')}`);

    const classifiedConsole = classifyConsoleErrors(consoleErrors, {
      allowControlledRestartNoise: restartedGateway,
    });
    if (classifiedConsole.unexpected.length > 0) {
      throw new Error(`${target.service}: unexpected console errors: ${classifiedConsole.unexpected.join(' | ')}`);
    }

    const fileName = `${String(index + 1).padStart(2, '0')}-${target.service}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: false });
    results.push({
      ...target,
      ...snapshot,
      recoveredBridge,
      reloadedRoute,
      restartedGateway,
      authoritativeCount: inventoryRecovery.authoritativeCount,
      expandedActions,
      expectedUnavailableConsoleErrors: classifiedConsole.expectedUnavailable.length,
      screenshot: fileName,
    });
    console.log(`Verified ${target.service}: ${target.tools} tools${expandedActions ? ' (action drawer expanded)' : ''}${recoveredBridge ? ' (bridge recovery exercised)' : ''}${reloadedRoute ? ' (same route reloaded after recovery proof)' : ''}${restartedGateway ? ' (gateway/bridge restarted once)' : ''}.`);
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
    gatewayRestartCount,
    results,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'service-route-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  console.log(`Verified ${results.length} canonical service routes across ${families.size} families (${toolTotal} tools); controlled gateway restarts=${gatewayRestartCount}.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}