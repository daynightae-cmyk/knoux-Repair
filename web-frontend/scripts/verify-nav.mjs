/** LAB: verify canonical navigation — finding link + sidebar quick tool. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ORIGIN = process.env.KNOUX_CAPTURE_ORIGIN || 'http://127.0.0.1:3000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-nav-profile-'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--window-size=1920,1080', `--user-data-dir=${profileDir}`],
  });
  const out = {};
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`${ORIGIN}/?view=ai-scan&nosplash=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(
      () => ![...document.querySelectorAll('.cc-actions .cc-btn')].every(b => b.disabled),
      { timeout: 90000 },
    );
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.cc-actions .cc-btn')].find(x => x.textContent.includes('Start AI Scan'));
      if (b) b.click();
    });
    await page.waitForFunction(
      () => (document.querySelector('.cc-live-state')?.textContent || '').includes('FINDINGS'),
      { timeout: 120000 },
    );
    // Click first finding's OPEN pill.
    await page.evaluate(() => {
      const pills = [...document.querySelectorAll('.cc-tools .cc-pill')];
      const open = pills.find(p => p.textContent.includes('DS01') || p.textContent.includes('SC01') || p.textContent.includes('SE04') || p.textContent.includes('DM02'));
      if (open) open.click();
    });
    await sleep(1500);
    out.findingNav = await page.evaluate(() => ({
      head: document.querySelector('.cc-live-head')?.textContent?.replace(/\s+/g, ' ').slice(0, 130) || '',
      sel: document.querySelector('.cc-tool[data-selected="true"] .cc-tool-id')?.textContent || '',
    }));
    await page.screenshot({ path: 'visual-evidence-lab/CC-11_FINDING-NAV.png' });

    // Sidebar quick capability → real canonical tool.
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.knoux-rail-item')];
      const q = items.find(i => i.textContent.includes('Duplicate Detection'));
      if (q) q.click();
    });
    await sleep(1500);
    out.quickNav = await page.evaluate(() => ({
      head: document.querySelector('.cc-live-head')?.textContent?.replace(/\s+/g, ' ').slice(0, 130) || '',
      sel: document.querySelector('.cc-tool[data-selected="true"] .cc-tool-id')?.textContent || '',
    }));
    await page.screenshot({ path: 'visual-evidence-lab/CC-12_QUICK-NAV.png' });
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error('NAV TEST FAILED:', e); process.exit(1); });
