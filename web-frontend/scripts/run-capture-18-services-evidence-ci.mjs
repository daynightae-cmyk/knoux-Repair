import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)));
const sourcePath = path.resolve(scriptDir, 'capture-18-services-evidence.mjs');
const tempPath = path.resolve(scriptDir, `.capture-18-services-evidence-ci-${process.pid}.mjs`);

const original = fs.readFileSync(sourcePath, 'utf8');
const source = original.replace(/\r\n/g, '\n');
const anchor = "    const transportReset = /Failed to load resource:\\s*net::ERR_CONNECTION_(?:RESET|REFUSED)/i.test(message);";
const originalBranch = "    if (unavailable503 || (allowTransportNoise && transportReset)) expected.push(message);";

if (!source.includes(anchor) || !source.includes(originalBranch)) {
  throw new Error('18-service capture classifier changed; refusing to apply the narrow CI-only HMR classification shim.');
}

const hmrClassifier = `${anchor}
    // Windows evidence runs the Vite development client. The product CSP correctly
    // blocks its loopback HMR socket; classify only this exact diagnostic as harness noise.
    const devHmrCspBlocked = /Connecting to 'ws:\\/\\/127\\.0\\.0\\.1:24678\\/\\?token=[^']+' violates the following Content Security Policy directive: "connect-src 'self' http:\\/\\/127\\.0\\.0\\.1:8787"\\. The action has been blocked\\./i.test(message);`;
const patchedBranch = "    if (unavailable503 || devHmrCspBlocked || (allowTransportNoise && transportReset)) expected.push(message);";

let patched = source.replace(anchor, hmrClassifier).replace(originalBranch, patchedBranch);
if (patched === source || !patched.includes('devHmrCspBlocked')) {
  throw new Error('Failed to construct the strict CI evidence classifier.');
}

const countOccurrences = (text, needle) => text.split(needle).length - 1;

const inventoryProbeTimeoutAnchor = `      signal: AbortSignal.timeout(5_000),
      headers: { Accept: 'application/json' },`;
const inventoryProbeTimeoutReplacement = `      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },`;

if (countOccurrences(patched, inventoryProbeTimeoutAnchor) !== 1) {
  throw new Error('18-service authoritative inventory probe timeout changed; refusing to apply the CI timeout-alignment shim.');
}
patched = patched.replace(inventoryProbeTimeoutAnchor, inventoryProbeTimeoutReplacement);

const hydrationFunctionAnchor = 'async function ensureInventory(page, target) {';
const hydrationReloadBranch = `    if (probe.ok && probe.count === target.tools && probe.category === target.service) {
      reloadedRoute = true;
      await reloadRoute(page, target);
      continue;
    }`;

const primaryReadinessAnchor = 'if (probe.ok && probe.count === target.tools && snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable) {';
const primaryReadinessReplacement = 'if (probe.ok && probe.count === target.tools && snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable && (target.ownsActions || snapshot.drawerAvailable)) {';

const retryReadinessAnchor = 'if (probe.ok && probe.count === target.tools && probe.category === target.service && snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable) {';
const retryReadinessReplacement = 'if (probe.ok && probe.count === target.tools && probe.category === target.service && snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable && (target.ownsActions || snapshot.drawerAvailable)) {';

if (
  !patched.includes(hydrationFunctionAnchor)
  || !patched.includes(hydrationReloadBranch)
  || countOccurrences(patched, primaryReadinessAnchor) !== 1
  || countOccurrences(patched, retryReadinessAnchor) !== 1
) {
  throw new Error('18-service inventory readiness flow changed; refusing to apply the bounded CI hydration/action-readiness shim.');
}

patched = patched
  .replace(primaryReadinessAnchor, primaryReadinessReplacement)
  .replace(retryReadinessAnchor, retryReadinessReplacement);

const hydrationHelper = `async function waitForUiInventoryHydration(page, target, timeoutMs = 8_000) {
  await page.waitForFunction(
    ({ serviceId, selector, expectedCount, ownsActions }) => {
      const familyRoot = document.querySelector('.knoux-family-page[data-service="' + serviceId + '"]');
      const surface = document.querySelector(selector);
      if (!familyRoot || !surface) return false;

      const retryAvailable = [...document.querySelectorAll('.knoux-tool-empty-state button')]
        .some(button => /retry connection/i.test(button.textContent || ''));
      if (retryAvailable) return true;

      const stage = document.querySelector('.knoux-workspace-stage');
      const workbench = document.querySelector('.knoux-engineering-workbench');
      const railCountText = document.querySelector('.knoux-command-tool-rail .knoux-command-rail-header small')?.textContent || '';
      const stageCount = Number(stage?.getAttribute('data-service-tool-count') || 0);
      const workbenchCount = Number(workbench?.getAttribute('data-service-tool-count') || 0);
      const railCount = Number.parseInt(railCountText.trim(), 10) || 0;
      const inventoryReady = (stageCount || workbenchCount || railCount) === expectedCount;
      const standardActionsReady = ownsActions || Boolean(document.querySelector('.knoux-command-tool-drawer'));
      return inventoryReady && standardActionsReady;
    },
    { timeout: timeoutMs, polling: 100 },
    {
      serviceId: target.service,
      selector: target.surface || '.knoux-stage-service-app',
      expectedCount: target.tools,
      ownsActions: Boolean(target.ownsActions),
    },
  ).catch(() => {});

  return readSnapshot(page, target);
}`;

const hydrationReplacement = `    if (probe.ok && probe.count === target.tools && probe.category === target.service) {
      // Backend inventory is authoritative and already correct. Give React a bounded
      // chance to hydrate the same route and, for standard routes, expose the family
      // command drawer that proves bridgeOnline has settled true before any reload.
      snapshot = await waitForUiInventoryHydration(page, target);
      if (snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable && (target.ownsActions || snapshot.drawerAvailable)) {
        return { recoveredBridge, reloadedRoute, restartedGateway, authoritativeCount: probe.count };
      }
      if (snapshot.retryAvailable) continue;

      reloadedRoute = true;
      await reloadRoute(page, target);
      continue;
    }`;

patched = patched
  .replace(hydrationFunctionAnchor, `${hydrationHelper}\n\n${hydrationFunctionAnchor}`)
  .replace(hydrationReloadBranch, hydrationReplacement);

if (
  !patched.includes('waitForUiInventoryHydration')
  || !patched.includes('standardActionsReady')
  || !patched.includes('command drawer that proves bridgeOnline')
  || countOccurrences(patched, inventoryProbeTimeoutReplacement) !== 1
  || countOccurrences(patched, primaryReadinessReplacement) !== 1
  || countOccurrences(patched, retryReadinessReplacement) !== 1
) {
  throw new Error('Failed to construct the bounded CI inventory/action-readiness shim.');
}

fs.writeFileSync(tempPath, patched, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
