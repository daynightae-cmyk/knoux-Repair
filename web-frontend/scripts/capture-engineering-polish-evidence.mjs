import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_ENGINEERING_EVIDENCE_PORT || 3004);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT = path.join(
  process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence'),
  'engineering-polish',
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
  child.stdout?.on('data', chunk => process.stdout.write(`[engineering-evidence] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[engineering-evidence] ${chunk}`));
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
  throw new Error(`Engineering evidence gateway not ready: ${last}`);
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

      console.warn(`[engineering-evidence] ${label}: navigation lifecycle timeout on attempt ${attempt}; committed=${committed}; readyState=${readyState}`);
      if (committed) return;

      try { await page.goto('about:blank', { waitUntil: 'load', timeout: 5_000 }); } catch {}
      await delay(750);
    }
  }
  throw lastError;
}

async function openRoute(page, service, selector) {
  const url = `${ORIGIN}/?view=workbench&nosplash=1&service=${encodeURIComponent(service)}`;
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
    const normalizedLabel = label.replace(/\s+/g, ' ').trim();
    const target = buttons.find(node => {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text === normalizedLabel) return true;
      if (!text.startsWith(normalizedLabel)) return false;
      const suffix = text.slice(normalizedLabel.length).trim();
      return /^\d+$/.test(suffix);
    });
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

async function scrollTo(page, selector, block = 'center') {
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 });
  await page.$eval(
    selector,
    (node, requestedBlock) => node.scrollIntoView({ block: requestedBlock, inline: 'nearest' }),
    block,
  );
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

  // Developer Tools: reveal the canonical station catalog only. No tool is executed.
  await openRoute(page, '12-Developer-Tools', '.developer-station-root');
  await clickButtonByText(page, '.developer-station-root', 'All Dev Tools');
  await page.waitForSelector('.developer-tool-grid', { visible: true, timeout: 20_000 });
  const developerCards = await page.$$eval('.developer-tool-card', nodes => nodes.length);
  if (developerCards < 13) throw new Error(`Developer Tools: expected 13 tool cards, found ${developerCards}`);
  const developerChrome = await page.evaluate(() => {
    const visible = selector => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05 && rect.width > 20 && rect.height > 20;
    };
    return { explorer: visible('.knoux-deck-explorer'), runState: visible('.knoux-deck-side') };
  });
  if (!developerChrome.explorer || !developerChrome.runState) {
    throw new Error(`Developer Tools: engineering chrome missing explorer=${developerChrome.explorer} runState=${developerChrome.runState}`);
  }
  await scrollTo(page, '.developer-tool-grid');
  const developerProof = await assertSurface(page, '.developer-station-root', 'Developer Tools action cards');
  await page.screenshot({ path: path.join(OUT, '01-developer-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '12-Developer-Tools', view: 'all-dev-tools', cards: developerCards, chrome: developerChrome, proof: developerProof, execution: 'not-started' });

  // Project Sonar: reveal Sonar Tools only. No Analyze, WhatIf, or Execute action is triggered.
  await openRoute(page, '18-Project-Sonar', '.project-sonar-station-root');
  await clickButtonByText(page, '.project-sonar-station-root', 'Sonar Tools');
  await page.waitForSelector('.project-sonar-station-root .tools-list-grid', { visible: true, timeout: 20_000 });
  const sonarCards = await page.$eval('.project-sonar-station-root .sonar-tool-grid .sonar-tool-card', nodes => nodes.length);
  if (sonarCards < 7) throw new Error(`Project Sonar: expected 7 tool cards, found ${sonarCards}`);
  const sonarLayout = await page.evaluate(() => {
    const grid = document.querySelector('.sonar-tool-grid');
    const cards = [...document.querySelectorAll('.sonar-tool-card')].filter(node => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 2 && rect.height > 2;
    });
    const rects = cards.map(node => node.getBoundingClientRect());
    const firstTop = rects[0]?.top ?? -9999;
    const firstRowCount = rects.filter(rect => Math.abs(rect.top - firstTop) <= 4).length;
    const gridStyle = grid instanceof HTMLElement ? getComputedStyle(grid) : null;
    return {
      display: gridStyle?.display || 'missing',
      columns: gridStyle?.gridTemplateColumns || 'none',
      firstRowCount,
      minCardWidth: rects.length ? Math.min(...rects.map(rect => rect.width)) : 0,
      minCardHeight: rects.length ? Math.min(...rects.map(rect => rect.height)) : 0,
    };
  });
  if (sonarLayout.display !== 'grid') throw new Error(`Project Sonar: expected CSS grid, got ${sonarLayout.display}`);
  if (sonarLayout.firstRowCount < 2) throw new Error(`Project Sonar: expected two desktop cards in first row, got ${sonarLayout.firstRowCount}`);
  if (sonarLayout.minCardWidth < 250 || sonarLayout.minCardHeight < 120) {
    throw new Error(`Project Sonar: card geometry too small width=${sonarLayout.minCardWidth} height=${sonarLayout.minCardHeight}`);
  }
  const sonarChrome = await page.evaluate(() => {
    const visible = selector => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05 && rect.width > 20 && rect.height > 20;
    };
    return { explorer: visible('.knoux-deck-explorer'), runState: visible('.knoux-deck-side') };
  });
  if (!sonarChrome.explorer || !sonarChrome.runState) {
    throw new Error(`Project Sonar: engineering chrome missing explorer=${sonarChrome.explorer} runState=${sonarChrome.runState}`);
  }
  await scrollTo(page, '.project-sonar-station-root .tools-list-grid');
  const sonarProof = await assertSurface(page, '.project-sonar-station-root', 'Project Sonar tool cards');
  await page.screenshot({ path: path.join(OUT, '02-project-sonar-tool-cards-1366.png'), fullPage: false });
  evidence.push({ service: '18-Project-Sonar', view: 'sonar-tools', cards: sonarCards, layout: sonarLayout, chrome: sonarChrome, proof: sonarProof, execution: 'not-started' });

  fs.writeFileSync(
    path.join(OUT, 'engineering-polish-evidence.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2),
  );
  console.log(`Engineering polish evidence captured: ${evidence.length} surfaces.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
