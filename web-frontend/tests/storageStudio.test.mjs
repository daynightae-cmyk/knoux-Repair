import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * KNOUX Repair — the production advisory gate and the Storage Studio.
 *
 * The quality gate used to run `npm audit` directly. npm 10 asks the bulk
 * advisory endpoint first and falls back to the retired quick endpoint when
 * that request fails, so one stalled connection reported a bogus "invalid
 * package tree" and turned the whole gate red before any evidence was
 * captured. The gate now runs through a script that uses the supported
 * endpoint, retries a transport failure, and fails closed when the advisory
 * service cannot be reached.
 *
 * These tests lock that behaviour, and the truthfulness contract of the
 * Storage Studio: measured readings only, no fabricated numbers, and every
 * destructive path left inside its own station.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8');

const gate = read('scripts/audit-production-deps.mjs');
const ci = read('../.github/workflows/ci.yml');
const installer = read('../.github/workflows/package-windows.yml');
const studio = read('src/components/pages/StorageStudio.tsx');
const studioCss = read('src/components/pages/storage-studio.css');
const familyPage = read('src/components/premium/FamilyPage.tsx');
const evidence = read('scripts/capture-storage-studio-evidence.mjs');
const client = read('src/lib/api.ts');

const { classifyAuditOutput, summarizeAdvisories } = await import(
  pathToFileURL(path.join(WEB_ROOT, 'scripts/audit-production-deps.mjs')).href
);

test('the advisory gate audits production dependencies and fails at high', () => {
  assert.match(gate, /'audit', '--omit=dev', `--audit-level=\$\{AUDIT_LEVEL\}`, '--json'/);
  assert.match(gate, /const AUDIT_LEVEL = 'high'/);
  // Dev dependencies stay out of the production gate.
  assert.match(gate, /--omit=dev/);
});

test('a clean production report passes the gate', () => {
  const verdict = classifyAuditOutput(
    JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {},
      metadata: { vulnerabilities: { high: 0, critical: 0 }, dependencies: { prod: 263 } },
    }),
    '',
    0,
  );
  assert.equal(verdict.kind, 'report');
  assert.equal(verdict.clean, true);
  assert.equal(verdict.prodDependencies, 263);
});

test('a real production advisory fails the gate and names the package', () => {
  const verdict = classifyAuditOutput(
    JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {
        'left-pad': [{ name: 'left-pad', severity: 'high', title: 'Prototype Pollution', range: '<1.3.0' }],
      },
      metadata: { vulnerabilities: { high: 1, critical: 0 }, dependencies: { prod: 263 } },
    }),
    '',
    1,
  );
  assert.equal(verdict.kind, 'report');
  assert.equal(verdict.clean, false);
  assert.equal(verdict.high, 1);
  const rows = summarizeAdvisories(verdict.advisories);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'left-pad');
  assert.equal(rows[0].severity, 'high');
});

test('an unreachable advisory service is never read as a clean bill of health', () => {
  // This is the shape npm prints when the advisory request itself fails:
  // the retired quick endpoint answering 400 "Invalid package tree".
  const verdict = classifyAuditOutput(
    JSON.stringify({ message: 'Invalid package tree, run  npm install  to rebuild your package-lock.json', error: { summary: '', detail: '' } }),
    'npm error audit endpoint returned an error',
    1,
  );
  assert.equal(verdict.kind, 'unreachable');
  assert.equal(verdict.clean, false);
  assert.match(verdict.detail, /Invalid package tree/);
});

test('the gate fails closed when the advisory service stays unreachable', () => {
  // BLOCKED is still a failure: an unverified tree is not a verified tree.
  assert.match(gate, /VERDICT: BLOCKED/);
  assert.match(gate, /return \{ exitCode: 1, verdict \};/);
  assert.match(gate, /return \{ exitCode: 1, verdict: last \};/);
  // And it retries a transport failure instead of reporting it as a finding.
  assert.match(gate, /retrying in/);
});

test('the gate uses the supported bulk advisory endpoint', () => {
  // npm 11 dropped the retired quick endpoint; an older npm runs the audit
  // through npx so the fallback can never answer.
  assert.match(gate, /const BULK_ONLY_NPM_MAJOR = 11/);
  assert.match(gate, /'--yes', 'npm@11'/);
  // A stalled request must not hold the gate for npm's 300s default.
  assert.match(gate, /npm_config_fetch_timeout: '60000'/);
  assert.match(gate, /npm_config_fetch_retries: '4'/);
});

test('the quality gate runs the advisory script and no longer double-audits on install', () => {
  assert.match(ci, /npm ci --no-audit/);
  assert.match(ci, /node scripts\/audit-production-deps\.mjs/);
  assert.doesNotMatch(ci, /run: npm audit --omit=dev/);
  // The installer job spends no advisory traffic either.
  assert.match(installer, /npm ci --no-audit/);
});

test('the Storage Studio is the recovery family surface', () => {
  assert.match(familyPage, /import StorageStudio from '\.\.\/pages\/StorageStudio'/);
  assert.match(familyPage, /family\.id === 'recovery'/);
  assert.match(familyPage, /<StorageStudio/);
  assert.equal((familyPage.match(/<StorageStudio/g) ?? []).length, 1);
  // The family's own action surface stays mounted under the stations.
  assert.match(familyPage, /<RecoverySpotlight/);
});

test('every Storage Studio reading comes from the bridge', () => {
  assert.match(studio, /api\.cleanupPreview\(\)/);
  assert.match(studio, /api\.duplicatesLatestScan\(\)/);
  assert.match(studio, /api\.backupRecoveryPreview\(\)/);
  // Disk capacity is the measured volume list, never a hard-coded size.
  assert.match(studio, /systemSnapshot\?\.Drives \?\? \[\]/);
  // No invented telemetry.
  assert.doesNotMatch(studio, /Math\.random/);
  assert.doesNotMatch(studio, /256\s*GB|\bTODO\b|\bFIXME\b/);
});

test('the Storage Studio states the truth when nothing has been measured', () => {
  assert.match(studio, /Not measured/);
  assert.match(studio, /Not measured yet/);
  // An offline bridge produces an empty state, not a plausible number.
  assert.match(studio, /bridgeOnline === false/);
  // A failed reading is reported, never silently replaced.
  assert.match(studio, /Promise\.allSettled/);
  assert.match(studio, /Some readings failed/);
});

test('the Storage Studio selects stations and never executes them', () => {
  assert.match(studio, /onSelectService\(station\.id\)/);
  // Quarantine, restore and delete stay inside the owning station behind
  // their own confirmation; the studio only opens a station.
  assert.doesNotMatch(studio, /duplicatesEngineQuarantine|duplicatesRestore|duplicatesVerify|api\.startRun/);
  assert.match(studio, /Open station/);
});

test('the Storage Studio keeps the studio visual grammar', () => {
  assert.match(studioCss, /\.knoux-storage-studio/);
  assert.match(studioCss, /\.knoux-storage-station\b/);
  assert.match(studio, /<StudioHeader/);
  assert.match(studio, /<StatusIndicator/);
});

test('the recovery family keeps its own visual identity and live context', () => {
  // The studio replaced the family overview, so the recovery hero and the
  // live-context facts it used to show have to survive somewhere.
  assert.match(studio, /RecoveryHoloVisual/);
  assert.match(studio, /knoux-storage-studio__masthead/);
  assert.match(studio, /knoux-storage-studio__context-items/);
  assert.match(studio, /systemSnapshot\?\.SystemDrive/);
  assert.match(studio, /systemSnapshot\?\.Machine/);
  // And the hero visual is still reachable: the family overview still owns
  // the import, so no shipped visual is orphaned by the rewrite.
  assert.match(read('src/components/premium/HeroVisuals.tsx'), /export function RecoveryHoloVisual/);
  assert.match(studioCss, /\.knoux-storage-studio__masthead/);
});

test('the Storage Studio evidence harness is wired into the quality gate', () => {
  assert.match(ci, /node scripts\/capture-storage-studio-evidence\.mjs/);
  assert.match(evidence, /\.knoux-storage-studio/);
  // The harness asserts the truthfulness contract on the rendered DOM.
  assert.match(evidence, /not measured/);
  assert.match(evidence, /EXPECTED_SERVICES/);
  for (const service of ['02-System-Cleanup', '05-Duplicate-Files', '06-Disk-Space', '11-Backup-Recovery']) {
    assert.ok(evidence.includes(service), `the harness covers ${service}`);
  }
  // And it survives the Edge navigation degradation the other harnesses
  // already tolerate.
  assert.match(evidence, /async function navigateEvidenceRoute\(/);
  assert.match(evidence, /attempt <= 2/);
  assert.match(evidence, /if \(committed\) return;/);
});

test('the studio publishes whether the measurement pass has finished', () => {
  // "Not started yet" and "read and found nothing" look identical on
  // screen, so the surface declares the state of the pass itself and the
  // capture waits on that instead of guessing.
  assert.match(studio, /data-probe=\{probeState\}/);
  assert.match(studio, /'idle' \| 'loading' \| 'settled'/);
  assert.match(evidence, /data-probe/);
  assert.match(evidence, /data-probe'\) === 'settled'/);
});

test('the Storage Studio never runs a destructive path', () => {
  // The evidence harness and the studio stay on the reading side only.
  assert.doesNotMatch(evidence, /api\.[a-zA-Z]*(quarantine|restore|delete|execute|startRun|cleanupRun)/);
  assert.doesNotMatch(studio, /api\.[a-zA-Z]*(quarantine|restore|delete|execute|startRun|cleanupRun)/);
  assert.match(studio, /selection is never execution/i);
});

test('a bridge preview that cannot be produced is evidence, not a renderer failure', () => {
  // A 5xx from a preview is the product's truthful "not measured" path. The
  // harness records it instead of failing, and then asserts the surface said
  // something about it — a failure that is reported nowhere is a lie.
  assert.match(evidence, /BRIDGE_UNAVAILABLE/);
  assert.match(evidence, /isBridgeUnavailable/);
  assert.match(evidence, /the bridge failed but the studio reported nothing/);
  assert.match(evidence, /knoux-storage-studio__notice/);
  // A real renderer error still fails the capture.
  assert.match(evidence, /renderer errors/);
});

test('two surfaces on one screen share one expensive preview request', () => {
  // The studio and the family spotlight read the same cleanup and backup
  // previews. Running the PowerShell measurement twice at once made it time
  // out, so concurrent readers now share one request.
  assert.match(client, /function shareRead</);
  assert.match(client, /const inFlightReads = new Map<string, Promise<unknown>>\(\)/);
  assert.match(client, /shareRead\('cleanup-preview'/);
  assert.match(client, /shareRead\('backup-recovery-preview'/);
  assert.match(client, /shareRead\('duplicates-latest-scan'/);
  // Only concurrent calls are merged: the entry is dropped once it settles.
  assert.match(client, /if \(inFlightReads\.get\(key\) === pending\) inFlightReads\.delete\(key\)/);
});
