import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * KNOUX Repair — Vitality Lab, and the cross-cutting execution dock.
 *
 * The System Vitality studio became an observatory over real readings, and
 * AI Scan / Action Center now report into the same execution dock. These
 * tests lock the contracts that make that honest: the canonical model is
 * reused instead of re-implemented, the numbers come from the bridge, the
 * sampler cannot pile up requests, and the dock has exactly one execution
 * surface.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8');

const lab = read('src/components/pages/VitalityLab.tsx');
const labCss = read('src/components/pages/vitality-lab.css');
const familyPage = read('src/components/premium/FamilyPage.tsx');
const drawer = read('src/components/shell/ExecutionDrawer.tsx');
const activity = read('src/lib/shellActivity.ts');
const aiScan = read('src/components/pages/AIScanPage.tsx');
const actionCenter = read('src/components/pages/ActionCenterPage.tsx');
const app = read('src/App.tsx');

test('the Vitality studio is a live lab, not a wall of tool buttons', () => {
  assert.match(familyPage, /import VitalityLab from '\.\.\/pages\/VitalityLab'/);
  assert.match(familyPage, /family\.id === 'vitality'/);
  assert.match(familyPage, /<VitalityLab/);
  assert.equal((familyPage.match(/<VitalityLab/g) ?? []).length, 1);

  // The lab is a workspace of its own, not the generic family overview.
  assert.match(lab, /export default function VitalityLab/);
  assert.match(lab, /knoux-vitality-lab/);
});

test('the lab reuses the canonical performance model instead of re-deriving it', () => {
  assert.match(lab, /import \{[\s\S]*analyzeBottlenecks,[\s\S]*derivePerformanceCondition,[\s\S]*\} from '\.\.\/\.\.\/features\/stations\/station08\/performanceModel'/);
  assert.match(lab, /derivePerformanceCondition\(cpuLoad, memoryLoad\)/);
  assert.match(lab, /analyzeBottlenecks\(cpuLoad, memoryLoad, diskActive, optimization\?\.Signals \?\? \[\]\)/);

  // No local health score, no invented percentage.
  assert.doesNotMatch(lab, /Math\.random/);
  assert.doesNotMatch(lab, /healthScore|overallScore|percentComplete/);
});

test('every lab number comes from the bridge', () => {
  assert.match(lab, /api\.system\(\)/);
  assert.match(lab, /api\.optimizationPreview\(\)/);
  // The condition is derived from measured CPU and memory only.
  assert.match(lab, /const cpuLoad = live\?\.CpuLoad \?\? optimization\?\.Cpu\.LoadPercent \?\? null/);
  // The disks and consumers are the bridge's own lists.
  assert.match(lab, /optimization\?\.Disks \?\? \[\]/);
  assert.match(lab, /optimization\?\.TopProcesses \?\? \[\]/);
});

test('the sampler never piles up requests against a slow bridge', () => {
  assert.match(lab, /samplingRef\.current/);
  assert.match(lab, /if \(bridgeOnline !== true \|\| samplingRef\.current\) return;/);
  // The timeline reports the span the samples really cover.
  assert.match(lab, /const sampleSpanSeconds = samples\.length > 1/);
  assert.match(lab, /sampleSpanLabel/);
});

test('the lab states the truth when nothing has been measured', () => {
  assert.match(lab, /Not measured/);
  assert.match(lab, /Not checked yet/);
  assert.match(lab, /Waiting for the first samples/);
  assert.match(lab, /No bottleneck crossed its threshold/);
});

test('the lab offers the owning workbench and the investigating tool', () => {
  assert.match(lab, /onSelectService\(service\.id\)/);
  assert.match(lab, /onSelectTool\(item\.toolId\)/);
  assert.match(lab, /Investigate with/);
  assert.match(lab, /family\.services\.map/);
});

test('the execution dock has exactly one surface for tool runs and guided activity', () => {
  assert.match(activity, /export interface ShellActivity/);
  assert.match(activity, /export type ShellActivityStatus/);
  assert.match(drawer, /activity\?: ShellActivity \| null/);
  assert.match(drawer, /const activityMode = activity !== null && tool === null;/);
  // The same stage strip serves both, so there is no second execution model.
  assert.match(drawer, /activityMode[\s\S]*activity\?\.stages \?\? \[\]\)\.map/);
  assert.match(drawer, /STAGES\.map/);
  // A guided activity still never fabricates a success.
  assert.doesNotMatch(drawer, /Math\.random/);
});

test('AI Scan reports its real sweep into the dock', () => {
  assert.match(aiScan, /onActivity\?: \(activity: ShellActivity\) => void/);
  assert.match(aiScan, /const reportStage = \(index: number, line: string\)/);
  // The stages are the steps the scan really performs.
  for (const stage of ['vitals', 'storage', 'cleanup', 'drivers', 'findings']) {
    assert.ok(aiScan.includes(`id: '${stage}'`), `missing scan stage: ${stage}`);
  }
  assert.match(aiScan, /api\.system\(\)/);
  assert.match(aiScan, /api\.cleanupPreview\(\)/);
  assert.match(aiScan, /api\.driversPreview\(\)/);
  // The completion line states the real counts.
  assert.match(aiScan, /findings from \$\{verifiedSources\} verified sources/);
});

test('the Action Center shows the same operation the dock is running', () => {
  assert.match(actionCenter, /activity\?: ShellActivity \| null/);
  assert.match(actionCenter, /onOpenDock\?: \(\) => void/);
  assert.match(actionCenter, /CURRENT OPERATION/);
  assert.match(actionCenter, /activity\.stages\.map/);
  // The old hero banner is gone; the surface uses the studio grammar.
  assert.doesNotMatch(actionCenter, /knoux-hero/);
  assert.match(actionCenter, /<StudioHeader/);
});

test('the shell wires the activity through to the dock and the Action Center', () => {
  assert.match(app, /const \[shellActivity, setShellActivity\] = useState<ShellActivity \| null>\(null\)/);
  assert.match(app, /onActivity=\{setShellActivity\}/);
  assert.match(app, /activity=\{shellActivity\}/);
  assert.match(app, /onOpenDock=\{\(\) => setDrawerCollapsed\(false\)\}/);
  assert.match(app, /<ExecutionDrawer[^]*?activity=\{shellActivity\}/);
});
