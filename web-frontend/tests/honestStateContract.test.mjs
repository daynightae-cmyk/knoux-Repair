/**
 * KNOUX REPAIR — honest-state contract across the station surfaces.
 *
 * Each test pins a specific lie that was reachable by a real user, in the order
 * the product would have shown it to them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { actualRecoveredBytes, actualQuarantinedBytes } from '../src/features/stations/station02/cleanupModel.ts';
import { deriveSecurityPosture, securityCoverage } from '../src/features/stations/station09/securityModel.ts';
import { privacyCategories, filterSettingsByCategory } from '../src/features/stations/station13/privacyModel.ts';
import { extractDependencyEdges } from '../src/features/stations/station07/servicesModel.ts';
import { splitCandidates } from '../src/features/stations/station12/developerModel.ts';
import { buildCacheCandidates, buildResidualCandidates, parseMeasuredPaths, calculateCacheSummary }
  from '../src/features/stations/station04/programsModel.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(resolve(here, '..', rel), 'utf8');
const station = (n, file) => read(`src/features/stations/station${String(n).padStart(2, '0')}/${file}`);

/* ── 11 Backup & Recovery ──────────────────────────────────────────────── */

test('an unreadable restore-point source never says "no restore point"', () => {
  const source = station(11, 'RecoveryStation.tsx');
  // A grey icon, an honest "count not reported" and the caption "No restore
  // point" all rendered at once, directly under the honest number.
  assert.doesNotMatch(
    source,
    /summary\.restorePointsCount > 0\s*\n?\s*\?[^:]*:\s*\n?\s*\(lang === 'ar'[^)]*\)\s*:\s*'No restore point'\s*\n?\s*\}\}/,
    'the restore-point caption must branch on readability first'
  );
  assert.match(source, /summary\.restorePointsRead === 'UNREADABLE'\s*\n?\s*\?/);
  assert.match(source, /Restore points could not be read/);
  // History must read both casings, and must not print a fabricated count.
  assert.match(source, /itemsProcessed: readEnvelopeNumber\(terminalResult, 'itemsProcessed'\)/);
  assert.match(source, /toLocaleString\(lang\)/);
});

/* ── 15 System Monitoring ──────────────────────────────────────────────── */

test('an observatory all-clear is only claimed after a live sample', () => {
  const source = station(15, 'MonitoringStation.tsx');
  // A green "zero processes unresponsive" used to render whenever preview was
  // null, i.e. before anything had been measured at all.
  assert.match(source, /\{!sampleMeasured \? \(/);
  assert.match(source, /unmeasuredUnresponsive/);
  assert.match(source, /noUnresponsiveMeasured/);
  // Service counts must not print a measured zero for an unsampled machine,
  // in the summary itself and not only at the render site.
  assert.doesNotMatch(source, /running: preview\?\.Services\?\.Running \?\? 0/);
  assert.doesNotMatch(source, /stopped: preview\?\.Services\?\.Stopped \?\? 0/);
  assert.match(source, /running: number \| null; stopped: number \| null; total: number \| null/);
  assert.match(source, /if \(!preview\?\.Services\) return \{ running: null, stopped: null, total: null \}/);
  assert.match(source, /\{sampleMeasured \? servicesSummary\.running : '—'\}/);
  // And a failed read must be visible, not silently "not checked yet".
  assert.match(source, /const \[previewError, setPreviewError\]/);
  assert.match(source, /setPreviewError\(/);
});

test('the observatory exposes real search, filters, sort and an inspector', () => {
  const source = station(15, 'MonitoringStation.tsx');
  assert.match(source, /StationInventorySurface<OperationsPreviewProcess>/);
  assert.match(source, /StationInventorySurface<OperationsPreviewService>/);
  assert.match(source, /sortInitial=\{\{ key: 'memory', direction: 'desc' \}\}/);
  assert.match(source, /inspector=\{renderProcessInspector\}/);
  assert.match(source, /inspector=\{renderServiceInspector\}/);
  // rows === null is what encodes "never sampled".
  assert.match(source, /\(\) => \(preview \? preview\.Processes\.TopMemory : null\)/);
});

/* ── 17 Post-Install ───────────────────────────────────────────────────── */

test('never-scanned never renders as a healthy provisioning result', () => {
  const source = station(17, 'PostInstallStation.tsx');
  // Three places claimed zero/no/none for a preview that had never been read,
  // contradicting the station's own honest "Not queried" overview tile.
  assert.match(source, /\{!previewData \? \(\s*<div className="empty-state-notice">/);
  // Whitespace-tolerant: the intent is that the empty branch is only reachable
  // once previewData exists and the offers list is genuinely empty.
  assert.match(source, /!previewData\.DriverOffers\.Offers\s*\|\|\s*previewData\.DriverOffers\.Offers\.length === 0/);
  assert.match(source, /!previewData\s*\? '—'\s*\n?\s*: previewData\.Winget\.Available/);
  assert.doesNotMatch(source, /previewData\?\.Winget\.Available \? 'Yes' : 'No'}/);
});

test('a provisioning selection is never mutated in place and never silently reused', () => {
  const source = station(17, 'PostInstallStation.tsx');
  // Sorting the live state array reorders the user's own selection.
  assert.doesNotMatch(source, /selectedAppSelections\.sort\(/);
  assert.doesNotMatch(source, /selectedDriverSelections\.sort\(/);
  assert.match(source, /\[\.\.\.selectedAppSelections\]\.sort\(/);
  assert.match(source, /\[\.\.\.selectedDriverSelections\]\.sort\(/);
  // A successful install consumes the selection, and a refreshed catalog
  // re-bases the retained indices so a renumbered list cannot install the
  // wrong package. The count must come from the catalog that was actually
  // read, not a field the station never had.
  assert.match(source, /if \(outcome === 'success'\) \{/);
  assert.match(source, /setSelectedAppSelections\(\[\]\)/);
  assert.match(source, /const appCount = res\.preview\.Catalog\?\.length \?\? 0/);
  assert.match(source, /const driverCount = res\.preview\.DriverOffers\?\.Offers\?\.length \?\? 0/);
});

/* ── 02 System Cleanup ─────────────────────────────────────────────────── */

test('quarantined bytes are never counted as reclaimed space', () => {
  // Quarantine is a move. The bytes still exist and are restorable, so adding
  // them to "actually recovered" claimed free space that was never freed.
  const outcome = { bytesActuallyRecovered: 500, bytesQuarantined: 300, bytesPermanentlyDeleted: 200 };
  assert.equal(actualRecoveredBytes(outcome), 200);
  assert.equal(actualQuarantinedBytes(outcome), 300);
  // A tool that only reports the legacy aggregate still reports honestly.
  assert.equal(actualRecoveredBytes({ bytesActuallyRecovered: 100, bytesQuarantined: 0, bytesPermanentlyDeleted: 0 }), 100);
  assert.equal(actualRecoveredBytes({ bytesPermanentlyDeleted: 40 }), 40);
  assert.equal(actualRecoveredBytes({}), 0);
});

test('the cleanup plan dialog enforces the phrase it prints', () => {
  const source = station(2, 'CleanupStation.tsx');
  // "Type CONFIRM to authorize permanent deletion" used to accept one character.
  assert.match(source, /const planPhraseAuthorized = planPhrase\.trim\(\)\.toUpperCase\(\) === TYPED_PHRASE/);
  assert.match(source, /disabled=\{\(!planDestructive \? false : !planPhraseAuthorized\)/);
  assert.match(source, /if \(planDestructive && phrase\.trim\(\)\.toUpperCase\(\) !== TYPED_PHRASE\)/);
  // A plan that stops early must account for the steps that never ran.
  assert.match(source, /Not executed:/);
});

test('the shared execution gate refuses a wrong destructive phrase', () => {
  const controller = read('src/features/stations/_shared/StationExecutionController.ts');
  assert.match(controller, /export const TYPED_PHRASE = 'CONFIRM'/);
  assert.match(controller, /confirmation\.phrase\.trim\(\)\.toUpperCase\(\) !== TYPED_PHRASE/);
});

/* ── 05 Duplicate Files ────────────────────────────────────────────────── */

test('duplicate quarantine and restore both require review and confirmation', () => {
  const source = station(5, 'DuplicateStation.tsx');
  // The engine path moved real files on the first click of a button labelled
  // REVIEW CLEANUP, and "Restore all" posted every id unconfirmed.
  assert.match(source, /setEngineConfirmOpen\(true\);/);
  assert.match(source, /aria-labelledby="dup-engine-confirm-title"/);
  assert.match(source, /aria-labelledby="dup-restore-confirm-title"/);
  assert.match(source, /if \(ids\.length > 1\) \{\s*setRestoreConfirmIds\(ids\);\s*return;/);
  // The keeper invariant the UI promises is now enforced, not assumed.
  assert.match(source, /enforceKeeperInvariant\(/);
  // A hard-linked group reclaims nothing, so it must not report reclaimable bytes.
  assert.match(source, /hardLinked\.reclaimMultiplier === 0 \? 0 : 1/);
});

/* ── 09 Security ───────────────────────────────────────────────────────── */

test('security posture is reachable and names what it did not measure', () => {
  // SystemSnapshot has no EnableLUA, so requiring uacEnabled === true made the
  // best verdict structurally unreachable.
  assert.equal(
    deriveSecurityPosture(true, true, true, null),
    'SECURE',
    'a machine whose measured controls are all active must be able to read SECURE'
  );
  assert.equal(deriveSecurityPosture(true, true, true, false), 'EXPOSED');
  assert.equal(deriveSecurityPosture(null, null, null, null), 'UNKNOWN');
  // A measured control is what lowers the posture, never an absent one.
  assert.equal(deriveSecurityPosture(true, true, null, null), 'SECURE');
  const coverage = securityCoverage(true, true, true, null);
  assert.equal(coverage.measuredCount, 3);
  assert.equal(coverage.totalCount, 4);
  assert.deepEqual(coverage.unmeasured, ['User Account Control']);
});

/* ── 13 Privacy ────────────────────────────────────────────────────────── */

test('a privacy control can never be hidden by a category string mismatch', () => {
  const settings = [
    { Id: 'A', Name: 'Camera', Category: 'App permissions', State: 'Allowed', Detail: '', Value: '1' },
    { Id: 'B', Name: 'Telemetry', Category: 'app permissions ', State: 'Denied', Detail: '', Value: '0' },
    { Id: 'C', Name: 'Ads', Category: 'New Category', State: 'Denied', Detail: '', Value: '0' },
  ];
  // Whitespace tolerance.
  assert.equal(filterSettingsByCategory(settings, 'App permissions').length, 2);
  // A brand-new category is now discoverable instead of silently vanishing.
  // 'App permissions' and 'app permissions ' are the SAME category, so they
  // must be one tab, not two near-identical tabs that each list both settings.
  assert.deepEqual(privacyCategories(settings), ['App permissions', 'New Category']);
  assert.equal(privacyCategories(settings).length, 2);
  // Every listed category must actually filter to something.
  for (const category of privacyCategories(settings)) {
    assert.ok(filterSettingsByCategory(settings, category).length > 0, category);
  }
  assert.equal(filterSettingsByCategory(settings, 'ALL').length, 3);
});

test('an unavailable privacy control is never rendered as measured', () => {
  const source = station(13, 'PrivacyStation.tsx');
  assert.match(source, /setting\.Available === false/);
  assert.match(source, /Unavailable on this device/);
  // The gate is "were settings read", not "what stance did they produce".
  assert.doesNotMatch(source, /const auditMeasured = summary\.stance !== 'INCONCLUSIVE'/);
});

/* ── 16 Software Environment ───────────────────────────────────────────── */

test('a partial preview failure never prints a confident total of zero', () => {
  const source = station(16, 'SoftwareStation.tsx');
  assert.match(source, /setReadFailures\(failures\)/);
  assert.match(source, /The installed-software inventory could not be read\./);
  // A bare table body cannot distinguish never-read from filtered-to-zero.
  assert.match(source, /\{!softwareData \? \(/);
  assert.match(source, /The inventory returned no applications\./);
  // A DESTRUCTIVE uninstall must not start from a native prompt.
  assert.doesNotMatch(source, /window\.prompt\(t\.packageIdPrompt\)/);
  assert.match(source, /uninstallPhrase\.trim\(\)\.toUpperCase\(\) !== 'UNINSTALL'/);
});

/* ── 12 Developer Tools ────────────────────────────────────────────────── */

test('a PATH collision reports the actual paths, not just a count', () => {
  assert.deepEqual(splitCandidates('C:\\a\\git.exe; C:\\b\\git.exe'), ['C:\\a\\git.exe', 'C:\\b\\git.exe']);
  assert.deepEqual(splitCandidates('["C:/a/git.exe","C:/b/git.exe"]'), ['C:/a/git.exe', 'C:/b/git.exe']);
  assert.deepEqual(splitCandidates('C:\\a\\git.exe\nC:\\b\\git.exe'), ['C:\\a\\git.exe', 'C:\\b\\git.exe']);
  // "The tool reported a count but not the paths" must be a reachable state.
  assert.deepEqual(splitCandidates(undefined), []);
  assert.deepEqual(splitCandidates(''), []);
});

test('a failed parse never replaces good evidence with an empty list', () => {
  const source = station(12, 'DeveloperStation.tsx');
  assert.match(source, /if \(parsed\.length > 0\) \{/);
  assert.doesNotMatch(source, /setToolchain\(parseToolchainItems\(output\)\);/);
  assert.doesNotMatch(source, /setPorts\(parseDevPorts\(run\.result\?\.output \|\| ''\)\);/);
  // Not-checked and measured-clean must be different sentences.
  assert.match(source, /\{!toolchainMeasured \? \(/);
  assert.match(source, /Measured: the audit returned no matching tools\./);
  assert.match(source, /portsMeasured \? t\.noPorts/);
});

/* ── 07 Services & Processes ───────────────────────────────────────────── */

test('the dependency tab shows the measured SP07 output', () => {
  const source = station(7, 'ServicesStation.tsx');
  // The result used to be discarded: the user clicked, waited, nothing appeared.
  assert.match(source, /setDependencyEvidence\(extractDependencyEdges\(/);
  assert.match(source, /setActiveTab\('dependencies'\)/);
  assert.match(source, /Dependencies have not been traced yet\./);
  assert.match(source, /the tool reported no dependency relationship/);
  // WARNING and INCONCLUSIVE are not failures.
  assert.match(source, /entry\.status === 'WARNING' \|\| entry\.status === 'INCONCLUSIVE' \? 'inconclusive'/);
});

test('dependency edges are read from whichever shape SP07 emitted', () => {
  const structured = extractDependencyEdges([
    { Service: 'Spooler', Dependencies: ['RpcSs', 'SamSs'] },
  ]);
  assert.equal(structured.length, 2);
  assert.equal(structured[0].service, 'Spooler');
  assert.equal(structured[0].critical, true, 'RpcSs is a protected core service');
  assert.equal(extractDependencyEdges('Spooler | RpcSs\nAudioSrv | Audiosrv')?.length, 2);
  assert.equal(extractDependencyEdges({ evidence: { dependencies: [{ name: 'A', dependsOn: 'B' }] } })?.length, 1);
  // Nothing parseable is null, so the UI can say "untraced", not "none found".
  assert.equal(extractDependencyEdges('nothing here at all'), null);
  assert.equal(extractDependencyEdges(null), null);
});

/* ── 08 Performance ────────────────────────────────────────────────────── */

test('the performance hand-off targets the station that owns process evidence', () => {
  const source = station(8, 'PerformanceStation.tsx');
  // 07-Services-Processes lives in family `investigation`; passing `recovery`
  // made the lookup fail and dropped the user into System Cleanup.
  // The summary must be un-cast so a wrong family or service id is a compile
  // error rather than a navigation that silently goes nowhere.
  assert.match(source, /onNavigateService\('investigation', '07-Services-Processes'\)/);
  assert.doesNotMatch(source, /\bas (?:FamilyId|ServiceId|never)\b/);
  assert.doesNotMatch(source, /onNavigateService\('recovery' as FamilyId, '07-Services-Processes'/);
  // A failed telemetry read must be visible.
  assert.match(source, /const \[telemetryError, setTelemetryError\]/);
});

/* ── 10 Diagnostics ────────────────────────────────────────────────────── */

test('diagnostics never reports PASS for a machine it did not examine', () => {
  const source = station(10, 'DiagnosticsStation.tsx');
  assert.match(source, /const hasPreview = preview !== null;/);
  assert.match(source, /!hasPreview \? \(\s*<span className="text-slate-400">NOT CHECKED<\/span>/);
  // A silent 15-event cutoff made the visible list disagree with the KPI.
  assert.match(source, /eventLogs\.slice\(0, eventLimit\)/);
  assert.match(source, /setEventLimit\(current => current \+ 50\)/);
  assert.match(source, /The event log has not been checked yet\./);
});

/* ── 06 Disk Space ─────────────────────────────────────────────────────── */

test('a failed volume read is never reported as "no volumes on this machine"', () => {
  const source = station(6, 'DiskSpaceStation.tsx');
  assert.match(source, /const \[baselineError, setBaselineError\]/);
  assert.match(source, /\{baselineError \? \(/);
  assert.doesNotMatch(source, /catch \{\s*\/\/ offline state handled by bridgeOnline check/);
  // The button copy must match the mode that will actually run.
  assert.match(source, /const actionLabel = \(tool: BridgeTool \| undefined\)/);
  assert.match(source, /actionLabel\(tool\)/);
  assert.doesNotMatch(source, /: t\.startAction\}<\/span>/);
});

/* ── 01 System Maintenance ─────────────────────────────────────────────── */

test('the maintenance health verdict reaches the screen', () => {
  const source = station(1, 'MaintenanceStation.tsx');
  // The model derived a trustworthy categorical answer; only the report saw it.
  assert.match(source, /className=\{`care-health-verdict is-/);
  assert.match(source, /\{health !== 'NOT_SCANNED' && \(/);
  assert.match(source, /HEALTH_COPY\[health\]/);
  // A bridge that is still being probed is not "OFFLINE".
  assert.match(source, /bridgeOnline === true \? text\.online : bridgeOnline === false \? text\.offline : text\.checking/);
});

/* ── 04 Programs & Applications ────────────────────────────────────────── */

test('cache and residual figures are measured, not seeded zeros', () => {
  const source = station(4, 'ProgramsStation.tsx');
  assert.match(source, /const \[cacheMeasured, setCacheMeasured\]/);
  assert.match(source, /cacheMeasured \? `\$\{evidence\.cacheSummary\.candidateCount\} files` : '—'/);
  // PA03's result must be parsed, not thrown away.
  assert.match(source, /parseMeasuredPaths\(lineStrings\)/);
  assert.match(source, /if \(toolId === 'PA03'\) setCacheMeasured\(true\);/);
});

test('a PA03 scan with no path-shaped line measures nothing rather than nothing found', () => {
  assert.equal(parseMeasuredPaths([]), null);
  assert.equal(parseMeasuredPaths(['Starting analysis...', 'Done.']), null);
  const measured = parseMeasuredPaths([
    'C:\\Users\\k7\\AppData\\Local\\Temp\\a.tmp\t12000',
    'C:\\Windows\\Temp\\b.tmp',
    'C:\\Users\\k7\\cache\\c.dat (12.3 MB)',
  ]);
  assert.equal(measured.length, 3);
  assert.equal(measured[0].sizeBytes, 12000);
  assert.equal(measured[1].sizeBytes, 0, 'a path with no reported size is 0, not a fabricated measurement');
  assert.ok(Math.abs(measured[2].sizeBytes - Math.round(12.3 * 1024 ** 2)) <= 1);
});

test('a classified cache candidate is never silently promoted to removable', () => {
  const candidates = buildCacheCandidates([
    { path: 'C:\\Users\\k7\\AppData\\Local\\Temp\\a.tmp', sizeBytes: 1000 },
    { path: 'C:\\Users\\k7\\AppData\\Local\\Login Data', sizeBytes: 5000 },
  ]);
  const summary = calculateCacheSummary(candidates);
  assert.ok(summary.protectedCount >= 1, 'a credential store must land in the protected bucket');
  assert.equal(summary.candidateBytes <= 1000, true);
  const residuals = buildResidualCandidates([{ path: 'C:\\Program Files\\GoneApp', sizeBytes: 5 * 1024 * 1024 }], []);
  assert.equal(residuals.length, 1);
  assert.equal(typeof residuals[0].classification, 'string');
});

/* ── cross-cutting ─────────────────────────────────────────────────────── */

test('no station hard-codes a customer-facing ToolId as navigation text', () => {
  // ToolIds are internal identifiers. A customer sees the tool's own name.
  const files = [
    'station01/MaintenanceStation.tsx', 'station04/ProgramsStation.tsx',
    'station10/DiagnosticsStation.tsx', 'station12/DeveloperStation.tsx',
    'station15/MonitoringStation.tsx', 'station17/PostInstallStation.tsx',
  ];
  for (const rel of files) {
    const source = read(`src/features/stations/${rel}`);
    // A ToolId inside a heading or button label would be internal leakage.
    assert.doesNotMatch(source, /<h[1-3][^>]*>[^<]*\b[A-Z]{2}\d{2}\b[^<]*<\/h[1-3]>/, rel);
  }
});
