# KNOUX Repair — Architecture

> Version 2.0.3 · `main` @ `e71db5e` · Windows-only local workstation.

This document describes **how KNOUX Repair is built**: the processes it spawns, the
contract between them, the tool-execution pipeline, the security boundaries, and the
rules you must respect when changing the system.

For *what* the product does, see `README-EN.md` / `README-AR.md`. For the deep gap
analysis, see `Docs/DEEP-AUDIT-REPORT-20261020.md`.

---

## 1. The product in one paragraph

KNOUX Repair is an offline-first **Windows repair workstation**. It presents 158
system tools grouped into 18 services and 6 families. A tool is never a binary blob:
it is a PowerShell script that the local bridge validates, executes under a
deny-by-default policy, and then reports on with a signed, structured result
envelope. Nothing runs that the user did not ask for, and nothing reports a result
the system did not actually produce.

---

## 2. Repository layout

```
Base/
├── web-frontend/              # THE APPLICATION (Electron + React)
│   ├── desktop/               # Electron main process (CommonJS)
│   │   ├── main.cjs           # lifecycle, window, local static server, bridge spawn
│   │   └── security.cjs       # navigation allow-list, asset path resolution
│   ├── server/                # The local bridge (ES modules)
│   │   ├── bridge.mjs         # entry point + private-MCP wrapper
│   │   ├── bridge-auth.mjs    # authentication authority, CORS, mutation guard
│   │   ├── bridge-core.mjs    # tool registry, execution, results  (canonical core)
│   │   ├── cloud-relay.mjs    # opt-in read-only cloud routing
│   │   ├── duplicatesEngine.mjs / duplicatesJobs.mjs
│   │   ├── knouxAiRuntime.ts  # AI runtime
│   │   ├── private-mcp.mjs    # private MCP server
│   │   └── workbench-inspection.mjs  # safe archive/secret inspection
│   ├── src/                   # React renderer
│   │   ├── App.tsx            # MasterWorkstation shell
│   │   ├── components/        # premium shell, panels, workbench
│   │   ├── features/stations/ # station01 … station18 + _shared
│   │   ├── data/              # family-map, categories, preview config
│   │   ├── lib/               # api client, i18n, mcp, workspace apis
│   │   └── db/                # drizzle schema + backend db
│   ├── scripts/               # visual evidence capture (Playwright/CDP)
│   ├── tests/                 # node:test suites (one per concern)
│   └── visual-evidence/       # committed screenshot evidence
├── Core/                      # PowerShell modules (the tool SDK)
├── Config/                    # JSON configuration (menus, guards, settings)
├── Docs/                      # design docs, manifests, reports
├── 01-System-Maintenance/ … 18-Project-Sonar/   # the 158 tool scripts
├── Data/                      # SQLite duplicates index
├── Installer/                 # NSIS installer + branding
├── Reports/                   # per-run report folders (generated)
└── Quarantine/                # quarantined items awaiting restore
```

---

## 3. Runtime processes

Launching the app creates **four** cooperating processes:

```
┌──────────────────────────────────────────────────────────────────┐
│ Electron main  (desktop/main.cjs)                               │
│  • prepares the writable runtime copy (packaged builds only)     │
│  • starts a loopback static file server on a random port         │
│  • spawns the bridge as a child process                          │
│  • probes the bridge until the tool registry validates            │
│  • only then creates the BrowserWindow                           │
└───────────┬──────────────────────────────────────────────────────┘
            │ HTTP (127.0.0.1, random port)
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Renderer  (React 18 SPA, sandboxed, contextIsolation)           │
│  • talks ONLY to the bridge on 127.0.0.1:8787                   │
│  • never touches the filesystem or child_process                 │
└───────────┬──────────────────────────────────────────────────────┘
            │ HTTP + X-Knoux-Bridge-Token
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Bridge  (node, ELECTRON_RUN_AS_NODE=1)                          │
│  • owns the 158-tool registry (Docs/TOOLS-MANIFEST.json)        │
│  • validates every execution request before spawning             │
│  • spawns the tool's PowerShell script                          │
│  • parses the structured result envelope back out                │
└───────────┬──────────────────────────────────────────────────────┘
            │ spawn powershell.exe
            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Tool script  (NN-Category/XX-Tool.ps1)                          │
│  • imports Core/KnouxRepair.Core.psm1                           │
│  • opens a session, measures, writes a report, emits a result   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.1 The readiness contract

The UI must never show "READY" before the tool registry is valid. The main process
enforces this in `probeBridgeReady()`: health → `/api/tools` → registry validates.
If the probe fails, the exact offline reason travels to the renderer in the launch
URL (`bridgeError=…`), so the first paint shows **OFFLINE / UNAVAILABLE** instead of
a misleading "0 tools".

### 3.2 The writable runtime copy (packaged builds only)

A packaged app runs from `process.resourcesPath/knoux-runtime`, which is
read-only. On launch the main process copies it to
`app.getPath('userData')/runtime`, then writes a **fingerprint** file:

```
fingerprint = `${version}:${sha256(watched runtime files + every category script)}`
```

The version alone is not enough — a same-version code update would otherwise keep
running a stale bridge. The fingerprint makes any change to the executable runtime
surface refresh the writable copy. `Reports`, `Quarantine` and `node_modules` are
excluded from the copy, and `.env.local` is never copied.

---

## 4. The tool-execution pipeline

This is the heart of the system. A run is a **seven-step pipeline**, and every step
is a gate.

```
UI  ──POST /api/runs──▶  Bridge
                          │
                          │ 1. registry lookup        (unknown tool → 400)
                          │ 2. request validation     (mode, risk, confirmation)
                          │ 3. script resolution      (path must stay under REPO_ROOT
                          │                            AND be in the menu index)
                          │ 4. elevation check        (admin tool without admin → 403)
                          ▼
                    spawn powershell.exe -File <script>
                          │ 5. Core re-validates      (deny-by-default; the
                          │                            execution context is DATA,
                          │                            never self-authorization)
                          ▼
                    tool measures the system
                          │ 6. report export          (exactly 7 entries, see §7)
                          ▼
                    results.json  ──▶  Bridge parses  ──▶  UI envelope
```

### 4.1 Modes

| Mode | Flag passed | Meaning |
|------|-------------|---------|
| `run` | *(none)* | The real operation. |
| `analyze` | `-AnalyzeOnly` | Plans the operation, changes nothing. |
| `preview` | `-WhatIf` | The script's own what-if path. |

Mode support is **not** assumed: the manifest flag is authoritative, and the script
text is the fallback. A tool that does not declare support is rejected with
`MODE_NOT_SUPPORTED` rather than silently run in the wrong mode.

### 4.2 Risk levels and confirmation

`READ_ONLY`, `SAFE_CLEANUP`, `SYSTEM_REPAIR`, `DESTRUCTIVE`, `REBOOT_REQUIRED`,
`WINRE_ONLY`.

`Test-KnouxExecutionConfirmation` is **deny-by-default**. `SYSTEM_REPAIR` and above
require explicit confirmation evidence — including a typed phrase — carried in the
validated execution context. A host environment variable can never authorize an
action by itself. `WINRE_ONLY` is never authorized for an online repair.

### 4.3 Exit-code contract

`Stop-KnouxSession` enforces a fixed mapping and *corrects* a mismatched exit code
rather than letting it drift:

| Status | Exit code |
|--------|-----------|
| Success | 0 |
| Warning | 1 (non-fatal) |
| Failed | 2 (fatal) |
| Cancelled | 3 |
| Skipped | 4 |
| Inconclusive | 5 |

`Inconclusive` is a first-class terminal state: the bridge surfaces it distinctly
and never collapses it into success.

---

## 5. The catalog model: 6 families, 18 services, 158 tools

```
Family 01 · System Vitality ............ 26 tools
  01-System-Maintenance   10
  08-Performance          12
  15-System-Monitoring     4
Family 02 · Recovery & Storage ......... 37 tools
  02-System-Cleanup       11
  05-Duplicate-Files      11
  06-Disk-Space           10
  11-Backup-Recovery       5
Family 03 · Assurance .................. 29 tools
  03-Network-Internet     11
  09-Security             10
  13-Privacy               4
  14-Driver-Management     4
Family 04 · Software Library ........... 24 tools
  04-Programs-Applications 10
  16-Software-Environment   8
  17-PostInstall-Setup      6
Family 05 · Engineering Workbench ...... 20 tools
  12-Developer-Tools       13
  18-Project-Sonar          7
Family 06 · Investigation .............. 22 tools
  10-Diagnostics-Reports   11
  07-Services-Processes    11
                              ─────────
                              158 tools
```

The registry has exactly one source of truth: `Docs/TOOLS-MANIFEST.json`. The
bridge, the menu index (`Config/menus.json`) and the renderer all read from it. A
tool that is not in the manifest cannot be executed, and a script that is not
registered in the menu index cannot be resolved.

`web-frontend/tests/architectureInvariants.test.mjs` asserts these exact counts and
the per-family distribution, so the catalog cannot drift silently.

---

## 6. The bridge API surface

All routes are served on `127.0.0.1:8787`. Mutating routes require **all three** of:
an allowed `Origin`, a `Content-Type: application/json`, and a valid
`X-Knoux-Bridge-Token`.

| Group | Routes |
|-------|--------|
| Health & registry | `GET /api/health` · `GET /api/tools` · `GET /api/tools/:id` · `GET /api/categories` · `GET /api/categories/:id/tools` |
| System | `GET /api/system` · `GET /api/folders` · `GET /api/folders/roots` |
| Execution | `POST /api/runs` · `GET /api/runs/:id` · `POST /api/runs/:id/cancel` |
| Authentication | `GET /api/auth/status` · `GET /api/auth/start/:provider` · `GET /api/auth/callback/:provider` · `POST /api/auth/handoff/:id/claim` · `POST /api/auth/handoff/:id/cancel` · `POST /api/auth/logout` |
| Previews (read-only) | `GET /api/{network,operations,performance,diagnostics,backup-recovery,drivers,privacy,cleanup,post-install,software-advanced,software,duplicates,sonar}/preview` |
| Duplicates engine | `POST /api/duplicates/engine-scan` · `engine-quarantine` · `engine-restore` · `engine-verify` · `POST /api/duplicates/jobs` · `GET /api/duplicates/jobs/:id` · `POST /api/duplicates/jobs/:id/cancel` · `GET /api/duplicates/scans` · `history` · `thumbnail` · `quarantine` |
| AI | `GET /api/ai/models` · `POST /api/ai/generate` · `GET /api/sonar/ai-status` |
| Sonar | `POST /api/sonar/analysis` · `POST /api/sonar/export` · `GET /api/sonar/exports/:id` |
| Private MCP | `GET /api/mcp/contract` · `POST /api/mcp/verify` |

`bridge.mjs` is the **authentication authority**; `bridge-core.mjs` remains the
canonical tool/runtime authority. The wrapper asserts, at load time, that the
delegated core still contains the Phase 00 contracts it depends on — if a refactor
drops one of them, the bridge refuses to start rather than degrading silently.

---

## 7. The report contract

Every tool run produces exactly **seven** entries in
`Reports/<timestamp>-<TOOLID>/`:

```
operation.log     the run log
errors.log        the error log
results.json      the structured result envelope
results.csv       the same envelope, tabular
summary-en.txt    the English summary
summary-ar.txt    the Arabic summary
raw-output/       any auxiliary data the tool wrote
```

`Test-KnouxReportSchema` asserts that nothing else is in the folder. Tools that
need extra data write it **inside `raw-output/`**.

### 7.1 Run correlation

`results.json` carries a `runId` that is **identical to the bridge run id** that
produced it. The bridge writes the authoritative run id into
`$env:KNOUX_EXECUTION_CONTEXT` before spawning the script, and
`Start-KnouxSession` adopts it. Only a direct, non-bridge invocation (running the
script by hand) falls back to a freshly generated GUID.

This is what makes "open the report for *this* run" possible. If you ever see a
report whose `runId` does not match its run, the correlation has been broken.

### 7.2 Truthfulness

The envelope distinguishes what happened from what was attempted:

- `changedSystem` — did the tool actually change anything?
- `itemsFound` vs `itemsProcessed` — discovered vs handled.
- `verificationPerformed` / `verificationResult` — was the change verified, and what
  did verification conclude? "Not performed" is a valid, expected value.
- Unknown data is `null`. Values are never invented, and a field that could not be
  determined stays `null` rather than being filled with a plausible default.

---

## 8. Security model

### 8.1 Process boundaries

- The renderer runs with `contextIsolation: true`, `nodeIntegration: false` and
  `sandbox: true`. It has no filesystem access and no `child_process`.
- The renderer may only talk to the bridge, and only with the per-launch token.
- The bridge token is a fresh 32-byte random value, generated on every start, held
  in memory only, never written to disk and never committed.

### 8.2 The static asset server

The packaged app serves its own frontend from a loopback HTTP server. The response
headers are fixed:

```
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none';
  frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
  font-src 'self' data:; img-src 'self' data: https:;
  connect-src 'self' http://127.0.0.1:8787
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Navigation away from the app origin is blocked and external links are handed to the
system browser only after passing `filterExternalUrl`.

### 8.3 The no-local-secrets promise

`localSecretsSent: false` is **enforced**, not asserted. Project Sonar evidence is
redacted before it can reach the AI or a report: `workbench-inspection.mjs` detects
eight secret families and masks them, and `bridge-core.mjs` scrubs the evidence
before handing it on. The promise is covered by guard tests that fail if a raw
extraction or a write/execute capability is reintroduced.

### 8.4 Safe archive inspection

`workbench-inspection.mjs` inspects archives **without extracting them**:

- ZIP traversal is judged and rejected.
- Hard ceilings: 2 GB archive, 32 MB per entry, 10 000 entries.
- SHA-256 is computed in a bounded, streaming way.
- Every read is bounded.

---

## 9. Build and packaging

```
npm --prefix web-frontend run build
  ├── vite build                     → web-frontend/dist          (renderer)
  └── esbuild server.ts --bundle     → web-frontend/dist/server.cjs
electron-builder --win nsis
  └── packages: dist/ + desktop/ + package.json
      extraResources: server/, Config/, Core/, Docs/, 01..18/, brand logo
      → process.resourcesPath/knoux-runtime
```

The NSIS installer is per-user, allows choosing the install directory, and creates
both a desktop and a Start-menu shortcut.

---

## 10. Test strategy

```bash
npm --prefix web-frontend test        # node:test over tests/*.test.mjs
npm --prefix web-frontend run typecheck
npm --prefix web-frontend run build
npm --prefix web-frontend audit
```

The suites are organised by *concern*, not by file:

| Concern | Examples |
|---------|----------|
| Catalog invariants | `architectureInvariants`, `apiInventory`, `productTruth` |
| Execution honesty | `executionHonesty`, `executionSemantics`, `resultEnvelopeTruthfulness`, `honestStateContract` |
| Security | `bridgeSecurity`, `rendererSecretBoundary`, `capabilityGate`, `privateMcpClosure`, `bridgeMutations` |
| Station behaviour | `station01` … `station18`, `stationTruthfulnessClosure`, `stationRecoveryHonesty` |
| Visual contract | `*VisualPolish`, `*WorkspaceLayout`, `visualClosureIdentity`, `workbenchVisualLock` |
| Platform integrity | `desktopLifecycle`, `reportRunCorrelation`, `dependencyPinClosure` |

Two suites execute **real PowerShell** against the real `Core` module, so the
session/report contract is proven behaviourally rather than by reading source text.

---

## 11. Extension guide

### Adding a tool

1. Write the script at `NN-Category/XX-ToolName.ps1` and keep it inside the
   category folder.
2. `Import-Module` `Core/KnouxRepair.Core.psm1` and use `Start-KnouxSession` /
   `Stop-KnouxSession` / `Write-KnouxResult`. Do not hand-roll the report.
3. Register it in `Docs/TOOLS-MANIFEST.json` **and** `Config/menus.json`. Both are
   required — the bridge rejects a script that is not in the menu index.
4. Add a test under `web-frontend/tests/`.
5. Run the full gate: test → typecheck → build → audit.

### Invariants you must not break

- The catalog is exactly 158 tools / 18 services / 6 families.
- A run produces exactly seven report entries.
- Unknown data stays `null`.
- Mode and confirmation are validated by the bridge *and* re-validated by Core.
- The renderer never gains filesystem or process access.
- A tool that fails must say so — never report a partial success as a success.

---

## 12. Known limitations

See `Docs/KNOWN-LIMITATIONS.md` and `Docs/DEEP-AUDIT-REPORT-20261020.md` for the
current list, including the live cloud gateway verification (blocked without
`gcloud` access) and the tools that require elevation and are therefore not
exercised in an automated run.
