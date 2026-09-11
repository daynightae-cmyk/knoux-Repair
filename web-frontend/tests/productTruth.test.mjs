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
    'Based on your diagnostic analysis',
    'Configure GEMINI_API_KEY for live online AI model streaming',
  ];

  for (const marker of forbiddenRuntimeMarkers) {
    assert.equal(source.includes(marker), false, `server.ts must not contain fabricated runtime marker: ${marker}`);
  }

  assert.match(source, /app\.use\('\/api',\s*proxyApi\)/, 'API must proxy through the real local bridge');
  assert.match(source, /HOST\s*=\s*'127\.0\.0\.1'/, 'web gateway must remain loopback-only');
  assert.match(source, /bridgeIsHealthy/, 'gateway must verify bridge health');
  assert.match(source, /KNOUX_PROJECT_ROOT/, 'gateway must bind bridge execution to the resolved project root');
});

test('unavailable AI providers report unavailability instead of fabricated answers', () => {
  const source = read('../server.ts');
  assert.match(source, /AI_PROVIDER_NOT_CONFIGURED/, 'gateway must surface a structured unavailable reason');
  assert.match(source, /available:\s*false/, 'unavailable AI must be explicit');
  assert.match(source, /new GoogleGenAI\(\{\s*apiKey:\s*googleKey\s*\}\)/, 'Google SDK must receive only the Google key');
  assert.match(source, /openrouter\.ai\/api\/v1\/chat\/completions/, 'OpenRouter traffic must use the OpenRouter API');
});

test('production UI never presents fabricated measurements as live facts', () => {
  const actionCenter = read('../src/components/ActionCenter.tsx');
  for (const marker of [
    '4529848320',
    'Intel Core Workstation',
    '10.4 / 32 GB',
    '21.6 GB Free',
    '642 GB Free',
    '382 GB / 1024 GB',
    'Windows 11 Pro Workstation',
    '?? 142',
  ]) {
    assert.equal(actionCenter.includes(marker), false, `ActionCenter must not contain fabricated marker: ${marker}`);
  }
  assert.match(actionCenter, /Unavailable/, 'ActionCenter must render unavailable states');

  const workspace = read('../src/components/GoogleWorkspaceHub.tsx');
  for (const marker of [
    'united-olympics-sports',
    'i9-14900K',
    'Overall Health Score: 98/100',
    'Over 2.1 TB combined available disk space',
    'europe-west1 with Firebase sync',
    'europe-west1',
    '1530 GB Free (74%)',
    'Defender Status: Active & Protected',
  ]) {
    assert.equal(workspace.includes(marker), false, `GoogleWorkspaceHub must not contain fabricated marker: ${marker}`);
  }

  const speedUp = read('../src/components/SpeedUpSuite.tsx');
  assert.equal(speedUp.includes('3.8 GB Free'), false, 'SpeedUpSuite must not hard-code memory readings');

  const care = read('../src/components/CareDashboard.tsx');
  for (const marker of [
    '?? 14',
    '3840000000',
    '1.4 GB RAM Released',
    '128 Registry keys',
    '6 Optimization Areas Detected',
    'issues resolved',
    'AI Mode',
    'KNOUX AI SCAN ENGINE',
    'Active & Enforced',
  ]) {
    assert.equal(care.includes(marker), false, `CareDashboard must not contain fabricated marker: ${marker}`);
  }

  const firebaseSlot = read('../firebase-applet-config.json');
  assert.equal(firebaseSlot.includes('united-olympics-sports'), false, 'bundled Firebase slot must not reference a foreign project');
  assert.match(firebaseSlot, /"configured":\s*false/, 'bundled Firebase slot must be explicitly unconfigured');
  const firebase = read('../src/lib/firebase.ts');
  assert.match(firebase, /isWorkspaceConfigured/, 'workspace backend must be gated on explicit configuration');
});

test('Arabic UI uses approved canonical terminology without the ecclesiastical mistranslation', () => {
  const arabicUiSources = [
    '../src/components/pages/AIScanPage.tsx',
    '../src/components/premium/AllServicesNavigator.tsx',
    '../src/components/premium/ToolWorkspace.tsx',
  ].map(read);

  for (const source of arabicUiSources) {
    assert.equal(source.includes('كنسية'), false, 'Canonical product architecture must be translated as معتمدة, not كنسية');
  }
  assert.match(arabicUiSources[0], /أداة معتمدة/);
  assert.match(arabicUiSources[1], /البنية المعتمدة/);
  assert.match(arabicUiSources[2], /منظومة KNOUX Repair المعتمدة/);
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
