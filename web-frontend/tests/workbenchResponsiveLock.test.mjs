import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const deck = fs.readFileSync(path.join(webRoot, 'src', 'workbench-command-deck.css'), 'utf8');

// Regression for the 1366x768 center-collapse defect: the deck lives inside
// FamilyPage rails, so viewport width alone cannot protect CENTER. The live
// column must be a query container and the deck must collapse by container
// budget, not just by viewport.
test('deck collapses by container budget so CENTER never collapses to zero', () => {
  assert.match(deck, /\.knoux-command-live-column\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(deck, /@container[^{]*\(max-width:\s*980px\)/);
  assert.match(deck, /@container[^{]*\(max-width:\s*620px\)/);
});

test('workbench tool rail rejoins flow below the deck at narrow shells', () => {
  assert.match(deck, /@media\s*\(max-width:\s*1500px\)/);
  assert.match(deck, /:has\(\.knoux-engineering-workbench\)\s*>\s*\.knoux-command-tool-rail/);
  assert.match(deck, /position:\s*static/);
});

test('single ServiceApps mount is preserved (no double render regression)', () => {
  const station = fs.readFileSync(path.join(webRoot, 'src', 'components', 'premium', 'workbench', 'EngineeringWorkbenchStation.tsx'), 'utf8');
  const mounts = station.match(/<ServiceApps/g) ?? [];
  assert.equal(mounts.length, 1, `expected exactly 1 ServiceApps mount in workbench, found ${mounts.length}`);
  const family = fs.readFileSync(path.join(webRoot, 'src', 'components', 'premium', 'FamilyPage.tsx'), 'utf8');
  assert.match(family, /showWorkbenchStation \? \(/);
  assert.equal((family.match(/<FamilyLiveStage/g) ?? []).length, 1);
  assert.doesNotMatch(family, /showDuplicateStudio/);
});
