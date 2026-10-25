import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN = 'http://127.0.0.1:3000';
const OUT = path.resolve('visual-evidence/studio-shell');
fs.mkdirSync(OUT, { recursive: true });
const edge = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].filter(p => fs.existsSync(p))[0];

const T = [
  ['home-command', null, null, null, 1366, 768, 'en'],
  ['home-command-1440', null, null, null, 1440, 900, 'en'],
  ['home-command-rtl', null, null, null, 1366, 768, 'ar'],
  ['software-applications', 'software', null, 'applications', 1366, 768, 'en'],
  ['software-runtime', 'software', null, 'runtime', 1366, 768, 'en'],
  ['software-setup', 'software', null, 'setup', 1366, 768, 'en'],
  ['software-maintenance', 'software', null, 'maintenance', 1366, 768, 'en'],
  ['software-applications-rtl', 'software', null, 'applications', 1366, 768, 'ar'],
  ['vitality-studio', 'vitality', '01-System-Maintenance', null, 1366, 768, 'en'],
  ['recovery-studio', 'recovery', '06-Disk-Space', null, 1366, 768, 'en'],
  ['assurance-studio', 'assurance', '09-Security', null, 1366, 768, 'en'],
  ['investigation-studio', 'investigation', '10-Diagnostics-Reports', null, 1366, 768, 'en'],
  ['workbench-studio', 'workbench', '12-Developer-Tools', null, 1366, 768, 'en'],
];

const results = [];
for (const [id, view, service, workspace, w, h, lang] of T) {
  const b = await puppeteer.launch({ executablePath: edge, headless: true, args: ['--disable-gpu', '--no-first-run'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await p.setViewport({ width: w, height: h });
  await p.evaluateOnNewDocument(l => { try { localStorage.setItem('knoux-lang', l); } catch {} }, lang);
  const url = view ? `${ORIGIN}/?view=${view}&nosplash=1${service ? `&service=${service}` : ''}` : `${ORIGIN}/?view=home&nosplash=1`;
  let out = 'ok';
  try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch { out = 'goto failed'; }
  if (out === 'ok' && workspace) {
    try {
      await p.waitForSelector('.knoux-studio-nav-tab', { timeout: 15000 });
      const clicked = await p.evaluate(id => {
        const n = document.querySelector(`.knoux-studio-nav-tab[data-nav-id="${id}"]`);
        if (n) { n.click(); return true; }
        return false;
      }, workspace);
      if (!clicked) out = `workspace tab not found: ${workspace}`;
      else await new Promise(r => setTimeout(r, 11000));
    } catch { out = 'workspace failed'; }
  } else if (out === 'ok') {
    await new Promise(r => setTimeout(r, 3500));
  }
  const file = path.join(OUT, `${id}.png`);
  if (out === 'ok') await p.screenshot({ path: file, fullPage: false });
  const dom = out === 'ok' ? await p.evaluate(() => ({
    view: document.querySelector('.knoux-workspace[role="main"]')?.getAttribute('data-view'),
    text: (document.body?.innerText || '').length,
    studio: !!document.querySelector('.knoux-software-studio'),
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
    dir: document.documentElement.getAttribute('dir'),
  })) : null;
  console.log(JSON.stringify({ id, out, errs, dom, file: path.basename(file) }));
  results.push({ id, out, file });
  await b.close();
}
fs.writeFileSync(path.join(OUT, 'studio-shell-evidence.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log('DONE');
