import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const home = read('src/components/pages/HomePage.tsx');
const context = read('src/components/pages/HomeContextPanel.tsx');
const css = read('src/components/pages/HomePage.css');
const app = read('src/App.tsx');
const rail = read('src/components/premium/LeftRail.tsx');
const topbar = read('src/components/premium/TopBar.tsx');

function pngSize(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('Home is the real post-entry default and remains reachable from shell navigation', () => {
  assert.match(app, /initialView[^\n]*\|\| 'home'/);
  assert.match(app, /<HomePage/);
  assert.match(app, /onHomeOpen=\{\(\) => handleRailSelect\('home'\)\}/);
  assert.match(rail, /id: 'home'/);
  assert.match(topbar, /aria-current=\{homeActive \? 'page'/);
});

test('Home exposes all six real families and routes interactions through application navigation', () => {
  assert.match(home, /FAMILIES\.filter/);
  for (const family of ['vitality', 'recovery', 'assurance', 'software', 'workbench', 'investigation']) {
    assert.match(home, new RegExp(`${family}`));
  }
  assert.match(home, /onClick=\{\(\) => onNavigate\(\{ family: family\.id \}\)\}/);
  assert.match(home, /HERO_ACTIONS\.map/);
  assert.match(home, /onClick=\{\(\) => onNavigate\(action\.destination\)\}/);
});

test('Home activity summary derives running state from activeTasks in English and Arabic', () => {
  assert.match(home, /activeTasks\.filter\(task => task\.status === 'running'\)\.length/);
  assert.match(home, /runningTaskCount === 0/);
  assert.match(home, /1 task is running\./);
  assert.match(home, /tasks are running\./);
  assert.match(home, /مهمة واحدة قيد التشغيل\./);
  assert.match(home, /مهمتان قيد التشغيل\./);
  assert.match(home, /<p>\{activitySummary\}<\/p>/);
});

test('Home context reports live props and does not fabricate bridge or evidence readiness', () => {
  assert.match(context, /bridgeOnline === true/);
  assert.match(context, /bridgeOnline === false/);
  assert.match(context, /systemSnapshot \?/);
  assert.match(context, /activeTasks\.filter/);
  assert.match(context, /Local bridge unavailable/);
  assert.match(context, /No scan results/);
  assert.match(app, /api\.aiModels\(\)/);
  assert.match(context, /UNCONFIGURED/);
  assert.match(context, /configured; live availability is verified on use/);
  assert.doesNotMatch(context, /bridgeOnline === true \? \(ar \? 'جاهز' : 'READY'\)/);
  assert.doesNotMatch(context, /Math\.random|mock|demo data/i);
});

test('Home visual asset is production-sized and referenced from the production brand path', () => {
  const asset = path.join(root, 'public/brand/knoux-home-core.png');
  assert.ok(fs.existsSync(asset));
  assert.deepEqual(pngSize(asset), { width: 1672, height: 941 });
  assert.match(home, /\/brand\/knoux-home-core\.png/);
  assert.match(css, /object-fit: cover/);
});

test('Home responds to narrow windows and reduced motion', () => {
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none/);
  assert.doesNotMatch(css, /overflow-x:\s*scroll/);
});

test('Home owns its truthful context panel without duplicating the global Sentinel panel', () => {
  assert.match(app, /activeView !== 'home' && !selectedToolId && <SentinelPanel/);
  assert.match(home, /<HomeContextPanel/);
});
