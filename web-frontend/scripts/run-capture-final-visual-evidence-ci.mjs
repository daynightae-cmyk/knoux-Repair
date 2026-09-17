import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1)));
const sourcePath = path.resolve(scriptDir, 'capture-final-visual-evidence.mjs');
const tempPath = path.resolve(scriptDir, `.capture-final-visual-evidence-ci-${process.pid}.mjs`);

const original = fs.readFileSync(sourcePath, 'utf8');
let patched = original.replace(/\r\n/g, '\n');

const ignoredLines = patched.match(/^const ignored=.*;$/gm) ?? [];
if (ignoredLines.length !== 1 || !ignoredLines[0].includes('127\\.0\\.0\\.1:24678')) {
  throw new Error('Final visual console classifier changed; refusing to apply the narrow CI HMR classification shim.');
}

const classifier = `const devHmrCspBlocked=/Connecting to 'ws:\\/\\/127\\.0\\.0\\.1:24678\\/\\?token=[^']+' violates the following Content Security Policy directive: "connect-src 'self' http:\\/\\/127\\.0\\.0\\.1:8787"\\. The action has been blocked\\./i;\nconst ignored=m=>/status of 503\\s*\\(Service Unavailable\\)/i.test(m)||devHmrCspBlocked.test(m);`;
patched = patched.replace(/^const ignored=.*;$/m, classifier);

const assertBeforeCapture = "const s=await snapshot(p,x,ce,pe);assertShot(x,s);await p.screenshot({path:path.join(OUT,x.file),fullPage:false});";
const captureBeforeAssert = "const s=await snapshot(p,x,ce,pe);await p.screenshot({path:path.join(OUT,x.file),fullPage:false});assertShot(x,s);";
if (!patched.includes(assertBeforeCapture)) {
  throw new Error('Final visual capture flow changed; refusing to reorder screenshot evidence around structural assertions.');
}
patched = patched.replace(assertBeforeCapture, captureBeforeAssert);

if (!patched.includes('devHmrCspBlocked') || !patched.includes(captureBeforeAssert)) {
  throw new Error('Failed to construct the strict final-visual CI wrapper.');
}

fs.writeFileSync(tempPath, patched, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
