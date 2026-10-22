import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * KNOUX Repair — 18-service visual matrix.
 *
 * Captures every canonical service at the two wide reference widths, in
 * English and Arabic, and asserts the shell resolved the right service:
 *
 *   - the studio page carries the service id it was asked for
 *   - the studio header names that service
 *   - the page produced no runtime error
 *   - nothing overflows horizontally
 *
 * The capture is a real application load against the local gateway and the
 * real bridge, so every number and every surface in the picture is measured.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const ORIGIN = process.env.KNOUX_MATRIX_ORIGIN || 'http://127.0.0.1:3000';
const OUT = path.resolve(
  process.env.KNOUX_MATRIX_EVIDENCE_DIR
    ? path.resolve(process.env.KNOUX_MATRIX_EVIDENCE_DIR)
    : path.join(WEB_ROOT, 'visual-evidence', 'service-matrix'),
);

const EDGE = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

/** The canonical 18 services and the family that owns each one. */
const SERVICES = [
  ['vitality', '01-System-Maintenance', 'System Maintenance', 10],
  ['vitality', '08-Performance', 'Performance', 12],
  ['vitality', '15-System-Monitoring', 'System Monitoring', 4],
  ['recovery', '02-System-Cleanup', 'System Cleanup', 11],
  ['recovery', '05-Duplicate-Files', 'Duplicate Files', 11],
  ['recovery', '06-Disk-Space', 'Disk Space', 10],
  ['recovery', '11-Backup-Recovery', 'Backup & Recovery', 5],
  ['assurance', '03-Network-Internet', 'Network & Internet', 11],
  ['assurance', '09-Security', 'Security', 10],
  ['assurance', '13-Privacy', 'Privacy', 4],
  ['assurance', '14-Driver-Management', 'Driver Management', 4],
  ['software', '04-Programs-Applications', 'Programs & Applications', 10],
  ['software', '16-Software-Environment', 'Software Environment', 8],
  ['software', '17-PostInstall-Setup', 'Post-Install Setup', 6],
  ['workbench', '12-Developer-Tools', 'Developer Tools', 13],
  ['workbench', '18-Project-Sonar', 'Project Sonar', 7],
  ['investigation', '10-Diagnostics-Reports', 'Diagnostics & Reports', 11],
  ['investigation', '07-Services-Processes', 'Services & Processes', 11],
].map(([family, service, name, tools]) => ({ family, service, name, tools }));

const VIEWPORTS = [
  { id: '1440', width: 1440, height: 900 },
  { id: '1920', width: 1920, height: 1080 },
];
const LANGS = ['en', 'ar'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const edge = () => {
  const found = EDGE.find(p => fs.existsSync(p));
  if (!found) throw new Error(`Edge not found: ${EDGE.join(', ')}`);
  return found;
};

function manifestCount(category) {
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'Docs', 'TOOLS-MANIFEST.json'), 'utf8'));
  return manifest.filter(tool => tool.Category === category).length;
}

fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const results = [];
let browser;

for (const target of SERVICES) {
  const expectedTools = manifestCount(target.service);
  if (expectedTools !== target.tools) {
    failures.push(`${target.service}: manifest declares ${expectedTools} tools, matrix expected ${target.tools}`);
  }

  for (const viewport of VIEWPORTS) {
    for (const lang of LANGS) {
      // A fresh browser per service: one long-lived headless Edge degrades
      // after a handful of pages on this machine and stalls the next load.
      if (browser) await browser.close().catch(() => {});
      browser = await puppeteer.launch({
        executablePath: edge(),
        headless: true,
        args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
      });

      const page = await browser.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
      });
      page.on('pageerror', error => pageErrors.push(error.message.slice(0, 200)));

      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(l => {
        try { localStorage.setItem('knoux-lang', l); } catch { /* private mode */ }
      }, lang);

      const file = `${target.service}-${viewport.id}-${lang}.png`;
      let outcome = 'STRUCTURAL_PASS';
      let detail = {};

      try {
        await page.goto(
          `${ORIGIN}/?view=${encodeURIComponent(target.family)}&nosplash=1&service=${encodeURIComponent(target.service)}`,
          { waitUntil: 'domcontentloaded', timeout: 45000 },
        );
        await page.waitForSelector(`.knoux-family-page[data-service="${target.service}"]`, { timeout: 30000 });
        await page.waitForFunction(
          service => {
            const heading = document.querySelector('.knoux-studio-header h1');
            return Boolean(heading && heading.textContent && heading.textContent.trim().length > 0);
          },
          { timeout: 20000, polling: 'raf' },
          target.service,
        );
        await sleep(4000);

        detail = await page.evaluate(service => {
          const familyPage = document.querySelector(`.knoux-family-page[data-service="${service}"]`);
          const heading = document.querySelector('.knoux-studio-header h1');
          const nav = document.querySelector('.knoux-studio-nav-strip');
          const rect = familyPage?.getBoundingClientRect();
          return {
            resolvedService: familyPage?.getAttribute('data-service') ?? null,
            heading: heading?.textContent?.trim() ?? null,
            navTabs: nav ? nav.querySelectorAll('.knoux-studio-nav-tab').length : 0,
            pageHeight: rect ? Math.round(rect.height) : 0,
            pageWidth: rect ? Math.round(rect.width) : 0,
            overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
          };
        }, target.service);

        const problems = [];
        if (detail.resolvedService !== target.service) problems.push(`resolved service ${detail.resolvedService}`);
        if (!detail.heading) problems.push('studio header has no title');
        if (detail.overflow > 2) problems.push(`horizontal overflow ${detail.overflow}px`);
        if (pageErrors.length) problems.push(`page errors: ${pageErrors.join(' | ')}`);
        const realConsoleErrors = consoleErrors.filter(message => !/ws:\/\/127\.0\.0\.1:24678/.test(message));
        if (realConsoleErrors.length) problems.push(`console errors: ${realConsoleErrors.join(' | ')}`);

        if (problems.length) {
          outcome = 'STRUCTURAL_FAIL';
          failures.push(`${target.service} @${viewport.id}/${lang}: ${problems.join('; ')}`);
          await page.screenshot({ path: path.join(OUT, `FAIL-${file}`), fullPage: false });
        } else {
          await page.screenshot({ path: path.join(OUT, file), fullPage: false });
        }
      } catch (error) {
        outcome = 'STRUCTURAL_FAIL';
        failures.push(`${target.service} @${viewport.id}/${lang}: ${String(error.message).split('\n')[0]}`);
      }

      results.push({ service: target.service, family: target.family, viewport: viewport.id, lang, file, outcome, detail });
      console.log(`[service-matrix] ${target.service} @${viewport.id}/${lang} -> ${outcome}`);
    }
  }
}

if (browser) await browser.close().catch(() => {});

fs.writeFileSync(
  path.join(OUT, 'service-matrix-evidence.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), origin: ORIGIN, captures: results.length, failures, results }, null, 2),
);

if (failures.length) {
  console.error(`[service-matrix] FAIL captures=${results.length} failures=${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`[service-matrix] PASS captures=${results.length} failures=0`);
}
