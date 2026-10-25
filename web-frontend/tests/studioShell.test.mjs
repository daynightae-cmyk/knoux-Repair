/**
 * KNOUX Repair — Adaptive Studio Shell
 *
 * Locks the invariants of the redesigned shell:
 *   - one navigation spine, six studios, eighteen services, one registry
 *   - a contextual service navigation instead of stacked rails
 *   - a collapsible, contextual inspector
 *   - one global execution dock with the real SELECT..REPORT stage chain
 *   - no fabricated success anywhere in the shell
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const read = (relativePath) => fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');

const app = read('src/App.tsx');
const rail = read('src/components/premium/LeftRail.tsx');
const familyPage = read('src/components/premium/FamilyPage.tsx');
const inspector = read('src/components/premium/SentinelPanel.tsx');
const registry = read('src/data/studio-registry.ts');
const icons = read('src/data/studio-icons.ts');
const drawer = read('src/components/shell/ExecutionDrawer.tsx');
const header = read('src/components/shell/StudioHeader.tsx');
const navigation = read('src/components/shell/StudioNavigation.tsx');
const inventory = read('src/components/shell/EntityInventory.tsx');
const shellCss = read('src/components/shell/studio-shell.css');
const main = read('src/main.tsx');

test('the studio registry derives every studio from the canonical family map', () => {
  assert.match(registry, /import \{ FAMILIES, ALL_SERVICES, SERVICE_TO_FAMILY \} from '\.\/family-map'/);
  assert.match(registry, /export const STUDIOS: StudioDefinition\[\] = FAMILIES\.map\(buildStudio\)/);
  assert.match(registry, /export const STUDIO_BY_ID: Map<FamilyId, StudioDefinition>/);

  // The registry must never re-declare a family or a service id.
  const familyIds = ['vitality', 'recovery', 'assurance', 'software', 'workbench', 'investigation'];
  for (const id of familyIds) {
    assert.ok(!new RegExp(`id:\\s*'${id}'`).test(registry.replace(/id:\s*'vitality',/g, '')), `registry must not redeclare ${id}`);
  }
  assert.doesNotMatch(registry, /expectedTools:\s*\d+/, 'tool counts must come from the canonical map, never be re-declared');
  assert.doesNotMatch(registry, /legacySection/, 'route ownership must stay in the canonical map');
});

test('the navigation spine exposes Home, AI Scan, six studios, Action Center and Settings', () => {
  for (const id of ['home', 'ai-scan', 'action-center', 'settings']) {
    assert.ok(rail.includes(`id: '${id}'`), `spine must expose ${id}`);
  }
  assert.match(rail, /const STUDIO_ITEMS: NavItem\[\] = FAMILIES\.map\(/);
  assert.match(rail, /import \{ FAMILIES \} from '\.\.\/\.\.\/data\/family-map'/);

  // One shared icon registry — no competing glyph maps.
  assert.match(icons, /export const FAMILY_ICONS: Record<FamilyId, IconComponent>/);
  assert.match(icons, /export const SERVICE_ICONS: Record<ServiceId, IconComponent>/);
  assert.match(icons, /export function iconForDestination/);
});

test('the spine is collapsible and reachable by keyboard', () => {
  assert.match(rail, /Ctrl\+B|ctrlKey \|\| e\.metaKey/);
  assert.match(rail, /setExpanded\(value => !value\)/);
  assert.match(rail, /data-expanded=\{expanded\}/);
  assert.match(rail, /aria-current=\{isActive \? 'page' : undefined\}/);
});

test('the service rail becomes a contextual navigation strip instead of a stacked sidebar', () => {
  // The canonical class names stay (DOM contract), but the new shell turns
  // the rail into a horizontal strip inside the workspace.
  assert.match(familyPage, /knoux-command-service-rail/);
  assert.match(familyPage, /<StudioNavigation/);
  assert.match(familyPage, /knoux-studio-workspace/);

  assert.match(shellCss, /\.knoux-family-page\.knoux-studio-workspace\[data-family\] \.knoux-command-service-rail \{/);
  assert.match(shellCss, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(shellCss, /\.knoux-family-page\.knoux-studio-workspace\[data-family\] > \.knoux-command-service-rail \{/);
  assert.match(shellCss, /\.knoux-family-page\.knoux-studio-workspace\[data-family\] > \.knoux-command-tool-rail \{/);
  assert.match(shellCss, /\.knoux-family-page\.knoux-studio-workspace\[data-family\] > \.knoux-command-live-column \{/);
  // The work surface must keep a real height, otherwise the station collapses.
  assert.match(shellCss, /min-height: calc\(100vh - 132px\) !important/);
});

test('the studio header states identity and real metrics without a giant hero', () => {
  assert.match(header, /export default function StudioHeader/);
  assert.match(header, /knoux-studio-header/);
  assert.match(familyPage, /<StudioHeader/);
  // The brief is collapsed by default: the hero never pushes work below the fold.
  assert.match(familyPage, /const \[briefOpen, setBriefOpen\] = useState\(false\)/);
  assert.match(familyPage, /knoux-studio-brief/);
  assert.doesNotMatch(header, /min-height:\s*clamp\(/);
});

test('the inspector is contextual and collapsible and never a permanent wide column', () => {
  assert.match(inspector, /collapsed\?: boolean/);
  assert.match(inspector, /onToggleCollapse\?: \(\) => void/);
  assert.match(inspector, /data-collapsed=\{collapsed\}/);
  assert.match(inspector, /knoux-inspector/);

  // The shell guard that keeps the inspector off Home stays intact.
  assert.match(app, /activeView !== 'home' && !selectedToolId && <SentinelPanel/);

  // Telemetry lives in a section, not a permanent full-height telemetry wall.
  assert.match(inspector, /data-section="system"/);
  assert.match(inspector, /data-section="operation"/);
  assert.match(shellCss, /--knoux-inspector-width-collapsed: 52px/);
});

test('the inspector keeps the workbench live probe contract', () => {
  for (const call of [
    'api.health()',
    "api.categoryTools('12-Developer-Tools')",
    "api.categoryTools('18-Project-Sonar')",
    'api.sonarAiStatus()',
    'api.system()',
  ]) {
    assert.ok(inspector.includes(call), `missing live probe: ${call}`);
  }
  assert.match(inspector, /Promise\.allSettled\(/);
  assert.match(inspector, /setTimeout\(\(\) => void probe\(\), 8000\)/);
  assert.match(inspector, /api\.advancedSoftwarePreview\(\)/);
  assert.match(inspector, /onClick=\{\(\) => void runDeveloperDeepProbe\(\)\}/);
});

test('one global execution dock carries the whole SELECT..REPORT chain', () => {
  for (const stage of ['select', 'preview', 'confirm', 'execute', 'verify', 'report']) {
    assert.ok(drawer.includes(`id: '${stage}'`), `drawer must model the ${stage} stage`);
  }
  assert.match(drawer, /export default function ExecutionDrawer/);
  assert.match(app, /<ExecutionDrawer/);

  // Real state only: no fabricated progress, no invented percentage.
  assert.doesNotMatch(drawer, /Math\.random/);
  assert.doesNotMatch(drawer, /%\s*complete|fakeProgress|simulate/);
  assert.match(drawer, /detectReportPath/);
  assert.match(drawer, /Not observed yet/);
  assert.match(drawer, /The run was cancelled\. The operation was not performed\./);
});

test('the shell has one canonical inventory primitive, not a competing list', () => {
  assert.match(inventory, /import \{ StationInventorySurface \} from '\.\.\/workspace\/StationInventorySurface'/);
  assert.match(inventory, /rows: Row\[\] \| null/);
  assert.match(inventory, /empty: InventoryEmptyLabels/);
  assert.match(inventory, /null means nothing has been measured yet; \[\] means measured and genuinely empty/);
});

test('the shell stylesheet loads last so it owns the layout', () => {
  const shell = main.indexOf("import './components/shell/studio-shell.css'");
  const others = ['premium-shell.css', 'premium-cinematic.css', 'command-center.css', 'family-preview.css']
    .map(file => main.indexOf(`import './${file}'`));
  assert.ok(shell >= 0, 'the studio shell stylesheet must be loaded');
  for (const other of others) {
    assert.ok(other >= 0 && other < shell, `${other} must load before the studio shell stylesheet`);
  }
});

test('the shell never fabricates tool counts, telemetry or success', () => {
  assert.doesNotMatch(app, /158\s*(Tools|TOOLS)/);
  assert.doesNotMatch(rail, /158/);
  assert.doesNotMatch(inspector, /Math\.random/);
  assert.doesNotMatch(drawer, /Math\.random/);
  assert.match(app, /System Workspace: Ready/);
  assert.match(app, /System Workspace: Offline/);
  assert.match(app, /tools registered/);
});
