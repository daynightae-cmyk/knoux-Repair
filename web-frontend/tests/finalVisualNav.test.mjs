import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const read = p => fs.readFileSync(path.join(WEB_ROOT, p), 'utf8');

test('real navigation controls expose stable selectors (no test-only nav implementation)', () => {
  const rail = read('src/components/premium/LeftRail.tsx');
  assert.match(rail, /data-nav-view=\{item\.id\}/);
  const card = read('src/components/premium/ServiceCard.tsx');
  assert.match(card, /data-service-id=\{service\.id\}/);
  const topbar = read('src/components/premium/TopBar.tsx');
  assert.match(topbar, /data-nav-view="home"/);
  const overview = read('src/components/pages/FamilyOverviewPage.tsx');
  assert.match(overview, /data-service-id=\{service\.id\}/);
  const library = read('src/components/pages/SoftwareLibraryPage.tsx');
  assert.match(library, /data-service-id=\{service\.id\}/);
});

test('final visual proof gate reports structure only, never byte-size visual acceptance', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  assert.doesNotMatch(script, /VISUALLY_ACCEPTED/);
  assert.doesNotMatch(script, /VISUAL DEFECT FOUND/);
  assert.doesNotMatch(script, /bytes\s*<\s*80000/);
  assert.match(script, /STRUCTURAL_PASS/);
  assert.match(script, /SCREENSHOT_CAPTURED/);
  assert.match(script, /human.*VISUAL REVIEW|VISUAL REVIEW.*human/is);
});

test('navigation gate uses real in-app clicks, not URL navigation between steps', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  const gateStart = script.indexOf('async function navigationBlankGate');
  assert.ok(gateStart >= 0, 'navigationBlankGate must exist');
  const gate = script.slice(gateStart);
  const gotos = gate.match(/page\.goto\(/g) || [];
  assert.equal(gotos.length, 1, `navigation gate must contain exactly one initial page.goto (found ${gotos.length})`);
  assert.match(gate, /resolveClickSelector|page\.click\(/);
  assert.match(gate, /Execution context|contextEvents/);
  assert.doesNotMatch(gate, /evidence\.slice\(0,\s*10\)/);
  assert.match(script, /data-nav-view|data-service-id/);
});

test('final visual evidence uses one canonical directory (no duplicated copies)', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  assert.doesNotMatch(script, /ROOT_OUT/);
  assert.doesNotMatch(script, /copyFileSync/);
  assert.match(script, /final-visual/);
});

test('navigation blank proof tracks outgoing and incoming surfaces and treats shell loss as failure', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  assert.match(script, /currentSurfaceSelector/);
  assert.match(script, /outgoingVisible/);
  assert.match(script, /previousSurfaceSelector/);
  assert.match(script, /expectedSurfaceSelector/);
  assert.match(script, /application shell disappeared during in-app navigation/);
  assert.doesNotMatch(script, /if\s*\(!s\.shellVisible\)\s*return null/);
  assert.match(script, /s\.loaderVisible\s*\|\|\s*s\.outgoingVisible\s*\|\|\s*s\.expectedVisible/);
});

test('navigation evidence maps expectedExists from the existence field, not visibility', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  assert.match(script, /expectedExists:\s*last\.expectedExists/);
  assert.doesNotMatch(script, /expectedExists:\s*last\.expectedVisible/);
});

test('RTL proof inspects real Diagnostics and Services controls', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  assert.match(script, /\.diagnostic-evidence-station button/);
  assert.match(script, /\.services-topology-station button/);
  assert.match(script, /diagnosticControlCount/);
  assert.match(script, /servicesControlCount/);
  assert.match(script, /RTL Diagnostics inspected zero real station controls/);
});

test('FamilyPage station-owned action contract includes Services & Processes', () => {
  const familyPage = read('src/components/premium/FamilyPage.tsx');
  assert.match(familyPage, /STATION_OWNS_ACTIONS_IDS[\s\S]*'07-Services-Processes'/);
  assert.match(familyPage, /!hideGenericToolRail/);
});


test('Services & Processes has a real RTL capture so Services clipping checks execute', () => {
  const script = read('scripts/capture-final-visual-evidence.mjs');
  assert.match(script, /topologyRTL:\s*\{[\s\S]*service:\s*'07-Services-Processes'[\s\S]*rtl:\s*true/);
  assert.match(script, /12-system-topology-rtl-1366\.png/);
  assert.match(script, /captureOne\(browser,\s*'topologyRTL'\)/);
  assert.match(script, /target\.service === '07-Services-Processes'[\s\S]*servicesControlCount/);
});
