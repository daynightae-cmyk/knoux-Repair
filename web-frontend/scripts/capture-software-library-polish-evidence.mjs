import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_SOFTWARE_EVIDENCE_PORT || 3003);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT = path.join(
  process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence'),
  'software-library-polish',
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
  child.stdout?.on('data', chunk => process.stdout.write(`[software-evidence] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[software-evidence] ${chunk}`));
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
  throw new Error(`Software Library evidence gateway not ready: ${last}`);
}

async function navigateEvidenceRoute(page, url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isNavigationTimeout = error?.name === 'TimeoutError' || /Navigation timeout/i.test(message);
      if (!isNavigationTimeout) throw error;

      let committed = false;
      let readyState = 'unavailable';
      try {
        const currentUrl = page.url();
        if (currentUrl.startsWith(ORIGIN)) {
          readyState = await page.evaluate(() => document.readyState);
          committed = readyState === 'interactive' || readyState === 'complete' || Boolean(await page.$('body'));
        }
      } catch {}

      console.warn(`[software-evidence] ${label}: navigation lifecycle timeout on attempt ${attempt}; committed=${committed}; readyState=${readyState}`);
      if (committed) return;

      try { await page.goto('about:blank', { waitUntil: 'load', timeout: 5_000 }); } catch {}
      await delay(750);
    }
  }
  throw lastError;
}

async function openRoute(page, service, selector) {
  const url = `${ORIGIN}/?view=software&nosplash=1&service=${encodeURIComponent(service)}`;
  await navigateEvidenceRoute(page, url, service);
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

  // Programs & Applications: open the repair catalog only. No repair is executed.
  await openRoute(page, '04-Programs-Applications', '.programs-station');
  await clickButtonByText(page, '.programs-station', 'Repair & Re-register');
  await page.waitForSelector('.program-repair-grid', { visible: true, timeout: 20_000 });
  const programCards = await page.$$eval('.program-repair-card', nodes => nodes.length);
  if (programCards < 2) throw new Error(`Programs: expected 2 repair cards, found ${programCards}`);
  await scrollTo(page, '.program-repair-grid');
  const programsProof = await assertSurface(page, '.programs-station', 'Programs repair cards');
  await page.screenshot({ path: path.join(OUT, '01-programs-repair-cards-1366.png'), fullPage: false });
  evidence.push({ service: '04-Programs-Applications', view: 'repair', cards: programCards, proof: programsProof, execution: 'not-started' });

  // Software Environment: reveal Station Tools only. No Analyze, WhatIf, or Execute button is clicked.
  await openRoute(page, '16-Software-Environment', '.software-station-root');
  await clickButtonByText(page, '.software-station-root', 'Station Tools');
  await page.waitForSelector('.software-station-root .tools-list-grid', { visible: true, timeout: 20_000 });
  const softwareCards = await page.$$eval('.software-station-root .tools-list-grid .tool-card', nodes => nodes.length);
  if (softwareCards < 8) throw new Error(`Software Environment: expected 8 tool cards, found ${softwareCards}`);
  await scrollTo(page, '.software-station-root .tools-list-grid');
  const softwareProof = await assertSurface(page, '.software-station-root', 'Software Environment tool cards');
  await page.screenshot({ path: path.join(OUT, '02-software-environment-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '16-Software-Environment', view: 'station-tools', cards: softwareCards, proof: softwareProof, execution: 'not-started' });

  // Post-Install: reveal Provisioning Tools only. No provisioning action is executed.
  await openRoute(page, '17-PostInstall-Setup', '.post-install-station-root');
  await clickButtonByText(page, '.post-install-station-root', 'Provisioning Tools');
  await page.waitForSelector('.post-install-station-root .tools-list-grid', { visible: true, timeout: 20_000 });
  const postInstallCards = await page.$$eval('.post-install-station-root .tools-list-grid .tool-card', nodes => nodes.length);
  if (postInstallCards < 6) throw new Error(`Post-Install: expected 6 provisioning tool cards, found ${postInstallCards}`);
  await scrollTo(page, '.post-install-station-root .tools-list-grid');
  const postInstallProof = await assertSurface(page, '.post-install-station-root', 'Post-Install provisioning tool cards');
  await page.screenshot({ path: path.join(OUT, '03-post-install-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '17-PostInstall-Setup', view: 'provisioning-tools', cards: postInstallCards, proof: postInstallProof, execution: 'not-started' });

  fs.writeFileSync(
    path.join(OUT, 'software-library-polish-evidence.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2),
  );
  console.log(`Software Library polish evidence captured: ${evidence.length} surfaces.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
