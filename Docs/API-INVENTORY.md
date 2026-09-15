# KNOUX Repair — Authoritative `/api/*` Inventory (LOCAL ONLY)

Generated from live source (evidence-complete pass):
`web-frontend/server/bridge-core.mjs` (canonical tool/runtime authority),
`web-frontend/server/bridge-auth.mjs` (authentication authority),
`web-frontend/server/bridge.mjs` (private-MCP wrapper),
`web-frontend/server/private-mcp.mjs`, `duplicatesEngine.mjs`, `duplicatesJobs.mjs`,
consumers `web-frontend/src/lib/api.ts`, `web-frontend/src/lib/mcp.ts`, `web-frontend/server.ts`.

Envelope convention: success `{ ok: true, ... }`, failure `{ ok: false, error: CODE, message }`
(`sendJson`/`sendError` in `bridge-core.mjs`). No endpoint returns fake success.
No endpoint accepts renderer-supplied cloud secrets (`POST /api/ai/generate`
rejects `customApiKey` with `400 RENDERER_KEY_NOT_ACCEPTED`).

Mutation boundary (all POST): origin allow-list + `Content-Type: application/json`
(except bodyless cancel) + `X-Knoux-Bridge-Token` when `KNOUX_BRIDGE_TOKEN` is set
(`checkMutationGuard`, `bridge-core.mjs:1375`). GET previews are read-only and never mutate.
`POST /api/runs` additionally requires local auth session when `KNOUX_AUTH_REQUIRED=true`
(`bridge-auth.mjs:634`). Bridge binds `127.0.0.1` only.

Timeout model: renderer `request()` carries per-call timeouts (10s–125s in `api.ts`);
long executions never block the browser — `POST /api/runs` returns `202 { runId }`
immediately, client polls `GET /api/runs/:id`; duplicate indexed scans return
`202 { scanId }` and are polled via `GET /api/duplicates/jobs/:id`.
Backend run timeout `RUN_TIMEOUT_MS` = 10 min (test override supported).

Total routes: **50** (48 in bridge-core/auth/mcp + 2 gateway-proxied folder routes in `server.ts`).
Classified: 50. CLOSED: 50. PARTIAL: 0. BLOCKED: 0.

## 1. Health / registry (READ)

| METHOD | PATH | OWNER | R/M | AUTH | TOKEN | ELEVATION/POLICY | REQUEST | RESPONSE | ASYNC | TIMEOUT | ERRORS | SECRET RISK | CONSUMER | TEST | PROOF | STATUS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/health` | bridge-core.mjs:1475 | READ | no | no | none | — | `{ bridge, version, elevated, powershell, repoRoot, resourceMode, tools, categories }` | no | 10s client | — | none (paths only) | api.health, server.ts:112 gateway check | architectureInvariants, bridgeSecurity | LIVE_SAFE (this pass) | CLOSED |
| GET | `/api/tools` | bridge-core.mjs:1484 | READ | no | no | none | — | `{ tools: [...158 manifest, ScriptAvailable only] }` | no | 15s | — | none | api.tools | productTruth (158 count) | LIVE_SAFE | CLOSED |
| GET | `/api/categories` | bridge-core.mjs:1508 | READ | no | no | none | — | `{ categories: [{ id, tools, available }] }` | no | 15s | — | none | api.categories | productTruth | LIVE_SAFE | CLOSED |
| GET | `/api/categories/:id/tools` | bridge-core.mjs:1521 | READ | no | no | none | category id | `{ category, tools }` | no | 15s | — | none | api.categoryTools | productTruth | LIVE_SAFE | CLOSED |
| GET | `/api/tools/:toolId` | bridge-core.mjs:1542 | READ | no | no | none | tool id | `{ tool }` / 404 UNKNOWN_TOOL | no | 15s | 404 UNKNOWN_TOOL | none | api.toolMetadata | bridgeSecurity | LIVE_SAFE | CLOSED |
| GET | `/api/system` | bridge-core.mjs:1549 | READ | no | no | none | — | `{ system: CIM snapshot }` | no | 60s | INCONCLUSIVE when evidence unavailable | none | api.system (01/06/09 fallback) | station01/06/09 | LIVE_SAFE | CLOSED |

## 2. Read-only service previews (READ, one per service family)

| METHOD | PATH | OWNER | SERVICE | REQUEST | RESPONSE | CONSUMER | STATUS |
|---|---|---|---|---|---|---|---|
| GET | `/api/network/preview` | bridge-core.mjs:1562 | 03 Network | — | `{ preview: NI11 }` | api.networkPreview | CLOSED |
| GET | `/api/operations/preview` | bridge-core.mjs:1566 | 07 Services (+15 Monitoring reuse) | — | `{ preview: SP11 }` | api.operationsPreview | CLOSED |
| GET | `/api/performance/preview` | bridge-core.mjs:1570 | 08 Performance | — | `{ preview: PF11 }` | api.performancePreview | CLOSED |
| GET | `/api/performance/optimization-preview` | bridge-core.mjs:1574 | 08 Performance (2nd) | — | `{ preview: PF12 }` | api.optimizationPreview | CLOSED |
| GET | `/api/diagnostics/preview` | bridge-core.mjs:1578 | 10 Diagnostics | — | `{ preview: DR11 }` | api.diagnosticsPreview | CLOSED |
| GET | `/api/backup-recovery/preview` | bridge-core.mjs:1582 | 11 Backup | — | `{ preview: BR04 }` | api.backupRecoveryPreview | CLOSED |
| GET | `/api/drivers/preview` | bridge-core.mjs:1586 | 14 Drivers | — | `{ preview: DV04 }` | api.driversPreview | CLOSED |
| GET | `/api/privacy/preview` | bridge-core.mjs:1590 | 13 Privacy | — | `{ preview: PR04 }` | api.privacyPreview | CLOSED |
| GET | `/api/cleanup/preview` | bridge-core.mjs:1594 | 02 Cleanup | — | `{ preview: SC11 }` | api.cleanupPreview | CLOSED |
| GET | `/api/post-install/preview` | bridge-core.mjs:1598 | 17 PostInstall | — | `{ preview: PI06 }` | api.postInstallPreview | CLOSED |
| GET | `/api/software-advanced/preview` | bridge-core.mjs:1602 | 16 Software (2nd) | — | `{ preview: SW08 }` | api.advancedSoftwarePreview | CLOSED |
| GET | `/api/software/preview` | bridge-core.mjs:1606 | 16 Software (shared by 04 Programs, 12 Developer) | — | `{ preview: SW07 }` | api.softwarePreview | CLOSED |
| GET | `/api/sonar/preview?path=` | bridge-core.mjs:1833 | 18 Sonar | workspace path (validated, scope-locked) | `{ preview: SN07 }` | api.sonarPreview | CLOSED |
| GET | `/api/folders/roots` | bridge-core.mjs:1554 | shared scope control | — | `{ roots }` | api.folderRoots, server.ts:258 gateway proxy | CLOSED |
| GET | `/api/folders?path=` | bridge-core.mjs:1558 | shared scope control | validated local path | listing | api.folders, server.ts:263 gateway proxy | CLOSED |

Services without a dedicated preview reuse honest sources: 01 Maintenance / 06 Disk / 09 Security → `GET /api/system`;
04 Programs / 12 Developer → `GET /api/software/preview`; 15 Monitoring → `GET /api/operations/preview`.
No fabricated percentages; unknown = not-checked.

## 3. Duplicate engine (READ + guarded MUTATE, quarantine-first)

| METHOD | PATH | OWNER | R/M | GUARD | REQUEST | RESPONSE | ASYNC | ERRORS | CONSUMER | STATUS |
|---|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/duplicates/preview` | bridge-core.mjs:1610 | READ | — | `path, types, keeper, exclude` | `{ preview: DF11 }` | no | BAD_REQUEST on bad scope | api.duplicatePreview | CLOSED |
| GET | `/api/duplicates/thumbnail` | bridge-core.mjs:1615 | READ | — | `path, name` | image bytes or generated SVG placeholder | no | falls back to SVG, never 500s on missing file | station05 | CLOSED |
| GET | `/api/duplicates/quarantine` | bridge-core.mjs:1640 | READ | — | — | `{ quarantine }` vault listing | no | — | api.duplicateQuarantine | CLOSED |
| POST | `/api/duplicates/engine-scan` | bridge-core.mjs:1645 | READ (sync scan, no mutation) | JSON | `{ roots (≤16), minSizeBytes, types, excludeSubfolders, keeperPolicy }` | `{ preview }` SHA-256 verified | no (bounded fixture scans) | 400 BAD_REQUEST / ENGINE_SCAN_FAILED | api.duplicatesEngineScan | CLOSED |
| POST | `/api/duplicates/engine-quarantine` | bridge-core.mjs:1671 | MUTATE (move-only, never delete) | mutation guard | `{ paths[1..500], hashes? }` | `{ moved, failed, movedCount, failedCount }` + history record | no | 400 PATHS_INVALID | api.duplicatesEngineQuarantine | CLOSED |
| POST | `/api/duplicates/jobs` | bridge-core.mjs:1704 | READ (starts async indexed scan) | JSON | `{ roots[1..16], ...filters }` | `202 { scanId, status: PREPARING }` | **yes → `GET /api/duplicates/jobs/:id`** | 400 ROOTS_INVALID | api.duplicatesScanJob | CLOSED |
| GET | `/api/duplicates/jobs/:id` | bridge-core.mjs:1753 | READ | — | scanId | `{ job: { status, phase, progress, result, error } }` phases SCANNING>FINGERPRINTING>HASHING>GROUPING>READY | poll | 404 JOB_NOT_FOUND | api.duplicatesJob | CLOSED |
| POST | `/api/duplicates/jobs/:id/cancel` | bridge-core.mjs:1760 | MUTATE (cancel only) | bodyless guard | scanId | `{ cancelled: true }` | no | 404 JOB_NOT_FOUND | api.duplicatesJobCancel | CLOSED |
| GET | `/api/duplicates/scans?latest=1` | bridge-core.mjs:1766 | READ | — | `latest=1` only | `{ scan, preview }` or nulls | no | 400 QUERY_INVALID | api.duplicatesLatestScan | CLOSED |
| GET | `/api/duplicates/history?limit=` | bridge-core.mjs:1779 | READ | — | limit 1..200 | `{ history }` bounded | no | 500 HISTORY_FAILED | api.duplicatesHistory | CLOSED |
| POST | `/api/duplicates/engine-restore` | bridge-core.mjs:1788 | MUTATE (collision-safe restore) | mutation guard | `{ quarantineIds[1..200] }` | `{ restored, failed, restoredCount, failedCount }` never silently overwrites | no | 400 IDS_INVALID | api.duplicatesRestore | CLOSED |
| POST | `/api/duplicates/engine-verify` | bridge-core.mjs:1816 | READ | JSON | `{ quarantineIds[1..200] }` | `{ verified, failed, ... }` | no | 400 IDS_INVALID | api.duplicatesVerify | CLOSED |

Engine rule: size-group → bounded fingerprint → strong SHA-256 before confirming duplicates
(`duplicatesEngine.mjs`). SQLite index `Data/duplicates-index.db`, schema v1, parameterized,
stale reconciliation (`duplicatesJobs.mjs`). File contents never stored.

## 4. Run lifecycle (canonical async execution for all 158 ToolIds)

| METHOD | PATH | OWNER | R/M | GUARD | REQUEST | RESPONSE | ASYNC | ERRORS | CONSUMER | STATUS |
|---|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/runs` | bridge-core.mjs:1923 | MUTATE | auth (when required) + mutation guard | `{ toolId (manifest-only), mode (run\|analyze\|whatif), options, confirmation }` | `202 { runId }` | **yes → `GET /api/runs/:id`** | 400 UNKNOWN_TOOL/MODE_NOT_SUPPORTED/BAD_REQUEST, 403 CONFIRMATION_REQUIRED/PHRASE_REQUIRED, 409 RUN_IN_PROGRESS | api.startRun | CLOSED |
| GET | `/api/runs/:id` | bridge-core.mjs:1960 | READ | — | runId | `{ run: { id, toolId, mode, status, exitCode, output, error, evidence } }` sanitized via `publicRun` | poll | 404 RUN_NOT_FOUND | api.getRun | CLOSED |
| POST | `/api/runs/:id/cancel` | bridge-core.mjs:1966 | MUTATE (cancel only) | bodyless guard | runId | `{ ok: true }` | no | 404 RUN_NOT_FOUND | api.cancelRun | CLOSED |

Single-flight guard (`409 RUN_IN_PROGRESS`). Terminal states: success/warning/failed/cancelled/
inconclusive/skipped. `SIGINT` kills running trees. Prior runs never shown as live
(renderer `executionSemantics.ts` + `StationActiveRunBanner`).

## 5. Sonar export/analysis + AI (guarded, server-secret only)

| METHOD | PATH | OWNER | R/M | GUARD | REQUEST | RESPONSE | SECRET | CONSUMER | STATUS |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/sonar/exports/:id` | bridge-core.mjs:1878 | READ | — | export id | file bytes (pdf/markdown) or 404 EXPORT_NOT_FOUND (TTL 1h) | none | download URL from export call | CLOSED |
| POST | `/api/sonar/export` | bridge-core.mjs:1882 | MUTATE (creates local report file) | mutation guard | `{ path (validated), format: pdf\|markdown, language: ar\|en }` | `{ export: { ..., downloadUrl } }` | server keys only | api.sonarExport (ProjectSonarStation export cards) | **CLOSED** (markdown + PDF both proven live 2026-09-15: markdown 200/1956B, PDF 200/72727B, download verified) |
| POST | `/api/sonar/analysis` | bridge-core.mjs:1902 | READ (AI reasoning over local evidence) | mutation guard | `{ path, language }` | `{ ...analysis }` or provider-unconfigured truth | server keys only | api.sonarAnalysis (explicit Sonar AI action) | CLOSED |
| GET | `/api/sonar/ai-status` | bridge-core.mjs:1838 | READ | — | — | `{ configured, model? }` booleans only | exposes booleans only | api.sonarAiStatus | CLOSED |
| GET | `/api/ai/models` | bridge-core.mjs:1842 | READ | — | — | `{ models: catalog, hasGeminiKey, hasOpenRouterKey }` booleans only, never keys | keys never leave bridge | OpenCodeZenHub providers tab (CONFIGURED/UNCONFIGURED/CHECKING only) | CLOSED |
| POST | `/api/ai/generate` | bridge-core.mjs:1846 | READ (explicit paid-capable call) | mutation guard | `{ modelId, prompt, systemPrompt }` — `customApiKey` **rejected** | `{ text }` or `{ available:false, error: AI_PROVIDER_NOT_CONFIGURED }` | `OPENROUTER_API_KEY`/`GEMINI_API_KEY` server env only | OpenCodeZenHub studio (explicit Generate only, never auto-call) | CLOSED |

Note: `api.aiTemplates` client helper was removed — certified repair templates are a local
static catalog (`lib/aiModelsData.ts` `REPAIR_TEMPLATES`), there is no `/api/ai/templates`
server route and no dead visible action depends on it.

## 6. Auth (HttpOnly loopback sessions, PKCE, one-time state)

| METHOD | PATH | OWNER | R/M | REQUEST | RESPONSE | SECRET | STATUS |
|---|---|---|---|---|---|---|---|
| GET | `/api/auth/status` | bridge-auth.mjs:560 | READ | cookie | `{ required, mode, authenticated, sessionState, providers: { configured }, user? }` | tokens never to renderer | CLOSED |
| GET | `/api/auth/start/:provider` | bridge-auth.mjs:564 | READ (302 to provider) | provider ∈ google\|github\|entra + `?handoff=` | 302 provider authorize URL (PKCE S256) | client_secret stays server-side | CLOSED |
| GET | `/api/auth/callback/:provider` | bridge-auth.mjs:576 | READ (browser landing) | `code, state` | HTML result page, handoff completed server-side | code exchange server-side only | CLOSED |
| POST | `/api/auth/handoff/:id/claim` | bridge-auth.mjs:600 | MUTATE (creates session) | handoff id | `{ authenticated, user }` + `Set-Cookie HttpOnly SameSite=Strict` | session id HttpOnly | CLOSED |
| POST | `/api/auth/handoff/:id/cancel` | bridge-auth.mjs:618 | MUTATE | handoff id | `{ ok }` / 404 | — | CLOSED |
| POST | `/api/auth/logout` | bridge-auth.mjs:625 | MUTATE | cookie | `{ ok }` + cleared cookie | — | CLOSED |

Legacy `bridge-core.mjs` auth stubs (github/entra only, `:1454-1473`) are superseded by
`bridge-auth.mjs` (adds google, handoff model, DPAPI-persisted sessions). `bridge-auth.mjs`
is the single authentication authority.

## 7. Private MCP (fail-closed wrapper)

| METHOD | PATH | OWNER | R/M | GUARD | REQUEST | RESPONSE | STATUS |
|---|---|---|---|---|---|---|---|
| GET | `/api/mcp/contract` | bridge.mjs:52 | READ | — | — | `{ contract: { endpoint, audience, documentedAlias } }` audience = service URL without `/mcp` | CLOSED |
| POST | `/api/mcp/verify` | bridge.mjs:55 | READ (explicit probe) | mutation guard | — | `{ probe: { ok, protocol, http, tool, sanitized evidence } }` legacy-initialize fallback documented | CLOSED |

Known truth: unauthenticated → 403; Google-signed ID token works; modern protocol → HTTP 400,
legacy initialize → HTTP 200/session (`Docs/PRIVATE-MCP-CLOSURE.md`). Renderer never receives
a Google ID token. Live Agent→MCP E2E remains `BLOCKED_EXTERNAL_CREDENTIAL` without a local
invoker identity (never faked).

## Regression gate

`web-frontend/tests/apiInventory.test.mjs` fails if:
- `Docs/API-INVENTORY.md` is missing or lists fewer than 48 classified routes, or
- any `/api/*` literal consumed by `src/lib/api.ts` / `src/lib/mcp.ts` is absent from the inventory, or
- the renderer-secret boundary regresses (`customApiKey` / provider-secret inputs in `src/`).
