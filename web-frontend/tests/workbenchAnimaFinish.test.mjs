import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const mainTsx = readWeb('src/main.tsx');
const finishCss = readWeb('src/workbench-anima-finish.css');
const station = readWeb('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

test('Anima finish loads after canonical Workbench deck styles', () => {
  const deckIndex = mainTsx.indexOf("./workbench-command-deck.css");
  const finishIndex = mainTsx.indexOf("./workbench-anima-finish.css");
  assert.ok(deckIndex >= 0, 'canonical deck stylesheet must remain loaded');
  assert.ok(finishIndex > deckIndex, 'finish layer must load after canonical deck stylesheet');
});

test('cinematic hero uses slow cyan atmosphere and reduced-motion fallback', () => {
  assert.match(finishCss, /knoux-cyan-smoke-a/);
  assert.match(finishCss, /knoux-cyan-smoke-b/);
  assert.match(finishCss, /knoux-core-float/);
  assert.match(finishCss, /knoux-horizon-breathe/);
  assert.match(finishCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(finishCss, /\.knoux-deck-hero__title[\s\S]*clip:/);
});

test('final finish preserves live canonical service and tool execution', () => {
  assert.match(station, /import ServiceApps from '\.\.\/\.\.\/ServiceApps'/);
  assert.match(station, /activeSection=\{activeService\.legacySection\}/);
  assert.match(station, /onRunTool=\{onRunTool\}/);
  assert.match(station, /onCancelTool=\{onCancelTool\}/);

  for (const toolId of ['DT05', 'DT06', 'DT01', 'SN01', 'SN02', 'SN04', 'SN06']) {
    assert.match(station, new RegExp(`toolId: '${toolId}'`));
  }
});

test('visual finish adds designer signature without fabricated product data', () => {
  assert.match(finishCss, /ENG SADEK ELGAZAR/);
  const forbidden = [
    'stellar-web-app',
    '247 Commits',
    'Tests Passing',
    'Apply Suggestions',
    '100% System Health',
    'Mohammed Alqahtani',
  ];
  for (const marker of forbidden) {
    assert.equal(finishCss.includes(marker), false, `finish CSS must not contain fabricated marker: ${marker}`);
  }
});
