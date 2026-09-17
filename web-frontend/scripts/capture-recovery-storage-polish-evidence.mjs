import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_RECOVERY_EVIDENCE_PORT || 3001);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT = path.join(
  process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence'),
  'recovery-storage-polish',
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
  child.stdout?.on('data', chunk => process.stdout.write(`[recovery-evidence] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[recovery-evidence] ${chunk}`));
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
  throw new Error(`Recovery evidence gateway not ready: ${last}`);
}

async function openRoute(page, service, selector) {
  await page.goto(`${ORIGIN}/?view=recovery&nosplash=1&service=${encodeURIComponent(service)}`, {
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

  // Cleanup: preview only. This calls cleanupPreview and never executes a cleanup tool.
  await openRoute(page, '02-System-Cleanup', '.cleanup-station');
  await page.click('.cleanup-landing-primary-cta');
  await page.waitForSelector('.cleanup-group', { visible: true, timeout: 30_000 });
  const cleanupCards = await page.$$eval('.cleanup-group', nodes => nodes.length);
  if (cleanupCards < 3) throw new Error(`System Cleanup: expected real preview group cards, found ${cleanupCards}`);
  await scrollTo(page, '.cleanup-groups');
  const cleanupProof = await assertSurface(page, '.cleanup-station', 'System Cleanup preview groups');
  await page.screenshot({ path: path.join(OUT, '01-cleanup-preview-cards-1366.png'), fullPage: false });
  evidence.push({ service: '02-System-Cleanup', view: 'preview-groups', cards: cleanupCards, proof: cleanupProof, execution: 'preview-only' });

  // Duplicate Files: configuration surface only, no scan execution.
  await openRoute(page, '05-Duplicate-Files', '.duplicate-studio-root');
  await page.click('.duplicate-secondary-cta');
  await page.waitForSelector('.duplicate-scan-setup', { visible: true, timeout: 20_000 });
  const duplicateOptions = await page.$$eval('.duplicate-type-list button', nodes => nodes.length);
  if (duplicateOptions < 4) throw new Error(`Duplicate Files: expected scan type options, found ${duplicateOptions}`);
  await scrollTo(page, '.duplicate-scan-setup');
  const duplicateProof = await assertSurface(page, '.duplicate-studio-root', 'Duplicate Files scan configuration');
  await page.screenshot({ path: path.join(OUT, '02-duplicate-scan-config-1366.png'), fullPage: false });
  evidence.push({ service: '05-Duplicate-Files', view: 'scan-config', options: duplicateOptions, proof: duplicateProof, execution: 'not-started' });

  // Disk Space: reveal the canonical recovery action cards, do not execute any tool.
  await openRoute(page, '06-Disk-Space', '.disk-space-station');
  await clickButtonByText(page, '.disk-space-station', 'Recovery Actions');
  await page.waitForSelector('.disk-recovery-tool-grid', { visible: true, timeout: 20_000 });
  const diskCards = await page.$$eval('.disk-recovery-tool-card', nodes => nodes.length);
  if (diskCards < 4) throw new Error(`Disk Space: expected recovery action cards, found ${diskCards}`);
  await scrollTo(page, '.disk-recovery-tool-grid');
  const diskProof = await assertSurface(page, '.disk-space-station', 'Disk Space recovery actions');
  await page.screenshot({ path: path.join(OUT, '03-disk-recovery-action-cards-1366.png'), fullPage: false });
  evidence.push({ service: '06-Disk-Space', view: 'recovery-actions', cards: diskCards, proof: diskProof, execution: 'not-started' });

  // Backup & Recovery: reveal the canonical vault tools, do not execute any tool.
  await openRoute(page, '11-Backup-Recovery', '.recovery-vault-station');
  await clickButtonByText(page, '.recovery-vault-station', 'Recovery Tools');
  await page.waitForSelector('.recovery-tool-grid', { visible: true, timeout: 20_000 });
  const recoveryCards = await page.$$eval('.recovery-tool-card', nodes => nodes.length);
  if (recoveryCards < 4) throw new Error(`Backup & Recovery: expected recovery tool cards, found ${recoveryCards}`);
  await scrollTo(page, '.recovery-tool-grid');
  const recoveryProof = await assertSurface(page, '.recovery-vault-station', 'Backup & Recovery tool cards');
  await page.screenshot({ path: path.join(OUT, '04-backup-recovery-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '11-Backup-Recovery', view: 'recovery-tools', cards: recoveryCards, proof: recoveryProof, execution: 'not-started' });

  fs.writeFileSync(
    path.join(OUT, 'recovery-storage-polish-evidence.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2),
  );
  console.log(`Recovery & Storage polish evidence captured: ${evidence.length} surfaces.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
