import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8');

const surface = read('src/components/workspace/StationInventorySurface.tsx');
const surfaceCss = read('src/components/workspace/station-inventory.css');
const programs = read('src/features/stations/station04/ProgramsStation.tsx');
const programsModel = read('src/features/stations/station04/programsModel.ts');
const programsCss = read('src/features/stations/station04/programs-inventory.css');
const drivers = read('src/features/stations/station14/DriversStation.tsx');
const driversCss = read('src/features/stations/station14/drivers-inventory.css');
const serviceApps = read('src/components/ServiceApps.tsx');
const familyPage = read('src/components/premium/FamilyPage.tsx');
const familyStage = read('src/components/premium/FamilyLiveStage.tsx');
const app = read('src/App.tsx');

// ---------------------------------------------------------------------------
// The shared primitive, not 18 private dashboards
// ---------------------------------------------------------------------------

test('stations share one inventory primitive instead of building their own', () => {
  assert.equal((programs.match(/<StationInventorySurface/g) ?? []).length, 1);
  assert.equal((drivers.match(/<StationInventorySurface/g) ?? []).length, 1);
  // A station may not hand-roll a second search box for the same inventory.
  assert.doesNotMatch(programs, /programs-inv-search/);
  assert.doesNotMatch(drivers, /drivers-inv-search/);
});

test('the primitive separates the four unmeasured and measured states', () => {
  // not-checked, checking, genuinely empty, and filtered-to-nothing are distinct.
  for (const state of ['not-checked', 'checking', 'empty', 'no-match', 'ready']) {
    assert.ok(surface.includes(`'${state}'`), `missing state: ${state}`);
  }
  assert.match(surface, /rows !== null/);
  assert.match(surface, /'Not checked yet'|notChecked/);
});

test('the primitive never renders a number for an unmeasured filter count', () => {
  // Filter chips show a dash until the source has actually been read.
  assert.match(surface, /measured \? count : '—'/);
});

test('an unmeasured value sorts last and never becomes a fake zero', () => {
  assert.match(surface, /if \(left === null && right === null\) return 0;/);
  assert.match(surface, /if \(left === null\) return 1;/);
  assert.match(surface, /if \(right === null\) return -1;/);
});

test('the primitive exposes search, filters, sorting and an inspector', () => {
  assert.match(surface, /type="search"/);
  assert.match(surface, /role="group"/);
  assert.match(surface, /aria-sort/);
  assert.match(surface, /knoux-inventory__inspector/);
  assert.match(surface, /data-inspector=/);
  // Selecting a row opens the inspector instead of navigating away.
  assert.match(surface, /setSelectedKey\(selectedKey === key \? null : key\)/);
});

test('the primitive keeps the inspector beside the list and drops it on narrow widths', () => {
  assert.match(surfaceCss, /grid-template-columns: minmax\(0, 1fr\) minmax\(240px, 300px\)/);
  assert.match(surfaceCss, /@media \(max-width: 900px\)/);
});

test('the primitive is Arabic-aware', () => {
  assert.match(surface, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/);
  assert.match(surface, /lang === 'ar' \? 'ar' : 'en'/);
  assert.match(surfaceCss, /\[dir='rtl'\]/);
});

// ---------------------------------------------------------------------------
// Station 04 — Programs & Applications must be rich, not four cards
// ---------------------------------------------------------------------------

test('Programs reads the real live software preview instead of requiring a tool run', () => {
  assert.match(programs, /api\.softwarePreview\(\)/);
  assert.match(programs, /buildProgramInventory/);
});

test('Programs merges preview and tool rows without duplicating or inventing rows', () => {
  assert.match(programsModel, /if \(byKey\.has\(key\)\) continue;/);
  assert.match(programsModel, /origin: 'live-preview'/);
  assert.match(programsModel, /origin: 'tool-output'/);
});

test('Programs capability truth is typed, not read through an unknown cast', () => {
  assert.match(programsModel, /repairCapability\?: boolean \| null/);
  assert.match(programsModel, /updateCapability\?: boolean \| null/);
  assert.match(programsModel, /openCapability\?: boolean \| null/);
  // The old escape hatch is gone.
  assert.doesNotMatch(programs, /as unknown as Record<string, unknown>/);
});

test('Programs keeps capability truth unknown until a real source proves it', () => {
  // null means "not proven", which is neither true nor false.
  assert.match(programsModel, /const truthy = \(value: unknown\): boolean \| null/);
  assert.match(programs, /row\.repairCapability === null/);
  assert.match(programsModel, /repairable: truthy\(item\.RepairCapability\) === true/);
});

test('Programs exposes real filters, sortable columns and a detail inspector', () => {
  for (const key of ['removable', 'repairable', 'updatable', 'desktop', 'appx', 'largest', 'unknown-size']) {
    assert.ok(programs.includes(`key: '${key}'`), `missing filter: ${key}`);
  }
  assert.match(programs, /sortInitial=\{\{ key: 'name', direction: 'asc' \}\}/);
  assert.match(programs, /inspector=\{\(row, close\)/);
  assert.match(programsCss, /programs-inv-inspector/);
});

test('Programs reports provenance so the user knows which source a row came from', () => {
  assert.match(programs, /row\.origin === 'live-preview'/);
  assert.match(programs, /programs-inv-evidence/);
});

test('Programs search reaches the real fields a user would type', () => {
  assert.match(programs, /row\.installLocation, row\.packageProvider/);
  assert.match(programs, /Search name, publisher, version, source, install path/);
});

// ---------------------------------------------------------------------------
// Station 14 — a real device/driver centre
// ---------------------------------------------------------------------------

test('Drivers exposes a real searchable, filterable, sortable inventory', () => {
  for (const key of ['attention', 'unsigned', 'signed', 'third-party', 'legacy']) {
    assert.ok(drivers.includes(`key: '${key}'`), `missing filter: ${key}`);
  }
  assert.match(drivers, /sortInitial=\{\{ key: 'device', direction: 'asc' \}\}/);
  assert.match(drivers, /inspector=\{\(driver, close\)/);
  assert.match(driversCss, /drivers-inv-inspector/);
});

test('Drivers search reaches device, provider, class and INF', () => {
  assert.match(drivers, /driver\.InfName, driver\.Version, driver\.ProviderGroup/);
});

test('Drivers unmeasured driver date reads as unmeasured, not as zero years', () => {
  assert.match(drivers, /driver\.AgeYears === null/);
  assert.match(drivers, /'Not measured'/);
});

test('the driver inventory is fed only when the local inventory really returned drivers', () => {
  assert.match(drivers, /const driverRows = useMemo<DriverPreviewItem\[\] \| null>/);
  assert.match(drivers, /inventoryMeasured \? allDrivers : null/);
});

test('device classes hand a real search term to the inventory instead of a dead click', () => {
  assert.match(drivers, /setInventoryQuery\(c\.Class\)/);
  assert.match(drivers, /initialQuery=\{inventoryQuery\}/);
  assert.match(surface, /initialQuery = ''/);
});

test('Drivers shows signature state and a real problem code in the inspector', () => {
  assert.match(drivers, /data-signed=\{signatureState\(driver\)\}/);
  assert.match(drivers, /driver\.ProblemCode === 0/);
  assert.match(drivers, /driver\.ReviewSignals\.map/);
});

test('an absent review signal is scoped, never presented as a clean bill of health', () => {
  assert.match(drivers, /does not verify signature policy beyond the signature check itself/);
});

test('a registry entry with no identity is not counted as an unsigned driver', () => {
  // Signed:false on a record with no identity means "no data", not "unsigned".
  assert.match(drivers, /const hasIdentity = \(driver: DriverPreviewItem\)/);
  assert.match(drivers, /if \(!hasIdentity\(driver\)\) return 'unreported';/);
  assert.match(drivers, /test: driver => signatureState\(driver\) === 'unsigned'/);
  assert.match(drivers, /test: driver => signatureState\(driver\) === 'signed'/);
});

test('signature state is a three-way truth, not a boolean', () => {
  assert.match(drivers, /'signed' \| 'unsigned' \| 'unreported'/);
  assert.match(drivers, /Signature not reported/);
  assert.match(drivers, /data-signed=\{signatureState\(driver\)\}/);
  assert.match(driversCss, /data-signed='unreported'/);
  assert.match(driversCss, /data-tone='none'/);
});

test('an unidentified entry still needs a stable row key', () => {
  assert.match(drivers, /const driverKey = \(driver: DriverPreviewItem\)/);
  assert.match(drivers, /rowKey=\{driverKey\}/);
  // The old key was the INF name, which is empty on exactly these entries.
  assert.doesNotMatch(drivers, /rowKey=\{driver => driver\.InfName\}/);
});

test('measured-but-empty fields are not dressed up as unmeasured ones', () => {
  assert.match(drivers, /const reported = \(value: string \| null \| undefined\)/);
  assert.match(drivers, /Not reported/);
  // AgeYears null is the genuinely unmeasured case and keeps its own wording.
  assert.match(drivers, /driver\.AgeYears === null/);
  assert.match(drivers, /Not measured/);
});

// ---------------------------------------------------------------------------
// Cross-station contract: driver updates belong to Station 17
// ---------------------------------------------------------------------------

test('Drivers reads driver-offer discovery from Station 17 instead of duplicating it', () => {
  assert.match(drivers, /api\.postInstallPreview\(\)/);
  assert.match(drivers, /res\.preview\.DriverOffers/);
  // It must not construct its own DriverOffers result shape.
  assert.doesNotMatch(drivers, /DriverOffers\s*[:=]\s*\{/);
  assert.doesNotMatch(drivers, /Offers:\s*\[/);
});

test('driver offers read Not checked yet until Station 17 has actually reported', () => {
  assert.match(drivers, /const offersKnown = driverOffers !== null;/);
  assert.match(drivers, /const offersAvailable = driverOffers\?\.Available === true;/);
  assert.match(drivers, /'Updates available: not checked yet'/);
  // A discovered-but-empty result is a real zero, which is a different state.
  assert.match(drivers, /'Updates available: not offered by Windows Update'/);
});

test('the driver offer hand-off names the owning station and links to it', () => {
  assert.match(drivers, /'17-PostInstall-Setup'/);
  assert.match(drivers, /'software' as FamilyId/);
  assert.match(drivers, /Open driver offers/);
  assert.match(drivers, /belongs to the Post-Install station/);
});

test('the cross-station link is threaded to the station, not a local stub', () => {
  assert.match(app, /onNavigateService=\{\(family, service\) => navigateTo/);
  assert.match(familyPage, /onNavigateService\?: \(family: FamilyId, service: ServiceId\)/);
  assert.match(familyStage, /onNavigateService=\{onNavigateService\}/);
  assert.match(serviceApps, /onNavigateService=\{onNavigateService\}/);
  assert.match(drivers, /onNavigateService\?: \(family: FamilyId, service: ServiceId\)/);
});
