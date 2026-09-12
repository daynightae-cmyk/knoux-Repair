import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('family preview configuration covers six repair families and all eighteen services', () => {
  const source = read('src/data/family-preview-config.ts');
  for (const family of ['vitality', 'recovery', 'assurance', 'software', 'workbench', 'investigation']) {
    assert.match(source, new RegExp(`\\b${family}: \\{`));
  }
  for (let service = 1; service <= 18; service += 1) {
    assert.match(source, new RegExp(`'${String(service).padStart(2, '0')}-`));
  }
});

test('family page is a persistent service rail, live workspace, and tool rail', () => {
  const source = read('src/components/premium/FamilyPage.tsx');
  const serviceRail = source.indexOf('knoux-command-service-rail');
  const liveColumn = source.indexOf('knoux-command-live-column');
  const toolRail = source.indexOf('knoux-command-tool-rail');

  assert.ok(serviceRail >= 0);
  assert.ok(liveColumn > serviceRail);
  assert.ok(toolRail > liveColumn);
  assert.match(source, /<HeroSection/);
  assert.match(source, /<FamilyLiveStage/);
  assert.match(source, /executionTool=\{executionTool\}/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.doesNotMatch(source, /function scrollTo/);
  assert.doesNotMatch(source, /id="family-services"/);
});

test('selected tool and execution tool are modeled independently', () => {
  const familyPage = read('src/components/premium/FamilyPage.tsx');
  const liveStage = read('src/components/premium/FamilyLiveStage.tsx');
  const hero = read('src/components/premium/HeroSection.tsx');

  assert.match(familyPage, /const selectedTool = useMemo/);
  assert.match(familyPage, /const executionTool = useMemo/);
  assert.match(liveStage, /selectionDiffersFromExecution/);
  assert.match(liveStage, /runtime ownership remains attached to the execution tool/);
  assert.match(hero, /executionToolStatus === 'running'/);
  assert.match(hero, /EXECUTION CONTINUES/);
});

test('command center preserves execution results and honest runtime labels', () => {
  const hero = read('src/components/premium/HeroSection.tsx');
  const liveStage = read('src/components/premium/FamilyLiveStage.tsx');

  assert.match(hero, /Context preview — no synthetic telemetry/);
  assert.match(hero, /Live system snapshot/);
  assert.match(liveStage, /LAST EXECUTION/);
  assert.match(liveStage, /ACTIVE EXECUTION/);
  assert.match(liveStage, /toolStatuses\[executionTool\.ToolId\]/);
  assert.doesNotMatch(hero, /Math\.random/);
  assert.doesNotMatch(liveStage, /Math\.random/);
});

test('AI Scan preserves real evidence calls inside a persistent three-zone command center', () => {
  const source = read('src/components/pages/AIScanPage.tsx');
  for (const service of ['Scan', 'Analyze', 'Understand', 'Repair Together']) {
    assert.match(source, new RegExp(`titleEn: '${service}'`));
  }
  assert.match(source, /api\.system\(\)/);
  assert.match(source, /api\.cleanupPreview\(\)/);
  assert.match(source, /api\.driversPreview\(\)/);
  assert.match(source, /evidenceSourceCount === 0/);
  assert.match(source, /Diagnostic result unavailable/);
  assert.match(source, /knoux-ai-workflow-rail/);
  assert.match(source, /knoux-ai-live-column/);
  assert.match(source, /knoux-ai-findings-rail/);
  assert.match(source, /id="ai-recommendation-workspace"/);
  assert.match(source, /data-active=\{selectedFindingId === finding\.id\}/);
  assert.match(source, /onNavigate\(selectedFinding\.dest\)/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.doesNotMatch(source, /toolCount \?\? 158/);
});

test('command center CSS keeps rails independently scrollable and supports narrower layouts', () => {
  const source = read('src/command-center.css');
  assert.match(source, /grid-template-columns: var\(--command-rail-width\) minmax\(0, 1fr\) var\(--command-tool-width\)/);
  assert.match(source, /\.knoux-command-rail-scroll/);
  assert.match(source, /overflow-y: auto/);
  assert.match(source, /@container \(max-width: 1100px\)/);
  assert.match(source, /@container \(max-width: 760px\)/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
});

test('AI command center has independent rails, responsive fallback, and reduced motion', () => {
  const source = read('src/ai-command-center.css');
  assert.match(source, /\.knoux-ai-command-center/);
  assert.match(source, /\.knoux-ai-rail-scroll/);
  assert.match(source, /overflow:auto/);
  assert.match(source, /@container \(max-width: 1100px\)/);
  assert.match(source, /@container \(max-width: 760px\)/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
});
