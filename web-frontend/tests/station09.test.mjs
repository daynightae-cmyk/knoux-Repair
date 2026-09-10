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
function readWeb(p) { return fs.readFileSync(path.join(WEB_ROOT, p), 'utf8'); }

const STATION09_IDS = ['SE01', 'SE02', 'SE03', 'SE04', 'SE05', 'SE06', 'SE07', 'SE08', 'SE09', 'SE10'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station09-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station09', 'securityModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

/* =========================================================================
 * REPOSITORY CONTRACT & MANIFEST VERIFICATION
 * ========================================================================= */

test('Station 09: manifest inventory is exactly 10 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '09-Security');
  assert.equal(station.length, 10, 'Station 09 must have exactly 10 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION09_IDS].sort(),
    'Station 09 ToolIds must match manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 09: risk levels match safe analysis and system repair posture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const readOnly = manifest.filter((entry) => entry.Category === '09-Security' && ['SE01', 'SE04', 'SE09'].includes(entry.ToolId));
  for (const entry of readOnly) {
    assert.equal(entry.RiskLevel, 'READ_ONLY', `${entry.ToolId} must be READ_ONLY`);
  }

  const systemRepair = manifest.filter((entry) => entry.Category === '09-Security' && !['SE01', 'SE04', 'SE09'].includes(entry.ToolId));
  for (const entry of systemRepair) {
    assert.equal(entry.RiskLevel, 'SYSTEM_REPAIR', `${entry.ToolId} must be SYSTEM_REPAIR`);
    assert.equal(entry.RequiresAdmin, true, `${entry.ToolId} repair tool must require admin`);
  }
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (securityModel.ts)
 * ========================================================================= */

test('Station 09: deriveSecurityPosture evaluates categorical posture truthfully', () => {
  // All active -> SECURE
  assert.equal(model.deriveSecurityPosture(true, true, true, true), 'SECURE');

  // Any critical protection disabled -> EXPOSED
  assert.equal(model.deriveSecurityPosture(false, true, true, true), 'EXPOSED');
  assert.equal(model.deriveSecurityPosture(true, false, true, true), 'EXPOSED');
  assert.equal(model.deriveSecurityPosture(true, true, false, true), 'EXPOSED');
  assert.equal(model.deriveSecurityPosture(true, true, true, false), 'EXPOSED');

  // Missing data -> UNKNOWN
  assert.equal(model.deriveSecurityPosture(null, null, null, null), 'UNKNOWN');
});

test('Station 09: evaluateDefender parses Defender status without hallucination', () => {
  const activeDef = model.evaluateDefender({
    DefenderRunning: true,
    DefenderRealtime: true,
    DefenderSignatures: '1.405.210.0',
  });
  assert.equal(activeDef.running, true);
  assert.equal(activeDef.realtimeEnabled, true);
  assert.equal(activeDef.signatures, '1.405.210.0');
  assert.equal(activeDef.signatureStatus, 'CURRENT');

  const emptyDef = model.evaluateDefender(null);
  assert.equal(emptyDef.available, false);
  assert.equal(emptyDef.running, false);
  assert.equal(emptyDef.signatureStatus, 'UNKNOWN');
});

test('Station 09: evaluateFirewall evaluates all profiles and flags disabled ones', () => {
  const allOn = model.evaluateFirewall([
    { Profile: 'Domain', Enabled: true },
    { Profile: 'Private', Enabled: true },
    { Profile: 'Public', Enabled: true },
  ]);
  assert.equal(allOn.allEnabled, true);
  assert.equal(allOn.anyDisabled, false);
  assert.equal(allOn.enabledCount, 3);
  assert.equal(allOn.totalProfiles, 3);

  const oneOff = model.evaluateFirewall([
    { Profile: 'Domain', Enabled: true },
    { Profile: 'Private', Enabled: false },
    { Profile: 'Public', Enabled: true },
  ]);
  assert.equal(oneOff.allEnabled, false);
  assert.equal(oneOff.anyDisabled, true);
  assert.equal(oneOff.enabledCount, 2);
});

test('Station 09: evaluateUac verifies EnableLUA registry state', () => {
  assert.equal(model.evaluateUac(1).enabled, true);
  assert.equal(model.evaluateUac(true).enabled, true);
  assert.equal(model.evaluateUac(0).enabled, false);
  assert.equal(model.evaluateUac(false).enabled, false);
  assert.equal(model.evaluateUac(null).enabled, null);
});

test('Station 09: detectSecuritySignals identifies risks with specific tool citations', () => {
  const signals = model.detectSecuritySignals(
    { available: true, running: false, realtimeEnabled: false, signatures: '', signatureAgeDays: null, tamperProtected: null, signatureStatus: 'UNKNOWN' },
    { allEnabled: false, anyDisabled: true, totalProfiles: 3, enabledCount: 2, profiles: [] },
    { enabled: false, levelDescription: '' }
  );

  assert.ok(signals.some((s) => s.code === 'DEFENDER_SERVICE_STOPPED' && s.suggestedTool === 'SE03'));
  assert.ok(signals.some((s) => s.code === 'DEFENDER_REALTIME_DISABLED' && s.suggestedTool === 'SE02'));
  assert.ok(signals.some((s) => s.code === 'FIREWALL_PROFILE_DISABLED' && s.suggestedTool === 'SE05'));
  assert.ok(signals.some((s) => s.code === 'UAC_DISABLED' && s.suggestedTool === 'SE07'));
});

test('Station 09: isAllowedSecurityAction strictly forbids disabling security defenses', () => {
  assert.equal(model.isAllowedSecurityAction('SE01'), true);
  assert.equal(model.isAllowedSecurityAction('SE02'), true);
  assert.equal(model.isAllowedSecurityAction('SE10'), true);
  assert.equal(model.isAllowedSecurityAction('SE_DISABLE_DEFENDER'), false);
  assert.equal(model.isAllowedSecurityAction('SE_DISABLE_FIREWALL'), false);
  assert.equal(model.isAllowedSecurityAction('UNKNOWN_ACTION'), false);
});

/* =========================================================================
 * COMPONENT & ROUTING INTEGRATION
 * ========================================================================= */

test('Station 09: SecurityStation and SecurityHeroVisual components exist', () => {
  const stationSrc = readWeb('src/features/stations/station09/SecurityStation.tsx');
  assert.ok(stationSrc.includes('export default function SecurityStation'), 'SecurityStation component must be exported');
  assert.ok(stationSrc.includes('SE01–SE10'), 'Must cite Station 09 tool span');

  const heroSrc = readWeb('src/features/stations/station09/SecurityHeroVisual.tsx');
  assert.ok(heroSrc.includes('export default function SecurityHeroVisual'), 'SecurityHeroVisual component must be exported');
});

test('Station 09: ServiceApps routes activeSection security directly to SecurityStation', () => {
  const src = readWeb('src/components/ServiceApps.tsx');
  assert.ok(src.includes("activeSection === 'security'"), 'ServiceApps must route activeSection security');
  assert.ok(src.includes('<SecurityStation'), 'ServiceApps must render SecurityStation');
});
