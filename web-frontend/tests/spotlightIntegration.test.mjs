import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(here, p), 'utf8');

const assurance = read('../src/components/premium/AssuranceSpotlight.tsx');
const recovery = read('../src/components/premium/RecoverySpotlight.tsx');
const software = read('../src/components/premium/SoftwareSpotlight.tsx');
const overview = read('../src/components/pages/FamilyOverviewPage.tsx');
const library = read('../src/components/pages/SoftwareLibraryPage.tsx');
const familyPage = read('../src/components/premium/FamilyPage.tsx');
const manifest = JSON.parse(read('../../Docs/TOOLS-MANIFEST.json'));
const manifestIds = new Set(manifest.map((t) => t.ToolId));

const collectIds = (src) =>
  [...src.matchAll(/findTool\('([A-Z]{2}\d{2})'\)/g)].map((m) => m[1]);

test('spotlights mount inside the existing canonical overview surfaces, not a parallel shell', () => {
  assert.match(overview, /import AssuranceSpotlight from '\.\.\/premium\/AssuranceSpotlight'/);
  assert.match(overview, /import RecoverySpotlight from '\.\.\/premium\/RecoverySpotlight'/);
  assert.match(overview, /family\.id === 'assurance' && \(/);
  assert.match(overview, /family\.id === 'recovery' && \(/);
  assert.match(overview, /<AssuranceSpotlight/);
  assert.match(overview, /<RecoverySpotlight/);
  assert.match(library, /import SoftwareSpotlight from '\.\.\/premium\/SoftwareSpotlight'/);
  assert.match(library, /<SoftwareSpotlight/);
  assert.doesNotMatch(overview, /createRoot|BrowserRouter|registerSpotlight|spotlightRegistry/i);
  assert.doesNotMatch(library, /createRoot|BrowserRouter|registerSpotlight|spotlightRegistry/i);
});

test('every spotlight action routes through the single onSelectTool handler', () => {
  for (const [name, src] of [['Assurance', assurance], ['Recovery', recovery], ['Software', software]]) {
    assert.match(src, /onSelectTool: \(\w+: string\) => void/, `${name} declares the canonical handler prop`);
    assert.ok(!src.includes('onSelectService('), `${name} never navigates sideways instead of selecting`);
  }
  assert.match(overview, /onSelectTool: \(id: string\) => void/);
  assert.match(library, /onSelectTool: \(id: string\) => void/);
  assert.match(familyPage, /onSelectTool=\{onSelectTool\}/);
  const count = (familyPage.match(/onSelectTool=\{onSelectTool\}/g) || []).length;
  assert.ok(count >= 2, `FamilyPage threads the handler to both overviews (found ${count})`);
});

test('every ToolId a spotlight can select resolves against the canonical manifest', () => {
  for (const [name, src] of [['Assurance', assurance], ['Recovery', recovery], ['Software', software]]) {
    for (const id of collectIds(src)) {
      assert.ok(manifestIds.has(id), `${name} references unknown ToolId ${id}`);
    }
  }
});

test('spotlight status copy never claims a measured state without measurement', () => {
  // The stepper's 'Verified' is gated on bridgeOnline === true, a real
  // measurement, so the ban targets only unmeasured fallbacks: a defender
  // or firewall row must never resolve to a positive claim when the value
  // is false or undefined.
  assert.doesNotMatch(assurance, /'Protected'/);
  assert.doesNotMatch(assurance, /: 'Verified' \} /);
  assert.doesNotMatch(assurance, /defenderOn === true \? [^:]+ : \(isRtl \? '[^']+' : 'Verified'\)/);
  assert.match(assurance, /Unverified/);
  assert.match(assurance, /Unknown/);
  assert.match(assurance, /Not audited yet/);
  assert.doesNotMatch(recovery, /within 30 days/);
  assert.match(recovery, /quarantine and can be restored from there/);
});

test('spotlight counts come from the live tool contract, never hardcoded literals', () => {
  const code = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  assert.doesNotMatch(code(assurance), /'29 Protection Tools'/);
  assert.doesNotMatch(code(assurance), /'29 أداة حماية'/);
  assert.match(assurance, /serviceTools\.length\} Protection Tools/);
  assert.match(assurance, /\{networkCount\}|\{securityCount\}|\{privacyCount\}|\{driversCount\}/);
  assert.doesNotMatch(code(software), /allTools\.length\} Library Tools/);
  assert.match(software, /serviceTools\.length\} Library Tools/);
});

test('spotlight bridge calls use only existing endpoints with loading and error states', () => {
  for (const call of ['api.cleanupPreview()', 'api.backupRecoveryPreview()']) {
    assert.ok(recovery.includes(call), `Recovery calls ${call}`);
  }
  for (const call of ['api.softwarePreview()', 'api.postInstallPreview()', 'api.advancedSoftwarePreview()']) {
    assert.ok(software.includes(call), `Software calls ${call}`);
  }
  assert.match(recovery, /cleanupState === 'error'/);
  assert.match(recovery, /Preview unavailable/);
  assert.match(software, /swState === 'error'/);
  assert.match(software, /Preview unavailable/);
  assert.match(software, /N\/A/);
});
