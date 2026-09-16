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

const targets = [
  { name: '02-developer-tools-operational.png', width: 1366, height: 768 },
  { name: '02B-developer-tools-operational-1440.png', width: 1440, height: 900 },
];

fs.mkdirSync(OUT_DIR, { recursive: true });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

async function readOperationalLayout(page) {
  return page.evaluate(() => {
    const visible = element => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const box = element.getBoundingClientRect();
      return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
    };
    const workbench = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"]');
    const hero = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-hero');
    const serviceRail = document.querySelector('.knoux-command-center[data-family="workbench"] > .knoux-command-service-rail');
    const toolRail = document.querySelector('.knoux-command-center[data-family="workbench"][data-service="12-Developer-Tools"] > .knoux-command-tool-rail');
    const sentinel = document.querySelector('.knoux-body[data-workbench-operational="true"] > .knoux-sentinel');
    const outerTabs = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] > .knoux-deck-tabs');
    const deckServices = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] > .knoux-deck-services');
    const deckStrip = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] > .knoux-deck-strip');
    const toolIds = [...document.querySelectorAll('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-explorer__tool-id')];
    return {
      direction: document.querySelector('.knoux-shell')?.getAttribute('dir') || document.documentElement.getAttribute('dir') || '',
      workbenchVisible: visible(workbench),
      developerStationVisible: visible(document.querySelector('.service-app-embedded--developerTools .developer-station-root')),
      explorer: rect('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-explorer'),
      center: rect('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-center'),
      context: rect('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-side'),
      hero: rect('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-hero'),
      serviceRailVisible: visible(serviceRail),
      toolRailVisible: visible(toolRail),
      sentinelVisible: visible(sentinel),
      outerTabsVisible: visible(outerTabs),
      deckServicesVisible: visible(deckServices),
      deckStripVisible: visible(deckStrip),
      visibleToolIds: toolIds.filter(visible).length,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

function assertOperationalLayout(layout, target) {
  if (!layout.workbenchVisible) throw new Error(`${target.name}: Engineering Workbench did not render.`);
  if (!layout.developerStationVisible) throw new Error(`${target.name}: canonical DeveloperStation did not render in the center.`);
  if (!layout.explorer || !layout.center) throw new Error(`${target.name}: Explorer/center workspace zones are missing.`);
  if (layout.serviceRailVisible) throw new Error(`${target.name}: duplicate family service rail is still visible.`);
  if (layout.toolRailVisible) throw new Error(`${target.name}: duplicate generic ACTIONS rail is still visible.`);
  if (layout.sentinelVisible) throw new Error(`${target.name}: global Sentinel still consumes operational Workbench width.`);
  if (layout.outerTabsVisible) throw new Error(`${target.name}: duplicate outer Workbench tabs are still visible above DeveloperStation tabs.`);
  if (layout.deckServicesVisible || layout.deckStripVisible) throw new Error(`${target.name}: family-scale service/tool deck is visible in operational mode.`);
  if (layout.visibleToolIds !== 0) throw new Error(`${target.name}: ToolIds are visible as primary Explorer labels.`);
  if (!layout.hero || layout.hero.height > 60) throw new Error(`${target.name}: operational command strip is too tall (${layout.hero?.height ?? 'missing'}px).`);
  if (layout.center.width <= layout.explorer.width) throw new Error(`${target.name}: center (${layout.center.width}px) does not dominate Explorer (${layout.explorer.width}px).`);
  if (layout.context && layout.center.width <= layout.context.width) throw new Error(`${target.name}: center (${layout.center.width}px) does not dominate context (${layout.context.width}px).`);
  if (layout.pageScrollWidth > layout.viewportWidth + 1) throw new Error(`${target.name}: horizontal page overflow ${layout.pageScrollWidth}px > ${layout.viewportWidth}px.`);
}

async function captureTarget(browser, target) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('knoux-lang', 'en'); } catch { /* origin initializes on navigation */ }
  });

  const url = `${ORIGIN}/?view=workbench&nosplash=1&service=12-Developer-Tools`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('.knoux-engineering-workbench[data-operational="true"][data-service-id="12-Developer-Tools"]', { timeout: 20_000 });
  await page.waitForSelector('.service-app-embedded--developerTools .developer-station-root', { timeout: 30_000 });
  await page.waitForSelector('.knoux-deck-explorer', { timeout: 15_000 });
  await page.waitForSelector('.knoux-deck-center', { timeout: 15_000 });
  await page.waitForFunction(() => {
    const center = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-center');
    const explorer = document.querySelector('.knoux-engineering-workbench[data-service-id="12-Developer-Tools"] .knoux-deck-explorer');
    if (!(center instanceof HTMLElement) || !(explorer instanceof HTMLElement)) return false;
    return center.getBoundingClientRect().width > explorer.getBoundingClientRect().width;
  }, { timeout: 15_000, polling: 100 });

  const layout = await readOperationalLayout(page);
  assertOperationalLayout(layout, target);
  if (pageErrors.length > 0) throw new Error(`${target.name}: rendered page produced errors: ${pageErrors.join(' | ')}`);

  const destination = path.join(OUT_DIR, target.name);
  await page.screenshot({ path: destination, fullPage: false });
  const bytes = fs.statSync(destination).size;
  console.log(`Captured ${target.name} (${bytes} bytes, console errors=${consoleErrors.length}, page errors=${pageErrors.length})`);
  await page.close();
  return { name: target.name, url, viewport: { width: target.width, height: target.height }, layout, consoleErrors, pageErrors, bytes };
}

async function main() {
  const gateway = launchGateway();
  let browser;
  try {
    await waitForGateway();
    console.log(`Gateway ready at ${ORIGIN}`);
    browser = await puppeteer.launch({
      executablePath: findEdge(),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    const evidence = [];
    for (const target of targets) evidence.push(await captureTarget(browser, target));
    fs.writeFileSync(path.join(OUT_DIR, 'round1-developer-evidence.json'), JSON.stringify({ generatedAt: new Date().toISOString(), origin: ORIGIN, evidence }, null, 2));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopGateway(gateway);
  }
}

main().catch(error => { console.error('Fatal Round 1 Developer visual evidence error:', error); process.exit(1); });
