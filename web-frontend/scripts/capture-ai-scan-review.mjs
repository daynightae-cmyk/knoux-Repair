import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KNOUX_VISUAL_PORT || 3899);
const ORIGIN = `http://${HOST}:${PORT}`;
const OUT_DIR = 'C:\\Users\\day night\\.gemini\\antigravity\\brain\\0c7bf8a0-fbca-4d41-b209-706ed5b5531e';
const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const prefix = process.argv[2] || 'baseline';

const SIZES = [
  { name: `${prefix}-1536x1024.png`, width: 1536, height: 1024, lang: 'en' },
  { name: `${prefix}-1366x768.png`, width: 1366, height: 768, lang: 'en' },
  { name: `${prefix}-1920x1080.png`, width: 1920, height: 1080, lang: 'en' },
  { name: `${prefix}-rtl-1366x768.png`, width: 1366, height: 768, lang: 'ar' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getEdge = () => {
  const p = EDGE_CANDIDATES.find(fs.existsSync);
  if (!p) throw new Error(`Edge not found: ${EDGE_CANDIDATES.join(', ')}`);
  return p;
};

function startServer() {
  const o = {
    cwd: path.resolve('..'),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT), KNOUX_AUTH_REQUIRED: '0' },
  };
  const c = process.platform === 'win32'
    ? spawn(process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm run dev'], { cwd: process.cwd(), ...o })
    : spawn('npm', ['run', 'dev'], o);
  c.stdout?.on('data', d => process.stdout.write(`[dev] ${d}`));
  c.stderr?.on('data', d => process.stderr.write(`[dev] ${d}`));
  return c;
}

async function stopServer(c) {
  if (!c || c.killed) return;
  if (process.platform === 'win32' && c.pid) {
    await new Promise(r => {
      const k = spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { windowsHide: true });
      k.once('exit', r);
      k.once('error', r);
    });
    return;
  }
  c.kill('SIGTERM');
}

async function waitUntilReady() {
  const end = Date.now() + 45000;
  let lastErr = '';
  while (Date.now() < end) {
    try {
      const r = await fetch(`${ORIGIN}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return;
      lastErr = `HTTP ${r.status}`;
    } catch (x) {
      lastErr = x instanceof Error ? x.message : String(x);
    }
    await sleep(400);
  }
  throw new Error(`Server not ready: ${lastErr}`);
}

async function run() {
  console.log(`Starting server on port ${PORT}...`);
  const s = startServer();
  let browser;
  try {
    await waitUntilReady();
    console.log(`Server ready at ${ORIGIN}. Launching browser...`);
    browser = await puppeteer.launch({
      executablePath: getEdge(),
      headless: true,
      args: ['--disable-gpu', '--no-first-run', '--no-default-browser-check'],
    });

    for (const size of SIZES) {
      console.log(`Capturing ${size.name} (${size.width}x${size.height}, lang=${size.lang})...`);
      const page = await browser.newPage();
      await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(l => {
        try { localStorage.setItem('knoux-lang', l); } catch {}
      }, size.lang);

      await page.goto(`${ORIGIN}/?view=ai-scan&nosplash=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('.knoux-shell', { timeout: 20000 });
      await sleep(2500); // Wait for animations & bridge handshake
      const outPath = path.join(OUT_DIR, size.name);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved screenshot to ${outPath}`);
      await page.close();
    }
    console.log('Capture complete!');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopServer(s).catch(() => {});
  }
}

run().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
