import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  getSplashPresentation,
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
  assert.equal(SPLASH_TIMING.minimumVisualMs, 900);
  assert.ok(SPLASH_TIMING.exitMs >= 450 && SPLASH_TIMING.exitMs <= 650);
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
  assert.match(result.toolsLabel, /158 TOOLS READY/);
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

test('premium splash removes prohibited legacy visual concepts', () => {
  const forbidden = [
    /particle/i,
    /orbit/i,
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
  assert.equal(componentSource.includes('<button'), false);
  assert.match(componentSource, /\/brand\/knoux-repair-logo\.png/);
  assert.match(componentSource, /useReducedMotion/);
  assert.match(componentSource, /doneRef/);
  assert.match(componentSource, /aria-live="polite"/);
});

test('responsive and reduced-motion acceptance rules are present', () => {
  assert.match(cssSource, /@media \(max-height: 780px\)/);
  assert.match(cssSource, /@media \(max-width: 560px\)/);
  assert.match(cssSource, /@media \(min-width: 2200px\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /\.kr-splash__reflection[\s\S]*display: none !important/);
  assert.match(cssSource, /clamp\(/);
  assert.doesNotMatch(cssSource, /rotate\(360deg\)/i);
});

test('legacy SplashScreen delegates to the new premium implementation', () => {
  assert.match(legacySource, /import NexusSplash from '\.\/NexusSplash'/);
  assert.equal(legacySource.includes('STATUS_MESSAGES'), false);
  assert.equal(legacySource.includes('scanlines'), false);
  assert.equal(legacySource.includes('bg-grid-pattern'), false);
});
