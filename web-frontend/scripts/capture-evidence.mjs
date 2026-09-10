import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT_DIR = 'D:\\Knoux Dashboards\\Knoux Repair\\03-Build\\visual-evidence';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const targets = [
  {
    name: 'P0-01_AI-SCAN-START.png',
    url: 'http://127.0.0.1:4173/?view=ai-scan&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-02_SYSTEM-VITALITY.png',
    url: 'http://127.0.0.1:4173/?view=vitality&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-03_RECOVERY-STORAGE.png',
    url: 'http://127.0.0.1:4173/?view=recovery&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-04_ASSURANCE.png',
    url: 'http://127.0.0.1:4173/?view=assurance&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-05_SOFTWARE-LIBRARY.png',
    url: 'http://127.0.0.1:4173/?view=software&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-06_ENGINEERING-WORKBENCH.png',
    url: 'http://127.0.0.1:4173/?view=workbench&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-07_INVESTIGATION.png',
    url: 'http://127.0.0.1:4173/?view=investigation&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-08_ACTION-CENTER.png',
    url: 'http://127.0.0.1:4173/?view=action-center&nosplash=1',
    width: 1280,
    height: 800
  },
  {
    name: 'P0-09_CANONICAL-COMPACT-DESKTOP.png',
    url: 'http://127.0.0.1:4173/?view=vitality&nosplash=1',
    width: 1024,
    height: 700
  },
  {
    name: 'P0-10_UNIVERSAL-TOOL-WORKSPACE.png',
    url: 'http://127.0.0.1:4173/?view=vitality&service=01-System-Maintenance&tool=SM01&nosplash=1',
    width: 1280,
    height: 800
  }
];

async function main() {
  console.log('Launching browser with puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  for (const item of targets) {
    console.log(`Navigating to ${item.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: item.width, height: item.height, deviceScaleFactor: 1 });
    await page.goto(item.url, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Give animations a moment to settle
    await new Promise(r => setTimeout(r, 1200));

    const dest = path.join(OUT_DIR, item.name);
    await page.screenshot({ path: dest, fullPage: false });
    const stat = fs.statSync(dest);
    console.log(`✓ Captured ${item.name} (${stat.size} bytes)`);
    await page.close();
  }

  await browser.close();
  console.log('All screenshots successfully generated in', OUT_DIR);
}

main().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});
