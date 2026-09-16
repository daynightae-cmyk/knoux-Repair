import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const familyPage = read('src/components/premium/FamilyPage.tsx');
const overview = read('src/components/pages/FamilyOverviewPage.tsx');
const overviewCss = read('src/components/pages/FamilyOverviewPage.css');
const software = read('src/components/pages/SoftwareLibraryPage.tsx');
const softwareCss = read('src/software-library-command-deck.css');
const main = read('src/main.tsx');

const serviceIds = [
  '01-System-Maintenance', '02-System-Cleanup', '03-Network-Internet', '04-Programs-Applications',
  '05-Duplicate-Files', '06-Disk-Space', '07-Services-Processes', '08-Performance', '09-Security',
  '10-Diagnostics-Reports', '11-Backup-Recovery', '12-Developer-Tools', '13-Privacy',
  '14-Driver-Management', '15-System-Monitoring', '16-Software-Environment', '17-PostInstall-Setup',
  '18-Project-Sonar',
];

test('family landing is distinct from service execution and does not replace the live station path', () => {
  assert.match(familyPage, /showFamilyOverview = selectedService === null && selectedTool === null && executionTool === null/);
  assert.match(familyPage, /<FamilyOverviewPage/);
  assert.match(familyPage, /<SoftwareLibraryPage/);
  assert.match(familyPage, /<FamilyLiveStage/);
  assert.match(familyPage, /<EngineeringWorkbenchStation/);
  assert.match(familyPage, /<DuplicateStation/);
  assert.match(familyPage, /data-service=\{activeService\.id\}/);
});

test('five non-software family landings use distinct operational visual languages', () => {
  for (const visual of ['VitalityHoloVisual', 'RecoveryHoloVisual', 'AssuranceHoloVisual', 'WorkbenchHoloVisual', 'InvestigationHoloVisual']) {
    assert.match(overview, new RegExp(visual));
  }
  for (const family of ['vitality', 'recovery', 'assurance', 'workbench', 'investigation']) {
    assert.match(overviewCss, new RegExp(`data-family=['\"]${family}['\"]`));
  }
  assert.match(overviewCss, /@media \(max-width:980px\)/);
  assert.match(overviewCss, /prefers-reduced-motion/);
});

test('family context uses only system snapshot and bridge evidence, never synthetic telemetry', () => {
  assert.match(overview, /systemSnapshot/);
  assert.match(overview, /snapshot\.CpuLoad/);
  assert.match(overview, /snapshot\.Drives/);
  assert.match(overview, /snapshot\.Firewall/);
  assert.match(overview, /No live system snapshot has been received yet/);
  assert.doesNotMatch(overview, /Math\.random|setTimeout|fake|mock telemetry/i);
});

test('Assurance preserves observed false Defender states instead of relabeling them unknown', () => {
  assert.match(overview, /snapshot\.DefenderRunning === false/);
  assert.match(overview, /NOT RUNNING/);
  assert.match(overview, /لا يعمل/);
  assert.match(overview, /snapshot\.DefenderRealtime === false/);
  assert.match(overview, /DISABLED/);
  assert.match(overview, /معطلة/);
  assert.doesNotMatch(overview, /snapshot\.DefenderRunning \?[^\n]+NOT OBSERVED/);
  assert.doesNotMatch(overview, /snapshot\.DefenderRealtime \?[^\n]+NOT OBSERVED/);
});

test('Software Library remains a specialized three-workspace command deck backed by real manifest counts', () => {
  for (const id of ['04-Programs-Applications', '16-Software-Environment', '17-PostInstall-Setup']) {
    assert.match(software, new RegExp(id));
  }
  assert.match(software, /tool\.Category === service\.id/);
  assert.match(software, /bridgeOnline === true/);
  assert.match(software, /Selection is not execution/);
  assert.match(main, /software-library-command-deck\.css/);
  assert.match(softwareCss, /@media/);
  assert.doesNotMatch(software, /Math\.random|fake installed|mock apps/i);
});

test('all 18 canonical services remain represented after visual reconciliation', () => {
  const map = read('src/data/family-map.ts');
  for (const id of serviceIds) assert.match(map, new RegExp(id));
});
