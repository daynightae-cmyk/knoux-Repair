#!/usr/bin/env node
/**
 * KNOuX Repair — production dependency advisory gate.
 *
 * Why this exists instead of a bare `npm audit`:
 *
 *  - npm 10 asks the bulk advisory endpoint first, and when that request
 *    fails it falls back to `/-/npm/v1/security/audits/quick`. That fallback
 *    endpoint is being retired, so it answers 400 "Invalid package tree" and
 *    npm reports an invalid package tree for a lockfile that is perfectly
 *    valid. npm 11 only ever uses the supported bulk endpoint.
 *  - A hung advisory request used to burn npm's 300 second fetch timeout
 *    before falling back to the retired endpoint, so a single stalled
 *    connection turned the whole quality gate red.
 *
 * What this gate guarantees:
 *
 *  - Only production dependencies are audited (dev is omitted), and the
 *    gate fails on `high` and `critical` advisories, exactly like the
 *    command it replaces.
 *  - A real finding fails the gate. An unreachable advisory service also
 *    fails the gate, loudly and as BLOCKED. The gate never passes silently
 *    and it never reports a vulnerability count it did not receive.
 *
 * Usage: node scripts/audit-production-deps.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const AUDIT_LEVEL = 'high';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [15_000, 45_000];

/** npm versions that only use the supported bulk advisory endpoint. */
const BULK_ONLY_NPM_MAJOR = 11;

const isWindows = process.platform === 'win32';
const npmExecutable = isWindows ? 'npm.cmd' : 'npm';
const npxExecutable = isWindows ? 'npx.cmd' : 'npx';

export function classifyAuditOutput(stdout, stderr, exitCode) {
  const text = `${stdout ?? ''}`.trim();
  let parsed = null;
  if (text.startsWith('{')) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  // A real report: npm answered with the advisory document.
  if (parsed && typeof parsed.auditReportVersion === 'number') {
    const counts = parsed.metadata?.vulnerabilities ?? {};
    const high = Number(counts.high ?? 0);
    const critical = Number(counts.critical ?? 0);
    const prod = Number(parsed.metadata?.dependencies?.prod ?? 0);
    return {
      kind: 'report',
      clean: exitCode === 0 && high === 0 && critical === 0,
      high,
      critical,
      prodDependencies: prod,
      advisories: parsed.vulnerabilities ?? {},
      detail: '',
    };
  }

  // Anything else is the service or the transport failing, not a verdict.
  const message =
    parsed?.message ??
    parsed?.error?.summary ??
    `${stderr ?? ''}`.split('\n').find(line => line.includes('npm error'))?.replace(/^npm error\s*/, '').trim() ??
    'the advisory service did not return a report';
  return {
    kind: 'unreachable',
    clean: false,
    high: 0,
    critical: 0,
    prodDependencies: 0,
    advisories: {},
    detail: message,
  };
}

export function summarizeAdvisories(advisories) {
  const rows = [];
  for (const [name, entries] of Object.entries(advisories ?? {})) {
    // npm 11 reports one object per vulnerable package (with its advisory
    // detail under `via`); older reporters used an array of entries.
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      if (!entry || typeof entry !== 'object') continue;
      const via = Array.isArray(entry.via) ? entry.via : [];
      const advisory = via.find(item => item && typeof item === 'object' && (item.title || item.url)) ?? {};
      rows.push({
        name: entry.name ?? name,
        severity: entry.severity ?? advisory.severity ?? 'unknown',
        title: entry.title ?? advisory.title ?? advisory.url ?? entry.url ?? '',
        range: entry.range ?? advisory.range ?? '',
      });
    }
  }
  return rows.sort((a, b) => (a.severity === b.severity ? a.name.localeCompare(b.name) : a.severity.localeCompare(b.severity)));
}

function run(command, args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => { stdout += chunk; });
    child.stderr?.on('data', chunk => { stderr += chunk; });
    child.on('error', error => resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` }));
    child.on('close', code => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

/**
 * Node refuses to spawn a `.cmd` shim directly (EINVAL), so the npm CLI is
 * launched through its own JavaScript entry point when it can be found next
 * to the running node binary. The command shell is only the fallback.
 */
function npmLauncher() {
  const binDir = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin');
  const npmCli = path.join(binDir, 'npm-cli.js');
  const npxCli = path.join(binDir, 'npx-cli.js');
  return {
    npm: fs.existsSync(npmCli) ? { command: process.execPath, prefix: [npmCli] } : null,
    npx: fs.existsSync(npxCli) ? { command: process.execPath, prefix: [npxCli] } : null,
  };
}

function shellFallback(executable, args) {
  const quoted = [executable, ...args].map(part => `"${part}"`).join(' ');
  return {
    command: process.env.ComSpec ?? 'cmd.exe',
    prefix: ['/d', '/s', '/c', `"${quoted}"`],
  };
}

export async function readNpmMajorVersion(cwd) {
  const launcher = npmLauncher();
  const target = launcher.npm ?? shellFallback(npmExecutable, ['--version']);
  const result = await run(target.command, [...target.prefix, '--version'], { cwd });
  const major = Number.parseInt(`${result.stdout}`.trim(), 10);
  return Number.isFinite(major) ? major : 0;
}

/**
 * npm 10 falls back to the retired quick endpoint when the bulk request
 * fails, which turns a transport hiccup into a bogus "invalid package tree".
 * npm 11 only ever asks the supported bulk endpoint, so an older npm runs
 * the audit through npx instead.
 */
export async function resolveAuditRunner(cwd) {
  const major = await readNpmMajorVersion(cwd);
  const launcher = npmLauncher();
  if (major >= BULK_ONLY_NPM_MAJOR) {
    const target = launcher.npm ?? shellFallback(npmExecutable, []);
    return { command: target.command, prefix: target.prefix, npmMajor: major, viaNpx: false };
  }
  const target = launcher.npx ?? shellFallback(npxExecutable, ['--yes', 'npm@11']);
  return { command: target.command, prefix: [...target.prefix, '--yes', 'npm@11'], npmMajor: major, viaNpx: true };
}

function auditEnv() {
  return {
    // A stalled advisory request must not hold the gate for five minutes.
    npm_config_fetch_timeout: '60000',
    npm_config_fetch_retries: '4',
    npm_config_fetch_retry_mintimeout: '15000',
    npm_config_fetch_retry_maxtimeout: '120000',
    npm_config_audit_level: AUDIT_LEVEL,
  };
}

function sleep(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

export async function runAuditGate({ cwd = process.cwd(), log = console.log } = {}) {
  const runner = await resolveAuditRunner(cwd);
  const runnerVersion = `${(await run(runner.command, [...runner.prefix, '--version'], { cwd })).stdout}`.trim();
  log(`KNOuX production advisory gate`);
  log(`  npm: ${runner.npmMajor || 'unknown'}${runner.viaNpx ? ' (audit runs through npm@11: bulk advisory endpoint only)' : ' (bulk advisory endpoint)'}; runner ${runnerVersion || 'unknown'}`);
  log(`  scope: production dependencies only, dev omitted; fails at ${AUDIT_LEVEL}`);

  let last = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const result = await run(
      runner.command,
      [...runner.prefix, 'audit', '--omit=dev', `--audit-level=${AUDIT_LEVEL}`, '--json'],
      { cwd, env: auditEnv() },
    );
    const verdict = classifyAuditOutput(result.stdout, result.stderr, result.code);
    last = verdict;

    if (verdict.kind === 'report') {
      if (verdict.clean) {
        log(`  production dependencies audited: ${verdict.prodDependencies}`);
        log(`VERDICT: PASS — 0 high and 0 critical production advisories`);
        return { exitCode: 0, verdict };
      }
      log(`  production dependencies audited: ${verdict.prodDependencies}`);
      log(`VERDICT: FAIL — ${verdict.high} high and ${verdict.critical} critical production advisories`);
      for (const row of summarizeAdvisories(verdict.advisories)) {
        if (row.severity === 'high' || row.severity === 'critical') {
          log(`  ${row.name}  ${row.range}  ${row.severity}  ${row.title}`);
        }
      }
      return { exitCode: 1, verdict };
    }

    log(`  attempt ${attempt}/${MAX_ATTEMPTS}: advisory service unreachable — ${verdict.detail}`);
    if (attempt < MAX_ATTEMPTS) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      log(`  retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }

  log('VERDICT: BLOCKED — the advisory service could not be reached, so production dependencies were NOT verified.');
  log('  This is an infrastructure failure, not a clean bill of health: the gate fails on purpose.');
  return { exitCode: 1, verdict: last };
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (invokedDirectly) {
  const result = await runAuditGate({ cwd: process.cwd() });
  process.exit(result.exitCode);
}
