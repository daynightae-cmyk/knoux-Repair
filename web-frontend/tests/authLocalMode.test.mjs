import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.KNOUX_IGNORE_DOTENV = '1';
process.env.KNOUX_AUTH_REQUIRED = 'false';
process.env.KNOUX_AUTH_FRONTEND_ORIGIN = 'http://127.0.0.1:3000';
process.env.KNOUX_BRIDGE_TOKEN = 'knoux-local-mode-capability-token-001';

const { server } = await import('../server/bridge.mjs');
let baseUrl = '';

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Local Mode is explicit and does not require a provider session', async () => {
  const status = await fetch(`${baseUrl}/api/auth/status`);
  assert.equal(status.status, 200);
  const body = await status.json();
  assert.equal(body.required, false);
  assert.equal(body.mode, 'local');
  assert.equal(body.authenticated, false);

  const run = await fetch(`${baseUrl}/api/runs`, {
    method: 'POST',
    headers: {
      Origin: 'http://127.0.0.1:3000',
      'Content-Type': 'application/json',
      'X-Knoux-Bridge-Token': 'knoux-local-mode-capability-token-001',
    },
    body: JSON.stringify({ toolId: 'NO_SUCH_TOOL', mode: 'run' }),
  });
  assert.equal(run.status, 400);
  assert.equal((await run.json()).error, 'UNKNOWN_TOOL');
});
