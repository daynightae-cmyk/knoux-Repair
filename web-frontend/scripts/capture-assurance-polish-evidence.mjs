import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_ASSURANCE_EVIDENCE_PORT || 3002);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT = path.join(
  process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence'),
  'assurance-polish',
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
  child.stdout?.on('data', chunk => process.stdout.write(`[assurance-evidence] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[assurance-evidence] ${chunk}`));
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
  throw new Error(`Assurance evidence gateway not ready: ${last}`);
}

async function openRoute(page, service, selector) {
  await page.goto(`${ORIGIN}/?view=assurance&nosplash=1&service=${encodeURIComponent(service)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForSelector(`.knoux-family-page[data-service="${service}"]`, { timeout: 20_000 });
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await delay(250);
}

async function clickButtonByText(page, rootSelector, label) {
  const result = await page.evaluate(({ rootSelector, label }) => {
    const root = document.querySelector(rootSelector);
    if (!(root instanceof HTMLElement)) return { clicked: false, labels: [] };
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05 && rect.width > 2 && rect.height > 2;
    };
    const buttons = [...root.querySelectorAll('button')].filter(visible);
    const target = buttons.find(node => (node.textContent || '').replace(/\s+/g, ' ').trim() === label);
    if (!(target instanceof HTMLButtonElement)) {
      return { clicked: false, labels: buttons.map(node => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean) };
    }
    target.click();
    return { clicked: true, labels: [] };
  }, { rootSelector, label });
  if (!result.clicked) throw new Error(`${rootSelector}: button "${label}" not found; visible=${result.labels.join(' | ')}`);
}

async function assertSurface(page, selector, label) {
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
      label,
      visible: visible(root),
      width: root instanceof HTMLElement ? root.getBoundingClientRect().width : 0,
      clipped: clipped.map(node => (node.textContent || node.getAttribute('aria-label') || 'control').trim().slice(0, 90)),
      pageOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    };
  }, { selector, label });
  if (!proof.visible || proof.width < 500) throw new Error(`${label}: station surface not visible`);
  if (proof.clipped.length) throw new Error(`${label}: clipped controls: ${proof.clipped.join(' | ')}`);
  if (proof.pageOverflow > 2) throw new Error(`${label}: horizontal page overflow=${proof.pageOverflow}px`);
  return proof;
}

async function scrollTo(page, selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 });
  await page.$eval(selector, node => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await delay(150);
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

  // Network: reveal the canonical Operations catalog only. No operation is executed.
  await openRoute(page, '03-Network-Internet', '.network-station');
  await clickButtonByText(page, '.network-station', 'Operations');
  await page.waitForSelector('.network-ops', { visible: true, timeout: 20_000 });
  const networkCards = await page.$$eval('.network-op', nodes => nodes.length);
  if (networkCards < 11) throw new Error(`Network: expected 11 operation cards, found ${networkCards}`);
  await scrollTo(page, '.network-ops');
  const networkProof = await assertSurface(page, '.network-station', 'Network operation cards');
  await page.screenshot({ path: path.join(OUT, '01-network-operation-cards-1366.png'), fullPage: false });
  evidence.push({ service: '03-Network-Internet', view: 'operations', cards: networkCards, proof: networkProof, execution: 'not-started' });

  // Security: reveal the protected Security Actions catalog only.
  await openRoute(page, '09-Security', '.security-evidence-station');
  await clickButtonByText(page, '.security-evidence-station', 'Security Actions');
  await page.waitForSelector('.security-tool-grid', { visible: true, timeout: 20_000 });
  const securityCards = await page.$$eval('.security-tool-card', nodes => nodes.length);
  if (securityCards < 10) throw new Error(`Security: expected 10 action cards, found ${securityCards}`);
  await scrollTo(page, '.security-tool-grid');
  const securityProof = await assertSurface(page, '.security-evidence-station', 'Security action cards');
  await page.screenshot({ path: path.join(OUT, '02-security-action-cards-1366.png'), fullPage: false });
  evidence.push({ service: '09-Security', view: 'security-actions', cards: securityCards, proof: securityProof, execution: 'not-started' });

  // Privacy: reveal the station catalog only. Analyze/Execute buttons are never clicked.
  await openRoute(page, '13-Privacy', '.privacy-control-station');
  await clickButtonByText(page, '.privacy-control-station', 'Privacy Tools');
  await page.waitForSelector('.privacy-tool-grid', { visible: true, timeout: 20_000 });
  const privacyCards = await page.$$eval('.privacy-tool-card', nodes => nodes.length);
  if (privacyCards < 4) throw new Error(`Privacy: expected 4 tool cards, found ${privacyCards}`);
  await scrollTo(page, '.privacy-tool-grid');
  const privacyProof = await assertSurface(page, '.privacy-control-station', 'Privacy tool cards');
  await page.screenshot({ path: path.join(OUT, '03-privacy-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '13-Privacy', view: 'privacy-tools', cards: privacyCards, proof: privacyProof, execution: 'not-started' });

  // Driver Management: reveal the station catalog only. No driver operation is executed.
  await openRoute(page, '14-Driver-Management', '.driver-matrix-station');
  await clickButtonByText(page, '.driver-matrix-station', 'Driver Tools');
  await page.waitForSelector('.driver-tool-grid', { visible: true, timeout: 20_000 });
  const driverCards = await page.$$eval('.driver-tool-card', nodes => nodes.length);
  if (driverCards < 4) throw new Error(`Driver Management: expected 4 tool cards, found ${driverCards}`);
  await scrollTo(page, '.driver-tool-grid');
  const driverProof = await assertSurface(page, '.driver-matrix-station', 'Driver tool cards');
  await page.screenshot({ path: path.join(OUT, '04-driver-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '14-Driver-Management', view: 'driver-tools', cards: driverCards, proof: driverProof, execution: 'not-started' });

  fs.writeFileSync(
    path.join(OUT, 'assurance-polish-evidence.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2),
  );
  console.log(`Assurance polish evidence captured: ${evidence.length} surfaces.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
