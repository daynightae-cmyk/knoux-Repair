import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_VISUAL_PORT || 3000);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT_DIR = process.env.KNOUX_VISUAL_EVIDENCE_DIR ? path.resolve(process.env.KNOUX_VISUAL_EVIDENCE_DIR) : path.resolve('visual-evidence');
const EDGE_CANDIDATES = [process.env.EDGE_PATH, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean);
const target = { name: 'MISSION-02_PRIVATE-MCP-CENTER.png', width: 1440, height: 900, lang: 'en', requireMcp: true };
fs.mkdirSync(OUT_DIR, { recursive: true });

async function waitForGateway(timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Gateway did not become ready at ${ORIGIN}: ${lastError}`);
}

function launchGateway() {
  const common = { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(PORT), KNOUX_AUTH_REQUIRED: '0' } };
  const child = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm run dev'], common)
    : spawn('npm', ['run', 'dev'], common);
  child.stdout?.on('data', chunk => process.stdout.write(`[mission02-gateway] ${chunk}`));
  child.stderr?.on('data', chunk => process.stderr.write(`[mission02-gateway] ${chunk}`));
  return child;
}

async function stopGateway(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      killer.once('exit', resolve); killer.once('error', resolve);
    });
    return;
  }
  child.kill('SIGTERM');
}

function findEdge() {
  const edge = EDGE_CANDIDATES.find(candidate => fs.existsSync(candidate));
  if (!edge) throw new Error(`Microsoft Edge executable not found. Checked: ${EDGE_CANDIDATES.join(', ')}`);
  return edge;
}

async function main() {
  const gateway = launchGateway();
  let browser;
  try {
    await waitForGateway();
    browser = await puppeteer.launch({ executablePath: findEdge(), headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 });
    const url = `${ORIGIN}/?view=ai-scan&nosplash=1&mcp=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => localStorage.setItem('knoux-lang', 'en'));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.knoux-mcp-center', { timeout: 8000 });
    await new Promise(resolve => setTimeout(resolve, 900));
    const selectors = await page.evaluate(() => ({
      mcpCenter: Boolean(document.querySelector('.knoux-mcp-center')),
      proofStages: document.querySelectorAll('.knoux-mcp-stage').length,
      privateBadge: Boolean(document.querySelector('.knoux-mcp-private-badge')),
      direction: document.documentElement.getAttribute('dir') || document.body.getAttribute('dir') || '',
    }));
    if (target.requireMcp && !selectors.mcpCenter) throw new Error('Mission 02 MCP center did not render.');
    if (selectors.proofStages !== 5) throw new Error(`Mission 02 expected 5 proof stages, found ${selectors.proofStages}.`);
    if (!selectors.privateBadge) throw new Error('Mission 02 private-by-design badge is missing.');
    if (selectors.direction !== 'ltr') throw new Error(`Mission 02 English capture must render LTR, found ${selectors.direction || 'unset'}.`);
    const destination = path.join(OUT_DIR, target.name);
    await page.screenshot({ path: destination, fullPage: false });
    const evidence = { generatedAt: new Date().toISOString(), url, viewport: { width: target.width, height: target.height }, lang: target.lang, selectors, consoleErrors, pageErrors, bytes: fs.statSync(destination).size };
    fs.writeFileSync(path.join(OUT_DIR, 'mission02-evidence.json'), JSON.stringify(evidence, null, 2));
    if (pageErrors.length) throw new Error(`Mission 02 preview produced ${pageErrors.length} page error(s).`);
    console.log(`Captured ${target.name} (${evidence.bytes} bytes, console errors=${consoleErrors.length}, page errors=${pageErrors.length})`);
    await page.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopGateway(gateway);
  }
}

main().catch(error => { console.error('Fatal Mission 02 visual evidence error:', error); process.exit(1); });
