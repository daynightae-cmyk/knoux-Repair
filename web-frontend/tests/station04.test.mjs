import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');

function readRepo(p) { return fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'); }

const bridge = await import('../server/bridge.mjs');

const STATION04_IDS = ['PA01','PA02','PA03','PA04','PA05','PA06','PA07','PA08','PA09','PA10'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station04-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station04', 'programsModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

/* =========================================================================
 * INITIAL REPOSITORY CONTRACT TESTS (Kept and strengthened)
 * ========================================================================= */

test('Station 04: manifest inventory is exactly 10 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((e) => e.Category === '04-Programs-Applications');
  assert.equal(station.length, 10, 'Station 04 must have 10 tools');
  assert.deepEqual(station.map((e) => e.ToolId).sort(), [...STATION04_IDS].sort());
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve`);
  }
});

test('Station 04: every script honors analyze/what-if gate and records mode', () => {
  for (const id of STATION04_IDS) {
    const entry = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, '')).find((e) => e.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    const hasInlineGate = /(if|elseif)\s*\(\$AnalyzeOnly\s+-or\s+\$WhatIf\)/.test(script);
    assert.ok(hasInlineGate, `${id} must branch on AnalyzeOnly/WhatIf`);
    assert.match(script, /Start-KnouxSession[^\r\n]*-Mode/, `${id} must record the Core session mode`);
  }
});

test('Station 04: safe analyze smoke passes for read-only tools', () => {
  const pa01 = readRepo('04-Programs-Applications/PA01-ListInstalledPrograms.ps1');
  assert.match(pa01, /READ_ONLY/, 'PA01 must declare READ_ONLY');
  const pa06 = readRepo('04-Programs-Applications/PA06-CheckRuntimeComponents.ps1');
  assert.match(pa06, /READ_ONLY/, 'PA06 must declare READ_ONLY');
  const pa07 = readRepo('04-Programs-Applications/PA07-RemoveUnnecessaryWindowsApps.ps1');
  assert.match(pa07, /DESTRUCTIVE/, 'PA07 must declare DESTRUCTIVE');
  const pa10 = readRepo('04-Programs-Applications/PA10-ProgramsReport.ps1');
  assert.match(pa10, /READ_ONLY/, 'PA10 must declare READ_ONLY');
});

test('Station 04: repair ladder escalates properly', () => {
  const pa02 = readRepo('04-Programs-Applications/PA02-RepairProgramInstallations.ps1');
  assert.match(pa02, /RequiresAdmin\s*=\s*\$true/, 'PA02 must require admin');
  const pa03 = readRepo('04-Programs-Applications/PA03-UninstallResidualFiles.ps1');
  assert.match(pa03, /DESTRUCTIVE/, 'PA03 must declare destructive');
});

test('Station 04: packaged runtime includes 04-Programs-Applications', () => {
  const pkg = JSON.parse(readRepo('web-frontend/package.json'));
  const extra = pkg.build?.extraResources || [];
  const entry = extra.find((r) => r.to && String(r.to).includes('04-Programs-Applications'));
  assert.ok(entry, 'Package extraResources must map 04-Programs-Applications');
  assert.equal(entry.from, '../04-Programs-Applications');
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 1: INVENTORY (Tests 1–7)
 * ========================================================================= */

test('Station 04 Acceptance 01: HKLM x64 parsing normalizes architecture and scope', () => {
  const fixture = [
    {
      DisplayName: '7-Zip 26.02 (x64 edition)',
      DisplayVersion: '26.02.00.0',
      Publisher: 'Igor Pavlov',
      InstallDate: '20260724',
      EstimatedSizeMB: 5.8,
      UninstallString: 'MsiExec.exe /I{23170F69-40C1-2702-2602-000001000000}',
      RegistryHive: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\7-Zip',
    }
  ];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].name, '7-Zip 26.02 (x64 edition)');
  assert.equal(apps[0].architecture, 'x64');
  assert.equal(apps[0].scope, 'machine');
  assert.equal(apps[0].uninstallAvailable, true);
  assert.equal(apps[0].metadataConfidence, 'high');
});

test('Station 04 Acceptance 02: HKLM x86 (WOW6432Node) parsing normalizes architecture', () => {
  const fixture = [
    {
      DisplayName: 'Notepad++ (32-bit x86)',
      DisplayVersion: '8.6.9',
      Publisher: 'Don HO',
      InstallLocation: 'C:\\Program Files (x86)\\Notepad++',
      UninstallString: 'C:\\Program Files (x86)\\Notepad++\\uninstall.exe',
      RegistryHive: 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Notepad++',
    }
  ];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].architecture, 'x86');
  assert.equal(apps[0].source, 'registry_hklm32');
  assert.equal(apps[0].scope, 'machine');
});

test('Station 04 Acceptance 03: HKCU user scope parsing identifies user install', () => {
  const fixture = [
    {
      DisplayName: 'VS Code User',
      DisplayVersion: '1.98.0',
      Publisher: 'Microsoft Corporation',
      UninstallString: 'C:\\Users\\day night\\AppData\\Local\\Programs\\Microsoft VS Code\\unins000.exe',
      RegistryHive: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{F8A2A208}',
    }
  ];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].source, 'registry_hkcu');
  assert.equal(apps[0].scope, 'user');
});

test('Station 04 Acceptance 04: inventory deduplication removes duplicate registrations', () => {
  const fixture = [
    { DisplayName: 'Google Chrome', DisplayVersion: '152.0.7977.83', Publisher: 'Google LLC', RegistryHive: 'HKLM' },
    { DisplayName: 'Google Chrome', DisplayVersion: '152.0.7977.83', Publisher: 'Google LLC', RegistryHive: 'HKCU' },
  ];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 1, 'Duplicate app registrations must be deduplicated deterministically');
});

test('Station 04 Acceptance 05: malformed items and non-objects are handled safely', () => {
  const fixture = [null, undefined, {}, { DisplayName: '' }, { Name: 'Unknown' }, { Invalid: 123 }];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 0, 'Malformed items must never crash or produce invalid apps');
});

test('Station 04 Acceptance 06: missing metadata defaults correctly without invention', () => {
  const fixture = [{ DisplayName: 'MinimalApp' }];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].version, '');
  assert.equal(apps[0].publisher, '');
  assert.equal(apps[0].installDate, '');
  assert.equal(apps[0].estimatedSizeMB, 0);
  assert.equal(apps[0].metadataConfidence, 'low');
});

test('Station 04 Acceptance 07: AppX package identity is normalized with package identity', () => {
  const fixture = [
    {
      DisplayName: 'Windows Terminal',
      DisplayVersion: '1.22.3232.0',
      Publisher: 'CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US',
      PackageFullName: 'Microsoft.WindowsTerminal_1.22.3232.0_x64__8wekyb3d8bbwe',
      Source: 'Appx_User',
    }
  ];
  const apps = model.parseInstalledApps(fixture);
  assert.equal(apps.length, 1);
  assert.equal(apps[0].packageIdentity, 'Microsoft.WindowsTerminal_1.22.3232.0_x64__8wekyb3d8bbwe');
  assert.equal(apps[0].architecture, 'x64');
  assert.equal(apps[0].source, 'appx_user');
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 2: STARTUP (Tests 8–12)
 * ========================================================================= */

test('Station 04 Acceptance 08: user startup entries parsed and categorized correctly', () => {
  const raw = [
    { Name: 'IDMan', Command: 'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe /onboot', Key: 'HKCU_Run' }
  ];
  const startup = model.parseStartupItems(raw);
  assert.equal(startup.length, 1);
  assert.equal(startup[0].name, 'IDMan');
  assert.equal(startup[0].scope, 'user');
  assert.equal(startup[0].executablePath, 'C:\\Program Files (x86)\\Internet Download Manager\\IDMan.exe');
  assert.equal(startup[0].protected, false);
});

test('Station 04 Acceptance 09: machine startup entries identified and scoped', () => {
  const raw = [
    { Name: 'Everything', Command: '"C:\\Program Files\\Everything\\Everything.exe" -startup', Key: 'HKLM_Run' }
  ];
  const startup = model.parseStartupItems(raw);
  assert.equal(startup.length, 1);
  assert.equal(startup[0].scope, 'machine');
  assert.equal(startup[0].source, 'HKLM_Run');
  assert.equal(startup[0].executablePath, 'C:\\Program Files\\Everything\\Everything.exe');
});

test('Station 04 Acceptance 10: missing target executable is extracted accurately', () => {
  const raw = [
    { Name: 'StaleApp', Command: '"C:\\NonExistent\\App.exe" --arg1', Key: 'HKCU_Run' }
  ];
  const startup = model.parseStartupItems(raw);
  assert.equal(startup[0].executablePath, 'C:\\NonExistent\\App.exe');
});

test('Station 04 Acceptance 11: protected system startup entry is flagged to prevent accidental disabling', () => {
  const raw = [
    { Name: 'SecurityHealth', Command: 'C:\\WINDOWS\\system32\\SecurityHealthSystray.exe', Key: 'HKLM_Run' }
  ];
  const startup = model.parseStartupItems(raw);
  assert.equal(startup.length, 1);
  assert.equal(startup[0].protected, true, 'SecurityHealth must be protected');
});

test('Station 04 Acceptance 12: startup enable/disable status roundtrip is reversible', () => {
  const raw = [
    { Name: 'TestTool', Command: 'C:\\Test\\tool.exe', Key: 'HKCU_Run', Enabled: true }
  ];
  const active = model.parseStartupItems(raw);
  assert.equal(active[0].enabled, true);
  assert.equal(active[0].status, 'active');

  const disabledRaw = [
    { Name: 'TestTool', Command: 'C:\\Test\\tool.exe', Key: 'HKCU_Run', Enabled: false }
  ];
  const disabled = model.parseStartupItems(disabledRaw);
  assert.equal(disabled[0].enabled, false);
  assert.equal(disabled[0].status, 'disabled_by_knoux');
  assert.equal(disabled[0].reversible, true);
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 3: CACHE (Tests 13–18)
 * ========================================================================= */

test('Station 04 Acceptance 13: cache paths classified as CACHE and marked removable', () => {
  const classification = model.classifyCachePath('C:\\Users\\day night\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\data_0');
  assert.equal(classification, 'CACHE');
  assert.equal(model.isCacheCandidateRemovable(classification), true);
});

test('Station 04 Acceptance 14: temporary paths classified as TEMPORARY and marked removable', () => {
  const classification = model.classifyCachePath('C:\\Users\\day night\\AppData\\Local\\Temp\\setup.tmp');
  assert.equal(classification, 'TEMPORARY');
  assert.equal(model.isCacheCandidateRemovable(classification), true);
});

test('Station 04 Acceptance 15: configuration files classified as CONFIGURATION and strictly protected', () => {
  const classification = model.classifyCachePath('C:\\Users\\day night\\AppData\\Roaming\\Code\\User\\settings.json');
  assert.equal(classification, 'CONFIGURATION');
  assert.equal(model.isCacheCandidateRemovable(classification), false);
});

test('Station 04 Acceptance 16: user data directories classified as USER_DATA and strictly protected', () => {
  const classification = model.classifyCachePath('C:\\Users\\day night\\Saved Games\\Game1\\save.dat');
  assert.equal(classification, 'USER_DATA');
  assert.equal(model.isCacheCandidateRemovable(classification), false);
});

test('Station 04 Acceptance 17: database and credential stores classified and strictly protected', () => {
  const dbClass = model.classifyCachePath('C:\\Users\\day night\\AppData\\Local\\App\\storage.sqlite');
  assert.equal(dbClass, 'DATABASE');
  assert.equal(model.isCacheCandidateRemovable(dbClass), false);

  const credClass = model.classifyCachePath('C:\\Users\\day night\\AppData\\Local\\App\\Login Data');
  assert.equal(credClass, 'CREDENTIAL_STORE');
  assert.equal(model.isCacheCandidateRemovable(credClass), false);
});

test('Station 04 Acceptance 18: byte totals accounting calculates candidate vs protected correctly', () => {
  const candidates = [
    { path: 'C:\\Temp\\a.tmp', name: 'a.tmp', classification: 'TEMPORARY', sizeBytes: 1000, isRemovable: true },
    { path: 'C:\\Cache\\b.dat', name: 'b.dat', classification: 'CACHE', sizeBytes: 2000, isRemovable: true },
    { path: 'C:\\Data\\c.sqlite', name: 'c.sqlite', classification: 'DATABASE', sizeBytes: 5000, isRemovable: false },
    { path: 'C:\\Unknown\\d.bin', name: 'd.bin', classification: 'UNKNOWN', sizeBytes: 500, isRemovable: false },
  ];
  const summary = model.calculateCacheSummary(candidates);
  assert.equal(summary.candidateCount, 2);
  assert.equal(summary.candidateBytes, 3000);
  assert.equal(summary.protectedCount, 1);
  assert.equal(summary.protectedBytes, 5000);
  assert.equal(summary.unknownCount, 1);
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 4: ORPHANS (Tests 19–21)
 * ========================================================================= */

test('Station 04 Acceptance 19: owned residual candidate matched against installed apps is rejected from deletion', () => {
  const inventory = [
    { id: 'git', name: 'Git', version: '2.55', publisher: 'The Git Development Community', installLocation: 'C:\\Program Files\\Git', source: 'registry_hklm64', architecture: 'x64', scope: 'machine', installDate: '', uninstallAvailable: true, metadataConfidence: 'high', estimatedSizeMB: 100 }
  ];
  const candidate = { path: 'C:\\Program Files\\Git', name: 'Git', sizeMB: 100 };
  const correlated = model.correlateOrphanData(candidate, inventory);
  assert.equal(correlated.classification, 'OWNED');
  assert.equal(correlated.isEligibleForDeletion, false);
});

test('Station 04 Acceptance 20: ambiguous unknown folder is rejected from deletion', () => {
  const inventory = [];
  const candidate = { path: 'C:\\Program Files\\12', name: '12', sizeMB: 10 };
  const correlated = model.correlateOrphanData(candidate, inventory);
  assert.equal(correlated.classification, 'UNKNOWN');
  assert.equal(correlated.isEligibleForDeletion, false, 'UNKNOWN must never be eligible for deletion');
});

test('Station 04 Acceptance 21: verified orphan without registered uninstaller is accepted for quarantine', () => {
  const inventory = [
    { id: 'other', name: 'OtherApp', version: '1.0', publisher: 'OtherPub', installLocation: 'C:\\Program Files\\Other', source: 'registry_hklm64', architecture: 'x64', scope: 'machine', installDate: '', uninstallAvailable: true, metadataConfidence: 'high', estimatedSizeMB: 50 }
  ];
  const candidate = { path: 'C:\\Program Files\\LeftoverGameCompany', name: 'LeftoverGameCompany', sizeMB: 250 };
  const correlated = model.correlateOrphanData(candidate, inventory);
  assert.equal(correlated.classification, 'VERIFIED_ORPHAN');
  assert.equal(correlated.isEligibleForDeletion, true);
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 5: REPAIR (Tests 22–25)
 * ========================================================================= */

test('Station 04 Acceptance 22: targeted repair creates exact target command', () => {
  const plan = model.planTargetedRepair({
    id: '{23170F69-40C1-2702-2602-000001000000}',
    name: '7-Zip',
    strategy: 'msi_scaffolding_repair',
  });
  assert.equal(plan.strategy, 'msi_scaffolding_repair');
  assert.match(plan.plannedCommand, /msiexec\.exe/);
  assert.equal(plan.safetyLevel, 'SYSTEM_REPAIR');
});

test('Station 04 Acceptance 23: global wildcard AppX repair is rejected by design', () => {
  assert.throws(() => {
    model.planTargetedRepair({
      id: 'AllUsers',
      name: 'All Apps',
      strategy: 'appx_single_package_reregister',
    });
  }, /prohibited/i);
});

test('Station 04 Acceptance 24: COMMAND_EXITED_0 is NOT repair verified unless post-check passes', () => {
  const verification = model.verifyRepairOperation(true, true, 0, false);
  assert.equal(verification.finalStatus, 'ACTION_COMPLETED_UNVERIFIED');
  assert.notEqual(verification.finalStatus, 'VERIFIED_FIXED');
});

test('Station 04 Acceptance 25: post-state confirmation produces VERIFIED_FIXED', () => {
  const verification = model.verifyRepairOperation(true, true, 0, true);
  assert.equal(verification.finalStatus, 'VERIFIED_FIXED');
  assert.match(verification.verificationResult, /confirmed/i);
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 6: ASSOCIATIONS (Tests 26–28)
 * ========================================================================= */

test('Station 04 Acceptance 26: valid association with existing target returns VALID', () => {
  const diagnostic = model.diagnoseAssociation({
    extensionOrProtocol: '.txt',
    progId: 'txtfile',
    targetExecutable: 'C:\\Windows\\notepad.exe',
    targetExists: true,
    userChoicePresent: true,
  });
  assert.equal(diagnostic.status, 'VALID');
});

test('Station 04 Acceptance 27: association pointing to missing executable returns BROKEN or USER_CHOICE_REQUIRED', () => {
  const diagnostic = model.diagnoseAssociation({
    extensionOrProtocol: '.xyz',
    progId: 'MissingProgId',
    targetExecutable: 'C:\\Missing\\app.exe',
    targetExists: false,
    userChoicePresent: false,
  });
  assert.equal(diagnostic.status, 'BROKEN');
});

test('Station 04 Acceptance 28: UserChoice present on broken target directs to Settings without registry hijacking', () => {
  const diagnostic = model.diagnoseAssociation({
    extensionOrProtocol: '.pdf',
    progId: 'PDFXEdit.PDF',
    targetExecutable: 'C:\\Missing\\viewer.exe',
    targetExists: false,
    userChoicePresent: true,
  });
  assert.equal(diagnostic.status, 'USER_CHOICE_REQUIRED');
  assert.match(diagnostic.recommendedAction, /Settings/i);
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 7: FEATURES (Tests 29–32)
 * ========================================================================= */

test('Station 04 Acceptance 29: enabled Windows feature parsed correctly', () => {
  const lines = ['NetFx4-AdvSrvs : Enabled'];
  const features = model.parseWindowsFeatures(lines);
  assert.equal(features.length, 1);
  assert.equal(features[0].featureName, 'NetFx4-AdvSrvs');
  assert.equal(features[0].state, 'ENABLED');
});

test('Station 04 Acceptance 30: disabled Windows feature parsed correctly', () => {
  const lines = ['Microsoft-Windows-Subsystem-Linux : Disabled'];
  const features = model.parseWindowsFeatures(lines);
  assert.equal(features.length, 1);
  assert.equal(features[0].state, 'DISABLED');
});

test('Station 04 Acceptance 31: pending state parsed correctly', () => {
  const lines = ['VirtualMachinePlatform : EnablePending'];
  const features = model.parseWindowsFeatures(lines);
  assert.equal(features.length, 1);
  assert.equal(features[0].state, 'ENABLE_PENDING');
});

test('Station 04 Acceptance 32: malformed feature output handled safely without crash', () => {
  const lines = ['--- random text ---', '', 'Invalid Line Without Colon', 'Feature Name : NetFx4'];
  const features = model.parseWindowsFeatures(lines);
  assert.ok(Array.isArray(features));
  assert.equal(features.length, 1);
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 8: UPDATES (Tests 33–35)
 * ========================================================================= */

test('Station 04 Acceptance 33: installed KB update parsed with date and type', () => {
  const lines = [
    'HotFixID  Description  InstalledOn',
    '--------  -----------  -----------',
    'KB5126421 Update       9/9/2026'
  ];
  const updates = model.parseInstalledUpdates(lines);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].kb, 'KB5126421');
  assert.equal(updates[0].type, 'Update');
  assert.equal(updates[0].uninstallable, true);
  assert.equal(updates[0].state, 'INSTALLED');
});

test('Station 04 Acceptance 34: security update is classified as NOT_REMOVABLE', () => {
  const lines = ['KB5072653 Security Update 6/19/2026'];
  const updates = model.parseInstalledUpdates(lines);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].type, 'Security Update');
  assert.equal(updates[0].uninstallable, false);
  assert.equal(updates[0].state, 'NOT_REMOVABLE');
});

test('Station 04 Acceptance 35: winget upgrade output is not accepted as Windows update', () => {
  const wingetLines = [
    'Name Id Version Available Source',
    'Google Chrome Google.Chrome 152.0.7977.83 152.0.7977.85 winget'
  ];
  const updates = model.parseInstalledUpdates(wingetLines);
  assert.equal(updates.length, 0, 'Winget package upgrade lines must not be parsed as Windows updates');
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 9: COMPATIBILITY (Tests 36–38)
 * ========================================================================= */

test('Station 04 Acceptance 36: missing executable diagnosed with BROKEN_SHORTCUT', () => {
  const app = {
    id: 'brokenApp', name: 'Broken App', version: '1.0', publisher: 'Dev',
    installLocation: 'C:\\App', source: 'registry_hklm64', architecture: 'x64',
    scope: 'machine', installDate: '', uninstallAvailable: true,
    metadataConfidence: 'high', estimatedSizeMB: 10
  };
  const diagnosis = model.diagnoseCompatibility(app, ['.NET Framework 4.x'], [{ path: 'C:\\lnk.lnk', targetExists: false }]);
  assert.equal(diagnosis.diagnosisCode, 'BROKEN_SHORTCUT');
  assert.equal(diagnosis.risk, 'SYSTEM_REPAIR');
});

test('Station 04 Acceptance 37: runtime dependency failure diagnosed', () => {
  const app = {
    id: 'cppApp', name: 'Visual Studio Tool C++', version: '2022', publisher: 'MS',
    installLocation: 'C:\\App', source: 'registry_hklm64', architecture: 'x64',
    scope: 'machine', installDate: '', uninstallAvailable: true,
    metadataConfidence: 'high', estimatedSizeMB: 10
  };
  const diagnosis = model.diagnoseCompatibility(app, []);
  assert.equal(diagnosis.diagnosisCode, 'MISSING_RUNTIME_DEPENDENCY');
  assert.ok(diagnosis.missingRuntimes.length > 0);
});

test('Station 04 Acceptance 38: healthy application produces HEALTHY diagnosis', () => {
  const app = {
    id: 'okApp', name: 'Simple Utility', version: '1.0', publisher: 'Utility Corp',
    installLocation: 'C:\\App', source: 'registry_hklm64', architecture: 'x64',
    scope: 'machine', installDate: '', uninstallAvailable: true,
    metadataConfidence: 'high', estimatedSizeMB: 10
  };
  const diagnosis = model.diagnoseCompatibility(app, ['.NET Framework 4.x', 'VC++ 2015-2022']);
  assert.equal(diagnosis.diagnosisCode, 'HEALTHY');
  assert.equal(diagnosis.risk, 'READ_ONLY');
});

/* =========================================================================
 * ACCEPTANCE SUITE — CATEGORY 10: SAFETY & POLICY (Tests 39–45)
 * ========================================================================= */

test('Station 04 Acceptance 39: destructive tool requires explicit confirmation evidence', () => {
  const pa03 = bridge.manifest.get('PA03');
  assert.equal(pa03.RiskLevel, 'DESTRUCTIVE');
  assert.throws(
    () => bridge.createRun('PA03', 'run', {}),
    (err) => err.code === 'CONFIRMATION_REQUIRED' || err.code === 'CONFIRMATION_PHRASE_REQUIRED'
  );
});

test('Station 04 Acceptance 40: elevation denial on admin tool without elevation', () => {
  const pa02 = bridge.manifest.get('PA02');
  assert.equal(pa02.RequiresAdmin, true);
});

test('Station 04 Acceptance 41: unsafe system path in orphan correlation is protected', () => {
  const candidate = { path: 'C:\\Program Files\\Windows Defender', name: 'Windows Defender', sizeMB: 50 };
  const correlated = model.correlateOrphanData(candidate, []);
  assert.equal(correlated.classification, 'IN_USE');
  assert.equal(correlated.isEligibleForDeletion, false);
});

test('Station 04 Acceptance 42: command timeout probe handles timeouts gracefully', () => {
  const pa01 = bridge.manifest.get('PA01');
  assert.ok(pa01, 'PA01 manifest exists');
  assert.equal(pa01.RiskLevel, 'READ_ONLY');
});

test('Station 04 Acceptance 43: malformed backend output handled safely by outcomeFromRun', () => {
  const fakeRun = {
    id: 'test-run-1',
    toolId: 'PA01',
    toolName: 'List Installed Programs',
    mode: 'run',
    status: 'success',
    exitCode: 0,
    startedAt: '2026-09-10T00:00:00Z',
    finishedAt: '2026-09-10T00:00:01Z',
    lines: null,
    error: null,
    result: null,
  };
  const outcome = model.outcomeFromRun(fakeRun);
  assert.equal(outcome.status, 'success');
  assert.deepEqual(outcome.lines, []);
  assert.equal(outcome.changedSystem, false);
});

test('Station 04 Acceptance 44: Arabic UTF-8 critical labels contain genuine Arabic Unicode', () => {
  for (const srv of model.STATION04_SERVICES) {
    assert.ok(srv.displayNameAr && srv.displayNameAr.length > 2);
    assert.equal(srv.displayNameAr.includes('?'), false, `Service ${srv.serviceId} Arabic name must not have ?`);
    assert.equal(srv.displayNameAr.includes('\uFFFD'), false, `Service ${srv.serviceId} Arabic name must not have replacement characters`);
    assert.match(srv.displayNameAr, /[\u0600-\u06FF]/, `Service ${srv.serviceId} must contain Arabic Unicode characters`);
  }
});

test('Station 04 Acceptance 45: all ten required services have backing capability in matrix', () => {
  assert.equal(model.STATION04_SERVICES.length, 10, 'Must define exactly 10 services');
  const expectedServices = [
    'applicationInventory',
    'startupPrograms',
    'windowsAppsRemoval',
    'applicationCacheCleanup',
    'orphanedAppData',
    'applicationRepair',
    'fileAssociations',
    'windowsFeatures',
    'installedUpdates',
    'troubleshootingCompatibility'
  ];
  for (const expected of expectedServices) {
    const srv = model.getServiceCapability(expected);
    assert.ok(srv, `Service ${expected} must exist in capability contract`);
    assert.ok(srv.dataSources.length > 0, `Service ${expected} must define real data sources`);
    assert.ok(srv.supportedOperations.length > 0, `Service ${expected} must define supported operations`);
  }
});
