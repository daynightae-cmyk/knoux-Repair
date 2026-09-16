# KNOUX Repair — 18-Service Evidence Matrix (evidence-complete pass, 2026-09-15)

Standard: AUTHORITATIVE SOURCE → PROVIDER/BRIDGE → TYPED DATA → REAL UI →
REAL ACTION → REVIEW/CONFIRM (mutating) → EXECUTION → FINAL BACKEND STATE →
VERIFICATION → EVIDENCE → HISTORY → EMPTY/OFFLINE/ERROR → TEST → SAFE RUNTIME PROOF.

Proof classes: LIVE_SAFE (read-only execution on this machine),
LIVE_FIXTURE (temp dirs/files, reversible), WIRING_ONLY_RISKY (selection→review→
confirm→ToolId/route/policy proven without destructive execution).

Live bridge for this pass: worktree bridge on 127.0.0.1:18787 (158 tools,
18 categories, all ScriptAvailable). Renderer visual pass: dev gateway :5173
wired to that bridge (VITE_KNOUX_BRIDGE_URL), viewports TRUE 1366x768 /
1440x900 / 1920x1080 (calibrated, dsf 0.5) + Arabic RTL.

| # | Service (legacySection) | ToolIds | Data source / provider route | ReadOnly actions (live) | Mutating actions (confirm/elevation) | Confirmation | Async lifecycle | Verification | Evidence / history | Focused tests | Runtime proof (this session) | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | System Maintenance (`maintenance`) | SM01–SM10 (10) | `GET /api/system` (CIM snapshot) + `POST /api/runs` | system snapshot LIVE_SAFE ok | SM02 repair etc. via runs (SYSTEM_REPAIR → typed phrase) | ExecutionConfirmDialog + bridge 403 CONFIRMATION_REQUIRED | runId → poll → terminal | CBS/exit-code evidence, Inconclusive when unavailable | run history, StationHistory | station01, station01Care | LIVE_SAFE system ok (19s); WIRING_ONLY_RISKY for repairs | CLOSED |
| 02 | System Cleanup (`cleanup`) | SC01–SC11 (11) | `GET /api/cleanup/preview` (SC11) + runs | cleanup preview LIVE_SAFE ok (real byte counts) | safe cleanup/quarantine where policy supports | mandatory confirmation footer | runId → poll | post-clean verification | history | station02 | LIVE_SAFE preview ok | CLOSED |
| 03 | Network & Internet (`network`) | NI01–NI11 (11) | `GET /api/network/preview` (NI11) + runs | network preview LIVE_SAFE ok | supported safe repairs only | confirm dialog | runId → poll | connectivity re-check | history (localStorage HISTORY_KEY, non-secret) | station03 | LIVE_SAFE preview ok | CLOSED |
| 04 | Programs & Applications (`programs`) | PA01–PA10 (10) | `GET /api/software/preview` shared (SW07) + runs | software inventory LIVE_SAFE ok | uninstall/repair only when backend handler exists; exact package id | review before mutation | runId → poll | per-action verification | history | station04, noFabricatedProgramsEvidence | LIVE_SAFE preview ok | CLOSED |
| 05 | Duplicate Files (`duplicates`) | DF01–DF11 (11) | Node engine (no PS): `engine-scan`, `jobs`, `engine-quarantine/restore/verify`, `scans`, `history` | engine-scan + indexed jobs LIVE_FIXTURE ok | quarantine-first (move-only); permanent delete only if canonical + separate confirm | mandatory Review Decisions → Confirm | scanId/jobs poll; phases SCANNING>FINGERPRINTING>HASHING>GROUPING>READY; cancel | hash verify + restore verify + collision-safe restore | duplicate history (scan/quarantine/restore with real timestamps) | duplicatesEngine, duplicatesIndex (11) | LIVE_FIXTURE full cycle: 3 files → 1 SHA-256 group (a+b, c excluded) → quarantine → verify → restore verified, all restored; jobs PREPARING→COMPLETED; cancel path code-proven | CLOSED |
| 06 | Disk Space (`disk`) | DS01–DS10 (10) | `GET /api/system` (volumes/used/free) + runs | system snapshot LIVE_SAFE ok | user-selected safe actions only | confirm dialog | runId → poll | re-measured values | history | station06 | LIVE_SAFE system ok; no decorative gauges (real values only) | CLOSED |
| 07 | Services & Processes (`services`) | SP01–SP11 (11) | `GET /api/operations/preview` (SP11) + runs | operations preview LIVE_SAFE ok | start/stop/restart only where supported; critical-service guards | confirm dialog | runId → poll | status re-check | history | station07 | LIVE_SAFE preview ok; WIRING_ONLY_RISKY for stop/restart | CLOSED |
| 08 | Performance (`performance`) | PF01–PF12 (12) | `GET /api/performance/preview` (PF11) + `optimization-preview` (PF12) + runs | both previews LIVE_SAFE ok (timestamped samples) | safe optimizations only | confirm dialog | runId → poll | before/after where meaningful | history | station08 | LIVE_SAFE both previews ok; no fabricated percentages | CLOSED |
| 09 | Security (`security`) | SE01–SE10 (10) | `GET /api/system` (Defender/firewall truth) + runs | system snapshot LIVE_SAFE ok (Defender On observed live in UI) | safe actions + privilege handling | confirm dialog | runId → poll | source+timestamp evidence | history | station09 | LIVE_SAFE system ok; no assumed "enabled" (live: Defender Real-time On, processes 307) | CLOSED |
| 10 | Diagnostics & Reports (`diagnostics`) | DR01–DR11 (11) | `GET /api/diagnostics/preview` (DR11) + runs | diagnostics preview LIVE_SAFE ok | full report run (explicit) | confirm dialog | runId → poll | structured findings | history | station10 | LIVE_SAFE preview ok | CLOSED |
| 11 | Backup & Recovery (`backupRecovery`) | BR01–BR05 (5) | `GET /api/backup-recovery/preview` (BR04) + runs | backup preview LIVE_SAFE ok | create/restore point, guarded restore with selectedPath | safe confirmation | runId → poll | restore candidate evidence | history | station11 | LIVE_SAFE preview ok; never implies backup exists (explicit unsupported states) | CLOSED |
| 12 | Developer Tools (`developerTools`) | DT01–DT13 (13) | `GET /api/software/preview` shared + `POST /api/runs` | inventory LIVE_SAFE ok | Workbench Command Deck preserved; risky actions wiring-verified | confirm dialog | POST /api/runs → runId → poll → terminal (never sync-block) | output/error/evidence capture | run history | station12, dtAsyncLifecycle, workbenchCommandDeck, workbenchLiveEndpoints | LIVE_SAFE: DT06 SUCCESS exit 0 (run a87ca1cc), DT05 SUCCESS exit 0 (run dfa210be) via async lifecycle this session | CLOSED |
| 13 | Privacy (`privacy`) | PR01–PR04 (4) | `GET /api/privacy/preview` (PR04) + runs | privacy preview LIVE_SAFE ok | apply plan / flush / clear with countdown + recovery export | changed-value plan + confirm | runId → poll | verify + rollback where supported | history | station13 | LIVE_SAFE preview ok; never displays policy as active unchecked | CLOSED |
| 14 | Driver Management (`drivers`) | DV01–DV04 (4) | `GET /api/drivers/preview` (DV04) + runs | drivers preview LIVE_SAFE ok | export/audit; update only where capability truth allows | confirm dialog | runId → poll | signature/inventory verification | history | station14 | LIVE_SAFE preview ok; no invented "latest driver" | CLOSED |
| 15 | System Monitoring (`monitoring`) | MO01–MO04 (4) | `GET /api/operations/preview` reused + runs | operations preview LIVE_SAFE ok (TopMemory/NotResponding observatory) | protected actions only | confirm dialog | runId → poll | sampled timestamps | history | station15 | LIVE_SAFE preview ok; pause/resume; no fake live graphs | CLOSED |
| 16 | Software Environment (`softwareEnvironment`) | SW01–SW08 (8) | `GET /api/software/preview` (SW07) + `software-advanced/preview` (SW08) + runs | both previews LIVE_SAFE ok | winget upgrade preview/apply (exact ID), protected uninstall | confirm dialog | runId → poll | version/exe resolution re-check | history (rememberRun/observeRun) | station16 | LIVE_SAFE both previews ok; no hard-coded versions | CLOSED |
| 17 | Post-Install Setup (`postInstall`) | PI01–PI06 (6) | `GET /api/post-install/preview` (PI06) + runs | post-install preview LIVE_SAFE ok (verified catalog IDs only) | install queue with per-item queued/running/success/failed states | safe install flow + confirm | runId → poll | result verification, no fake "installed" | queue history | station17 | LIVE_SAFE preview ok | CLOSED |
| 18 | Project Sonar (`projectSonar`) | SN01–SN07 (7) | `GET /api/sonar/preview?path=` (SN07, scope-locked) + export/analysis + runs | sonar preview LIVE_SAFE ok (C:\Windows\Temp probe); markdown+PDF export LIVE_SAFE ok (200, md 1956B, pdf 72727B, downloads verified) | export (creates local file, guarded); AI analysis explicit only | confirm dialog for runs; explicit AI action | runId → poll; export TTL 1h | findings attribution + evidence | history | station18 | LIVE_SAFE: preview + both exports + download; UI: selectable in workbench, SN chips idle, export cards honest generating/error states | CLOSED |

Cross-cutting (all services): selection ≠ running ≠ completed enforced by
`toolStatuses` + `data-tool-status` + status-dot CSS (running/success/error/
cancelled/inconclusive) + `StationActiveRunBanner` (single banner, backend-
confirmed cancel) + `ExecutionConfirmDialog` (typed phrase for
SYSTEM_REPAIR/DESTRUCTIVE, bridge enforces 403 CONFIRMATION_REQUIRED) +
`validateExecutionRequest` + single-flight 409 RUN_IN_PROGRESS +
`publicRun` sanitization (no secrets) + bounded history with real timestamps.

Blocked/external (unchanged, honest): live Agent→MCP E2E
(BLOCKED_EXTERNAL_CREDENTIAL — fresh `/api/mcp/verify` probe this session:
privacy confirmed-private 403, identity unavailable, fail-closed, no fake);
live paid-provider availability (no keys configured: hasGeminiKey=false,
hasOpenRouterKey=false → UI shows UNCONFIGURED truthfully).
