import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_VITALITY_EVIDENCE_PORT || 3000);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT = path.join(
  process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence'),
  'system-vitality-polish',
);
const EDGE = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function edgePath() {
  const candidate = EDGE.find(value => fs.existsSync(value));
  if (!candidate) throw new Error(`Edge not found: ${EDGE.join(', ')}`);
  return candidate;
}

function startGateway() {
  const options = {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), KNOUX_AUTH_REQUIRED: '0' },
  };
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm run dev'], options)
    : spawn('npm', ['run', 'dev'], options);
  child.stdout?.on('data', chunk => process.stdout.write(`[vitality-evidence] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[vitality-evidence] ${chunk}`));
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

async function ready(timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(400);
  }
  throw new Error(`Vitality evidence gateway not ready: ${last}`);
}

async function clickStationTab(page, rootSelector, tabIndex, label) {
  const result = await page.evaluate(({ rootSelector, tabIndex }) => {
    const root = document.querySelector(rootSelector);
    if (!(root instanceof HTMLElement)) return { clicked: false, count: 0, text: '' };
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05 && rect.width > 2 && rect.height > 2;
    };
    const directButtons = node => [...node.children].filter(child => child instanceof HTMLButtonElement && visible(child));
    const tabStrip = [...root.children]
      .filter(node => node instanceof HTMLElement && visible(node))
      .find(node => directButtons(node).length >= 8);
    if (!(tabStrip instanceof HTMLElement)) return { clicked: false, count: 0, text: '' };
    const buttons = directButtons(tabStrip);
    const button = buttons[tabIndex];
    if (!(button instanceof HTMLButtonElement)) {
      return { clicked: false, count: buttons.length, text: buttons.map(node => (node.textContent || '').trim()).join(' | ') };
    }
    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    button.click();
    return { clicked: true, count: buttons.length, text };
  }, { rootSelector, tabIndex });
  if (!result.clicked) {
    throw new Error(`${label}: station tab ${tabIndex + 1} unavailable; tabs=${result.count}; labels=${result.text}`);
  }
  console.log(`${label}: opened station tab ${tabIndex + 1} (${result.text || 'unlabelled'}).`);
}

async function assertVisible(page, selector, label) {
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 });
  const proof = await page.evaluate(({ selector, label }) => {
    const root = document.querySelector(selector);
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05 && rect.width > 2 && rect.height > 2;
    };
    const controls = [...(root?.querySelectorAll('button,input,select,textarea,[role="tab"],[role="button"]') || [])].filter(visible);
    const clipped = controls.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    });
    return {
      visible: visible(root),
      width: root instanceof HTMLElement ? root.getBoundingClientRect().width : 0,
      text: (root?.textContent || '').replace(/\s+/g, ' '),
      clipped: clipped.map(node => (node.textContent || node.getAttribute('aria-label') || 'control').trim().slice(0, 80)),
      pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      label,
    };
  }, { selector, label });
  if (!proof.visible || proof.width < 500) throw new Error(`${label}: canonical station surface not visible`);
  if (proof.clipped.length) throw new Error(`${label}: clipped controls: ${proof.clipped.join(' | ')}`);
  if (proof.pageOverflow > 2) throw new Error(`${label}: horizontal page overflow=${proof.pageOverflow}px`);
  return proof;
}

async function openRoute(page, service, selector) {
  await page.goto(`${ORIGIN}/?view=vitality&nosplash=1&service=${encodeURIComponent(service)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForSelector(`.knoux-family-page[data-service="${service}"]`, { timeout: 20_000 });
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await delay(250);
}

async function frameMonitoringToolCards(page) {
  const framed = await page.evaluate(() => {
    const root = document.querySelector('.monitoring-observatory-station');
    if (!(root instanceof HTMLElement)) return false;
    const marker = [...root.querySelectorAll('p')]
      .find(node => /Category:\s*15-System-Monitoring/i.test((node.textContent || '').replace(/\s+/g, ' ')));
    const target = marker?.parentElement;
    if (!(target instanceof HTMLElement)) return false;
    target.scrollIntoView({ block: 'start', inline: 'nearest' });
    return true;
  });
  if (!framed) throw new Error('System Monitoring: could not frame the tool inventory for screenshot evidence');
  await delay(180);
  const visibleMarker = await page.evaluate(() => {
    const root = document.querySelector('.monitoring-observatory-station');
    const marker = root && [...root.querySelectorAll('p')]
      .find(node => /Category:\s*15-System-Monitoring/i.test((node.textContent || '').replace(/\s+/g, ' ')));
    if (!(marker instanceof HTMLElement)) return false;
    const rect = marker.getBoundingClientRect();
    return rect.top >= 0 && rect.top < innerHeight && rect.bottom > 0 && rect.bottom <= innerHeight;
  });
  if (!visibleMarker) throw new Error('System Monitoring: tool inventory marker is not visible in the final screenshot viewport');
}

fs.mkdirSync(OUT, { recursive: true });
let gateway;
let browser;
const evidence = [];
try {
  gateway = startGateway();
  await ready();
  browser = await puppeteer.launch({
    executablePath: edgePath(),
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('knoux-lang', 'en'); } catch {}
  });

  await openRoute(page, '01-System-Maintenance', '.care-center');
  const maintenance = await assertVisible(page, '.care-center', 'System Maintenance overview');
  const maintenanceCards = await page.$$eval('.care-group', nodes => nodes.length);
  if (maintenanceCards < 3) throw new Error(`System Maintenance: expected visible health groups, found ${maintenanceCards}`);
  await page.screenshot({ path: path.join(OUT, '01-system-maintenance-health-cards-1366.png'), fullPage: false });
  evidence.push({ service: '01-System-Maintenance', view: 'overview', cards: maintenanceCards, proof: maintenance });

  await openRoute(page, '08-Performance', '.performance-observatory-station');
  await clickStationTab(page, '.performance-observatory-station', 5, 'Performance Lab Actions');
  await delay(150);
  const performance = await assertVisible(page, '.performance-observatory-station', 'Performance Lab Actions');
  const performanceCards = await page.$$eval(".performance-observatory-station [class*='hover:border-rose-500']", nodes => nodes.length);
  if (performanceCards < 4) throw new Error(`Performance: expected four action cards, found ${performanceCards}`);
  await page.screenshot({ path: path.join(OUT, '02-performance-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '08-Performance', view: 'actions', cards: performanceCards, proof: performance });

  await openRoute(page, '15-System-Monitoring', '.monitoring-observatory-station');
  await clickStationTab(page, '.monitoring-observatory-station', 5, 'System Monitoring Tools');
  await delay(150);
  const monitoring = await assertVisible(page, '.monitoring-observatory-station', 'System Monitoring Tools');
  const monitoringText = await page.$eval('.monitoring-observatory-station', node => (node.textContent || '').replace(/\s+/g, ' '));
  const monitoringCards = await page.$$eval(".monitoring-observatory-station div[style*='repeat(auto-fit, minmax(320px, 1fr))'] > div", nodes => nodes.length);
  if (!/Category:\s*15-System-Monitoring/i.test(monitoringText)) throw new Error('System Monitoring: tool inventory did not become visible');
  if (monitoringCards < 4) throw new Error(`System Monitoring: expected four action cards, found ${monitoringCards}`);
  await frameMonitoringToolCards(page);
  await page.screenshot({ path: path.join(OUT, '03-monitoring-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '15-System-Monitoring', view: 'actions', cards: monitoringCards, proof: monitoring });

  fs.writeFileSync(path.join(OUT, 'system-vitality-polish-evidence.json'), JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2));
  console.log(`System Vitality polish evidence captured: ${evidence.length} surfaces.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
