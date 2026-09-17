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

// A visible top-level route is the navigation blank-frame authority. The old
// `meaningful` probe intentionally inspected only a few station descendants,
// so valid family overviews and service-shell transitions were false positives.
// Structural capture gates already prove each required station surface exists.
const blankPredicateBefore = "fail=samples.filter(x=>x.workspace&&(x.meaningful===0||x.route===0||x.opacity<.02||x.body>x.vw+2))";
const blankPredicateAfter = "fail=samples.filter(x=>x.workspace&&(x.route===0||x.opacity<.02||x.body>x.vw+2))";
if (!patched.includes(blankPredicateBefore)) {
  throw new Error('Final visual navigation predicate changed; refusing to alter blank-frame classification.');
}
patched = patched.replace(blankPredicateBefore, blankPredicateAfter);

// Developer Tools starts real DT04/DT06 read-only probes on mount. The final
// RTL evidence page can close before those backend runs settle, so reuse of the
// same single-run bridge contaminates the next navigation phase with HTTP 409.
// Restart only the disposable CI gateway/browser between evidence phases.
const navBefore = "distinct(r);const nav=await navGate(b);";
const navAfter = "distinct(r);await b.close();b=null;await stop(g);await sleep(600);g=start();await ready();b=await puppeteer.launch({executablePath:edge(),headless:true,args:['--disable-gpu','--no-first-run','--no-default-browser-check']});const nav=await navGate(b);";
if (!patched.includes(navBefore)) {
  throw new Error('Final visual phase ordering changed; refusing to apply the navigation isolation restart.');
}
patched = patched.replace(navBefore, navAfter);

if (!patched.includes('devHmrCspBlocked') || !patched.includes(captureBeforeAssert) || !patched.includes(blankPredicateAfter) || !patched.includes(navAfter)) {
  throw new Error('Failed to construct the strict final-visual CI wrapper.');
}

fs.writeFileSync(tempPath, patched, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
