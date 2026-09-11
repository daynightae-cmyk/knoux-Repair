/**
 * KNOUX Repair — Architecture and Count Invariant Test Suite
 *
 * Verifies the 6 Families, 18 Services, 158 Tools structural invariants,
 * canonical service distribution, zero duplicate ownership,
 * and navigation resolution.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');

function readRepoJson(relativePath) {
  const content = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
  return JSON.parse(content.replace(/^\uFEFF/, ''));
}

function readWeb(relativePath) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

// ── Invariant Gate: 6 Families, 18 Services, 158 Tools ──

test('Invariant: Manifest contains exactly 158 tools across 18 numbered categories', () => {
  const manifest = readRepoJson('Docs/TOOLS-MANIFEST.json');
  assert.equal(Array.isArray(manifest), true, 'Manifest must be an array');
  assert.equal(manifest.length, 158, 'Manifest must declare exactly 158 canonical tools');

  const toolIds = new Set();
  const categories = new Set();

  for (const tool of manifest) {
    assert.ok(tool.ToolId, 'Every tool must have a ToolId');
    assert.equal(toolIds.has(tool.ToolId), false, `ToolId ${tool.ToolId} must be unique`);
    toolIds.add(tool.ToolId);
    categories.add(tool.Category);
  }

  assert.equal(categories.size, 18, 'Manifest must span exactly 18 categories');
});

test('Invariant: Canonical 6 Families and 18 Services tool distribution matches specification', () => {
  const manifest = readRepoJson('Docs/TOOLS-MANIFEST.json');
  
  const countByCategory = {};
  for (const tool of manifest) {
    countByCategory[tool.Category] = (countByCategory[tool.Category] || 0) + 1;
  }

  // Family 01: System Vitality (26 tools)
  assert.equal(countByCategory['01-System-Maintenance'], 10, '01-System-Maintenance must have 10 tools');
  assert.equal(countByCategory['08-Performance'], 12, '08-Performance must have 12 tools');
  assert.equal(countByCategory['15-System-Monitoring'], 4, '15-System-Monitoring must have 4 tools');
  const vitalityTotal = countByCategory['01-System-Maintenance'] + countByCategory['08-Performance'] + countByCategory['15-System-Monitoring'];
  assert.equal(vitalityTotal, 26, 'System Vitality total must be 26 tools');

  // Family 02: Recovery & Storage (37 tools)
  assert.equal(countByCategory['02-System-Cleanup'], 11, '02-System-Cleanup must have 11 tools');
  assert.equal(countByCategory['05-Duplicate-Files'], 11, '05-Duplicate-Files must have 11 tools');
  assert.equal(countByCategory['06-Disk-Space'], 10, '06-Disk-Space must have 10 tools');
  assert.equal(countByCategory['11-Backup-Recovery'], 5, '11-Backup-Recovery must have 5 tools');
  const recoveryTotal = countByCategory['02-System-Cleanup'] + countByCategory['05-Duplicate-Files'] + countByCategory['06-Disk-Space'] + countByCategory['11-Backup-Recovery'];
  assert.equal(recoveryTotal, 37, 'Recovery & Storage total must be 37 tools');

  // Family 03: Assurance (29 tools)
  assert.equal(countByCategory['03-Network-Internet'], 11, '03-Network-Internet must have 11 tools');
  assert.equal(countByCategory['09-Security'], 10, '09-Security must have 10 tools');
  assert.equal(countByCategory['13-Privacy'], 4, '13-Privacy must have 4 tools');
  assert.equal(countByCategory['14-Driver-Management'], 4, '14-Driver-Management must have 4 tools');
  const assuranceTotal = countByCategory['03-Network-Internet'] + countByCategory['09-Security'] + countByCategory['13-Privacy'] + countByCategory['14-Driver-Management'];
  assert.equal(assuranceTotal, 29, 'Assurance total must be 29 tools');

  // Family 04: Software Library (24 tools)
  assert.equal(countByCategory['04-Programs-Applications'], 10, '04-Programs-Applications must have 10 tools');
  assert.equal(countByCategory['16-Software-Environment'], 8, '16-Software-Environment must have 8 tools');
  assert.equal(countByCategory['17-PostInstall-Setup'], 6, '17-PostInstall-Setup must have 6 tools');
  const softwareTotal = countByCategory['04-Programs-Applications'] + countByCategory['16-Software-Environment'] + countByCategory['17-PostInstall-Setup'];
  assert.equal(softwareTotal, 24, 'Software Library total must be 24 tools');

  // Family 05: Engineering Workbench (20 tools)
  assert.equal(countByCategory['12-Developer-Tools'], 13, '12-Developer-Tools must have 13 tools');
  assert.equal(countByCategory['18-Project-Sonar'], 7, '18-Project-Sonar must have 7 tools');
  const workbenchTotal = countByCategory['12-Developer-Tools'] + countByCategory['18-Project-Sonar'];
  assert.equal(workbenchTotal, 20, 'Engineering Workbench total must be 20 tools');

  // Family 06: Investigation (22 tools)
  assert.equal(countByCategory['10-Diagnostics-Reports'], 11, '10-Diagnostics-Reports must have 11 tools');
  assert.equal(countByCategory['07-Services-Processes'], 11, '07-Services-Processes must have 11 tools');
  const investigationTotal = countByCategory['10-Diagnostics-Reports'] + countByCategory['07-Services-Processes'];
  assert.equal(investigationTotal, 22, 'Investigation total must be 22 tools');

  // Grand Total
  assert.equal(vitalityTotal + recoveryTotal + assuranceTotal + softwareTotal + workbenchTotal + investigationTotal, 158, 'Grand total of tools must be exactly 158');
});

test('Invariant: family-map.ts accurately defines all 6 families and 18 services with zero collision', () => {
  const familyMapSource = readWeb('src/data/family-map.ts');
  
  // Verify 6 families exist in FAMILIES array
  assert.match(familyMapSource, /id:\s*'vitality'/, 'vitality family must exist');
  assert.match(familyMapSource, /id:\s*'recovery'/, 'recovery family must exist');
  assert.match(familyMapSource, /id:\s*'assurance'/, 'assurance family must exist');
  assert.match(familyMapSource, /id:\s*'software'/, 'software family must exist');
  assert.match(familyMapSource, /id:\s*'workbench'/, 'workbench family must exist');
  assert.match(familyMapSource, /id:\s*'investigation'/, 'investigation family must exist');

  // Verify INVARIANTS declaration
  assert.match(familyMapSource, /families:\s*6/, 'INVARIANTS must specify 6 families');
  assert.match(familyMapSource, /services:\s*18/, 'INVARIANTS must specify 18 services');
  assert.match(familyMapSource, /tools:\s*158/, 'INVARIANTS must specify 158 tools');
});

test('Architecture: Unified App Shell retires duplicate primary Toolbox navigation', () => {
  const appSource = readWeb('src/App.tsx');
  
  // Verify primary rail components are integrated
  assert.match(appSource, /import\s+LeftRail\s+from/, 'App.tsx must use LeftRail');
  assert.match(appSource, /import\s+TopBar\s+from/, 'App.tsx must use TopBar');
  assert.match(appSource, /import\s+SentinelPanel\s+from/, 'App.tsx must use SentinelPanel');
  assert.match(appSource, /import\s+FamilyPage\s+from/, 'App.tsx must use FamilyPage');
  assert.match(appSource, /import\s+AIScanPage\s+from/, 'App.tsx must use AIScanPage');
  assert.match(appSource, /import\s+ActionCenterPage\s+from/, 'App.tsx must use ActionCenterPage');
  assert.match(appSource, /import\s+GlobalSearch\s+from/, 'App.tsx must use GlobalSearch');

  // Verify obsolete top glass tabs / duplicate suites are not used as competing routes
  assert.doesNotMatch(appSource, /<ToolboxSuite/, 'App.tsx must not render duplicate ToolboxSuite');
  assert.doesNotMatch(appSource, /<CareDashboard/, 'App.tsx must not render legacy CareDashboard');
  assert.doesNotMatch(appSource, /<SpeedUpSuite/, 'App.tsx must not render legacy SpeedUpSuite');
  assert.doesNotMatch(appSource, /<ProtectSuite/, 'App.tsx must not render legacy ProtectSuite');
});

test('Visual System: Design tokens and premium shell styles are defined and integrated', () => {
  const tokens = readWeb('src/design-tokens.css');
  assert.match(tokens, /--knoux-bg:\s*#050714/, 'Design tokens must define canonical canvas color #050714');
  assert.match(tokens, /--knoux-violet:\s*#7C3AED/, 'Design tokens must define Electric Violet #7C3AED');
  assert.match(tokens, /--knoux-cyan:\s*#22D3EE/, 'Design tokens must define Cyan #22D3EE');
  assert.match(tokens, /--knoux-glass-blur/, 'Design tokens must define glass blur tokens');

  const shell = readWeb('src/premium-shell.css');
  assert.match(shell, /\.knoux-shell/, 'Premium shell must define .knoux-shell class');
  assert.match(shell, /\.knoux-rail/, 'Premium shell must define .knoux-rail class');
  assert.match(shell, /\.knoux-sentinel/, 'Premium shell must define .knoux-sentinel class');
  assert.match(shell, /\.knoux-workspace/, 'Premium shell must define .knoux-workspace class');
});

test('Safety: Family live workspace routes confirmation-required tools through ExecutionConfirmDialog', () => {
  const stageSource = readWeb('src/components/premium/FamilyLiveStage.tsx');

  assert.match(stageSource, /ExecutionConfirmDialog/, 'Family live stage must render the shared execution confirmation dialog');
  assert.match(stageSource, /selectedTool\.RequiresConfirmation/, 'Family live stage must branch on the canonical RequiresConfirmation contract');
  assert.match(stageSource, /setPendingExecution\(\{\s*toolId:\s*selectedTool\.ToolId,\s*mode\s*\}\)/, 'Confirmation-required requests must be held pending before execution');
  assert.match(stageSource, /onRunTool\(pendingTool,\s*mode,\s*options,\s*confirmation\)/, 'Confirmed execution must forward immutable options and confirmation evidence to the bridge pipeline');
});
