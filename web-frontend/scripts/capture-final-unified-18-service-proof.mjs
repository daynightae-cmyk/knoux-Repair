import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_FINAL_UNIFIED_PORT || 3006);
const ORIGIN = `http://${HOST}:${PORT}`;
const ROOT_OUT = process.env.KNOUX_VISUAL_EVIDENCE_DIR
  ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR)
  : path.resolve('visual-evidence');
const OUT = path.join(ROOT_OUT, 'final-unified-18-services');
const EDGE = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const ROUTES = [
  { family: 'vitality', service: '01-System-Maintenance', name: 'System Maintenance', surface: '.knoux-stage-service-app' },
  { family: 'vitality', service: '08-Performance', name: 'Performance', surface: '.knoux-stage-service-app' },
  { family: 'vitality', service: '15-System-Monitoring', name: 'System Monitoring', surface: '.knoux-stage-service-app' },
  { family: 'recovery', service: '02-System-Cleanup', name: 'System Cleanup', surface: '.knoux-stage-service-app' },
  { family: 'recovery', service: '05-Duplicate-Files', name: 'Duplicate Files', surface: '.duplicate-studio-root' },
  { family: 'recovery', service: '06-Disk-Space', name: 'Disk Space', surface: '.knoux-stage-service-app' },
  { family: 'recovery', service: '11-Backup-Recovery', name: 'Backup & Recovery', surface: '.knoux-stage-service-app' },
  { family: 'assurance', service: '03-Network-Internet', name: 'Network & Internet', surface: '.knoux-stage-service-app' },
  { family: 'assurance', service: '09-Security', name: 'Security', surface: '.knoux-stage-service-app' },
  { family: 'assurance', service: '13-Privacy', name: 'Privacy', surface: '.knoux-stage-service-app' },
  { family: 'assurance', service: '14-Driver-Management', name: 'Driver Management', surface: '.knoux-stage-service-app' },
  { family: 'software', service: '04-Programs-Applications', name: 'Programs & Applications', surface: '.programs-station' },
  { family: 'software', service: '16-Software-Environment', name: 'Software Environment', surface: '.software-station-root' },
  { family: 'software', service: '17-PostInstall-Setup', name: 'Post-Install Setup', surface: '.post-install-station-root' },
  { family: 'workbench', service: '12-Developer-Tools', name: 'Developer Tools', surface: '.developer-station-root', workbench: true },
  { family: 'workbench', service: '18-Project-Sonar', name: 'Project Sonar', surface: '.project-sonar-station-root', workbench: true },
  { family: 'investigation', service: '10-Diagnostics-Reports', name: 'Diagnostics & Reports', surface: '.knoux-stage-service-app' },
  { family: 'investigation', service: '07-Services-Processes', name: 'Services & Processes', surface: '.knoux-station-workspace' },
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function findEdge() {
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
  child.stdout?.on('data', chunk => process.stdout.write(`[final-unified] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[final-unified] ${chunk}`));
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

async function waitForGateway(timeoutMs = 45_000) {
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
  throw new Error(`Final unified gateway not ready: ${last}`);
}

async function navigateRoute(page, target) {
  const url = `${ORIGIN}/?view=${encodeURIComponent(target.family)}&nosplash=1&service=${encodeURIComponent(target.service)}`;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const timeout = error?.name === 'TimeoutError' || /Navigation timeout/i.test(message);
      if (!timeout) throw error;

      let committed = false;
      try {
        if (page.url().startsWith(ORIGIN)) {
          const readyState = await page.evaluate(() => document.readyState);
          committed = readyState === 'interactive' || readyState === 'complete' || Boolean(await page.$('body'));
        }
      } catch {}

      if (committed) break;
      if (attempt === 2) throw error;
      try { await page.goto('about:blank', { waitUntil: 'load', timeout: 5_000 }); } catch {}
      await delay(750);
    }
  }
  if (lastError && !page.url().startsWith(ORIGIN)) throw lastError;

  await page.waitForSelector(`.knoux-family-page[data-service="${target.service}"]`, { visible: true, timeout: 20_000 });
  await page.waitForSelector(target.surface, { visible: true, timeout: 20_000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await delay(250);
}

async function inspectRoute(page, target) {
  return page.evaluate(({ target }) => {
    const visible = node => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > .05
        && rect.width > 2
        && rect.height > 2;
    };

    const root = document.querySelector(`.knoux-family-page[data-service="${target.service}"]`);
    const surface = document.querySelector(target.surface);
    const serviceRail = document.querySelector('.knoux-command-service-rail');
    const toolRail = document.querySelector('.knoux-command-tool-rail');
    const sentinel = document.querySelector('.knoux-sentinel');
    const controls = [...(root?.querySelectorAll('button,input,select,textarea,[role="tab"],[role="button"],a[href]') || [])]
      .filter(visible);

    const clippedControls = controls
      .filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .map(node => {
        const text = (node.textContent || node.getAttribute('aria-label') || node.getAttribute('title') || node.tagName)
          .replace(/\s+/g, ' ')
          .trim();
        return text.slice(0, 100);
      });

    const surfaceRect = surface instanceof HTMLElement ? surface.getBoundingClientRect() : null;
    const rootRect = root instanceof HTMLElement ? root.getBoundingClientRect() : null;
    const pageOverflow = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ) - innerWidth;

    return {
      familyService: root?.getAttribute('data-service') || null,
      family: root?.getAttribute('data-family') || null,
      rootVisible: visible(root),
      surfaceVisible: visible(surface),
      serviceRailVisible: visible(serviceRail),
      toolRailVisible: visible(toolRail),
      sentinelVisible: visible(sentinel),
      pageOverflow,
      clippedControls,
      visibleControlCount: controls.length,
      surfaceRect: surfaceRect ? {
        left: Math.round(surfaceRect.left),
        right: Math.round(surfaceRect.right),
        top: Math.round(surfaceRect.top),
        width: Math.round(surfaceRect.width),
        height: Math.round(surfaceRect.height),
      } : null,
      rootRect: rootRect ? {
        left: Math.round(rootRect.left),
        right: Math.round(rootRect.right),
        width: Math.round(rootRect.width),
      } : null,
    };
  }, { target });
}

fs.mkdirSync(OUT, { recursive: true });
let gateway;
let browser;
const results = [];

try {
  gateway = startGateway();
  await waitForGateway();

  browser = await puppeteer.launch({
    executablePath: findEdge(),
    headless: true,
    args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
  });

  for (let index = 0; index < ROUTES.length; index += 1) {
    const target = ROUTES[index];
    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('knoux-lang', 'en'); } catch {}
    });

    await navigateRoute(page, target);
    const proof = await inspectRoute(page, target);

    if (proof.familyService !== target.service) throw new Error(`${target.service}: route identity mismatch ${proof.familyService}`);
    if (proof.family !== target.family) throw new Error(`${target.service}: family mismatch ${proof.family}`);
    if (!proof.rootVisible || !proof.surfaceVisible) throw new Error(`${target.service}: canonical surface is not visible`);
    if (!target.workbench && !proof.serviceRailVisible) throw new Error(`${target.service}: family service rail is missing`);
    if (target.workbench && proof.serviceRailVisible) throw new Error(`${target.service}: outer service rail must remain absent in Engineering workbench`);
    if (proof.toolRailVisible) throw new Error(`${target.service}: duplicate outer ACTIONS rail is visible`);
    if (proof.sentinelVisible) throw new Error(`${target.service}: duplicate outer Sentinel is visible`);
    if (proof.pageOverflow > 2) throw new Error(`${target.service}: horizontal page overflow=${proof.pageOverflow}px`);
    if (proof.clippedControls.length) throw new Error(`${target.service}: clipped controls: ${proof.clippedControls.join(' | ')}`);
    if (!proof.surfaceRect || proof.surfaceRect.width < 420) throw new Error(`${target.service}: canonical surface width is too small`);
    if (proof.surfaceRect.left < -1 || proof.surfaceRect.right > 1367) {
      throw new Error(`${target.service}: canonical surface extends outside viewport: ${JSON.stringify(proof.surfaceRect)}`);
    }
    if (pageErrors.length) throw new Error(`${target.service}: page errors: ${pageErrors.join(' | ')}`);

    const unexpectedConsoleErrors = consoleErrors.filter(message =>
      !/status of 503\s*\(Service Unavailable\)/i.test(message)
      && !/net::ERR_CONNECTION_(?:RESET|REFUSED)/i.test(message)
    );
    if (unexpectedConsoleErrors.length) {
      throw new Error(`${target.service}: unexpected console errors: ${unexpectedConsoleErrors.join(' | ')}`);
    }

    const screenshot = `${String(index + 1).padStart(2, '0')}-${target.service}-1366.png`;
    await page.screenshot({ path: path.join(OUT, screenshot), fullPage: false });
    results.push({
      ...target,
      ...proof,
      pageErrors,
      expectedTransportConsoleErrors: consoleErrors.length - unexpectedConsoleErrors.length,
      screenshot,
      execution: 'not-started',
    });

    console.log(`Final unified proof ${index + 1}/18: ${target.service}; controls=${proof.visibleControlCount}; overflow=${proof.pageOverflow}; clipped=${proof.clippedControls.length}`);
    await page.close();
  }

  const families = new Set(results.map(item => item.family));
  if (results.length !== 18) throw new Error(`Expected 18 final service proofs, got ${results.length}`);
  if (families.size !== 6) throw new Error(`Expected 6 families in final proof, got ${families.size}`);

  const payload = {
    generatedAt: new Date().toISOString(),
    viewport: { width: 1366, height: 768 },
    verifiedFamilies: families.size,
    verifiedServices: results.length,
    execution: 'not-started',
    failures: [],
    results,
  };
  fs.writeFileSync(path.join(OUT, 'final-unified-18-service-proof.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Final unified proof complete: ${results.length} services across ${families.size} families; zero destructive actions executed.`);
} finally {
  await browser?.close().catch(() => {});
  await stopGateway(gateway);
}
