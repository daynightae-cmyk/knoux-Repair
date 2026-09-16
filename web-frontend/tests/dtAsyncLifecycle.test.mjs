import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { server } from '../server/bridge.mjs';

let baseUrl = '';
before(async () => {
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});
after(async () => {
  await new Promise((resolve) => server.close(() => resolve()));
});

async function runToCompletion(toolId, options = {}) {
  const start = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId, mode: 'analyze', options }),
  });
  assert.equal(start.status, 202, `${toolId} must accept analyze via async lifecycle`);
  const { runId } = await start.json();
  assert.ok(runId, `${toolId} must return a runId`);

  const deadline = Date.now() + 90000;
  for (;;) {
    const res = await fetch(`${baseUrl}/api/runs/${runId}`);
    assert.equal(res.status, 200);
    const { run } = await res.json();
    assert.equal(run.id, runId);
    assert.equal(run.toolId, toolId);
    if (run.status !== 'running') return run;
    assert.ok(Date.now() < deadline, `${toolId} run ${runId} did not finish in time`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

test('DT05 async lifecycle closes: version-less package.json yields evidence, not a property error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knoux-dt05-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'lifecycle-probe' }), 'utf8');
  try {
    const run = await runToCompletion('DT05', { localSourcePath: dir });
    assert.equal(run.status, 'success');
    assert.equal(run.exitCode, 0);
    const text = (run.lines || []).map((l) => l.text).join('\n');
    assert.match(text, /Project intelligence snapshot created/);
    assert.equal(text.includes('.version'), false, 'StrictMode .version failure must not surface');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('DT06 async lifecycle closes: listener enumeration succeeds without Invalid class', async () => {
  const run = await runToCompletion('DT06', {});
  assert.equal(run.status, 'success');
  assert.equal(run.exitCode, 0);
  const text = (run.lines || []).map((l) => l.text).join('\n');
  assert.match(text, /active developer-process listeners/);
  assert.equal(text.includes('Invalid class'), false, 'NetTCPIP fallback must hide the Invalid class failure');
});
