import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const page = read('src/components/pages/SoftwareLibraryPage.tsx');
const css = read('src/software-library-deck.css');
const main = read('src/main.tsx');
const familyPage = read('src/components/premium/FamilyPage.tsx');

test('the library deck is imported and is the only Software Library surface', () => {
  assert.match(main, /software-library-deck\.css/);
  assert.equal((main.match(/software-library-deck\.css/g) ?? []).length, 1);
  assert.match(familyPage, /<SoftwareLibraryPage/);
  assert.equal((familyPage.match(/<SoftwareLibraryPage/g) ?? []).length, 1);
});

test('the library is an operational deck, not a marketing or statistics surface', () => {
  // No hero art, no marketing triad, no decorative stat tiles.
  assert.doesNotMatch(page, /software-library-hero/);
  assert.doesNotMatch(page, /knoux-software-library-hero\.png/);
  assert.doesNotMatch(page, /CLEARER|SAFER|ORGANIZED/);
  assert.doesNotMatch(page, /software-library-principles/);
  // The section order the user asked for: masthead, controls, topology, inventory, safety.
  const order = ['sl-masthead', 'sl-controls', 'sl-topology', 'sl-inventory', 'sl-safety'];
  let cursor = -1;
  for (const id of order) {
    const at = page.indexOf(`"${id}"`);
    assert.ok(at > cursor, `${id} must come after the previous section in document order`);
    cursor = at;
  }
});

test('the deck ships four real range controls', () => {
  assert.equal((page.match(/<DeckSlider/g) ?? []).length, 4);
  assert.equal((css.match(/\.sl-slider/g) ?? []).length >= 1, true);
  assert.match(page, /type="range"/);
  for (const label of ['Risk ceiling', 'Privilege scope', 'Reversibility', 'Row detail']) {
    assert.ok(page.includes(label), `missing control: ${label}`);
  }
});

test('every control readout is measured, never assumed', () => {
  // Nothing is counted while the bridge is unreachable.
  assert.match(page, /const measured = bridgeOnline === true/);
  assert.match(page, /const controlsLocked = !measured/);
  assert.match(page, /disabled=\{controlsLocked\}/);
  assert.match(page, /\{totalRegistered === null \? '—' : totalRegistered\}/);
  assert.match(page, /\{admitted === null[\s\S]{0,120}Not checked yet/);
  assert.match(page, /\{count === null \? '—' : count\}|\{valueText \?\? \(count === null \? '—' : count\)\}/);
  assert.match(page, /\{measured \? all\.length : '—'\}/);
  // Locked controls state why they are locked instead of implying an empty result.
  assert.match(page, /sl-controls__lock/);
  assert.match(page, /Controls stay locked until the local execution bridge is reachable/);
});

test('the reversibility control never counts a tool the manifest says has no recovery', () => {
  assert.match(page, /function declaresRecovery\(value: string \| undefined\)/);
  assert.match(page, /if \(text === ''\) return false/);
  assert.ok(page.includes("^(none|no\\b|n\\/?a|not (applicable|available|required)|unsupported|-)\\b"), 'recovery-intent guard must reject explicit negatives');
  assert.match(page, /!text\.startsWith\('none'\)/);
  // "None (read-only listing)" must not read as a backup.
  assert.match(page, /return declaresRecovery\(tool\.RollbackMethod\)/);
  assert.match(page, /return declaresRecovery\(tool\.BackupMethod\)/);
  // The filter is applied, not merely counted.
  assert.match(page, /reversibility === 1 && !hasRollback\(tool\)/);
  assert.match(page, /reversibility === 2 && !\(hasRollback\(tool\) && hasBackup\(tool\)\)/);
});

test('the deck renders the live manifest rather than a fixed action count', () => {
  assert.match(page, /tools\.filter\(tool => tool\.Category === service\.id\)/);
  assert.match(page, /tools\.filter\(tool => family\.services\.some\(s => s\.id === tool\.Category\)/);
  // No hardcoded inventory size is baked into the surface.
  assert.doesNotMatch(page, /loadedTools|const TOTAL|ACTIONS_COUNT/);
  // Risk and capability chips come from the tool contract, not from a lookup table of lies.
  for (const field of ['tool.RiskLevel', 'tool.RequiresAdmin', 'tool.AnalyzeOnlySupported', 'tool.WhatIfSupported', 'tool.ReportsEvidence', 'tool.RequiresRestart']) {
    assert.ok(page.includes(field), `missing live field: ${field}`);
  }
});

test('the inventory lists real registered actions and never invents a row', () => {
  assert.match(page, /<code>\{tool\.ToolId\}<\/code>/);
  assert.match(page, /<strong>\{ar \? tool\.ArabicName : tool\.EnglishName\}<\/strong>/);
  assert.match(page, /\{density === 2 && <p>\{tool\.Purpose\}<\/p>\}/);
  // A second name line is only rendered when the two names actually differ.
  assert.match(page, /\(ar \? tool\.ArabicName : tool\.EnglishName\) !== \(ar \? tool\.EnglishName : tool\.ArabicName\) &&/);
  assert.match(page, /sl-inventory__empty/);
  assert.match(page, /No registered action matches these controls/);
});

test('workspace focus is a real filter and opening stays a separate intent', () => {
  assert.match(page, /if \(focusService && tool\.Category !== focusService\) return false/);
  assert.match(page, /setFocusService\(focused \? null : service\.id\)/);
  assert.match(page, /aria-pressed=\{focused\}/);
  assert.match(page, /onClick=\{\(\) => onSelectService\(service\.id\)\}/);
  // The workspace name itself is a control: the repository's navigation gate
  // reaches every service by clicking a visible button carrying its name.
  assert.match(page, /className="sl-node__head"\s*\n\s*onClick=\{\(\) => onSelectService\(service\.id\)\}/);
  assert.match(page, /<strong>\{workspaceName\(service\)\}<\/strong>/);
  assert.match(page, /aria-label=\{t\(`Open \$\{workspaceName\(service\)\}`/);
  // Selection is never execution.
  assert.match(page, /Selection is not execution\./);
  assert.match(page, /الاختيار ليس تنفيذًا/);
  assert.doesNotMatch(page, /onRunTool|startRun|api\./);
});

test('the deck is bilingual and mirrors in RTL', () => {
  assert.match(page, /dir=\{ar \? 'rtl' : 'ltr'\}/);
  assert.match(page, /data-family="software"/);
  for (const [en, ar] of [
    ['Software Library', 'مكتبة البرامج'],
    ['Action controls', 'أدوات التحكم بالإجراءات'],
    ['Workspace topology', 'طوبولوجيا مساحات العمل'],
    ['Action inventory', 'جرد الإجراءات'],
    ['Not checked yet', 'لم يتم الفحص بعد'],
  ]) {
    assert.ok(page.includes(en), `missing en copy: ${en}`);
    assert.ok(page.includes(ar), `missing ar copy: ${ar}`);
  }
  assert.match(page, /rtl:rotate-180/);
});

test('the deck stays inside the viewport and keeps controls reachable', () => {
  assert.match(css, /\.sl-topology__rail\s*\{[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.sl-controls__body\s*\{[\s\S]*repeat\(4, minmax\(\d+px, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1400px\)/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.sl-search input\s*\{[\s\S]*min-width: 0|min-width: 0/);
  assert.doesNotMatch(css, /position:\s*fixed/);
});

test('the density control changes real row rendering', () => {
  assert.match(page, /data-density=\{density\}/);
  assert.match(css, /\.sl-inventory__groups\[data-density='0'\]/);
  assert.match(css, /\.sl-inventory__groups\[data-density='0'\] \.sl-group__name p \{ display: none; \}/);
});
