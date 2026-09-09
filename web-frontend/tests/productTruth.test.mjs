import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

test('local web gateway contains no fabricated runtime evidence', () => {
  const source = read('../server.ts');

  const forbiddenRuntimeMarkers = [
    'Nexus Administrator',
    'admin@knoux.nexus',
    'i9-14900K',
    'Windows 11 Pro / Cloud Nexus Hybrid',
    'Tool execution simulation',
    'Duplicate preview & quarantine mocks',
    'Project Sonar mock',
    "model: 'gemini-1.5-flash'",
    'All signatures conform to policy',
    "name: 'System32'",
    "name: 'Program Files'",
    "name: 'AppData'",
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(source.includes(marker), false, `server.ts must not contain fabricated runtime marker: ${marker}`);
  }

  assert.match(source, /app\.use\('\/api',\s*proxyApi\)/, 'API must proxy through the real local bridge');
  assert.match(source, /HOST\s*=\s*'127\.0\.0\.1'/, 'web gateway must remain loopback-only');
  assert.match(source, /bridgeIsHealthy/, 'gateway must verify bridge health');
  assert.match(source, /KNOUX_PROJECT_ROOT/, 'gateway must bind bridge execution to the resolved project root');
});

test('web and Electron local surfaces retain response security policy', () => {
  const gateway = read('../server.ts');
  const electron = read('../desktop/main.cjs');

  for (const header of [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'X-Frame-Options',
    'Permissions-Policy',
  ]) {
    assert.match(gateway, new RegExp(header), `server.ts must set ${header}`);
    assert.match(electron, new RegExp(header), `desktop/main.cjs must set ${header}`);
  }

  assert.match(electron, /contextIsolation:\s*true/);
  assert.match(electron, /nodeIntegration:\s*false/);
  assert.match(electron, /sandbox:\s*true/);
  assert.match(electron, /webSecurity:\s*true/);
  assert.match(electron, /frontendServer\.listen\(0,\s*'127\.0\.0\.1'/);
  assert.match(electron, /connect-src 'self' http:\/\/127\.0\.0\.1:8787/);
});
