import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)));
const sourcePath = path.resolve(scriptDir, 'capture-18-services-evidence.mjs');
const tempPath = path.resolve(scriptDir, `.capture-18-services-evidence-ci-${process.pid}.mjs`);

const original = fs.readFileSync(sourcePath, 'utf8');
const anchor = "    const transportReset = /Failed to load resource:\\s*net::ERR_CONNECTION_(?:RESET|REFUSED)/i.test(message);";
const originalBranch = "    if (unavailable503 || (allowTransportNoise && transportReset)) expected.push(message);";

if (!original.includes(anchor) || !original.includes(originalBranch)) {
  throw new Error('18-service capture classifier changed; refusing to apply the narrow CI-only HMR classification shim.');
}

const hmrClassifier = `${anchor}
    // Windows evidence runs the Vite development client. The product CSP correctly
    // blocks its loopback HMR socket; classify only this exact diagnostic as harness noise.
    const devHmrCspBlocked = /Connecting to 'ws:\\/\\/127\\.0\\.0\\.1:24678\\/\\?token=[^']+' violates the following Content Security Policy directive: "connect-src 'self' http:\\/\\/127\\.0\\.0\\.1:8787"\\. The action has been blocked\\./i.test(message);`;
const patchedBranch = "    if (unavailable503 || devHmrCspBlocked || (allowTransportNoise && transportReset)) expected.push(message);";

let patched = original.replace(anchor, hmrClassifier).replace(originalBranch, patchedBranch);
if (patched === original || !patched.includes('devHmrCspBlocked')) {
  throw new Error('Failed to construct the strict CI evidence classifier.');
}

const hydrationFunctionAnchor = 'async function ensureInventory(page, target) {';
const hydrationReloadBranch = `    if (probe.ok && probe.count === target.tools && probe.category === target.service) {
      reloadedRoute = true;
      await reloadRoute(page, target);
      continue;
    }`;

if (!patched.includes(hydrationFunctionAnchor) || !patched.includes(hydrationReloadBranch)) {
  throw new Error('18-service inventory hydration flow changed; refusing to apply the bounded CI hydration shim.');
}

const hydrationHelper = `async function waitForUiInventoryHydration(page, target, timeoutMs = 8_000) {
  await page.waitForFunction(
    ({ serviceId, selector, expectedCount }) => {
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
      return (stageCount || workbenchCount || railCount) === expectedCount;
    },
    { timeout: timeoutMs, polling: 100 },
    {
      serviceId: target.service,
      selector: target.surface || '.knoux-stage-service-app',
      expectedCount: target.tools,
    },
  ).catch(() => {});

  return readSnapshot(page, target);
}`;

const hydrationReplacement = `    if (probe.ok && probe.count === target.tools && probe.category === target.service) {
      // Backend inventory is authoritative and already correct. Give React a bounded
      // chance to hydrate the same route before reloading it and resetting UI state.
      snapshot = await waitForUiInventoryHydration(page, target);
      if (snapshot.serviceToolCount === target.tools && !snapshot.retryAvailable) {
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

if (!patched.includes('waitForUiInventoryHydration') || !patched.includes('Give React a bounded')) {
  throw new Error('Failed to construct the bounded CI inventory hydration shim.');
}

fs.writeFileSync(tempPath, patched, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
