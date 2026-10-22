import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * KNOUX Repair — the family studios.
 *
 * Six families, six studios, one grammar. A studio landing is a *measurement*
 * surface: stations backed by real bridge readings, nothing else. The
 * canonical inventory is unchanged — 6 families, 18 services, 158 tools — and
 * these tests pin that alongside the truthfulness contract of the three
 * studios added after the Storage Studio.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8');

const familyPage = read('src/components/premium/FamilyPage.tsx');
const grid = read('src/components/studios/studioStations.tsx');
const gridCss = read('src/components/studios/studioStations.css');
const shell = read('src/components/studios/StudioShell.tsx');
const shellCss = read('src/components/studios/studioShell.css');
const storage = read('src/components/pages/StorageStudio.tsx');
const investigation = read('src/components/pages/InvestigationStudio.tsx');
const assurance = read('src/components/pages/AssuranceStudio.tsx');
const workbench = read('src/components/pages/WorkbenchStudio.tsx');
const familyMap = read('src/data/family-map.ts');

const STUDIOS = [
  { name: 'Investigation', file: investigation, family: 'investigation', services: ['10-Diagnostics-Reports', '07-Services-Processes'], visual: 'InvestigationHoloVisual' },
  { name: 'Assurance', file: assurance, family: 'assurance', services: ['03-Network-Internet', '09-Security', '13-Privacy', '14-Driver-Management'], visual: 'AssuranceHoloVisual' },
  { name: 'Workbench', file: workbench, family: 'workbench', services: ['12-Developer-Tools', '18-Project-Sonar'], visual: 'WorkbenchHoloVisual' },
];

test('the canonical inventory is unchanged: 6 families, 18 services, 158 tools', () => {
  assert.match(familyMap, /INVARIANTS\s*=\s*\{/);
  assert.match(familyMap, /tools:\s*158/);
  // The per-family tool counts the architecture test pins.
  for (const [family, tools] of [['vitality', 26], ['recovery', 37], ['assurance', 29], ['software', 24], ['workbench', 20], ['investigation', 22]]) {
    const index = familyMap.indexOf(`id: '${family}'`);
    assert.ok(index > 0, `family ${family} must exist`);
    const window = familyMap.slice(index, index + 400);
    assert.match(window, new RegExp(`expectedTools: ${tools}\\b`), `${family} must still own ${tools} tools`);
  }
});

test('every family landing is a studio built on the shared grammar', () => {
  // Six studios, one grammar: a header, a masthead, the station grid, the
  // notice, the spotlight and the closing note.
  assert.match(shell, /<StudioHeader/);
  assert.match(shell, /knoux-studio-masthead/);
  assert.match(shell, /knoux-studio-notice/);
  assert.match(shell, /knoux-studio-spotlight/);
  assert.match(shell, /knoux-studio-truth/);
  assert.match(grid, /knoux-studio-stations/);
  assert.match(grid, /knoux-studio-station\b/);
  assert.match(gridCss, /\.knoux-studio-station\b/);
  assert.match(shellCss, /\.knoux-studio-masthead/);

  // The studios that already existed and the three new ones all use it.
  for (const source of [storage, investigation, assurance, workbench]) {
    assert.match(source, /<StudioShell/);
    assert.match(source, /<StudioStationGrid/);
  }
});

test('each new studio is the landing surface of its own family', () => {
  for (const studio of STUDIOS) {
    assert.match(familyPage, new RegExp(`import ${studio.name}Studio from '\\.\\./pages/${studio.name}Studio'`), `${studio.name} must be imported`);
    assert.match(familyPage, new RegExp(`family\\.id === '${studio.family}'`), `${studio.family} must route to its studio`);
    assert.match(familyPage, new RegExp(`<${studio.name}Studio`), `${studio.name} must be mounted`);
    assert.equal((familyPage.match(new RegExp(`<${studio.name}Studio`, 'g')) ?? []).length, 1, `${studio.name} must be mounted exactly once`);
  }
  // The storage studio stays the recovery landing.
  assert.match(familyPage, /family\.id === 'recovery'/);
  assert.match(familyPage, /<StorageStudio/);
});

test('every station of every new studio reads from the bridge', () => {
  // Investigation reads the diagnostics and operations previews.
  assert.match(investigation, /api\.diagnosticsPreview/);
  assert.match(investigation, /api\.operationsPreview/);
  // Assurance reads the network, privacy and driver previews, and the live
  // system snapshot for the protection state.
  assert.match(assurance, /api\.networkPreview/);
  assert.match(assurance, /api\.privacyPreview/);
  assert.match(assurance, /api\.driversPreview/);
  assert.match(assurance, /DefenderRunning/);
  assert.match(assurance, /DefenderRealtime/);
  assert.match(assurance, /DefenderSignatures/);
  // The firewall state is read, never assumed: a missing snapshot is
  // "unavailable", not "enabled".
  assert.match(assurance, /systemSnapshot\?\.Firewall \?\? null/);
  // The workbench reads the developer runtime inventory, the workspace roots
  // and the Sonar AI status.
  assert.match(workbench, /api\.advancedSoftwarePreview/);
  assert.match(workbench, /api\.folderRoots/);
  assert.match(workbench, /api\.sonarAiStatus/);
});

test('no studio invents a number', () => {
  for (const source of [storage, investigation, assurance, workbench]) {
    assert.doesNotMatch(source, /Math\.random/);
    assert.doesNotMatch(source, /\bTODO\b|\bFIXME\b/);
    assert.doesNotMatch(source, /256\s*GB/);
  }
});

test('no studio executes anything: selection opens, it does not act', () => {
  for (const source of [storage, investigation, assurance, workbench, grid]) {
    assert.doesNotMatch(source, /api\.[a-zA-Z]*(quarantine|restore|delete|execute|startRun|cleanupRun)/);
  }
  // The station button only opens the owning service.
  assert.match(grid, /onSelectService\(station\.id\)/);
  assert.doesNotMatch(grid, /api\.startRun|api\.duplicatesEngineQuarantine/);
});

test('a station never borrows another station state', () => {
  // The security station is judged by the system snapshot, the disk station
  // by the volume list, and the rest by their own probe.
  assert.match(assurance, /station\.id === '09-Security'/);
  assert.match(storage, /station\.id === '06-Disk-Space'/);
  // And the shared helper keeps the four states apart.
  assert.match(grid, /export function stationStateFor/);
  assert.match(grid, /if \(!measured\) return 'offline';/);
  assert.match(grid, /if \(probe === 'error'\) return 'error';/);
  assert.match(grid, /return hasReading \? 'measured' : 'empty';/);
});

test('every studio keeps its own visual identity', () => {
  for (const studio of STUDIOS) {
    assert.match(studio.file, new RegExp(studio.visual), `${studio.name} must keep its hero visual`);
  }
  // And the visuals are still owned by the module that ships them.
  const heroVisuals = read('src/components/premium/HeroVisuals.tsx');
  for (const studio of STUDIOS) {
    assert.match(heroVisuals, new RegExp(`export function ${studio.visual}`), `${studio.visual} must still exist`);
  }
});

test('the workbench service contract is untouched', () => {
  // The workbench station still owns every service view of its family; the
  // studio only adds the landing that was missing.
  assert.match(familyPage, /showWorkbenchStation = family\.id === 'workbench' && selectedService !== null/);
  assert.match(familyPage, /<EngineeringWorkbenchStation/);
  assert.match(workbench, /The workbench station itself is unchanged/);
});

test('the family overview keeps its own spotlights', () => {
  // The recovery and assurance families keep their action surfaces; the
  // investigation and workbench families never had one.
  assert.match(familyPage, /<RecoverySpotlight/);
  assert.match(familyPage, /<AssuranceSpotlight/);
  // The assurance spotlight is mounted inside its studio, not beside it.
  assert.match(familyPage, /<AssuranceStudio[\s\S]{0,600}<AssuranceSpotlight/);
});

test('an offline bridge produces an empty surface, not a plausible number', () => {
  for (const source of [storage, investigation, assurance, workbench]) {
    assert.match(source, /bridgeOnline === false/);
    assert.match(source, /Not measured yet/);
  }
  // The shared grid renders the empty line rather than a number.
  assert.match(grid, /knoux-studio-station__empty/);
  assert.match(gridCss, /\.knoux-studio-station__empty/);
});
