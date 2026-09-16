import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canActivateSplash,
  getSplashPresentation,
  isSplashActivationKey,
  resolveSplashStage,
  SPLASH_PROGRESS_STEPS,
  SPLASH_TIMING,
} from '../src/components/splashModel.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(here, '../src/components/NexusSplash.tsx');
const cssPath = path.resolve(here, '../src/components/NexusSplash.css');
const legacyPath = path.resolve(here, '../src/components/SplashScreen.tsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');
const cssSource = fs.readFileSync(cssPath, 'utf8');
const legacySource = fs.readFileSync(legacyPath, 'utf8');

test('boot progress is deterministic and bounded', () => {
  assert.deepEqual(SPLASH_PROGRESS_STEPS.map(({ value }) => value), [22, 48, 72, 90]);
  assert.ok(SPLASH_PROGRESS_STEPS.every(({ value }) => value > 0 && value < 100));
  assert.equal(componentSource.includes('Math.random'), false);
  assert.equal(legacySource.includes('Math.random'), false);
  assert.equal(SPLASH_TIMING.minimumVisualMs, 1300);
  assert.ok(SPLASH_TIMING.exitMs >= 650 && SPLASH_TIMING.exitMs <= 800);
});

test('entry activation accepts physical and numpad Enter only after real readiness settles', () => {
  assert.equal(isSplashActivationKey('Enter', 'Enter'), true);
  assert.equal(isSplashActivationKey('Enter', 'NumpadEnter'), true);
  assert.equal(isSplashActivationKey(' ', 'Space'), false);
  assert.equal(canActivateSplash({ progress: 90, bridgeOnline: true, timedOut: false, imageSettled: true }), false);
  assert.equal(canActivateSplash({ progress: 100, bridgeOnline: null, timedOut: false, imageSettled: true }), false);
  assert.equal(canActivateSplash({ progress: 100, bridgeOnline: true, timedOut: false, imageSettled: true }), true);
  assert.equal(canActivateSplash({ progress: 100, bridgeOnline: null, timedOut: true, imageSettled: true }), true);
});

test('bridge online reaches real ready state and reports tool count', () => {
  const result = getSplashPresentation({
    lang: 'en',
    progress: 100,
    bridgeOnline: true,
    toolCount: 158,
    timedOut: false,
  });
  assert.equal(result.stage, 'ready');
  assert.equal(result.stageLabel, 'System ready');
  assert.equal(result.bridgeLabel, 'CONNECTED');
  assert.match(result.toolsLabel, /158 TOOLS REGISTERED/);
});

test('bridge offline never claims that the system bridge is ready', () => {
  const result = getSplashPresentation({
    lang: 'en',
    progress: 100,
    bridgeOnline: false,
    toolCount: 0,
    timedOut: false,
  });
  assert.equal(result.stage, 'offline');
  assert.match(result.stageLabel, /bridge unavailable/i);
  assert.equal(result.bridgeLabel, 'OFFLINE');
  // Phase 00: offline renders OFFLINE, never a zero-tool or syncing claim.
  assert.equal(result.toolsLabel, 'OFFLINE');
  assert.doesNotMatch(result.stageLabel, /^System ready$/);
});

test('unresolved bridge holds at connecting and degrades gracefully only after timeout', () => {
  assert.equal(resolveSplashStage(90, null, false), 'connecting');
  assert.equal(resolveSplashStage(100, null, true), 'continuing');

  const result = getSplashPresentation({
    lang: 'ar',
    progress: 100,
    bridgeOnline: null,
    toolCount: 0,
    timedOut: true,
  });
  assert.equal(result.stage, 'continuing');
  assert.match(result.stageLabel, /ما زال الاتصال/);
  assert.match(result.toolsLabel, /مزامنة/);
});

test('cinematic entry uses real artwork and an accessible interactive control', () => {
  const forbidden = [
    /scanline/i,
    /decrypt/i,
    /hacking/i,
    /matrix/i,
    /Launch Glass Workstation/i,
    /bg-grid-pattern/i,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(componentSource), false, `forbidden visual marker found: ${pattern}`);
  }
  assert.match(componentSource, /<button/);
  assert.match(componentSource, /onClick=\{requestEnter\}/);
  assert.match(componentSource, /\/brand\/knoux-entry-cinematic\.png/);
  assert.match(componentSource, /\/brand\/knoux-mark-crystal\.png/);
  assert.match(componentSource, /\/brand\/knoux-repair-wordmark-wide\.png/);
  assert.match(componentSource, /useReducedMotion/);
  assert.match(componentSource, /doneRef/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /removeEventListener\('keydown'/);
  assert.match(componentSource, /leavingRef\.current/);
});

test('responsive and reduced-motion acceptance rules are present', () => {
  assert.match(cssSource, /@media \(max-aspect-ratio: 3 \/ 2\)/);
  assert.match(cssSource, /@media \(max-width: 640px\)/);
  assert.match(cssSource, /@media \(min-width: 2200px\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /\.kr-entry__particles \{ display: none; \}/);
  assert.match(cssSource, /clamp\(/);
  assert.doesNotMatch(cssSource, /rotate\(360deg\)/i);
});

test('application shell opens the real home by removing only the entry overlay', () => {
  const appSource = fs.readFileSync(path.resolve(here, '../src/App.tsx'), 'utf8');
  assert.match(appSource, /onDone=\{\(\) => setSplashVisible\(false\)\}/);
  assert.match(appSource, /initialView[^\n]*\|\| 'home'/);
  assert.match(appSource, /activeView === 'home'/);
});

test('legacy SplashScreen delegates to the new premium implementation', () => {
  assert.match(legacySource, /import NexusSplash from '\.\/NexusSplash'/);
  assert.equal(legacySource.includes('STATUS_MESSAGES'), false);
  assert.equal(legacySource.includes('scanlines'), false);
  assert.equal(legacySource.includes('bg-grid-pattern'), false);
});
