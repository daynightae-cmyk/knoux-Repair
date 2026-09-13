import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');

function readWeb(relativePath) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

function collectTextFiles(root, extensions = new Set(['.ts', '.tsx', '.mjs', '.js'])) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (extensions.has(path.extname(entry.name))) output.push(absolute);
    }
  };
  walk(root);
  return output;
}

test('workbench station is mounted only as the idle service surface and preserves canonical tool execution', () => {
  const familyPage = readWeb('src/components/premium/FamilyPage.tsx');

  assert.match(familyPage, /EngineeringWorkbenchStation/);
  assert.match(familyPage, /family\.id === 'workbench' && !selectedTool && !executionTool/);
  assert.match(familyPage, /<EngineeringWorkbenchStation/);

  // Current-main architecture must remain available for selected/running tools.
  assert.match(familyPage, /<HeroSection/);
  assert.match(familyPage, /<FamilyLiveStage/);
  assert.match(familyPage, /<ToolCard/);
  assert.match(familyPage, /selectedTool=\{selectedTool\}/);
  assert.match(familyPage, /executionTool=\{executionTool\}/);
});

test('workbench station delegates to the real existing service applications', () => {
  const station = readWeb('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');

  assert.match(station, /import ServiceApps from '\.\.\/\.\.\/ServiceApps'/);
  assert.match(station, /'12-Developer-Tools'/);
  assert.match(station, /'18-Project-Sonar'/);
  assert.match(station, /activeSection=\{activeService\.legacySection\}/);
  assert.match(station, /tools=\{serviceTools\}/);
  assert.match(station, /onRunTool=\{onRunTool\}/);
  assert.match(station, /onCancelTool=\{onCancelTool\}/);
  assert.match(station, /onRetryBridge=\{onRetryBridge\}/);

  // No fake workstation metrics or browser-persisted premium state in this surface.
  assert.doesNotMatch(station, /sessionStorage|localStorage/);
  assert.doesNotMatch(station, /CPU\s*\d+%|RAM\s*\d+%|LATENCY[^\n]*\d+\s*ms/i);
});

test('unsafe donor premium verifier material is not present in the reconciled source tree', () => {
  const roots = [
    path.join(WEB_ROOT, 'server'),
    path.join(WEB_ROOT, 'src', 'components', 'premium', 'workbench'),
  ];
  const source = roots
    .flatMap(root => collectTextFiles(root))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');

  // These are the exact verifier values found on the historical donor branch.
  assert.doesNotMatch(source, /1d536dd78e4bf53ac43ad153e54af0da/i);
  assert.doesNotMatch(source, /a953276c868cc1b9887c0ff1c48998b47df24c421d22660c05e9036c4a9f3995c3ec1354fc735ad75899d6188635a72919b46fe21bb209ca6606e2cfa9b4c29d/i);
  assert.doesNotMatch(source, /knoux-workbench-token/);
});

test('canonical Engineering Workbench remains two services and twenty internal tools by contract', () => {
  const familyMap = readWeb('src/data/family-map.ts');
  const workbenchStart = familyMap.indexOf("id: 'workbench'");
  const investigationStart = familyMap.indexOf("id: 'investigation'", workbenchStart);
  assert.ok(workbenchStart >= 0 && investigationStart > workbenchStart, 'workbench family block must exist');
  const block = familyMap.slice(workbenchStart, investigationStart);

  assert.match(block, /expectedTools:\s*20/);
  assert.match(block, /id:\s*'12-Developer-Tools'/);
  assert.match(block, /id:\s*'18-Project-Sonar'/);
});
