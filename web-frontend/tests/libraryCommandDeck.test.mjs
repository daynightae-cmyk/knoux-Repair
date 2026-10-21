import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The Software Library was deliberately redesigned from an "action control
 * deck" (a card grid driven by four range sliders) into the KNOuX
 * Application Studio: four real workspaces over live bridge data.
 *
 * The truthfulness guarantees of the old deck are preserved verbatim:
 * nothing is counted while the bridge is unreachable, the live manifest is
 * the only source of counts, selection is never execution, and the surface
 * is bilingual and RTL-safe.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const page = read('src/components/pages/SoftwareLibraryPage.tsx');
const css = read('src/software-library-deck.css');
const main = read('src/main.tsx');
const familyPage = read('src/components/premium/FamilyPage.tsx');

test('the application studio is imported and is the only Software Library surface', () => {
  assert.match(main, /software-library-deck\.css/);
  assert.equal((main.match(/software-library-deck\.css/g) ?? []).length, 1);
  assert.match(familyPage, /<SoftwareLibraryPage/);
  assert.equal((familyPage.match(/<SoftwareLibraryPage/g) ?? []).length, 1);
});

test('the library is an operational studio, not a marketing or statistics surface', () => {
  // No hero art, no marketing triad, no decorative stat tiles.
  assert.doesNotMatch(page, /software-library-hero/);
  assert.doesNotMatch(page, /knoux-software-library-hero\.png/);
  assert.doesNotMatch(page, /CLEARER|SAFER|ORGANIZED/);
  assert.doesNotMatch(page, /software-library-principles/);
});

test('the rejected slider panel is gone for good', () => {
  // The owner rejected "a collection of tool cards, generic counters and
  // risk sliders". None of that grammar may come back.
  assert.doesNotMatch(page, /type="range"/);
  assert.doesNotMatch(page, /<DeckSlider/);
  assert.doesNotMatch(page, /RISK_LADDER/);
  assert.doesNotMatch(page, /riskCeiling/);
  assert.doesNotMatch(page, /reversibility/);
});

test('the studio is four real workspaces over live bridge data', () => {
  for (const id of ['applications', 'runtime', 'setup', 'maintenance']) {
    assert.ok(page.includes(`id: '${id}'`), `missing workspace: ${id}`);
  }
  for (const [en, ar] of [
    ['Applications', 'التطبيقات'],
    ['Runtime & Environment', 'بيئة التشغيل'],
    ['Installation & Setup', 'التثبيت والإعداد'],
    ['Maintenance', 'الصيانة'],
  ]) {
    assert.ok(page.includes(en), `missing en workspace: ${en}`);
    assert.ok(page.includes(ar), `missing ar workspace: ${ar}`);
  }

  // Every workspace is fed by a real, existing bridge endpoint.
  for (const call of ['api.softwarePreview()', 'api.advancedSoftwarePreview()', 'api.postInstallPreview()']) {
    assert.ok(page.includes(call), `missing live data source: ${call}`);
  }
});

test('every control readout is measured, never assumed', () => {
  // Nothing is counted while the bridge is unreachable.
  assert.match(page, /const measured = bridgeOnline === true/);
  assert.match(page, /Not checked yet/);
  assert.match(page, /لم يتم الفحص بعد/);
  assert.match(page, /measured \? String\(software\?\.Total \?\? 0\) : '—'/);
  assert.match(page, /measured \? String\(libraryTools\.length\) : '—'/);
  // A failed read states the real cause and offers a real retry.
  assert.match(page, /softwareError/);
  assert.match(page, /provisioningError/);
  assert.match(page, /advancedError/);
  assert.match(page, /onClick=\{\(\) => void loadSoftware\(\)\}/);
  // Locked states say why they are locked instead of implying an empty result.
  assert.match(page, /bridgeOnline !== true/);
});

test('the studio renders the live manifest rather than a fixed action count', () => {
  assert.match(page, /tools\.filter\(tool => tool\.Category === service\.id\)/);
  assert.match(page, /tools\.filter\(tool => family\.services\.some\(service => service\.id === tool\.Category\)\)/);
  // No hardcoded inventory size is baked into the surface.
  assert.doesNotMatch(page, /loadedTools|const TOTAL|ACTIONS_COUNT/);
  // Risk and capability chips come from the tool contract, not from a lookup table of lies.
  for (const field of ['tool.RiskLevel', 'tool.RequiresAdmin', 'tool.AnalyzeOnlySupported', 'tool.WhatIfSupported', 'tool.ReportsEvidence', 'tool.RequiresRestart']) {
    assert.ok(page.includes(field), `missing live field: ${field}`);
  }
});

test('the application inventory is the canonical measured inventory, not a parallel list', () => {
  assert.match(page, /buildProgramInventory\(software\.Items, \[\]\)/);
  assert.match(page, /import \{ buildProgramInventory, STATION04_SERVICES \}/);
  assert.match(page, /<EntityInventory/);
  assert.match(page, /import EntityInventory from '\.\.\/shell\/EntityInventory'/);
  // The inventory keeps the canonical truthfulness contract.
  assert.match(page, /rows=\{inventory\}/);
  assert.match(page, /notChecked: \{ en: 'Not checked yet'/);
  // The real capability matrix, not a hand-written table.
  assert.match(page, /STATION04_SERVICES\.find\(entry => entry\.serviceId === service\.id\)/);
});

test('the maintenance workspace shows the real action contract and never executes', () => {
  assert.match(page, /<code>\{tool\.ToolId\}<\/code>/);
  assert.match(page, /<strong>\{ar \? tool\.ArabicName : tool\.EnglishName\}<\/strong>/);
  assert.match(page, /onClick=\{\(\) => onSelectTool\(tool\.ToolId\)\}/);
  // Selection is never execution.
  assert.match(page, /Selection is not execution/);
  assert.match(page, /الاختيار ليس تنفيذًا/);
  assert.doesNotMatch(page, /onRunTool|startRun/);
});

test('the studio is bilingual and mirrors in RTL', () => {
  assert.match(page, /dir=\{ar \? 'rtl' : 'ltr'\}/);
  assert.match(page, /data-family="software"/);
  for (const [en, ar] of [
    ['Software Library', 'مكتبة البرامج'],
    ['Installed applications', 'التطبيقات المثبَّتة'],
    ['Developer runtimes', 'بيئات تشغيل المطورين'],
    ['Essential software catalog', 'كتالوج البرامج الأساسية'],
    ['Not checked yet', 'لم يتم الفحص بعد'],
  ]) {
    assert.ok(page.includes(en), `missing en copy: ${en}`);
    assert.ok(page.includes(ar), `missing ar copy: ${ar}`);
  }
});

test('the deck stylesheet stays loaded and keeps no fixed positioning', () => {
  assert.match(css, /@media \(max-width: 1400px\)/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /position:\s*fixed/);
});
