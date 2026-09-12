import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_VISUAL_PORT || 3000);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT_DIR = process.env.KNOUX_VISUAL_EVIDENCE_DIR
  ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR)
  : path.resolve('visual-evidence');
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

fs.mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { name: 'P0-01_AI-SCAN-START.png', view: 'ai-scan', width: 1280, height: 800 },
  { name: 'P0-02_SYSTEM-VITALITY.png', view: 'vitality', width: 1280, height: 800 },
  { name: 'P0-03_RECOVERY-STORAGE.png', view: 'recovery', width: 1280, height: 800 },
  { name: 'P0-04_ASSURANCE.png', view: 'assurance', width: 1280, height: 800 },
  { name: 'P0-05_SOFTWARE-LIBRARY.png', view: 'software', width: 1280, height: 800 },
  { name: 'P0-06_ENGINEERING-WORKBENCH.png', view: 'workbench', width: 1280, height: 800 },
  { name: 'P0-07_INVESTIGATION.png', view: 'investigation', width: 1280, height: 800 },
  { name: 'P0-08_ACTION-CENTER.png', view: 'action-center', width: 1280, height: 800 },
  { name: 'P0-09_ALL-SERVICES-NAVIGATOR.png', view: 'navigator', width: 1280, height: 800 },
  {
    name: 'P0-10_UNIVERSAL-TOOL-WORKSPACE.png',
    view: 'vitality',
    query: '&service=01-System-Maintenance&tool=SM01',
    width: 1280,
    height: 800,
    requireWorkspace: true,
    scrollSelector: '.knoux-workspace-stage',
  },
  {
    name: 'P0-10B_RECOVERY-SERVICE-TOOLS.png',
    view: 'recovery',
    width: 1280,
    height: 800,
    scrollSelector: '#family-services',
  },
  { name: 'P0-11_RECOVERY-WIDE-1920.png', view: 'recovery', width: 1920, height: 1080 },
  { name: 'P0-12_RECOVERY-RTL.png', view: 'recovery', width: 1280, height: 800, lang: 'ar' },
  {
    name: 'MISSION-01_ACCOUNT-CENTER.png',
    view: 'ai-scan',
    query: '&account=1',
    width: 1440,
    height: 900,
    lang: 'en',
    requireAccount: true,
  },
];

const TERMINAL_EXECUTION_STATES = new Set(['success', 'error', 'cancelled', 'inconclusive']);

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
  child.stdout?.on('data', chunk => process.stdout.write(`[gateway] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[gateway] ${chunk}`));
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

function findEdge() {
  const edge = EDGE_CANDIDATES.find(candidate => fs.existsSync(candidate));
  if (!edge) throw new Error(`Microsoft Edge executable not found. Checked: ${EDGE_CANDIDATES.join(', ')}`);
  return edge;
}

async function inspectPage(page, target) {
  const selectors = await page.evaluate(() => ({
    hero: Boolean(document.querySelector('.knoux-preview-hero')),
    liveStage: Boolean(document.querySelector('.knoux-workspace-stage')),
    serviceCards: document.querySelectorAll('.knoux-service-card').length,
    toolCards: document.querySelectorAll('.knoux-tool-card').length,
    workspace: Boolean(document.querySelector('.knoux-tool-workspace')),
    accountCenter: Boolean(document.querySelector('.knoux-account-center')),
    direction: document.querySelector('.knoux-shell')?.getAttribute('dir') || document.documentElement.getAttribute('dir') || document.body.getAttribute('dir') || '',
  }));

  if (['vitality', 'recovery', 'assurance', 'software', 'workbench', 'investigation'].includes(target.view)) {
    if (!selectors.hero) throw new Error(`${target.name}: family hero is missing`);
    if (!selectors.liveStage) throw new Error(`${target.name}: live tool stage is missing`);
    if (selectors.serviceCards < 1) throw new Error(`${target.name}: service selector cards are missing`);
    if (!target.requireWorkspace && selectors.toolCards < 1) throw new Error(`${target.name}: selected service tool cards are missing`);
  }
  if (target.requireWorkspace && !selectors.workspace) throw new Error(`${target.name}: selected tool did not transform the live stage into ToolWorkspace`);
  if (target.requireAccount && !selectors.accountCenter) throw new Error(`${target.name}: account center did not render`);
  if (target.lang === 'ar' && selectors.direction !== 'rtl') throw new Error(`${target.name}: Arabic capture did not render RTL`);
  if (target.lang === 'en' && selectors.direction !== 'ltr') throw new Error(`${target.name}: English capture did not render LTR`);
  return selectors;
}

async function inspectExecutionLifecycle(page) {
  return page.evaluate(() => {
    const stage = document.querySelector('.knoux-workspace-stage');
    const executionBar = document.querySelector('.knoux-command-execution-bar');
    const workspace = document.querySelector('.knoux-tool-workspace');
    const workspaceText = workspace?.textContent || '';
    const executionText = executionBar?.textContent || '';
    const selectedMatch = workspaceText.match(/\b[A-Z]{2}\d{2}\b/);
    const executionMatch = executionText.match(/\b[A-Z]{2}\d{2}\b/);
    return {
      stageExecution: stage?.getAttribute('data-execution') || 'missing',
      executionBarStatus: executionBar?.getAttribute('data-status') || null,
      selectedToolId: selectedMatch?.[0] || null,
      executionToolId: executionMatch?.[0] || null,
      executionText: executionText.trim().replace(/\s+/g, ' '),
      transitions: Array.isArray(window.__knouxLifecycleTransitions) ? window.__knouxLifecycleTransitions : [],
    };
  });
}

async function captureRealExecutionLifecycle(browser) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const url = `${ORIGIN}/?view=vitality&nosplash=1&service=08-Performance&tool=PF01`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 });
  await page.waitForSelector('.knoux-tool-workspace', { timeout: 10_000 });
  await page.evaluate(() => document.querySelector('.knoux-workspace-stage')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await new Promise(resolve => setTimeout(resolve, 250));

  const selectedState = await inspectExecutionLifecycle(page);
  if (selectedState.selectedToolId !== 'PF01') {
    throw new Error(`Lifecycle proof expected PF01 selected before execution, got ${selectedState.selectedToolId || 'none'}`);
  }
  if (selectedState.stageExecution !== 'idle') {
    throw new Error(`Lifecycle proof expected idle before execution, got ${selectedState.stageExecution}`);
  }
  const selectedPath = path.join(OUT_DIR, 'P1-01_EXECUTION-SELECTED-PF01.png');
  await page.screenshot({ path: selectedPath, fullPage: false });

  await page.evaluate(() => {
    window.__knouxLifecycleTransitions = [];
    const stage = document.querySelector('.knoux-workspace-stage');
    const record = () => {
      const status = stage?.getAttribute('data-execution') || 'missing';
      const executionBar = document.querySelector('.knoux-command-execution-bar');
      const executionText = executionBar?.textContent || '';
      const executionMatch = executionText.match(/\b[A-Z]{2}\d{2}\b/);
      const last = window.__knouxLifecycleTransitions[window.__knouxLifecycleTransitions.length - 1];
      if (!last || last.status !== status || last.executionToolId !== (executionMatch?.[0] || null)) {
        window.__knouxLifecycleTransitions.push({
          status,
          executionToolId: executionMatch?.[0] || null,
          atMs: Math.round(performance.now()),
        });
      }
    };
    record();
    const observer = new MutationObserver(record);
    if (stage) observer.observe(stage, { attributes: true, attributeFilter: ['data-execution'], subtree: true, childList: true });
    window.__knouxLifecycleObserver = observer;
  });

  const analyzeClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.knoux-tool-workspace button'));
    const analyze = buttons.find(button => (button.textContent || '').trim() === 'Analyze');
    if (!analyze || analyze.disabled) return false;
    analyze.click();
    return true;
  });
  if (!analyzeClicked) throw new Error('Lifecycle proof could not start PF01 Analyze through the real ToolWorkspace control.');

  await page.waitForFunction(
    () => document.querySelector('.knoux-workspace-stage')?.getAttribute('data-execution') === 'running',
    { timeout: 10_000, polling: 20 }
  );

  const runningState = await inspectExecutionLifecycle(page);
  if (runningState.executionToolId !== 'PF01' || runningState.stageExecution !== 'running') {
    throw new Error(`Running proof lost PF01 ownership: ${JSON.stringify(runningState)}`);
  }
  const runningPath = path.join(OUT_DIR, 'P1-02_EXECUTION-RUNNING-PF01.png');
  await page.screenshot({ path: runningPath, fullPage: false });

  const alternateSelected = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.knoux-tool-card'));
    const alternate = cards.find(card => /\bPF02\b/.test(card.textContent || ''));
    if (!alternate) return false;
    alternate.click();
    return true;
  });
  if (!alternateSelected) throw new Error('Lifecycle proof could not select PF02 while PF01 was executing.');

  await page.waitForFunction(
    () => {
      const stage = document.querySelector('.knoux-workspace-stage');
      const workspace = document.querySelector('.knoux-tool-workspace');
      const executionBar = document.querySelector('.knoux-command-execution-bar');
      return stage?.getAttribute('data-execution') === 'running'
        && /\bPF02\b/.test(workspace?.textContent || '')
        && /\bPF01\b/.test(executionBar?.textContent || '');
    },
    { timeout: 5_000, polling: 20 }
  );

  const ownershipState = await inspectExecutionLifecycle(page);
  if (ownershipState.selectedToolId !== 'PF02' || ownershipState.executionToolId !== 'PF01') {
    throw new Error(`Selected-vs-running ownership proof failed: ${JSON.stringify(ownershipState)}`);
  }
  const ownershipPath = path.join(OUT_DIR, 'P1-03_EXECUTION-PF02-SELECTED-PF01-RUNNING.png');
  await page.screenshot({ path: ownershipPath, fullPage: false });

  await page.waitForFunction(
    terminalStates => terminalStates.includes(document.querySelector('.knoux-workspace-stage')?.getAttribute('data-execution') || ''),
    { timeout: 90_000, polling: 100 },
    Array.from(TERMINAL_EXECUTION_STATES)
  );

  const terminalWhileBrowsing = await inspectExecutionLifecycle(page);
  if (!TERMINAL_EXECUTION_STATES.has(terminalWhileBrowsing.stageExecution)) {
    throw new Error(`PF01 did not reach a real terminal state: ${JSON.stringify(terminalWhileBrowsing)}`);
  }
  if (terminalWhileBrowsing.executionToolId !== 'PF01') {
    throw new Error(`PF01 terminal result lost canonical execution ownership: ${JSON.stringify(terminalWhileBrowsing)}`);
  }

  const pf01Reselected = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.knoux-tool-card'));
    const card = cards.find(item => /\bPF01\b/.test(item.textContent || ''));
    if (!card) return false;
    card.click();
    return true;
  });
  if (!pf01Reselected) throw new Error('Lifecycle proof could not reselect PF01 for terminal evidence.');

  await page.waitForFunction(
    () => /\bPF01\b/.test(document.querySelector('.knoux-tool-workspace')?.textContent || ''),
    { timeout: 5_000, polling: 20 }
  );

  const terminalState = await inspectExecutionLifecycle(page);
  const transitions = terminalState.transitions;
  if (!transitions.some(item => item.status === 'running' && item.executionToolId === 'PF01')) {
    throw new Error(`Lifecycle transition log never observed PF01 running: ${JSON.stringify(transitions)}`);
  }
  if (!transitions.some(item => TERMINAL_EXECUTION_STATES.has(item.status) && item.executionToolId === 'PF01')) {
    throw new Error(`Lifecycle transition log never observed a PF01 terminal result: ${JSON.stringify(transitions)}`);
  }

  const terminalPath = path.join(OUT_DIR, `P1-04_EXECUTION-TERMINAL-PF01-${terminalState.stageExecution.toUpperCase()}.png`);
  await page.screenshot({ path: terminalPath, fullPage: false });

  await page.evaluate(() => {
    window.__knouxLifecycleObserver?.disconnect?.();
  });

  const lifecycleEvidence = {
    generatedAt: new Date().toISOString(),
    url,
    source: 'real-tool-workspace-and-loopback-bridge',
    tool: {
      toolId: 'PF01',
      expectedRisk: 'READ_ONLY',
      mode: 'analyze',
    },
    alternateSelectionToolId: 'PF02',
    selectedState,
    runningState,
    ownershipState,
    terminalWhileBrowsing,
    terminalState,
    screenshots: [
      path.basename(selectedPath),
      path.basename(runningPath),
      path.basename(ownershipPath),
      path.basename(terminalPath),
    ],
    consoleErrors,
    pageErrors,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'P1-execution-lifecycle.json'), JSON.stringify(lifecycleEvidence, null, 2));
  if (pageErrors.length > 0) throw new Error(`Lifecycle proof produced ${pageErrors.length} page error(s).`);
  console.log(`Captured real execution lifecycle for PF01 -> ${terminalState.stageExecution}; ownership preserved while PF02 selected.`);
  await page.close();
  return lifecycleEvidence;
}

async function main() {
  const gateway = launchGateway();
  let browser;
  const evidence = [];
  let executionLifecycle = null;
  try {
    await waitForGateway();
    console.log(`Gateway ready at ${ORIGIN}`);
    browser = await puppeteer.launch({ executablePath: findEdge(), headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

    for (const target of targets) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 });
      if (target.lang) {
        await page.evaluateOnNewDocument(nextLang => {
          try { localStorage.setItem('knoux-lang', nextLang); } catch { /* origin initializes on navigation */ }
        }, target.lang);
      }
      const url = `${ORIGIN}/?view=${target.view}&nosplash=1${target.query || ''}`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 });

      if (target.requireWorkspace) {
        let workspace = await page.waitForSelector('.knoux-tool-workspace', { timeout: 8_000 }).catch(() => null);
        if (!workspace) {
          const firstCard = await page.waitForSelector('.knoux-tool-card', { timeout: 5_000 }).catch(() => null);
          if (firstCard) {
            await firstCard.click();
            workspace = await page.waitForSelector('.knoux-tool-workspace', { timeout: 8_000 }).catch(() => null);
          }
        }
      }

      if (target.requireAccount) await page.waitForSelector('.knoux-account-center', { timeout: 8_000 });
      await new Promise(resolve => setTimeout(resolve, 900));
      const selectors = await inspectPage(page, target);

      if (target.scrollSelector) {
        await page.evaluate(selector => document.querySelector(selector)?.scrollIntoView({ block: 'start', behavior: 'instant' }), target.scrollSelector);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const destination = path.join(OUT_DIR, target.name);
      await page.screenshot({ path: destination, fullPage: false });
      const stat = fs.statSync(destination);
      evidence.push({ name: target.name, url, viewport: { width: target.width, height: target.height }, lang: target.lang || 'en', scrollSelector: target.scrollSelector || null, selectors, consoleErrors, pageErrors, bytes: stat.size });
      console.log(`Captured ${target.name} (${stat.size} bytes, console errors=${consoleErrors.length}, page errors=${pageErrors.length})`);
      await page.close();
    }

    executionLifecycle = await captureRealExecutionLifecycle(browser);

    const reportPath = path.join(OUT_DIR, 'visual-evidence.json');
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), origin: ORIGIN, evidence, executionLifecycle }, null, 2));
    const pageErrorCount = evidence.reduce((sum, item) => sum + item.pageErrors.length, 0) + (executionLifecycle?.pageErrors?.length || 0);
    if (pageErrorCount > 0) throw new Error(`Rendered preview produced ${pageErrorCount} page error(s). See visual-evidence.json.`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopGateway(gateway);
  }
}

main().catch(error => { console.error('Fatal visual evidence error:', error); process.exit(1); });