# TRACER Runtime Endpoint Matrix — bridge + gateway + frontend (2026-09-16)

Repo root: `D:\Knoux-repair` | Bridge `http://127.0.0.1:8787` | Gateway `http://127.0.0.1:3000` | Manifest 158 tools / 18 categories / 12 preview families

## Bridge core (`web-frontend/server/bridge-core.mjs` → `bridge.mjs` wrapper)

| Route | Method | Source function | PowerShell / native source | Frontend consumer | Timeout | Mutation guard | Auth | Response type |
|-------|--------|-----------------|----------------------------|-------------------|---------|----------------|------|---------------|
| `/api/health` | GET | `bridge-core:1475` inline | `isElevated()` (pwsh check) + manifest sizes | `api.health()` (10s), gateway `bridgeIsHealthy()` (1s) | 1s health | none | none | `{ ok, bridge, version, elevated, powershell, repoRoot, resourceMode, tools, categories }` |
| `/api/tools` | GET | `bridge-core:1484` | `readManifest()` + `resolveToolCapabilities()` | `api.tools()` (15s), `StationToolRegistry`, workbench | 15s | none | optional `requireAuth`? no | `{ tools: BridgeTool[] (158, ScriptAvailable filtered) }` |
| `/api/categories` | GET | `bridge-core:1508` | counts from `manifest` | `api.categories()` | 15s | none | none | `{ categories: [{ id, tools, available }] }` |
| `/api/categories/:id/tools` | GET | `bridge-core:1521` | `manifest` filtered by Category | `api.categoryTools()`, capture probe | 15s (matrix shim 15s) | none | none | `{ category, tools }` |
| `/api/tools/:toolId` | GET | `bridge-core:1542` | `resolveToolCapabilities` | `api.toolMetadata()` | 15s | none | none | `{ tool: BridgeTool }` |
| `/api/system` | GET | `bridge-core:1549` | `SYSTEM_PS`: `Win32_OperatingSystem`, `Win32_ComputerSystem`, `Win32_Processor`, `Win32_LogicalDisk`, `Get-NetFirewallProfile`, `Get-MpComputerStatus`, `Get-Service WinDefend`, `Get-Process` | `api.system()` (60s) — stations 01,06,09 | 45s PS, 60s fetch, 30s cache | none | none | `{ system: SystemSnapshot }` |
| `/api/folders/roots` | GET | `browseRoots()` | `os.homedir()`, fs drives | `api.folderRoots()` | 15s | none | none | `{ roots: LocalFolderRoot[] }` |
| `/api/folders` | GET | `browseFolders()` / `resolveBrowsePath()` | `fs.readdirSync`, path validation (null, encoded, traversal, absolute) | `api.folders()` | 15s | none | none | `{ path, parentPath, folders, truncated }` |
| `/api/network/preview` | GET | `getNetworkPreview()` async | `NI11-InteractiveNetworkPreview.ps1` (`---KNOUX_NETWORK_JSON_START---`) | `api.networkPreview()` (125s) | 120s PS | none | none | `{ preview: NetworkPreview }` |
| `/api/operations/preview` | GET | `getOperationsPreview()` → `runPreviewScriptAsync(SP11)` | `SP11-InteractiveOperationsPreview.ps1` (`---KNOUX_OPERATIONS_JSON_START---`) | `api.operationsPreview()` (125s) | 120s | none | none | `{ preview: OperationsPreview }` |
| `/api/performance/preview` | GET | `getPerformancePreview()` → SP? PF11 | `PF11-InteractivePerformancePreview.ps1` | `api.performancePreview()` | 120s | none | none | `{ preview: PerformancePreview }` |
| `/api/performance/optimization-preview` | GET | `getOptimizationPreview()` → PF12 | `PF12-InteractiveOptimizationPreview.ps1` | `api.optimizationPreview()` | 120s | none | none | `{ preview: OptimizationPreview }` |
| `/api/diagnostics/preview` | GET | `getDiagnosticsPreview()` → DR11 | `DR11-InteractiveDiagnosticsPreview.ps1` | `api.diagnosticsPreview()` | 120s | none | none | `{ preview: DiagnosticsPreview }` |
| `/api/backup-recovery/preview` | GET | `getBackupRecoveryPreview()` → BR04 | `BR04-InteractiveBackupRecoveryPreview.ps1` | `api.backupRecoveryPreview()` | 120s | none | none | `{ preview: BackupRecoveryPreview }` |
| `/api/drivers/preview` | GET | `getDriversPreview()` → DV04 | `DV04-InteractiveDriverPreview.ps1` | `api.driversPreview()` | 120s | none | none | `{ preview: DriversPreview }` |
| `/api/privacy/preview` | GET | `getPrivacyPreview()` → PR04 | `PR04-InteractivePrivacyPreview.ps1` | `api.privacyPreview()` | 120s | none | none | `{ preview: PrivacyPreview }` |
| `/api/cleanup/preview` | GET | `getCleanupPreview()` → SC11 | `SC11-InteractiveCleanupPreview.ps1` | `api.cleanupPreview()` | 120s | none | none | `{ preview: CleanupPreview }` |
| `/api/post-install/preview` | GET | `getPostInstallPreview()` → PI06 | `PI06-InteractivePostInstallPreview.ps1` | `api.postInstallPreview()` | 120s | none | none | `{ preview: PostInstallPreview }` |
| `/api/software-advanced/preview` | GET | `getAdvancedSoftwarePreview()` → SW08 | `SW08-AdvancedSoftwareEnvironmentPreview.ps1` | `api.advancedSoftwarePreview()` | 120s | none | none | `{ preview: AdvancedSoftwarePreview }` |
| `/api/software/preview` | GET | `getSoftwarePreview()` async | `SW07-InteractiveSoftwarePreview.ps1` (`---KNOUX_SOFTWARE_JSON_START---`) | `api.softwarePreview()` | 120s | none | none | `{ preview: SoftwarePreview }` |
| `/api/duplicates/preview` | GET | `getDuplicatePreview()` async | `DF11` scan (`---KNOUX_DUPLICATES_JSON_START---`) | `api.duplicatePreview()` | 120s | none | none | `{ preview: DuplicatePreview (+PreviewId) }` |
| `/api/duplicates/thumbnail` | GET | inline | `fs.statSync` + SVG fallback | direct img src | 25MB cap | none | none | `image/*` or `image/svg+xml` |
| `/api/duplicates/quarantine` | GET | `getDuplicateQuarantine()` | `Quarantine/DF*` + `quarantine-meta.json` | `api.duplicateQuarantine()` | 30s | none | none | `{ quarantine: DuplicateQuarantinePreview }` |
| `/api/duplicates/engine-scan` | POST | `scanDuplicateRoots()` | Node SHA-256 engine (no PS) | `api.duplicatesEngineScan()` | 125s | JSON gate (no token? reads) | none | `{ preview }` |
| `/api/duplicates/engine-quarantine` | POST | `quarantineDuplicatePaths()` | Node fs move | `api.duplicatesEngineQuarantine()` | 125s | origin + content-type + token | optional auth | `{ moved, failed }` |
| `/api/duplicates/jobs` | POST | `createJobStore` + `runIndexedScan` async | SQLite `Data/duplicates-index.db` | `api.duplicatesScanJob()` | 30s | none | none | `{ scanId, status } 202` |
| `/api/duplicates/jobs/:id` | GET | `duplicateJobs.get()` | job store | `api.duplicatesJob()` | 30s | none | none | `{ job }` |
| `/api/duplicates/jobs/:id/cancel` | POST | `requestCancel()` | job store | `api.duplicatesJobCancel()` | 30s | JSON gate | optional | `{ cancelled }` |
| `/api/duplicates/scans?latest=1` | GET | `getLatestScan` + `getScanPreview` | SQLite | `api.duplicatesLatestScan()` | 60s | none | none | `{ scan, preview }` |
| `/api/duplicates/history` | GET | `listHistory` | SQLite | `api.duplicatesHistory()` | 30s | none | none | `{ history }` |
| `/api/duplicates/engine-restore` | POST | `restoreQuarantineEntries` | Quarantine | `api.duplicatesRestore()` | 125s | mutation guard | optional | `{ restored, failed }` |
| `/api/duplicates/engine-verify` | POST | `verifyQuarantineEntries` | Quarantine | `api.duplicatesVerify()` | 60s | none | none | `{ verified, failed }` |
| `/api/sonar/preview` | GET | `getProjectSonarPreview()` async | `SN07` (`---KNOUX_SONAR_JSON_START---`) | `api.sonarPreview()` | 125s | none | none | `{ preview: ProjectSonarPreview }` |
| `/api/sonar/ai-status` | GET | inline | `OPENROUTER_CONFIGURED` | `api.sonarAiStatus()` | 15s | none | none | `{ configured, model }` |
| `/api/ai/models` | GET | `AI_MODEL_CATALOG` | `GEMINI_API_KEY`, `OPENROUTER_API_KEY` | `api.aiModels()` | 5s | none | none | `{ models, hasGeminiKey, hasOpenRouterKey }` |
| `/api/ai/generate` | POST | `generateAiText()` → provider routing (Google vs OpenRouter) | `fetchWithTimeout` to `generativelanguage.googleapis.com` or `openrouter.ai` | `api.aiGenerate()` | 120s | origin+content-type+token | optional | `{ text, codeSnippets }` or 503 unavailable |
| `/api/sonar/exports/:id` | GET | `sonarExports.get()` | `Reports/Project-Sonar-Exports` | direct download | — | none | none | `application/pdf` / `text/markdown` |
| `/api/sonar/export` | POST | `exportProjectSonarReport()` async | `SN07` preview + `msedge --print-to-pdf` (spawnSync, 120s) | `api.sonarExport()` | 125s | mutation guard | optional | `{ export: { id, downloadUrl } }` |
| `/api/sonar/analysis` | POST | `getProjectSonarAiAnalysis()` async | `SN07` + OpenRouter (sanitizedFacts only, no file contents) | `api.sonarAnalysis()` | 125s | mutation guard | optional | `{ analysis, model }` |
| `/api/runs` | POST | `createRun()` | `manifest.get(toolId)` → `spawn(PS -File ...)` + `KNOUX_EXECUTION_CONTEXT` | `api.startRun()` (15s) | 600s (TEST_MODE 250-30000) | origin+content-type+token + `requireAuth` if `KNOUX_AUTH_REQUIRED` + risk/confirmation + `activeRunId` 409 guard | yes when `KNOUX_AUTH_REQUIRED` | `{ runId } 202` or `409 RUN_IN_PROGRESS` |
| `/api/runs/:id` | GET | `publicRun()` | `runs.get(id)` | `api.getRun()` (15s) | 15s | none | none | `{ run }` |
| `/api/runs/:id/cancel` | POST | `cancelRun()` → `killProcessTree` (taskkill /T /F or SIGKILL) | process tree | `api.cancelRun()` (15s) | 15s | origin guard (no JSON body) + token | yes | `{ ok }` |

## Gateway (`web-frontend/server.ts`)

| Route | Method | Purpose | Forwarding |
|-------|--------|---------|------------|
| `/api/*` | * | proxies to `http://127.0.0.1:8787` preserving headers (`host` rewritten), re-serializes `express.json()` bodies to avoid pipe hang | `proxyBridgeRequest()` with 503 `BRIDGE_UNAVAILABLE` fallback |
| `/api/workspace/roots` etc. | GET | folder roots (duplicate of bridge) | proxy to bridge |
| `/api/cloudsql/*` | GET/POST | Cloud SQL user sync, repair logs, telemetry, workspace events | `src/db/backendDb.ts` (drizzle-orm/pg) |
| `/api/ai/*` | GET/POST | AI models/templates/generate (gateway also serves Google GenAI directly with `GEMINI_API_KEY`) | local, no bridge |
| `/workspace/roots` etc. | GET | top-level workspace browsing | proxy |
| `/*` (Vite) | GET | dev `vite.middlewares` or `dist` static + SPA fallback + CSP `connect-src 'self' http://127.0.0.1:8787` | — |

## Timeout policy (frontend `src/lib/api.ts` vs bridge)

| Endpoint | Frontend `request()` timeout | Bridge PS timeout | Notes |
|----------|-----------------------------|-------------------|-------|
| `api.tools/categories` | 15s | — | authoritative inventory probe; shimmed 5s→15s for CIM |
| `api.system` | 60s | 45s | 30s cache + coalescing pending promise |
| `api.networkPreview` etc. (12 previews) | 125s | 120s | async `runPsAsync` non-blocking; health stays responsive |
| `api.sonarPreview` | 125s | 120s | |
| `api.softwarePreview` | 125s | 120s | |
| `api.duplicatePreview` | 125s | 120s | |
| `api.startRun` | 15s | 600s (tool) | bridge kills at `RUN_TIMEOUT_MS` with `taskkill /T` |
| `api.getRun` | 15s | — | polling interval 300-800ms until terminal |
| `api.aiGenerate` | 120s | 60-100s (`fetchWithTimeout`) | provider routing explicit |

## Mutation guard (every `POST /api/runs`, quarantine, export, AI)

1. Origin present → must be allowlisted (`http://localhost:5173`, `http://127.0.0.1:5173/4173`, `AUTH_FRONTEND_ORIGIN`)
2. JSON mutations require `Content-Type: application/json` (415 otherwise)
3. When `KNOUX_BRIDGE_TOKEN` set (Electron production) → `X-Knoux-Bridge-Token` timing-safe equal

Duplicate/privacy etc. reads are intentionally unguarded but still loopback-only (server binds `127.0.0.1` only).

## Special lifecycle

- **Single-run**: global `activeRunId` + `409 RUN_IN_PROGRESS` for concurrent `POST /api/runs`. Background `analyzeOnly` serialized via `backgroundAnalyzeTail` + `backgroundAnalyzeStarts` map (StrictMode duplicate shares promise).
- **Inconclusive**: `resultStatus === 'Inconclusive'` → `run.status = 'inconclusive'` (distinct terminal, never success). `cancelled`/`failed` similarly distinct.
- **Cancel**: `POST /api/runs/:id/cancel` + `killProcessTree(taskkill /T /F || SIGKILL)` → poll until backend terminal (`requestBackendConfirmedCancel`). Local abort never claims `cancelled`.
- **Timeout**: `RUN_TIMEOUT_MS = 10m` (test mode 250-30000ms via env) → `taskkill` → `error` + `activeRunId` cleared.
- **Sonar privacy**: preview finds `Findings[:40]` sanitized (languages, fileCount, git flag, severity/code/title/evidence/fix only); no `sourceFileContentsSent`.

## Frontend mapping snapshot

- `api.system()` → Station01 Maintenance, 06 Disk, 09 Security (Defender)
- `api.cleanupPreview()` → Station02
- `api.networkPreview()` → Station03
- `api.softwarePreview()` + `api.softwarePreview()` (duplicate) → Station04 Programs (registry), Station16 Software
- `api.operationsPreview()` → Station07 Services, 15 Monitoring
- `api.performancePreview()` + `api.optimizationPreview()` → Station08 Performance
- `api.diagnosticsPreview()` → Station10
- `api.backupRecoveryPreview()` → Station11
- `api.driversPreview()` → Station14
- `api.privacyPreview()` → Station13
- `api.postInstallPreview()` → Station17
- `api.duplicatePreview()` + engine-scan/jobs → Station05
- `api.sonarPreview()` → Station18

All routes inventory-classified in `tests/apiInventory.test.mjs` (expected console `503`/`ERR_CONNECTION` classified as transport noise only when `allowTransportNoise`).

