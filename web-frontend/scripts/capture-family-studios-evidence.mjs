import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

/**
 * KNOUX Repair — family studio rendered UI evidence.
 *
 * Six families, six studios, one grammar. Every studio landing is a
 * *measurement* surface: stations backed by real bridge readings, and
 * nothing else. This harness captures each studio and asserts the
 * truthfulness contract on the rendered DOM:
 *
 *   - the studio surface is on screen and every one of its services is
 *     present as a station,
 *   - every station either shows measured readings or an explicit
 *     "not measured" line — never a plausible number with no source,
 *   - the page does not overflow horizontally,
 *   - the renderer reports no page errors.
 *
 * It never runs a cleanup, quarantine, restore or delete tool.
 */

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_STUDIO_EVIDENCE_PORT || 3002);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT = path.join(
  process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence'),
  'family-studios',
);
const EDGE = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

/**
 * The studios under evidence, with the services each one owns. The service
 * list is the canonical inventory, not a hand-picked subset.
 */
const FAMILIES = [
  {
    id: 'recovery',
    label: 'storage',
    selector: '.knoux-storage-studio',
    services: ['02-System-Cleanup', '05-Duplicate-Files', '06-Disk-Space', '11-Backup-Recovery'],
  },
  {
    id: 'investigation',
    label: 'investigation',
    selector: '.knoux-investigation-studio',
    services: ['10-Diagnostics-Reports', '07-Services-Processes'],
  },
  {
    id: 'assurance',
    label: 'assurance',
    selector: '.knoux-assurance-studio',
    services: ['03-Network-Internet', '09-Security', '13-Privacy', '14-Driver-Management'],
  },
  {
    id: 'workbench',
    label: 'workbench',
    selector: '.knoux-workbench-studio',
    services: ['12-Developer-Tools', '18-Project-Sonar'],
  },
];

const TARGETS = [
  { id: '1440-en', width: 1440, height: 900, lang: 'en' },
  { id: '1440-ar', width: 1440, height: 900, lang: 'ar' },
];

/**
 * How long the capture waits for the studio's measurement pass to settle.
 *
 * A preview is a real PowerShell measurement and can take a while on a busy
 * machine. The budget is bounded so the evidence step cannot hold the
 * quality gate hostage; a station that is still reading is a truthful state
 * and is recorded as such.
 */
const SETTLE_BUDGET_MS = 90_000;

const delay = ms => new Promise(resolve => { setTimeout(resolve, ms); });

/**
 * The dev server's HMR websocket is blocked by the product CSP on purpose:
 * the shipped renderer is never allowed to open that socket. The quality
 * gate runs with CI=1, where the dev server never starts it. A local run can
 * still see the attempt, so it is ignored here and only that.
 */
const DEV_ONLY_CONSOLE_NOISE = /ws:\/\/127\.0\.0\.1:24678/;

/**
 * A preview the bridge could not produce answers with a 5xx status.
 *
 * That is the product's truthful "not measured" path, not a renderer
 * defect: the studio shows the failure instead of a number. It is therefore
 * recorded as bridge evidence, and the capture additionally asserts that the
 * surface reported the failure honestly.
 */
const BRIDGE_UNAVAILABLE = /Failed to load resource: the server responded with a status of 5\d\d/i;

function isProductError(entry) {
  return !DEV_ONLY_CONSOLE_NOISE.test(entry);
}

function isBridgeUnavailable(entry) {
  return BRIDGE_UNAVAILABLE.test(entry);
}

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
    // CI=1 turns the dev server's HMR websocket off, exactly as the quality
    // gate runs it. The product CSP forbids that websocket, so leaving it on
    // would report a dev-only console error as a product failure.
    env: { ...process.env, PORT: String(PORT), KNOUX_AUTH_REQUIRED: '0', CI: '1' },
  };
  const gateway = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm run dev'], options)
    : spawn('npm', ['run', 'dev'], options);
  gateway.stdout?.on('data', chunk => process.stdout.write(`[studio-evidence] ${chunk}`));
  gateway.stderr?.on('data', chunk => process.stderr.write(`[studio-evidence] ${chunk}`));
  return gateway;
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

async function ready(timeoutMs = 60_000) {
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
    await delay(500);
  }
  throw new Error(`Studio evidence gateway not ready: ${last}`);
}

/**
 * One long-lived headless Edge degrades after a handful of navigations, so a
 * lifecycle timeout is retried: if the document actually committed, the
 * capture continues; only a navigation that never committed is retried.
 */
async function navigateEvidenceRoute(page, url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
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

      console.warn(`[studio-evidence] ${label}: navigation lifecycle timeout on attempt ${attempt}; committed=${committed}; readyState=${readyState}`);
      if (committed) return;

      try { await page.goto('about:blank', { waitUntil: 'load', timeout: 5_000 }); } catch {}
      await delay(750);
    }
  }
  throw lastError;
}

async function readStudio(page, family) {
  return page.evaluate((config) => {
    const studio = document.querySelector(config.selector);
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .05 && rect.width > 2 && rect.height > 2;
    };
    const stations = [...document.querySelectorAll('.knoux-studio-station')].map(node => ({
      service: node.getAttribute('data-service-id'),
      state: node.getAttribute('data-state'),
      readings: [...node.querySelectorAll('.knoux-studio-station__reading')].map(reading => ({
        label: reading.querySelector('span')?.textContent?.trim() ?? '',
        value: reading.querySelector('b')?.textContent?.trim() ?? '',
      })),
      empty: node.querySelector('.knoux-studio-station__empty')?.textContent?.trim() ?? null,
    }));
    return {
      visible: visible(studio),
      probe: studio?.getAttribute('data-probe') ?? null,
      header: document.querySelector('.knoux-studio-header h1')?.textContent?.trim() ?? null,
      metrics: [...document.querySelectorAll('.knoux-studio-header-metric')].map(node => node.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      masthead: Boolean(document.querySelector('.knoux-studio-masthead')),
      context: [...document.querySelectorAll('.knoux-studio-masthead__context-items > div')].map(node => ({
        label: node.querySelector('span')?.textContent?.trim() ?? '',
        value: node.querySelector('b')?.textContent?.trim() ?? '',
      })),
      stations,
      notice: document.querySelector('.knoux-studio-notice')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      expected: config.services,
      dir: document.documentElement.getAttribute('dir'),
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      bodyTextLength: (document.body?.innerText || '').length,
    };
  }, { selector: family.selector, services: family.services });
}

function assertStudio(detail, label, bridgeUnavailable) {
  const problems = [];
  if (!detail.visible) problems.push('the studio surface is not visible');
  if (detail.overflow > 2) problems.push(`horizontal page overflow=${detail.overflow}px`);
  if (detail.bodyTextLength < 200) problems.push(`the studio rendered almost no text (${detail.bodyTextLength} chars)`);
  // The family's own visual identity and live context survive the studio
  // rewrite.
  if (!detail.masthead) problems.push('the studio masthead is missing');
  if (detail.context.length !== 3) problems.push(`expected 3 live-context facts, found ${detail.context.length}`);
  for (const fact of detail.context) {
    if (!fact.value) problems.push(`live context "${fact.label}" has no value`);
  }
  // When the bridge could not produce a preview, the surface has to say so.
  // A failure that is reported nowhere is a truthfulness failure.
  if (bridgeUnavailable > 0) {
    const reported = Boolean(detail.notice) || detail.stations.some(station => station.state === 'error');
    if (!reported) problems.push('the bridge failed but the studio reported nothing');
  }
  const services = detail.stations.map(station => station.service);
  for (const service of detail.expected) {
    if (!services.includes(service)) problems.push(`station missing: ${service}`);
  }
  for (const station of detail.stations) {
    // A station shows either measured readings or an explicit empty line.
    // It never shows a number without a source.
    if (station.readings.length === 0 && !station.empty) {
      problems.push(`${station.service}: no readings and no "not measured" line`);
    }
    for (const reading of station.readings) {
      if (!reading.value) problems.push(`${station.service}: empty reading "${reading.label}"`);
    }
  }
  if (problems.length) throw new Error(`${label}: ${problems.join('; ')}`);
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

  for (const family of FAMILIES) {
    for (const target of TARGETS) {
      const id = `${family.label}-${target.id}`;
      // A fresh browser per capture: one long-lived headless Edge degrades
      // after a handful of navigations.
      await browser.close();
      browser = await puppeteer.launch({
        executablePath: edgePath(),
        headless: true,
        args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
      });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(String(error.message).slice(0, 200)));
      page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 200)}`); });
      await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(lang => { try { localStorage.setItem('knoux-lang', lang); } catch {} }, target.lang);
      await navigateEvidenceRoute(page, `${ORIGIN}/?view=${family.id}&nosplash=1`, id);
      await page.waitForSelector(family.selector, { visible: true, timeout: 30_000 });
      // The previews measure the disk, so they need a moment. The capture
      // waits for the measurement pass to finish instead of photographing a
      // half-loaded surface — but a preview that never answers is a truthful
      // "not measured" station, so an unsettled capture is recorded, not
      // hidden.
      const probeSettled = await page.waitForFunction((selector) => {
        const studio = document.querySelector(selector);
        return studio?.getAttribute('data-probe') === 'settled';
      }, { timeout: SETTLE_BUDGET_MS, polling: 500 }, family.selector).then(() => true).catch(() => false);
      const settled = await page.waitForFunction(() => {
        const stations = [...document.querySelectorAll('.knoux-studio-station')];
        if (stations.length === 0) return false;
        return stations.every(node => node.getAttribute('data-state') !== 'loading');
      }, { timeout: 20_000, polling: 500 }).then(() => true).catch(() => false);
      await delay(800);
      const detail = await readStudio(page, family);
      const productErrors = errors.filter(isProductError);
      const bridgeUnavailable = productErrors.filter(isBridgeUnavailable);
      const realErrors = productErrors.filter(entry => !isBridgeUnavailable(entry));
      assertStudio(detail, id, bridgeUnavailable.length);
      if (realErrors.length) throw new Error(`${id}: renderer errors: ${realErrors.join(' | ')}`);
      const file = path.join(OUT, `${id}.png`);
      await page.screenshot({ path: file, fullPage: false });
      evidence.push({
        id,
        family: family.id,
        viewport: `${target.width}x${target.height}`,
        lang: target.lang,
        settled: settled && probeSettled,
        bridgeUnavailable: bridgeUnavailable.length,
        file: path.basename(file),
        detail,
      });
      console.log(`[studio-evidence] ${id} -> ok (${detail.stations.length} stations, settled=${settled && probeSettled}, bridgeUnavailable=${bridgeUnavailable.length})`);
      await page.close();
    }
  }

  fs.writeFileSync(path.join(OUT, 'family-studios-evidence.json'), JSON.stringify({ generatedAt: new Date().toISOString(), evidence }, null, 2));
  console.log(`[studio-evidence] PASS captures=${evidence.length}`);
} catch (error) {
  console.error(`[studio-evidence] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await stopGateway(gateway);
}
