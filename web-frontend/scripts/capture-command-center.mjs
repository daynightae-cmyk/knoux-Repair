/**
 * KNOUX Repair LAB — command-center runtime evidence capture.
 *
 * Uses the RUNNING lab servers (gateway 5173, bridge 8788). Never spawns
 * servers. Drives a separate headless Edge (own profile) so the shared
 * human preview tab is never disturbed. Serializes bridge runs (single slot).
 *
 * Usage: node scripts/capture-command-center.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const outDir = path.join(webRoot, 'visual-evidence-lab');
fs.mkdirSync(outDir, { recursive: true });
// Edge profile MUST live outside vite's watched tree (locked files crash it).
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-cc-profile-'));

const ORIGIN = process.env.KNOUX_CAPTURE_ORIGIN || 'http://127.0.0.1:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const VP = { width: 1920, height: 1080 };

const shot = (page, name) => page.screenshot({ path: path.join(outDir, name) });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const state = (page) => page.evaluate(() => ({
  head: document.querySelector('.cc-live-head')?.textContent?.replace(/\s+/g, ' ').slice(0, 120) || '',
  state: document.querySelector('.cc-live-state')?.textContent?.trim() || '',
  sel: document.querySelector('.cc-tool[data-selected="true"] .cc-tool-id')?.textContent || '',
  run: document.querySelector('.cc-tool[data-running="true"] .cc-tool-id')?.textContent || '',
  tools: document.querySelectorAll('.cc-tool').length,
  services: document.querySelectorAll('.cc-service').length,
  heroes: document.querySelectorAll('.knoux-hero').length,
  oldStage: document.querySelectorAll('.knoux-live-stage').length,
  stream: document.querySelectorAll('.cc-event-stream .ev').length,
  scrollY: window.scrollY,
}));

async function waitTools(page, timeoutMs = 45000) {
  await page.waitForFunction(() => document.querySelectorAll('.cc-tool').length > 0, { timeout: timeoutMs });
}

async function waitBridge(page, timeoutMs = 60000) {
  await page.waitForFunction(
    () => (document.querySelector('.cc-info-strip')?.textContent || '').includes('ONLINE'),
    { timeout: timeoutMs },
  );
}

async function clickTool(page, id) {
  await page.evaluate((toolId) => {
    const cards = [...document.querySelectorAll('.cc-tool')];
    const el = cards.find(c => c.querySelector('.cc-tool-id')?.textContent === toolId);
    if (el) el.click();
  }, id);
}

async function clickService(page, nameEn) {
  await page.evaluate((name) => {
    const mods = [...document.querySelectorAll('.cc-service')];
    const el = mods.find(m => m.querySelector('.cc-service-name')?.textContent === name);
    if (el) el.click();
  }, nameEn);
}

async function clickRun(page) {
  await page.evaluate(() => { document.querySelector('.cc-actions .cc-btn-primary')?.click(); });
}

async function waitState(page, want, timeoutMs = 90000) {
  await page.waitForFunction(
    (w) => (document.querySelector('.cc-live-state')?.textContent || '').includes(w),
    { timeout: timeoutMs }, want,
  );
}

const results = {};
async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--window-size=1920,1080', `--user-data-dir=${profileDir}`],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport(VP);

    // 1 — FAMILY IDLE (recovery): rails + standby center, no hero anywhere.
    await page.goto(`${ORIGIN}/?view=recovery&nosplash=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitTools(page);
    await sleep(1200);
    results.idle = await state(page);
    await shot(page, 'CC-01_FAMILY-IDLE.png');

    // 2 — SERVICE SWITCH in place: 06-Disk-Space. Center must persist, no scroll.
    await page.evaluate(() => { document.querySelector('.cc-live')?.setAttribute('data-probe', 'persist'); });
    await clickService(page, 'Disk Space');
    await sleep(1200);
    const svc = await state(page);
    const liveSame = await page.evaluate(() => document.querySelector('.cc-live')?.getAttribute('data-probe') === 'persist');
    results.serviceSwitch = { ...svc, centerPersisted: liveSame };
    await shot(page, 'CC-02_SERVICE-SWITCH.png');

    // 3 — SELECT DF01 (selection only, must NOT execute).
    await clickService(page, 'Duplicate Files');
    await sleep(800);
    await clickTool(page, 'DF01');
    await sleep(1200);
    results.selected = await state(page);
    await shot(page, 'CC-03_TOOL-SELECTED.png');

    // 4 — RUN DS01 (storage): running state + live stream.
    await clickService(page, 'Disk Space');
    await sleep(800);
    await clickTool(page, 'DS01');
    await sleep(800);
    await clickRun(page);
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('RUNNING'),
      { timeout: 30000 },
    );
    await sleep(2500);
    results.running = await state(page);
    await shot(page, 'CC-04_TOOL-RUNNING.png');

    // 5 — SELECTED vs RUNNING: start slow DF01, then select DS01 while it runs.
    // Center must stay pinned to DF01 (authoritative owner).
    await clickService(page, 'Duplicate Files');
    await sleep(800);
    await clickTool(page, 'DF01');
    await sleep(800);
    await clickRun(page);
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('RUNNING'),
      { timeout: 30000 },
    );
    await sleep(2000);
    await clickService(page, 'Disk Space');
    await sleep(800);
    await clickTool(page, 'DS01');
    await sleep(1200);
    results.pinned = await state(page);
    results.pinnedHead = await page.evaluate(() => document.querySelector('.cc-live-head')?.textContent?.replace(/\s+/g, ' ').slice(0, 130) || '');
    await shot(page, 'CC-05_PINNED-WHILE-RUNNING.png');

    // 6 — CANCEL DF01 mid-run via UI (still running: slow duplicate analyze).
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.cc-active-exec button')].find(x => x.textContent.includes('View live'));
      if (b) b.click();
    });
    await sleep(800);
    await page.evaluate(() => { document.querySelector('.cc-actions .cc-btn-danger')?.click(); });
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('CANCELLED'),
      { timeout: 30000 },
    ).catch(() => {});
    await sleep(800);
    results.cancelled = await state(page);
    await shot(page, 'CC-06_CANCELLED.png');

    // 7 — RESULT: run DS01 to completion, result owned by DS01.
    await clickService(page, 'Disk Space');
    await sleep(800);
    await clickTool(page, 'DS01');
    await sleep(800);
    await clickRun(page);
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('RUNNING'),
      { timeout: 30000 },
    );
    await waitState(page, 'SUCCESS', 240000).catch(() => {});
    await sleep(800);
    results.result = await state(page);
    results.resultTitle = await page.evaluate(() => document.querySelector('.cc-result-title')?.textContent?.slice(0, 120) || '');
    results.resultCells = await page.evaluate(() => [...document.querySelectorAll('.cc-result-cell')].map(c => c.textContent?.replace(/\s+/g, ' ').slice(0, 40)));
    await shot(page, 'CC-07_TOOL-RESULT.png');

    // 7b — LAST RESULT reachability: select DF02, then return via rail card.
    await clickService(page, 'Duplicate Files');
    await sleep(800);
    await clickTool(page, 'DF02');
    await sleep(1000);
    results.afterSelect = await state(page);
    results.lastResultCard = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.cc-active-exec')];
      const el = cards.find(c => c.textContent.includes('LAST RESULT') || c.textContent.includes('آخر نتيجة'));
      return el ? el.textContent.replace(/\s+/g, ' ').slice(0, 100) : '';
    });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.cc-active-exec')];
      const el = cards.find(c => c.textContent.includes('LAST RESULT') || c.textContent.includes('آخر نتيجة'));
      const btn = el?.querySelector('button');
      if (btn) btn.click();
    });
    await sleep(1000);
    results.backToResult = await state(page);
    results.backToResultTitle = await page.evaluate(() => document.querySelector('.cc-result-title')?.textContent?.slice(0, 120) || '');
    await shot(page, 'CC-07B_LAST-RESULT.png');

    // 8 — AI SCAN idle + 9 — real findings.
    await page.goto(`${ORIGIN}/?view=ai-scan&nosplash=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('STANDBY'),
      { timeout: 60000 },
    );
    await sleep(1500);
    results.aiIdle = await state(page);
    await shot(page, 'CC-08_AI-SCAN-IDLE.png');
    await page.waitForFunction(
      () => ![...document.querySelectorAll('.cc-actions .cc-btn')].every(b => b.disabled),
      { timeout: 90000 },
    );
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.cc-actions .cc-btn')];
      const start = btns.find(b => b.textContent.includes('Start AI Scan'));
      if (start) start.click();
    });
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('FINDINGS'),
      { timeout: 90000 },
    ).catch(() => {});
    await sleep(800);
    results.aiFindings = await state(page);
    results.aiFindingCount = await page.evaluate(() => document.querySelectorAll('.cc-tools .cc-tool').length);
    await shot(page, 'CC-09_AI-SCAN-FINDINGS.png');

    // 10 — RTL vitality.
    await page.evaluate(() => { try { localStorage.setItem('knoux-lang', 'ar'); } catch {} });
    await page.goto(`${ORIGIN}/?view=vitality&nosplash=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await waitTools(page);
    await sleep(1200);
    results.rtl = await state(page);
    results.rtlDir = await page.evaluate(() => document.querySelector('.knoux-cc')?.getAttribute('dir'));
    await shot(page, 'CC-10_RTL.png');
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(outDir, 'capture-report.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error('CAPTURE FAILED:', e); process.exit(1); });
