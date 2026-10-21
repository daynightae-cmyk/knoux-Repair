/**
 * KNOUX Repair — Desktop (Electron) Window Lifecycle Test Suite
 *
 * Locks the invariant that prevents the "application terminates itself"
 * defect: the main BrowserWindow must be held by a strong module-level
 * reference for the whole session.
 *
 * Background: `createWindow()` used to be called as a bare statement
 * (`createWindow(frontendOrigin, bridgeState);`), so the returned
 * BrowserWindow was reachable only from a local scope. V8 could finalize the
 * native window during a garbage collection, which emitted `closed` and then
 * `window-all-closed`, and the app quit itself with exit code 0 after an
 * unpredictable delay (observed: 50-92s, and 169s+ when a CDP client kept
 * the renderer busy). The strong module reference removes the collection
 * window entirely.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');

function readDesktop(relativePath) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

function mainSource() {
  return readDesktop('desktop/main.cjs');
}

// ── The strong reference must exist at module scope ──

test('Desktop lifecycle: main.cjs holds a module-level strong reference to the main window', () => {
  const source = mainSource();

  assert.match(
    source,
    /^let\s+mainWindow\s*=\s*null\s*;?$/m,
    'main.cjs must declare a module-level `let mainWindow = null;` so the window is never unreachable',
  );
});

test('Desktop lifecycle: createWindow assigns the window to the module-level reference', () => {
  const source = mainSource();

  assert.match(
    source,
    /mainWindow\s*=\s*window\s*;/,
    'createWindow must assign the created BrowserWindow to the module-level reference',
  );
});

// ── The reference must be taken before any await/collection window ──

test('Desktop lifecycle: the strong reference is taken before the window can be collected', () => {
  const source = mainSource();
  const createStart = source.indexOf('function createWindow(');
  assert.ok(createStart > -1, 'createWindow must exist');

  const assignIndex = source.indexOf('mainWindow = window;', createStart);
  assert.ok(assignIndex > -1, 'createWindow must contain the assignment');

  const loadIndex = source.indexOf('window.loadURL(', createStart);
  assert.ok(loadIndex > -1, 'createWindow must load the frontend URL');

  assert.ok(
    assignIndex < loadIndex,
    'The strong reference must be taken before loadURL, so no collection window exists while the renderer boots',
  );
});

// ── The reference must be released only on a real close ──

test('Desktop lifecycle: the reference is released only when that same window closes', () => {
  const source = mainSource();

  assert.match(
    source,
    /window\.on\(\s*'closed'[\s\S]{0,200}?if\s*\(\s*mainWindow\s*===\s*window\s*\)\s*mainWindow\s*=\s*null\s*;/,
    'The closed handler must clear the reference only when it still points at that window',
  );
});

// ── No call site may discard the window ──

test('Desktop lifecycle: no call site creates a window while discarding the reference', () => {
  const source = mainSource();
  const discarded = source.match(/^\s*createWindow\([^)]*\)\s*;?\s*$/gm) || [];

  for (const call of discarded) {
    assert.ok(
      /mainWindow/.test(call),
      `createWindow must never be called while discarding the window reference: ${call.trim()}`,
    );
  }
});

// ── The quit path must remain the standard single-window behavior ──

test('Desktop lifecycle: window-all-closed still quits the app (standard Windows behavior)', () => {
  const source = mainSource();
  assert.match(
    source,
    /app\.on\(\s*'window-all-closed'\s*,\s*\(\)\s*=>\s*app\.quit\(\)\s*\)/,
    'The app must still quit when every window closes, so a genuine close ends the process',
  );
});

test('Desktop lifecycle: before-quit still stops the runtime and marks the quit as intentional', () => {
  const source = mainSource();
  assert.match(
    source,
    /app\.on\(\s*'before-quit'\s*,\s*\(\)\s*=>\s*\{\s*quitting\s*=\s*true\s*;\s*stopRuntime\(\)\s*;\s*\}\s*\)/,
    'before-quit must set quitting=true and stop the runtime, so a real quit is not reported as a crash',
  );
});

// ── The renderer must not be able to close the shell itself ──

test('Desktop lifecycle: the renderer contains no self-termination path', () => {
  const srcRoot = path.join(WEB_ROOT, 'src');
  const offenders = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (/window\s*\.\s*close\s*\(/.test(text) || /app\s*\.\s*(quit|exit)\s*\(/.test(text)) {
        offenders.push(path.relative(WEB_ROOT, full));
      }
    }
  };

  walk(srcRoot);

  assert.deepEqual(
    offenders,
    [],
    `The renderer must not be able to terminate the shell; found self-termination in: ${offenders.join(', ')}`,
  );
});

// ── GPU stability: the self-termination was a GPU-process death ──

test('Desktop lifecycle: hardware acceleration is disabled so an old GPU driver cannot kill the window', () => {
  const source = mainSource();

  assert.match(
    source,
    /app\.disableHardwareAcceleration\s*=\s*true/,
    'Hardware acceleration must be disabled: a GPU process that dies takes the window with it',
  );
  assert.match(
    source,
    /appendSwitch\(\s*'disable-gpu-compositing'\s*\)/,
    'GPU compositing must be disabled alongside hardware acceleration',
  );
  assert.match(
    source,
    /appendSwitch\(\s*'disable-gpu-rasterization'\s*\)/,
    'GPU rasterization must be disabled alongside hardware acceleration',
  );
});

// ── The window icon must be readable by the native Windows shell ──

test('Desktop lifecycle: the window icon resolves to a file that is actually packaged', () => {
  const source = mainSource();
  const pkg = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, 'package.json'), 'utf8'));

  // The icon is read through a native API, so it can never live inside the
  // asar. It must come from the packaged extraResources copy.
  assert.match(
    source,
    /path\.join\(sourceRuntimeRoot\(\),\s*'Assets'/,
    'The icon must be resolved from the packaged runtime Assets folder',
  );
  assert.doesNotMatch(
    source,
    /'public',\s*'brand'/,
    'The icon must not point inside app.asar/public: public/ is not part of the packaged file set',
  );

  const assetCopies = (pkg.build?.extraResources || []).filter(
    (entry) => typeof entry.from === 'string' && entry.from.includes('public/brand/'),
  );
  assert.ok(
    assetCopies.length > 0,
    'The brand logo must be copied into the packaged runtime Assets folder',
  );
});

// ── The packaged runtime must never run a stale bridge ──

test('Desktop lifecycle: the runtime fingerprint covers the bridge implementation, not only its entry point', () => {
  const source = mainSource();

  for (const module of [
    'web-frontend/server/bridge-core.mjs',
    'web-frontend/server/bridge-auth.mjs',
  ]) {
    assert.ok(
      source.includes(`'${module}'`),
      `The runtime fingerprint must watch ${module}; otherwise a packaged app keeps running a stale bridge`,
    );
  }
});
