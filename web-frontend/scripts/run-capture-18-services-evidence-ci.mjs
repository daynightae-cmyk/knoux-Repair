import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)));
const sourcePath = path.resolve(scriptDir, 'capture-18-services-evidence.mjs');
const tempPath = path.resolve(scriptDir, `.capture-18-services-evidence-ci-${process.pid}.mjs`);

const original = fs.readFileSync(sourcePath, 'utf8');
const anchor = "    const devSocketReset = /WebSocket connection to 'ws:\\/\\/127\\.0\\.0\\.1:24678\\/'.*ERR_CONNECTION_REFUSED/i.test(message);";
const originalBranch = "    if (unavailable503 || (allowControlledRestartNoise && (transportReset || devSocketReset))) {";

if (!original.includes(anchor) || !original.includes(originalBranch)) {
  throw new Error('18-service capture classifier changed; refusing to apply the narrow CI-only HMR classification shim.');
}

const hmrClassifier = `${anchor}\n    // Windows evidence runs the Vite development client. The product CSP correctly\n    // blocks its loopback HMR socket; classify only this exact diagnostic as harness noise.\n    const devHmrCspBlocked = /Connecting to 'ws:\\/\\/127\\.0\\.0\\.1:24678\\/\\?token=[^']+' violates the following Content Security Policy directive: \\\"connect-src 'self' http:\\/\\/127\\.0\\.0\\.1:8787\\\"\\. The action has been blocked\\./i.test(message);`;
const patchedBranch = "    if (unavailable503 || devHmrCspBlocked || (allowControlledRestartNoise && (transportReset || devSocketReset))) {";

let patched = original.replace(anchor, hmrClassifier).replace(originalBranch, patchedBranch);
if (patched === original || !patched.includes('devHmrCspBlocked')) {
  throw new Error('Failed to construct the strict CI evidence classifier.');
}

fs.writeFileSync(tempPath, patched, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
