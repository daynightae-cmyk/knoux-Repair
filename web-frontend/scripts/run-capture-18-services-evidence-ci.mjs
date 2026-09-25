import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)));
const sourcePath = path.resolve(scriptDir, 'capture-18-services-evidence.mjs');
const tempPath = path.resolve(scriptDir, `.capture-18-services-evidence-ci-${process.pid}.mjs`);

const original = fs.readFileSync(sourcePath, 'utf8');
const source = original.replace(/\r\n/g, '\n');
const transportAnchor = "    const transportReset = /Failed to load resource:\\s*net::ERR_CONNECTION_(?:RESET|REFUSED)/i.test(message);";
const canonicalHmrAnchor = "    const hmrCspDiagnostic =";
const canonicalHmrExpectedBranch = "      hmrCspDiagnostic ||";

if (
  !source.includes(transportAnchor)
  || !source.includes(canonicalHmrAnchor)
  || !source.includes(canonicalHmrExpectedBranch)
) {
  throw new Error('18-service canonical console classifier changed; refusing to run CI evidence with an unverified allowlist.');
}

// The canonical capture classifier now owns the exact Vite HMR CSP diagnostic.
// Do not inject a second CI-only classifier. Preserve the evidence classifier
// verbatim and apply only the bounded route/readiness shims below.
let patched = source;

const countOccurrences = (text, needle) => text.split(needle).length - 1;

// Recovery & Storage now follows the same ownership rule already used by the
// specialized stations: the canonical station owns its real controls and the
// generic FamilyPage ACTIONS rail is intentionally absent from the rendered UI.
const recoveryStationRoutes = [
  [
    "  { family: 'recovery', service: '02-System-Cleanup', name: 'System Cleanup', tools: 11 },",
    "  { family: 'recovery', service: '02-System-Cleanup', name: 'System Cleanup', tools: 11, ownsActions: true },",
  ],
  [
    "  { family: 'recovery', service: '06-Disk-Space', name: 'Disk Space', tools: 10 },",
    "  { family: 'recovery', service: '06-Disk-Space', name: 'Disk Space', tools: 10, ownsActions: true },",
  ],
  [
    "  { family: 'recovery', service: '11-Backup-Recovery', name: 'Backup & Recovery', tools: 5 },",
    "  { family: 'recovery', service: '11-Backup-Recovery', name: 'Backup & Recovery', tools: 5, ownsActions: true },",
  ],
];

for (const [before, after] of recoveryStationRoutes) {
  if (countOccurrences(patched, before) !== 1) {
    throw new Error(`Recovery route ownership anchor changed: ${before}`);
  }
  patched = patched.replace(before, after);
}

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
  || !patched.includes("service: '02-System-Cleanup', name: 'System Cleanup', tools: 11, ownsActions: true")
  || !patched.includes("service: '06-Disk-Space', name: 'Disk Space', tools: 10, ownsActions: true")
  || !patched.includes("service: '11-Backup-Recovery', name: 'Backup & Recovery', tools: 5, ownsActions: true")
) {
  throw new Error('Failed to construct the bounded CI inventory/action-readiness shim.');
}

fs.writeFileSync(tempPath, patched, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
