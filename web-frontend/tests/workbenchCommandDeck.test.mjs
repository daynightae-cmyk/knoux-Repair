import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const station = readWeb('src/components/premium/workbench/EngineeringWorkbenchStation.tsx');
const familyPage = readWeb('src/components/premium/FamilyPage.tsx');
const mainTsx = readWeb('src/main.tsx');
const deckCss = readWeb('src/workbench-command-deck.css');
const heroSvg = fs.readFileSync(path.join(webRoot, 'public/brand/workbench-hero.svg'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'Docs/TOOLS-MANIFEST.json'), 'utf8'));
const manifestTools = Array.isArray(manifest) ? manifest : manifest.tools;

test('workbench deck preserves the canonical reconciliation contract', () => {
  assert.match(station, /import ServiceApps from '\.\.\/\.\.\/ServiceApps'/);
  assert.match(station, /'12-Developer-Tools'/);
  assert.match(station, /'18-Project-Sonar'/);
  assert.match(station, /activeSection=\{activeService\.legacySection\}/);
  assert.match(station, /tools=\{serviceTools\}/);
  assert.match(station, /onRunTool=\{onRunTool\}/);
  assert.match(station, /onCancelTool=\{onCancelTool\}/);
  assert.match(station, /onRetryBridge=\{onRetryBridge\}/);
  assert.match(station, /className="knoux-workspace-stage/);
  assert.match(station, /data-mode="service"/);
  assert.match(station, /data-execution="idle"/);
  assert.match(station, /data-selected-tool-id=""/);
  assert.match(station, /data-service-tool-count=\{bridgeOnline === true \? serviceTools\.length : ''\}/);
  assert.match(station, /className="knoux-stage-service-app/);
  assert.doesNotMatch(station, /sessionStorage|localStorage/);
});

test('deck quick-action chips map 1:1 to real manifest tools', () => {
  const expected = [
    ['DT05', '12-Developer-Tools'],
    ['DT06', '12-Developer-Tools'],
    ['DT01', '12-Developer-Tools'],
    ['SN01', '18-Project-Sonar'],
    ['SN02', '18-Project-Sonar'],
    ['SN04', '18-Project-Sonar'],
    ['SN06', '18-Project-Sonar'],
  ];
  for (const [toolId, category] of expected) {
    assert.match(station, new RegExp(`toolId: '${toolId}'`), `chip for ${toolId} must exist`);
    const record = manifestTools.find((tool) => tool.ToolId === toolId);
    assert.ok(record, `${toolId} must exist in TOOLS-MANIFEST`);
    assert.equal(record.Category, category, `${toolId} must belong to ${category}`);
  }
  assert.match(station, /import ExecutionConfirmDialog from '\.\.\/\.\.\/ExecutionConfirmDialog'/);
  assert.match(station, /<ExecutionConfirmDialog/);
});

test('deck renders no fabricated telemetry, repos, scans or AI claims', () => {
  const forbidden = [
    'stellar-web-app',
    '247 Commits',
    'Branches',
    'Contributors',
    'Open in GitHub',
    'Apply Suggestions',
    'AI RECOMMENDATION',
    'AI Assist Active',
    'Tests Passing',
    'ENVIRONMENT READINESS',
    'LATEST SCAN',
  ];
  for (const marker of forbidden) {
    assert.equal(station.includes(marker), false, `fabricated marker must not exist: ${marker}`);
  }
  assert.equal(/(\d+)\s*%/.test(station), false, 'no percentage metrics in deck source');
  assert.match(station, /Unknown/);
});

test('deck hero uses a standalone asset with no embedded text', () => {
  assert.match(station, /workbench-hero\.png/);
  assert.match(station, /workbench-hero\.svg/);
  assert.equal(heroSvg.includes('<text'), false, 'hero asset must not embed text');
  assert.match(heroSvg, /<svg/);
});

test('family page feeds the deck both workbench services for honest counts', () => {
  assert.match(familyPage, /familyTools=\{familyTools\}/);
  assert.match(station, /familyTools\?: BridgeTool\[\]/);
  assert.match(station, /pool\.filter\(tool => tool\.Category === service\.id\)/);
});

test('deck styles load through the canonical entry with reduced-motion support', () => {
  assert.match(mainTsx, /workbench-command-deck\.css/);
  assert.match(deckCss, /prefers-reduced-motion: reduce/);
  assert.match(deckCss, /\.knoux-deck-hero/);
  assert.match(deckCss, /\.knoux-deck-chip/);
  assert.match(deckCss, /\.knoux-deck-service/);
});
