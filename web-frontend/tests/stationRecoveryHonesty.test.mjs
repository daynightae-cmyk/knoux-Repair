import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
// The working copy uses CRLF, so every assertion here is line-ending agnostic.
const read = (rel) => fs.readFileSync(path.join(webRoot, rel), 'utf8').replace(/\r\n/g, '\n');

const model = read('src/features/stations/station11/recoveryModel.ts');
const station = read('src/features/stations/station11/RecoveryStation.tsx');

// ---------------------------------------------------------------------------
// The defect: an unreadable query was reported as a verified empty one
// ---------------------------------------------------------------------------

test('readiness never claims UNPROTECTED when nothing could actually be queried', () => {
  // All three mechanisms unavailable used to collapse to (0, 0, 0) -> UNPROTECTED,
  // which told the user their PC was unprotected when the truth was "could not check".
  assert.match(model, /if \(reads\.every\(read => read === 'UNREADABLE'\)\) \{\s*\n\s*return 'INCONCLUSIVE';/);
  assert.doesNotMatch(model, /if \(restorePoints === 0 && shadowCopies === 0 && localBackups === 0\) \{\s*\n\s*return 'UNPROTECTED';/);
});

test('UNPROTECTED requires at least one mechanism that was actually read', () => {
  assert.match(model, /if \(measured\.length > 0\) \{\n\s*return 'UNPROTECTED';/);
  assert.match(model, /read === 'UNREADABLE' \? null : count;/);
  assert.match(model, /\.filter\(\(value\): value is number => value !== null\)/);
});

test('the three read states are modelled, not collapsed into a boolean', () => {
  assert.match(model, /export type RecoverySourceRead = 'READABLE' \| 'READABLE_EMPTY' \| 'UNREADABLE';/);
});

test('read state is derived from the real availability flags on the preview', () => {
  assert.match(model, /!preview\.RestorePoints\?\.QueryAvailable\s*\n\s*\? 'UNREADABLE'/);
  assert.match(model, /!preview\.ShadowCopies\?\.QueryAvailable\s*\n\s*\? 'UNREADABLE'/);
  assert.match(model, /!preview\.LocalBackups\?\.RootAvailable\s*\n\s*\? 'UNREADABLE'/);
});

test('a source that could not be queried yields no count at all', () => {
  assert.match(model, /restorePointsRead === 'UNREADABLE' \? 0 : \(preview\.RestorePoints\?\.Count \?\? 0\)/);
  assert.match(model, /shadowCopiesRead === 'UNREADABLE' \? 0 : \(preview\.ShadowCopies\?\.Count \?\? 0\)/);
  assert.match(model, /localBackupsRead === 'UNREADABLE' \? 0 : \(preview\.LocalBackups\?\.Count \?\? 0\)/);
});

test('an absent preview reports every mechanism as unreadable', () => {
  assert.match(model, /restorePointsRead: 'UNREADABLE',\s*\n\s*shadowCopiesRead: 'UNREADABLE',\s*\n\s*localBackupsRead: 'UNREADABLE',/);
});

// ---------------------------------------------------------------------------
// The UI must speak the same distinction
// ---------------------------------------------------------------------------

test('each recovery list has its own unavailable message, distinct from its empty one', () => {
  for (const key of [
    'restorePointsUnavailable',
    'shadowCopiesUnavailable',
    'localBackupsUnavailable',
  ]) {
    assert.ok(station.includes(`${key}: `), `missing copy key: ${key}`);
  }
  for (const key of ['noRestorePoints', 'noShadowCopies', 'noLocalBackups']) {
    assert.ok(station.includes(`${key}: `), `missing copy key: ${key}`);
  }
});

test('the unavailable copy never implies the user lost data', () => {
  assert.match(station, /Nothing was lost here; backups have simply never run\./);
  assert.match(station, /This is not the same as having none\./);
});

test('each list renders unavailable before it renders empty', () => {
  assert.match(station, /summary\.restorePointsRead === 'UNREADABLE'\s*\n\s*\? text\.restorePointsUnavailable/);
  assert.match(station, /summary\.shadowCopiesRead === 'UNREADABLE'\s*\n\s*\? text\.shadowCopiesUnavailable/);
  assert.match(station, /summary\.localBackupsRead === 'UNREADABLE'\s*\n\s*\? text\.localBackupsUnavailable/);
});

test('the readiness banner explains an unknown verdict instead of staying vague', () => {
  assert.match(station, /unverifiedDesc: /);
  assert.match(station, /This is not a finding that you are unprotected\./);
  assert.match(station, /summary\.hasTelemetry\n\s*\? text\.unverifiedDesc/);
});

test('an unreadable mechanism reports a count as not reported, never as zero', () => {
  assert.match(station, /const readableCount = \(value: number, read: RecoverySourceRead\) =>/);
  assert.match(station, /read === 'UNREADABLE'\s*\n\s*\? text\.countUnavailable/);
});

test('an unreadable mechanism never reports EXPOSED, NONE or UNARCHIVED', () => {
  // Those are the alarming words an unread source must not trigger.
  assert.match(station, /const mechanismState = \(count: number, read: RecoverySourceRead/);
  assert.match(station, /if \(!summary\.hasTelemetry \|\| read === 'UNREADABLE'\) return 'UNKNOWN';/);
  assert.doesNotMatch(station, /summary\.hasTelemetry \? \(summary\.restorePointsCount > 0 \? 'READY' : 'EXPOSED'\)/);
  assert.doesNotMatch(station, /summary\.hasTelemetry \? \(summary\.shadowCopiesCount > 0 \? 'ACTIVE' : 'NONE'\)/);
  assert.doesNotMatch(station, /summary\.hasTelemetry \? \(summary\.localBackupsCount > 0 \? 'READY' : 'UNARCHIVED'\)/);
});

test('an unreadable source does not paint the tile as a problem', () => {
  // A red restore-point icon implies a finding that was never made.
  assert.match(station, /summary\.restorePointsRead === 'UNREADABLE' \? 'text-slate-400' : 'text-rose-400'/);
});

test('the unavailable and unverified copy exists in Arabic too', () => {
  const arabicUnavailable = (station.match(/Unavailable: '[^']*'/g) ?? []).length;
  assert.ok(arabicUnavailable >= 3, 'expected Arabic copy for each unavailable state');
  assert.match(station, /وهذا ليس دليلاً على أنك غير محمي\./);
});

// ---------------------------------------------------------------------------
// Signals: an unreadable mechanism must not raise a finding
// ---------------------------------------------------------------------------

test('an unreadable mechanism raises no finding at all', () => {
  // A HIGH "no restore points detected" signal from an unread source is exactly the
  // kind of invented finding this station must never produce.
  assert.match(model, /summary\.restorePointsRead !== 'UNREADABLE' && summary\.restorePointsCount === 0/);
  assert.match(model, /summary\.localBackupsRead !== 'UNREADABLE' && summary\.localBackupsCount === 0/);
  assert.doesNotMatch(model, /if \(summary\.restorePointsCount === 0\)/);
  assert.doesNotMatch(model, /if \(summary\.localBackupsCount === 0\)/);
});

test('an all-unreadable summary produces no signals at all', () => {
  assert.match(model, /if \(summary\.state === 'INCONCLUSIVE'\) return \[\];/);
});

test('a read-but-unqueryable vault is not described as pending telemetry', () => {
  // Telemetry arrived; the mechanisms inside it were unavailable. "Pending" would
  // misdescribe a finished read.
  assert.match(station, /<span>\{summary\.hasTelemetry \? text\.unverifiedDesc : text\.unknownDesc\}<\/span>/);
});
