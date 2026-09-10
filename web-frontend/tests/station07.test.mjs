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

const STATION07_IDS = ['SP01', 'SP02', 'SP03', 'SP04', 'SP05', 'SP06', 'SP07', 'SP08', 'SP09', 'SP10', 'SP11'];

const require = createRequire(import.meta.url);
const { buildSync } = require('esbuild');
const bundlePath = path.join(os.tmpdir(), `knoux-station07-model-${process.pid}.mjs`);
buildSync({
  entryPoints: [path.join(WEB_ROOT, 'src', 'features', 'stations', 'station07', 'servicesModel.ts')],
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

test('Station 07: manifest inventory is exactly 11 registered tools', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const station = manifest.filter((entry) => entry.Category === '07-Services-Processes');
  assert.equal(station.length, 11, 'Station 07 must have exactly 11 tools');
  assert.deepEqual(
    station.map((entry) => entry.ToolId).sort(),
    [...STATION07_IDS].sort(),
    'Station 07 ToolIds must match the manifest contract',
  );
  for (const entry of station) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, entry.ScriptPath)), `${entry.ToolId} script must resolve on disk`);
  }
});

test('Station 07: admin requirements match security posture', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const adminTools = manifest.filter((entry) => entry.Category === '07-Services-Processes' && entry.RequiresAdmin);
  const adminIds = adminTools.map((e) => e.ToolId);
  assert.deepEqual(adminIds.sort(), ['SP05', 'SP06', 'SP08', 'SP09'].sort());
});

test('Station 07: read-only reporting tools are properly flagged and safe', () => {
  const manifest = JSON.parse(readRepo('Docs/TOOLS-MANIFEST.json').replace(/^\uFEFF/, ''));
  const readOnly = manifest.filter((entry) => entry.Category === '07-Services-Processes' && entry.RiskLevel === 'READ_ONLY');
  const readOnlyIds = readOnly.map((e) => e.ToolId);
  assert.deepEqual(readOnlyIds.sort(), ['SP01', 'SP02', 'SP07', 'SP10', 'SP11'].sort());
  for (const entry of readOnly) {
    assert.equal(entry.RequiresAdmin, false, `${entry.ToolId} must not require admin`);
  }
});

/* =========================================================================
 * DOMAIN MODEL LOGIC VERIFICATION (servicesModel.ts)
 * ========================================================================= */

test('Station 07: parseServicesInventory normalizes status, start mode and blast radius', () => {
  const rawServices = [
    { Name: 'wuauserv', DisplayName: 'Windows Update', Status: 'Running', StartMode: 'Auto', DependentServices: [] },
    { Name: 'Spooler', DisplayName: 'Print Spooler', Status: 'Stopped', StartMode: 'Manual', DependentServices: [] },
    { Name: 'RpcSs', DisplayName: 'Remote Procedure Call', Status: 'Running', StartMode: 'Auto', DependentServices: ['s1', 's2', 's3', 's4', 's5'] },
  ];
  const parsed = model.parseServicesInventory(rawServices);
  assert.equal(parsed.length, 3);

  // wuauserv is protected
  assert.equal(parsed[0].name, 'wuauserv');
  assert.equal(parsed[0].status, 'Running');
  assert.equal(parsed[0].startType, 'Automatic');
  assert.equal(parsed[0].isProtected, true);
  assert.equal(parsed[0].blastRadius, 'CRITICAL');

  // Spooler is non-protected
  assert.equal(parsed[1].name, 'Spooler');
  assert.equal(parsed[1].status, 'Stopped');
  assert.equal(parsed[1].startType, 'Manual');
  assert.equal(parsed[1].isProtected, false);
  assert.equal(parsed[1].blastRadius, 'LOW');

  // RpcSs has 5 dependents + is protected
  assert.equal(parsed[2].blastRadius, 'CRITICAL');
});

test('Station 07: parseProcessesInventory parses metrics and categorizes processes', () => {
  const raw = [
    { ProcessName: 'System', ProcessId: 4, WorkingSetMB: 20, TotalProcessorTimeSeconds: 120, Responding: true },
    { ProcessName: 'Code', ProcessId: 1024, WorkingSetMB: 450, TotalProcessorTimeSeconds: 45, Responding: true },
    { ProcessName: 'BadApp', ProcessId: 2048, WorkingSetMB: 300, TotalProcessorTimeSeconds: 10, Responding: false },
  ];
  const parsed = model.parseProcessesInventory(raw);
  assert.equal(parsed.length, 3);

  assert.equal(parsed[0].name, 'System');
  assert.equal(parsed[0].isProtected, true);
  assert.equal(parsed[0].category, 'system');

  assert.equal(parsed[1].name, 'Code');
  assert.equal(parsed[1].isProtected, false);
  assert.equal(parsed[1].category, 'user');

  assert.equal(parsed[2].responding, false);
});

test('Station 07: isProcessProtected strictly defends Windows critical processes', () => {
  assert.equal(model.isProcessProtected('System'), true);
  assert.equal(model.isProcessProtected('csrss.exe'), true);
  assert.equal(model.isProcessProtected('winlogon'), true);
  assert.equal(model.isProcessProtected('services.exe'), true);
  assert.equal(model.isProcessProtected('lsass'), true);
  assert.equal(model.isProcessProtected('explorer.exe'), true);
  assert.equal(model.isProcessProtected('dwm'), true);
  assert.equal(model.isProcessProtected('Taskmgr'), true);
  assert.equal(model.isProcessProtected('MsMpEng'), true);
  assert.equal(model.isProcessProtected('random_tool.exe'), false);
});

test('Station 07: isServiceProtected strictly defends core system services', () => {
  assert.equal(model.isServiceProtected('wuauserv'), true);
  assert.equal(model.isServiceProtected('bits'), true);
  assert.equal(model.isServiceProtected('cryptsvc'), true);
  assert.equal(model.isServiceProtected('rpcss'), true);
  assert.equal(model.isServiceProtected('eventlog'), true);
  assert.equal(model.isServiceProtected('custom_svc'), false);
});

test('Station 07: calculateServiceTopology computes accurate counts without simulation', () => {
  const services = [
    { name: 's1', displayName: 'S1', status: 'Running', startType: 'Automatic', isProtected: true, dependentCount: 0, blastRadius: 'CRITICAL' },
    { name: 's2', displayName: 'S2', status: 'Stopped', startType: 'Automatic', isProtected: false, dependentCount: 0, blastRadius: 'LOW' },
    { name: 's3', displayName: 'S3', status: 'Stopped', startType: 'Manual', isProtected: false, dependentCount: 0, blastRadius: 'LOW' },
    { name: 's4', displayName: 'S4', status: 'Stopped', startType: 'Disabled', isProtected: false, dependentCount: 0, blastRadius: 'LOW' },
  ];
  const topo = model.calculateServiceTopology(services);
  assert.equal(topo.total, 4);
  assert.equal(topo.running, 1);
  assert.equal(topo.stopped, 3);
  assert.equal(topo.automatic, 2);
  assert.equal(topo.manual, 1);
  assert.equal(topo.disabled, 1);
  assert.equal(topo.attentionCount, 1); // s2 is Automatic but Stopped
});

test('Station 07: filterServices and filterProcesses filter accurately', () => {
  const services = [
    { name: 'wuauserv', displayName: 'Windows Update', status: 'Running', startType: 'Automatic', isProtected: true, dependentCount: 0, blastRadius: 'CRITICAL' },
    { name: 'spooler', displayName: 'Print Spooler', status: 'Stopped', startType: 'Manual', isProtected: false, dependentCount: 0, blastRadius: 'LOW' },
  ];
  assert.equal(model.filterServices(services, 'Update').length, 1);
  assert.equal(model.filterServices(services, '', 'running').length, 1);
  assert.equal(model.filterServices(services, '', 'disabled').length, 0);

  const processes = [
    { name: 'explorer', pid: 100, memoryMB: 80, cpuSeconds: 10, responding: true, isProtected: true, category: 'system' },
    { name: 'hungapp', pid: 200, memoryMB: 300, cpuSeconds: 5, responding: false, isProtected: false, category: 'user' },
  ];
  assert.equal(model.filterProcesses(processes, 'hung').length, 1);
  assert.equal(model.filterProcesses(processes, '', 'notResponding').length, 1);
  assert.equal(model.filterProcesses(processes, '', 'highMemory').length, 1);
});

/* =========================================================================
 * ARCHITECTURAL INTEGRATION (ServiceApps & Components)
 * ========================================================================= */

test('Station 07: ServicesStation and ServicesHeroVisual components exist', () => {
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station07', 'ServicesStation.tsx')));
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station07', 'ServicesHeroVisual.tsx')));
  assert.ok(fs.existsSync(path.join(WEB_ROOT, 'src', 'features', 'stations', 'station07', 'servicesModel.ts')));
});

test('Station 07: ServiceApps routes activeSection services directly to ServicesStation', () => {
  const serviceAppsCode = readWeb('src/components/ServiceApps.tsx');
  assert.match(serviceAppsCode, /import\s+ServicesStation\s+from/);
  assert.match(serviceAppsCode, /activeSection === ['"]services['"]/);
  assert.match(serviceAppsCode, /<ServicesStation/);
});
