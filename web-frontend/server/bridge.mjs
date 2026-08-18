/**
 * KNOUX REPAIR — Local Execution Bridge
 * Secure localhost-only HTTP bridge that executes the real KNOUX repair
 * PowerShell scripts (TOOLS-MANIFEST allowlist only). No arbitrary commands.
 *
 * Usage:  node server/bridge.mjs            (run elevated for admin tools)
 *         KNOUX_BRIDGE_PORT=8787 node server/bridge.mjs
 */
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVER_DIR, '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'Docs', 'TOOLS-MANIFEST.json');
const LOG_PATH = path.join(os.tmpdir(), 'knoux-bridge.log');
const PORT = Number(process.env.KNOUX_BRIDGE_PORT || 8787);
const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const TEST_MODE = process.env.KNOUX_BRIDGE_TEST_MODE === '1';
const TEST_TIMEOUT_MS = Number(process.env.KNOUX_BRIDGE_TEST_TIMEOUT_MS || 0);
const RUN_TIMEOUT_MS = TEST_MODE && Number.isInteger(TEST_TIMEOUT_MS) && TEST_TIMEOUT_MS >= 250 && TEST_TIMEOUT_MS <= 30000 ? TEST_TIMEOUT_MS : DEFAULT_RUN_TIMEOUT_MS;
const TEST_TIMEOUT_TOOL_ID = '__KNOUX_TEST_TIMEOUT__';
const TEST_TIMEOUT_SCRIPT_PATH = path.join(os.tmpdir(), `knoux-bridge-timeout-${process.pid}.ps1`);
const MAX_BUFFERED_LINES = 5000;
const SYSTEM_CACHE_MS = 30 * 1000;

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch { /* ignore */ }
  console.log(line);
}

function readManifest() {
  const text = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const entries = JSON.parse(text);
  const map = new Map();
  for (const e of entries) {
    if (e && typeof e.ToolId === 'string') map.set(e.ToolId, e);
  }
  return map;
}

function findPowerShell() {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
    process.env.ProgramFilesx86
      ? path.join(process.env.ProgramFilesx86, 'PowerShell', '7', 'pwsh.exe')
      : null,
    path.join(process.env.windir || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('PowerShell not found (pwsh.exe / powershell.exe)');
}

const PS = findPowerShell();

let _elevated = null;
function isElevated() {
  if (_elevated !== null) return _elevated;
  const check = spawnSync(PS, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-Command',
    '[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  ], { encoding: 'utf8', timeout: 20000, windowsHide: true });
  _elevated = String(check.stdout || '').trim().toLowerCase() === 'true';
  return _elevated;
}

log('Bridge v2.0.2 | repo:', REPO_ROOT);
log('PowerShell:', PS, '| elevated:', isElevated());

const manifest = readManifest();
if (TEST_MODE) {
  fs.writeFileSync(TEST_TIMEOUT_SCRIPT_PATH, "Write-Output '[KNOUX TEST] timeout probe started.'\r\nStart-Sleep -Seconds 30\r\n", 'utf8');
  manifest.set(TEST_TIMEOUT_TOOL_ID, { ToolId: TEST_TIMEOUT_TOOL_ID, Category: 'TEST_ONLY', ScriptPath: '[generated test-only timeout probe]', EnglishName: 'Test-only timeout probe', ArabicName: 'اختبار مهلة داخلي', Purpose: 'Harmless process used only to verify bridge timeout handling.', RiskLevel: 'READ_ONLY', RequiresAdmin: false });
  log(`Test-only timeout mode enabled (${RUN_TIMEOUT_MS}ms).`);
}
log('Manifest loaded:', manifest.size, 'tools');

/* ---------------- run registry ---------------- */

const runs = new Map();
let activeRunId = null;

function createRun(toolId) {
  const tool = manifest.get(toolId);
  const isTestTimeoutTool = TEST_MODE && toolId === TEST_TIMEOUT_TOOL_ID;
  const scriptPath = isTestTimeoutTool ? TEST_TIMEOUT_SCRIPT_PATH : path.resolve(REPO_ROOT, tool.ScriptPath);
  if ((!isTestTimeoutTool && !scriptPath.startsWith(REPO_ROOT + path.sep)) || !fs.existsSync(scriptPath)) {
    throw Object.assign(new Error('Tool script not found'), { status: 500, code: 'SCRIPT_MISSING' });
  }
  if (tool.RequiresAdmin && !isElevated()) {
    throw Object.assign(
      new Error(`"${tool.EnglishName}" requires Administrator privileges. Restart the bridge as Administrator (double-click start-bridge-admin.cmd).`),
      { status: 403, code: 'ELEVATION_REQUIRED' }
    );
  }

  const run = {
    id: crypto.randomUUID(),
    toolId,
    toolName: tool.EnglishName,
    status: 'running',
    exitCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    lines: [],
    error: null,
    cancelled: false,
    child: null,
    timer: null,
  };
  runs.set(run.id, run);

  const child = spawn(PS, [
    '-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
  ], { cwd: REPO_ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

  run.child = child;

  const pushLine = (stream, text) => {
    if (text === undefined || text === null) return;
    const line = { t: new Date().toISOString(), s: stream, text: String(text) };
    if (run.lines.length >= MAX_BUFFERED_LINES) run.lines.shift();
    run.lines.push(line);
  };

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => chunk.split(/\r?\n/).forEach((l) => pushLine('out', l)));
  child.stderr.on('data', (chunk) => chunk.split(/\r?\n/).forEach((l) => pushLine('err', l)));

  run.timer = setTimeout(() => {
    if (run.status === 'running') {
      const timeoutText = TEST_MODE ? `${RUN_TIMEOUT_MS}ms` : '10 minutes';
      pushLine('err', `[BRIDGE] Execution timed out after ${timeoutText}.`);
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      finishRun(run.id, -1, 'TIMEOUT');
    }
  }, RUN_TIMEOUT_MS);

  child.on('error', (err) => {
    pushLine('err', `[BRIDGE] Failed to start process: ${err.message}`);
    finishRun(run.id, -1, 'SPAWN_FAILED');
  });

  child.on('close', (code) => {
    clearTimeout(run.timer);
    finishRun(run.id, code, run.cancelled ? 'CANCELLED' : null);
  });

  return run;
}

function finishRun(runId, exitCode, reason) {
  const run = runs.get(runId);
  if (!run || run.status !== 'running') return;
  run.exitCode = exitCode;
  run.finishedAt = new Date().toISOString();
  if (reason === 'CANCELLED') {
    run.status = 'cancelled';
    run.lines.push({ t: run.finishedAt, s: 'err', text: '[BRIDGE] Execution cancelled by user.' });
  } else if (reason === 'TIMEOUT') {
    run.status = 'error';
    run.error = TEST_MODE ? `Execution timed out after ${RUN_TIMEOUT_MS}ms.` : 'Execution timed out after 10 minutes.';
  } else if (reason === 'SPAWN_FAILED') {
    run.status = 'error';
    run.error = 'Failed to start the PowerShell process.';
  } else {
    run.status = exitCode === 0 ? 'success' : 'error';
    if (exitCode !== 0) run.error = `Tool exited with code ${exitCode}.`;
  }
  if (activeRunId === runId) activeRunId = null;
}

function cancelRun(runId) {
  const run = runs.get(runId);
  if (!run) return false;
  if (run.status === 'running') {
    run.cancelled = true;
    try { run.child.kill('SIGKILL'); } catch { /* ignore */ }
  }
  return true;
}

function publicRun(run) {
  return {
    id: run.id, toolId: run.toolId, toolName: run.toolName, status: run.status,
    exitCode: run.exitCode, startedAt: run.startedAt, finishedAt: run.finishedAt,
    lines: run.lines, error: run.error,
  };
}

/* ---------------- /api/system (real read-only snapshot) ---------------- */

let systemCache = { at: 0, data: null };

const SYSTEM_PS = `
$ErrorActionPreference = 'SilentlyContinue'
$o = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$drives = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  [pscustomobject]@{ Name = $_.DeviceID; TotalGB = [math]::Round($_.Size/1GB,1); FreeGB = [math]::Round($_.FreeSpace/1GB,1) }
})
$fw = $null
try { $fw = @(Get-NetFirewallProfile | ForEach-Object { [pscustomobject]@{ Profile = $_.Name; Enabled = $_.Enabled } }) } catch { $fw = $null }
$def = Get-MpComputerStatus
$sec = Get-Service -Name WinDefend
$p = Get-Process | Where-Object { $_.ProcessName } | Measure-Object | Select-Object -ExpandProperty Count
[pscustomobject]@{
  Os = $o.Caption; Version = $o.Version; Build = $o.BuildNumber;
  Machine = $cs.Manufacturer + ' ' + $cs.Model;
  UptimeSeconds = [math]::Round(([DateTime]::Now - $o.LastBootUpTime).TotalSeconds,0);
  TotalRamGB = [math]::Round($cs.TotalPhysicalMemory/1GB,1);
  FreeRamGB = [math]::Round($o.FreePhysicalMemory/1MB,1);
  CpuName = $cpu.Name; CpuLoad = $cpu.LoadPercentage;
  Processes = $p; Drives = $drives;
  Firewall = $fw;
  DefenderRunning = [bool]$sec; DefenderRealtime = [bool]($def.RealTimeProtectionEnabled -eq $true);
  DefenderSignatures = [string]$def.AntivirusSignatureVersion
} | ConvertTo-Json -Depth 4 -Compress
`.trim();

function getSystemSnapshot() {
  const now = Date.now();
  if (systemCache.data && now - systemCache.at < SYSTEM_CACHE_MS) return systemCache.data;
  const res = spawnSync(PS, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SYSTEM_PS,
  ], { encoding: 'utf8', timeout: 45000, windowsHide: true, cwd: REPO_ROOT });
  const text = String(res.stdout || '').trim();
  const lastJson = text.split('\n').filter((l) => l.trim().startsWith('{')).pop() || '{}';
  let parsed = {};
  try { parsed = JSON.parse(lastJson); } catch { /* fall through */ }
  if (!parsed || typeof parsed !== 'object') parsed = {};
  systemCache = { at: now, data: parsed };
  return parsed;
}

/* ---------------- HTTP server ---------------- */

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173', 'http://localhost:4173',
  'http://127.0.0.1:5173', 'http://127.0.0.1:4173',
]);

function sendJson(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(data);
}

function sendError(res, status, code, message) {
  sendJson(res, status, { ok: false, error: code, message });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const origin = req.headers.origin || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'http://localhost:4173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const pathParts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'health') {
      return sendJson(res, 200, {
        ok: true, bridge: 'knoux-bridge', version: '2.0.2', elevated: isElevated(),
        powershell: PS, repoRoot: REPO_ROOT, tools: manifest.size,
      }, corsHeaders);
    }

    if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'tools') {
      const tools = [...manifest.values()].map((t) => ({
        ToolId: t.ToolId, Category: t.Category, ScriptPath: t.ScriptPath,
        EnglishName: t.EnglishName, ArabicName: t.ArabicName, Purpose: t.Purpose || '',
        RiskLevel: t.RiskLevel || '', RequiresAdmin: !!t.RequiresAdmin,
      }));
      return sendJson(res, 200, { ok: true, tools }, corsHeaders);
    }

    if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'system') {
      const snap = getSystemSnapshot();
      return sendJson(res, 200, { ok: true, system: snap }, corsHeaders);
    }

    if (req.method === 'POST' && pathParts[0] === 'api' && pathParts[1] === 'runs' && pathParts.length === 2) {
      let body = {};
      try {
        const raw = await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', (c) => { data += c; if (data.length > 64 * 1024) reject(new Error('body too large')); });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });
        body = JSON.parse(raw || '{}');
      } catch { return sendError(res, 400, 'BAD_REQUEST', 'Invalid JSON body.'); }

      const toolId = String(body.toolId || '');
      const tool = manifest.get(toolId);
      if (!tool) return sendError(res, 400, 'UNKNOWN_TOOL', `Unknown tool id "${toolId}". Only manifest tools can be executed.`);

      if (activeRunId && runs.get(activeRunId)?.status === 'running') {
        return sendError(res, 409, 'RUN_IN_PROGRESS', 'Another tool is currently running. Wait for it to finish or cancel it first.');
      }

      try {
        const run = createRun(toolId);
        activeRunId = run.id;
        log('RUN start:', run.id, toolId, '-', tool.EnglishName);
        return sendJson(res, 202, { ok: true, runId: run.id }, corsHeaders);
      } catch (e) {
        return sendError(res, e.status || 500, e.code || 'RUN_FAILED', e.message);
      }
    }

    if (req.method === 'GET' && pathParts[0] === 'api' && pathParts[1] === 'runs' && pathParts[2]) {
      const run = runs.get(pathParts[2]);
      if (!run) return sendError(res, 404, 'RUN_NOT_FOUND', 'Run not found.');
      return sendJson(res, 200, { ok: true, run: publicRun(run) }, corsHeaders);
    }

    if (req.method === 'POST' && pathParts[0] === 'api' && pathParts[1] === 'runs' && pathParts[2] && pathParts[3] === 'cancel') {
      const ok = cancelRun(pathParts[2]);
      if (!ok) return sendError(res, 404, 'RUN_NOT_FOUND', 'Run not found.');
      log('RUN cancel:', pathParts[2]);
      return sendJson(res, 200, { ok: true }, corsHeaders);
    }

    return sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${url.pathname}`);
  } catch (e) {
    log('ERROR:', e.stack || e.message);
    sendError(res, 500, 'INTERNAL', e.message || 'Internal error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Bridge listening on http://127.0.0.1:${PORT} (elevated=${isElevated()})`);
});

process.on('SIGINT', () => {
  for (const run of runs.values()) {
    if (run.status === 'running') { try { run.child.kill('SIGKILL'); } catch { /* ignore */ } }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
});

process.on('exit', () => { if (TEST_MODE) { try { fs.unlinkSync(TEST_TIMEOUT_SCRIPT_PATH); } catch { /* ignore */ } } });
