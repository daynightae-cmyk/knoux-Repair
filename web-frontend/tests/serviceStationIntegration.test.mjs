import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

const familyPage = read('src/components/premium/FamilyPage.tsx');
const liveStage = read('src/components/premium/FamilyLiveStage.tsx');
const toolCard = read('src/components/premium/ToolCard.tsx');
const familyMap = read('src/data/family-map.ts');
const main = read('src/main.tsx');

test('Family command center routes an idle selected service into its canonical Station UI', () => {
  assert.match(liveStage, /import ServiceApps from '\.\.\/ServiceApps'/);
  assert.match(liveStage, /activeSection=\{service\.legacySection\}/);
  assert.match(liveStage, /tools=\{serviceTools\}/);
  assert.match(liveStage, /knoux-stage-service-app/);
  assert.match(liveStage, /programsDockEnabled/);
  assert.match(liveStage, /serviceAppMode = !selectedTool && !executionRunning/);
});

test('FamilyPage passes service-scoped tools and keeps the customer service shell active until a tool is selected', () => {
  assert.match(familyPage, /serviceTools=\{serviceTools\}/);
  assert.match(familyPage, /onRetryBridge=\{onRetryBridge\}/);
  assert.match(familyPage, /serviceAppActive = !selectedTool/);
  assert.match(familyPage, /ACTIONS/);
  assert.match(familyPage, /إجراءات الخدمة/);
});

test('All 18 canonical services expose a legacySection route for Station integration', () => {
  const legacyMappings = familyMap.match(/legacySection:\s*'[^']+'/g) ?? [];
  assert.equal(legacyMappings.length, 18, `expected 18 service-to-station mappings, found ${legacyMappings.length}`);
});

test('Internal ToolId remains a data/runtime contract but is not rendered as the primary ToolCard label', () => {
  assert.match(toolCard, /data-tool-id=\{tool\.ToolId\}/);
  assert.doesNotMatch(toolCard, /knoux-tool-card-id/);
  assert.doesNotMatch(toolCard, />\{tool\.ToolId\}<\/div>/);
});

test('Service station integration CSS loads after the easy-service polish layer', () => {
  const easy = main.indexOf("import './easy-services-polish.css'");
  const integration = main.indexOf("import './service-station-integration.css'");
  assert.ok(easy >= 0, 'easy services polish must remain loaded');
  assert.ok(integration > easy, 'service station integration must be the final service layout override');
});
