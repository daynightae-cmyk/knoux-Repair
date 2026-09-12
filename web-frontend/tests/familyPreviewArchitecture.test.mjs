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

test('family page renders preview, services, selected service tools, then workspace', () => {
  const source = read('src/components/premium/FamilyPage.tsx');
  const hero = source.indexOf('<HeroSection');
  const services = source.indexOf('id="family-services"');
  const selectedService = source.indexOf('knoux-active-service-panel');
  const tools = source.indexOf('knoux-tool-card-grid');
  const workspace = source.indexOf('<FamilyLiveStage');

  assert.ok(hero >= 0);
  assert.ok(hero < services);
  assert.ok(services < selectedService);
  assert.ok(selectedService < tools);
  assert.ok(tools < workspace);
  assert.match(source, /onSelectTool\(null\)/);
  assert.match(source, /key=\{activeService\.id\}/);
});

test('wide preview reacts to service and tool context without synthetic runtime counts', () => {
  const source = read('src/components/premium/HeroSection.tsx');
  assert.match(source, /key=\{`\$\{family\.id\}-\$\{service\.id\}-\$\{selectedTool\?\.ToolId \?\? 'service'\}`\}/);
  assert.match(source, /onSelectService\(entry\.id\)/);
  assert.match(source, /bridgeOnline === true \? familyToolCount : '—'/);
  assert.match(source, /Context preview — runtime data not connected/);
});

test('AI Scan exposes its four service concepts and refuses an evidence-free success state', () => {
  const source = read('src/components/pages/AIScanPage.tsx');
  for (const service of ['Scan', 'Analyze', 'Understand', 'Repair Together']) {
    assert.match(source, new RegExp(`titleEn: '${service}'`));
  }
  assert.match(source, /evidenceSourceCount === 0/);
  assert.match(source, /Diagnostic result unavailable/);
  assert.match(source, /Open recommendations/);
  assert.doesNotMatch(source, /toolCount \?\? 158/);
});

test('family preview CSS includes responsive and reduced-motion fallbacks', () => {
  const source = read('src/family-preview.css');
  assert.match(source, /min-height: clamp\(360px, 32vw, 430px\)/);
  assert.match(source, /@media \(max-width: 980px\)/);
  assert.match(source, /@media \(max-width: 700px\)/);
  assert.match(source, /@media \(prefers-reduced-motion: reduce\)/);
});
