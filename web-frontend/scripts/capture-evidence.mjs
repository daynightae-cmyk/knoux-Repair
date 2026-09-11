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
  },
  { name: 'P0-11_RECOVERY-WIDE-1920.png', view: 'recovery', width: 1920, height: 1080 },
  { name: 'P0-12_RECOVERY-RTL.png', view: 'recovery', width: 1280, height: 800, lang: 'ar' },
];

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

async function waitForGateway(timeoutMs = 30_000) {
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
  const child = spawn(npmCommand(), ['run', 'dev'], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(PORT),
      KNOUX_AUTH_REQUIRED: '0',
    },
  });

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
    hero: Boolean(document.querySelector('.knoux-hero')),
    liveStage: Boolean(document.querySelector('.knoux-live-stage')),
    serviceCards: document.querySelectorAll('.knoux-service-card').length,
    toolCards: document.querySelectorAll('.knoux-tool-card').length,
    workspace: Boolean(document.querySelector('.knoux-tool-workspace')),
    direction: document.querySelector('.knoux-shell')?.getAttribute('dir') || document.documentElement.getAttribute('dir') || document.body.getAttribute('dir') || '',
  }));

  if (['vitality', 'recovery', 'assurance', 'software', 'workbench', 'investigation'].includes(target.view)) {
    if (!selectors.hero) throw new Error(`${target.name}: family hero is missing`);
    if (!selectors.liveStage) throw new Error(`${target.name}: live tool stage is missing`);
    if (selectors.serviceCards < 1) throw new Error(`${target.name}: service selector cards are missing`);
    if (!target.requireWorkspace && selectors.toolCards < 1) throw new Error(`${target.name}: selected service tool cards are missing`);
  }

  if (target.requireWorkspace && !selectors.workspace) {
    throw new Error(`${target.name}: selected tool did not transform the live stage into ToolWorkspace`);
  }

  if (target.lang === 'ar' && selectors.direction !== 'rtl') {
    throw new Error(`${target.name}: Arabic capture did not render RTL`);
  }

  return selectors;
}

async function main() {
  const gateway = launchGateway();
  let browser;
  const evidence = [];

  try {
    await waitForGateway();
    console.log(`Gateway ready at ${ORIGIN}`);

    browser = await puppeteer.launch({
      executablePath: findEdge(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    for (const target of targets) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', error => pageErrors.push(error.message));

      await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 });
      const url = `${ORIGIN}/?view=${target.view}&nosplash=1${target.query || ''}`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 45_000 });

      if (target.lang === 'ar') {
        await page.evaluate(() => localStorage.setItem('knoux-lang', 'ar'));
        await page.reload({ waitUntil: 'networkidle0', timeout: 45_000 });
      }

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

      await new Promise(resolve => setTimeout(resolve, 1200));
      const selectors = await inspectPage(page, target);
      const destination = path.join(OUT_DIR, target.name);
      await page.screenshot({ path: destination, fullPage: false });
      const stat = fs.statSync(destination);

      evidence.push({
        name: target.name,
        url,
        viewport: { width: target.width, height: target.height },
        lang: target.lang || 'en',
        selectors,
        consoleErrors,
        pageErrors,
        bytes: stat.size,
      });
      console.log(`Captured ${target.name} (${stat.size} bytes, console errors=${consoleErrors.length}, page errors=${pageErrors.length})`);
      await page.close();
    }

    const reportPath = path.join(OUT_DIR, 'visual-evidence.json');
    fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), origin: ORIGIN, evidence }, null, 2));

    const pageErrorCount = evidence.reduce((sum, item) => sum + item.pageErrors.length, 0);
    if (pageErrorCount > 0) {
      throw new Error(`Rendered preview produced ${pageErrorCount} page error(s). See visual-evidence.json.`);
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopGateway(gateway);
  }
}

main().catch(error => {
  console.error('Fatal visual evidence error:', error);
  process.exit(1);
});
