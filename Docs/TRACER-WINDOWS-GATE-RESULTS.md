# TRACER Windows Gate Results — 2026-09-16 (post-bridge async fix)

Authority HEAD: `1292098a6af8d6d031c8add2e3c6043eae9b8647` (+ fix(bridge): async preview runner → 0 restarts)
Remote main before: `755d514714b2eb734b7e558c124c24a36354ced0`
Date (UTC): 2026-09-16 ~17:47 Z (matrix), ~17:51 Z (mission02)

## Full chain (exact order per §46)

| Step | Command | Result | Evidence |
|------|---------|--------|----------|
| Install | `cd web-frontend && npm ci` | PASS | `added 689 packages in 49s` (warnings for deprecated inflight/glob/rimraf only) |
| Audit | `npm audit --omit=dev --audit-level=high` | PASS | `found 0 vulnerabilities` (second attempt; first hit transient ECONNRESET) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | PASS | exit 0, no diagnostics |
| Tests | `npm test` (`node --test --experimental-strip-types tests/*.test.mjs`) | PASS | `478 pass, 0 fail, 0 skipped` @ ~29s (478 = manifest + bridge + stations + execution honesty + duplicate engine/index) |
| Build | `npm run build` (`vite build && esbuild server.ts --bundle`) | PASS | `2659 modules transformed; 794.5 kB CSS, 2450 kB JS`; esbuild `dist/server.cjs 63.9kb` |
| Developer capture | `node scripts/capture-round1-developer.mjs` | PASS | `Captured 02-developer-tools-operational.png (249487 bytes)` + 1440 variant |
| 18-service matrix | `node scripts/run-capture-18-services-evidence-ci.mjs` | PASS | `Verified 18 canonical service routes across 6 families (158 tools); controlled gateway restarts=0` — previously 2 then FAIL at 13-Privacy with budget exhausted; after async fix 0 |
| Mission 02 | `node scripts/capture-mission02-evidence.mjs` | PASS | `Captured MISSION-02_PRIVATE-MCP-CENTER.png (461409 bytes, console errors=2, page errors=0)` |
| Web gateway | `pwsh Tests/Test-WebGateway.ps1` | PASS | `tools=158; gateway=http://127.0.0.1:3099; bridgePort=8799 → BRIDGE_UNAVAILABLE only when expected` |
| Bridge timeout | `pwsh Tests/Test-BridgeTimeout.ps1` (KNOUX_BRIDGE_TEST_MODE) | PASS | `Probe 2cabd6c4-… → error → timeout → activeRunId cleared, next run can begin` |
| Desktop suite | `pwsh Tests/Run-Tests.ps1` | PASS | `83 tests, 0 failures` — all Core, manifest, menu, quarantine, risk, encoding, and v2.0.1/2.0.2 tool harness |

## Matrix detail (18/18)

```
01 System Maintenance   10 tools  PASS  .knoux-stage-service-app (drawer expanded)
08 Performance          12 tools  PASS
15 System Monitoring     4 tools  PASS
02 System Cleanup       11 tools  PASS
05 Duplicate Files      11 tools  PASS  .duplicate-studio-root (station-owned)
06 Disk Space           10 tools  PASS
11 Backup & Recovery     5 tools  PASS
03 Network               11 tools  PASS
09 Security             10 tools  PASS
13 Privacy               4 tools  PASS
14 Driver Management     4 tools  PASS
04 Programs              10 tools  PASS  .programs-station
16 Software              8 tools  PASS  .software-station-root
17 PostInstall           6 tools  PASS  .post-install-station-root
12 Developer            13 tools  PASS  .developer-station-root
18 Sonar                 7 tools  PASS  .project-sonar-station-root
10 Diagnostics          11 tools  PASS  (station-owned)
07 Services              11 tools  PASS  .knoux-station-workspace
Total 158 tools, 6 families, matrix JSON → visual-evidence/service-route-matrix/service-route-matrix.json
```

Failures before fix:
- 2026-09-16 17:34 — `02-System-Cleanup: The operation was aborted due to timeout` → restart 1/2
- 17:37 — `11-Backup-Recovery: HTTP 503` → restart 2/2
- 17:37 — `13-Privacy: gateway recovery budget exhausted after 2 restart(s); HTTP 503` → FAIL, 409 serialization not root cause but blocking spawnSync starved inventory probes

Root cause: `spawnSync` in 12 preview handlers blocked Node event loop for up to 120s, so concurrent `GET /api/health` and `GET /api/categories/:id/tools` probes timed out (ECONNRESET/503). Fix: `runPsAsync` via `spawn` + non-blocking `runPreviewScriptAsync` + async `getSystemSnapshot` with pending coalescing. No retry budget increase; previous `MAX_GATEWAY_RESTARTS=2` kept.

## Checks

- `git diff --check` → PASS (0)
- `.gitignore` clean (no tsbuildinfo, dist committed only as build artifact, no secrets, no visual-evidence committed)
- `BRIDGE_URL` localhost-only, no public fallback
- No force push, no hard reset, no branch deletion

## Artifacts

- Developer captures: `web-frontend/visual-evidence/02-*` (ephemeral, not committed)
- Matrix: `visual-evidence/service-route-matrix/*.png` + `service-route-matrix.json`
- Mission02 capture: `MISSION-02_PRIVATE-MCP-CENTER.png`

Gate verdict: **FULL PASS** — ready for `git push origin main` (FF) and main CI monitor.
