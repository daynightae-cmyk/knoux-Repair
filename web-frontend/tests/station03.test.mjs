import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const WEB_ROOT = path.join(REPO_ROOT, 'web-frontend');

function readRepo(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function readWeb(relativePath) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

const bridge = await import('../server/bridge.mjs');

const STATION_IDS = ['NI01', 'NI02', 'NI03', 'NI04', 'NI05', 'NI06', 'NI07', 'NI08', 'NI09', 'NI10', 'NI11'];

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station03-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station03', 'networkModel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});
const model = await import(pathToFileURL(bundlePath).href);
try { fs.unlinkSync(bundlePath); } catch { /* non-critical */ }

// ---------- inventory ----------

test('Station 03: manifest inventory is exactly the 11 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '03-Network-Internet');
  assert.equal(station.length, 11, 'Station 03 must have 11 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION_IDS].sort(),
    'Station 03 ToolIds must match the contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve`);
  }
});

test('Station 03: every script honors the analyze/what-if gate and records mode', () => {
  for (const id of STATION_IDS) {
    const entry = [...bridge.manifest.values()].find((tool) => tool.ToolId === id);
    const script = readRepo(entry.ScriptPath);
    if (id === 'NI11') {
      // NI11 is measurement-only in every mode (the bridge preview endpoint
      // depends on its JSON markers), so it proves safety by containing no
      // mutation primitives at all.
      for (const primitive of ['Remove-Item', 'Clear-RecycleBin', 'netsh', 'ipconfig /release', 'ipconfig /renew', 'ipconfig /flushdns', 'Stop-Service', 'Set-Service']) {
        assert.equal(script.includes(primitive), false, `NI11 must not contain ${primitive}`);
      }
      continue;
    }
    const hasInlineGate = /(if|elseif)\s*\(\$AnalyzeOnly\s+-or\s+\$WhatIf\)/.test(script);
    assert.ok(hasInlineGate, `${id} must branch on AnalyzeOnly/WhatIf`);
    assert.match(script, /Start-KnouxSession[^\r\n]*-Mode/, `${id} must record the Core session mode`);
  }
});

test('Station 03: invasive repairs carry restart and confirmation semantics', () => {
  const ni04 = readRepo('03-Network-Internet/NI04-ResetWinsock.ps1');
  assert.match(ni04, /RestartNeeded\s*=\s*\$true/, 'NI04 must flag restart');
  assert.match(ni04, /Confirm-KnouxAction/, 'NI04 must confirm');
  const ni08 = readRepo('03-Network-Internet/NI08-ResetNetworkStack.ps1');
  assert.match(ni08, /RestartNeeded\s*=\s*\$true/, 'NI08 must flag restart');
  assert.match(ni08, /Static IPs may need to be re-set/, 'NI08 must disclose static-IP risk');
});

// ---------- mode + confirmation guards ----------

test('Station 03: unsupported modes are rejected, repairs are protected', () => {
  for (const id of ['NI01', 'NI06', 'NI07', 'NI10']) {
    assert.equal(bridge.manifest.get(id).WhatIfSupported, false, `${id} must not support preview`);
    assert.throws(() => bridge.createRun(id, 'preview', {}), (err) => err.code === 'MODE_NOT_SUPPORTED');
  }
  for (const id of ['NI04', 'NI08', 'NI09']) {
    assert.throws(() => bridge.createRun(id, 'run', {}), (err) => err.code === 'CONFIRMATION_REQUIRED', `${id} run must require confirmation`);
  }
  const phrase = bridge.normalizeConfirmation({ confirmed: true, phrase: 'CONFIRM', confirmedAt: new Date().toISOString() });
  bridge.validateExecutionRequest({ tool: bridge.manifest.get('NI04'), mode: 'run', confirmation: phrase });
});

// ---------- deterministic domain rules (runtime) ----------

const NI01_OK = [
  'Up adapters: 1',
  'Gateway: 192.168.1.1',
  '  => REACHABLE',
  '  => DNS resolution OK',
  '  => 8.8.8.8 REACHABLE',
];
const NI01_DNS_FAIL = [
  'Up adapters: 1',
  'Gateway: 192.168.1.1',
  '  => REACHABLE',
  '  => DNS resolution FAILED',
  '  => 8.8.8.8 REACHABLE',
];
const NI01_NO_GW = [
  'Up adapters: 1',
  '  => no IPv4 gateway detected',
  '  => DNS resolution FAILED',
  '  => 8.8.8.8 UNREACHABLE',
];

test('Station 03: NI01 markers parse into layer facts without invention', () => {
  const ok = model.parseNi01Lines(NI01_OK);
  assert.equal(ok.gateway, '192.168.1.1');
  assert.equal(ok.gatewayState, 'reachable');
  assert.equal(ok.dnsOk, true);
  assert.equal(ok.internetOk, true);
  const dnsFail = model.parseNi01Lines(NI01_DNS_FAIL);
  assert.equal(dnsFail.dnsOk, false);
  assert.equal(dnsFail.internetOk, true);
  const noGw = model.parseNi01Lines(NI01_NO_GW);
  assert.equal(noGw.gatewayState, 'none');
  assert.equal(noGw.gateway, '');
  const empty = model.parseNi01Lines([]);
  assert.equal(empty.gatewayState, 'unknown');
  assert.equal(empty.dnsOk, null);
  assert.equal(empty.internetOk, null);
});

test('Station 03: NI06 markers parse into measured quality only', () => {
  const measured = model.parseNi06Lines(['  Packet loss: 0%   Average latency: 12 ms']);
  assert.equal(measured.lossPercent, 0);
  assert.equal(measured.avgMs, 12);
  assert.equal(measured.measured, true);
  const empty = model.parseNi06Lines([]);
  assert.equal(empty.measured, false);
  assert.equal(empty.lossPercent, null);
  assert.equal(empty.avgMs, null);
});

function fakeOutcome(toolId, { status = 'SUCCESS', lines = [] } = {}) {
  return {
    toolId, mode: 'run', status,
    verificationResult: '', errorMessage: '', reportPath: `Reports/x-${toolId}`,
    finishedAt: '2026-09-10T00:01:00', changedSystem: false, restartNeeded: false, lines,
  };
}

function adaptersEvidence() {
  return {
    adapters: [
      { Description: 'Intel Ethernet', IPv4: '192.168.1.20', Gateway: '192.168.1.1', DNS: ['192.168.1.1'], DHCP: true, MacAddress: 'AA' },
    ],
    ni01: model.parseNi01Lines(NI01_OK),
    ni06: null,
    outcomes: {},
  };
}

test('Station 03: layer states derive from measured evidence', () => {
  const states = model.deriveLayerStates(adaptersEvidence(), []);
  assert.equal(states.adapter, 'CONNECTED');
  assert.equal(states.ip, 'CONNECTED');
  assert.equal(states.gateway, 'CONNECTED');
  assert.equal(states.dns, 'CONNECTED');
  assert.equal(states.internet, 'CONNECTED');
  assert.equal(model.firstFailedLayer(states), null);

  const dnsFail = { ...adaptersEvidence(), ni01: model.parseNi01Lines(NI01_DNS_FAIL) };
  const states2 = model.deriveLayerStates(dnsFail, []);
  assert.equal(states2.dns, 'UNREACHABLE');
  assert.equal(model.firstFailedLayer(states2), 'dns');

  const noGw = { adapters: [], ni01: model.parseNi01Lines(NI01_NO_GW), ni06: null, outcomes: {} };
  const states3 = model.deriveLayerStates(noGw, []);
  assert.equal(states3.gateway, 'MISCONFIGURED');

  const apipa = {
    adapters: [{ Description: 'Wi-Fi', IPv4: '169.254.5.6', Gateway: '', DNS: [], DHCP: true, MacAddress: 'BB' }],
    ni01: null, ni06: null, outcomes: {},
  };
  const states4 = model.deriveLayerStates(apipa, []);
  assert.equal(states4.ip, 'MISCONFIGURED');
});

test('Station 03: ICMP-blocked internet stays inconclusive, never failed', () => {
  // Gateway reachable + DNS resolves, but the 8.8.8.8 ping marker is absent
  // (blocked ICMP yields no marker): internet must not claim UNREACHABLE.
  const partial = {
    adapters: adaptersEvidence().adapters,
    ni01: { adaptersUp: 1, gateway: '192.168.1.1', gatewayState: 'reachable', dnsOk: true, internetOk: null },
    ni06: null, outcomes: {},
  };
  const states = model.deriveLayerStates(partial, []);
  assert.notEqual(states.internet, 'UNREACHABLE');
});

test('Station 03: recommendations escalate by evidence, never jump to reset', () => {
  const tools = STATION_IDS.map((id) => bridge.manifest.get(id));
  assert.deepEqual(model.buildRecommendations(adaptersEvidence(), tools), [], 'healthy path means no repairs');
  const dnsFail = { ...adaptersEvidence(), ni01: model.parseNi01Lines(NI01_DNS_FAIL) };
  const recs = model.buildRecommendations(dnsFail, tools);
  assert.ok(recs.some((rec) => rec.toolId === 'NI03'), 'DNS failure with reachable gateway must recommend flush');
  assert.ok(!recs.some((rec) => rec.toolId === 'NI08'), 'DNS failure must not jump to full reset');
  const stackCase = {
    ...adaptersEvidence(),
    ni01: { adaptersUp: 1, gateway: '192.168.1.1', gatewayState: 'reachable', dnsOk: true, internetOk: false },
  };
  // Gap 3: gateway + DNS OK + public-IP ICMP failure alone must NOT
  // recommend Winsock reset; it is DEGRADED/INCONCLUSIVE.
  const recs2 = model.buildRecommendations(stackCase, tools);
  assert.ok(!recs2.some((rec) => rec.toolId === 'NI04'), 'ICMP failure alone must NOT trigger automatic Winsock recommendation');
  assert.equal(recs2.length, 0, 'stack-level failure with no independent transport evidence yields no repair recommendations');
});

test('Station 03: static IPs are never sent to DHCP renew', () => {
  // The model only recommends NI02 when a DHCP-capable adapter lacks a lease.
  // A static adapter with no gateway must not produce an NI02 recommendation.
  const staticNoGw = {
    adapters: [{ Description: 'Intel Ethernet', IPv4: '10.0.0.5', Gateway: '', DNS: ['10.0.0.1'], DHCP: false, MacAddress: 'CC' }],
    ni01: { adaptersUp: 1, gateway: '', gatewayState: 'none', dnsOk: true, internetOk: false },
    ni06: null, outcomes: {},
  };
  const tools = STATION_IDS.map((id) => bridge.manifest.get(id));
  const recs = model.buildRecommendations(staticNoGw, tools);
  assert.ok(!recs.some((rec) => rec.toolId === 'NI02'), 'static adapters must never be renew targets');
});

test('Station 03: adapter classification separates physical, wifi, virtual', () => {
  assert.equal(model.classifyAdapter('Intel Ethernet Connection'), 'ethernet');
  assert.equal(model.classifyAdapter('Intel Wi-Fi 6 AX201'), 'wifi');
  assert.equal(model.classifyAdapter('Hyper-V Virtual Ethernet Adapter'), 'virtual');
  assert.equal(model.classifyAdapter('TAP-Windows Adapter'), 'virtual');
  assert.equal(model.classifyAdapter('Software Loopback Interface'), 'loopback');
});

test('Station 03: diagnose plan is read-only and ordered by layer', () => {
  const tools = STATION_IDS.map((id) => bridge.manifest.get(id));
  const plan = model.diagnosePlan(tools);
  assert.deepEqual(plan.map((step) => step.toolId), ['NI11', 'NI10', 'NI01', 'NI06']);
  assert.ok(plan.every((step) => step.mode === 'run'));
  for (const step of plan) {
    assert.equal(bridge.manifest.get(step.toolId).RiskLevel, 'READ_ONLY', `${step.toolId} diagnose step must be read-only`);
  }
});

test('Station 03: repair ladder orders refresh before reset', () => {
  const levels = model.REPAIR_LADDER.map((step) => step.toolId);
  assert.ok(levels.indexOf('NI03') < levels.indexOf('NI04'), 'DNS flush must precede Winsock');
  assert.ok(levels.indexOf('NI04') < levels.indexOf('NI08'), 'Winsock must precede full reset');
  assert.equal(model.REPAIR_LADDER[model.REPAIR_LADDER.length - 1].toolId, 'NI08', 'full reset must be last');
});

test('Station 03: report carries adapters and layers, never secrets', () => {
  const report = model.buildNetworkReport({
    adapters: adaptersEvidence().adapters,
    ni01: model.parseNi01Lines(NI01_OK),
    ni06: { lossPercent: 0, avgMs: 12, attempts: 10, measured: true },
    outcomes: [fakeOutcome('NI01')],
    history: [],
    before: { gateway: '192.168.1.1', dnsOk: false, internetOk: true },
    after: { gateway: '192.168.1.1', dnsOk: true, internetOk: true },
    lang: 'en',
  });
  assert.match(report, /192\.168\.1\.1/);
  assert.match(report, /loss 0%/);
  assert.match(report, /No passwords or secrets/);
  assert.match(report, /proxy/i);
  const lowered = report.toLowerCase();
  for (const secret of ['password', 'credential', 'token', 'private key', 'wifi key']) {
    if (secret === 'password') continue; // allowed inside the 'No passwords' scope line
    assert.equal(lowered.includes(secret), false, `report must not contain ${secret}`);
  }
});

// ---------- evidence-truth regression tests ----------

test('Station 03: adapter truth excludes virtual/loopback from primary path', () => {
  // Hyper-V, TAP, loopback adapters with IPs must not prove CONNECTED path.
  const virtualOnly = {
    adapters: [
      { Description: 'Hyper-V Virtual Ethernet Adapter', IPv4: '192.168.1.20', Gateway: '192.168.1.1', DNS: ['192.168.1.1'], DHCP: true, MacAddress: 'VV' },
      { Description: 'Software Loopback Interface', IPv4: '127.0.0.1', Gateway: '', DNS: [], DHCP: false, MacAddress: 'LL' },
    ],
    ni01: { adaptersUp: 2, gateway: '192.168.1.1', gatewayState: 'reachable', dnsOk: true, internetOk: true },
    ni06: null, outcomes: {},
  };
  const states = model.deriveLayerStates(virtualOnly, []);
  // No real physical/internet adapter proves the path.
  assert.notEqual(states.adapter, 'CONNECTED', 'virtual/loopback adapters must not falsely prove adapter CONNECTED');
});

test('Station 03: routing truth separates configured from verified', () => {
  // Configured gateway but unverified (no NI01 gatewayState) => CONFIGURED, not CONNECTED.
  const configuredOnly = {
    adapters: [{ Description: 'Intel Ethernet', IPv4: '192.168.1.20', Gateway: '192.168.1.1', DNS: ['192.168.1.1'], DHCP: true, MacAddress: 'AA' }],
    ni01: null,
    ni06: null, outcomes: {},
  };
  const states = model.deriveLayerStates(configuredOnly, []);
  assert.equal(states.routing, 'CONFIGURED', 'configured gateway without verified route must be CONFIGURED, not CONNECTED');
  // Verified gateway => CONNECTED.
  const verified = {
    adapters: configuredOnly.adapters,
    ni01: { adaptersUp: 1, gateway: '192.168.1.1', gatewayState: 'reachable', dnsOk: true, internetOk: true },
    ni06: null, outcomes: {},
  };
  const statesV = model.deriveLayerStates(verified, []);
  assert.equal(statesV.routing, 'CONNECTED', 'verified gateway must prove routing CONNECTED');
  // No gateway, no adapters => INCONCLUSIVE (not falsely CONNECTED).
  const emptyRoute = {
    adapters: [], ni01: null, ni06: null, outcomes: {},
  };
  const statesEmpty = model.deriveLayerStates(emptyRoute, []);
  assert.equal(statesEmpty.routing, 'INCONCLUSIVE', 'missing route evidence must be INCONCLUSIVE');
});

test('Station 03: gateway reachable + DNS OK + public IP ICMP failure => NO automatic Winsock recommendation', () => {
  const tools = STATION_IDS.map((id) => bridge.manifest.get(id));
  const stackCase = {
    adapters: [{ Description: 'Intel Ethernet', IPv4: '192.168.1.20', Gateway: '192.168.1.1', DNS: ['192.168.1.1'], DHCP: true, MacAddress: 'AA' }],
    ni01: { adaptersUp: 1, gateway: '192.168.1.1', gatewayState: 'reachable', dnsOk: true, internetOk: false },
    ni06: null, outcomes: {},
  };
  const recs = model.buildRecommendations(stackCase, tools);
  assert.ok(!recs.some((rec) => rec.toolId === 'NI04'), 'ICMP failure alone must NOT recommend Winsock');
  // The internet layer should be DEGRADED (gateway + DNS OK but ping fails = inconclusive/blocked), not a repair trigger.
  const states = model.deriveLayerStates(stackCase, []);
  assert.equal(states.internet, 'DEGRADED', 'gateway+dns OK with ping failure must be DEGRADED, not UNREACHABLE');
});

// ---------- product surface ----------

test('Station 03: UI keeps the Connection Map identity without fake telemetry', () => {
  const station = readWeb('src/features/stations/station03/NetworkStation.tsx');
  const modelSource = readWeb('src/features/stations/station03/networkModel.ts');
  assert.match(station, /CONNECTION MAP/, 'station must keep the Connection Map identity');
  for (const source of [station, modelSource]) {
    assert.equal(/Math\.random/.test(source), false, 'no random telemetry');
    assert.equal(/Mbps|fake.*ping|12 ms/.test(source), false, 'no fake network numbers');
  }
  assert.match(station, /Bridge offline is not internet offline/, 'station must separate bridge state from internet state');
  for (const state of ['NOT_CHECKED', 'REPAIR_VERIFIED', 'INCONCLUSIVE', 'ADMIN_REQUIRED', 'ENGINE_OFFLINE']) {
    assert.ok(station.includes(state), `station must model ${state}`);
  }
});

test('Station 03: offline bridge renders the shared offline state', () => {
  const station = readWeb('src/features/stations/station03/NetworkStation.tsx');
  assert.match(station, /StationOfflineState/, 'station must use the shared offline state');
});

test('Station 03: Arabic and English labels are both present', () => {
  const station = readWeb('src/features/stations/station03/NetworkStation.tsx');
  for (const label of ['تشخيص الاتصال', 'خريطة الاتصال', 'محول الشبكة النشط', 'البوابة الافتراضية', 'حل أسماء DNS', 'فقد الحزم', 'إصلاح الاتصال', 'تمت استعادة الاتصال', 'النتيجة غير حاسمة']) {
    assert.ok(station.includes(label), `station must include Arabic label: ${label}`);
  }
  assert.match(station, /dir=\{lang === 'ar' \? 'rtl' : 'ltr'\}/, 'station must switch direction');
});
