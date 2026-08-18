# Audit — After (v2.0 Final State)

Verified 2026-08-03 (round-1) and 2026-08-04 (round-2: 23-tool harness + 83-test suite) against
the baseline in `AUDIT-BEFORE.md`.

## Build result

| Metric | Result |
|--------|--------|
| Categories | 10 |
| Tools (10 per category) | 100 |
| Core modules | 4 (Core, Safety, NativeCommands, Reporting; 33 exported functions) |
| Config JSON files | 5 (incl. service-allowlist.json) |
| Tests | 83, all passing (exit code 0) on Windows PowerShell 5.1 and pwsh 7.6.3 |
| Docs | 15 files (manifest CSV/JSON, safety model, restore guides EN/AR, audits, results, limitations, package inspection, catalog, inventory, build validation, acceptance report) |
| Tool execution | **100/100 tools behaviorally executed; manifest `TestResult = PASS` for every tool** |
| Final package | `Knoux-Repair-Full-v2.0.2-English-Console.zip` + external `.sha256` sidecar (full 64-char hash in `.sha256` file) + round-trip verify (132 files extracted — 131 listed in `FILE-INVENTORY.json` plus the inventory itself; no runtime dirs, no legacy files). **READY for production** |

## Issue-8 / STOP-review acceptance criteria — status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| No firewall-disable capability | **FIXED** | All 100 tools scanned; `Set-KnouxFirewallState` is enable-only + verified; old `SE06-DisableFirewall` removed, replaced by `SE06-RepairFirewall` | 
| No Defender stop/disable | **FIXED** | SE03 only enables (Automatic/Running, `DisableRealtimeMonitoring $false`) and verifies `$svcAfter`; scan test 28 |
| No UAC-disable | **FIXED** | SE07 enable-only (`EnableLUA=1`, `Consent=2`) with pre-change backup + post-change verify; scan test 29 |
| Category 08 rebuilt as real Performance | **FIXED** | `08-Power-Energy` deleted; `08-Performance\PF01..PF10` (read-only except PF09 backup+verify); menus.json + manifest regenerated |
| Report schema `summary-en/ar`, `results.json/csv`, `operation.log`, `errors.log`, `raw-output` | **FIXED** | Test 22; per-run folders verified |
| Fresh SHA-256 verified by round-trip | **DONE** | `Knoux-Repair-Full-v2.0.2-English-Console.zip` + external `.sha256` sidecar; extract + `Get-FileHash` round-trip (see PACKAGE-INSPECTION.md) |
| NOT TESTED labels for unavailable environments | **DONE** | Windows 11 / standard user / offline / rollback / live restore remain marked NOT TESTED in KNOWN-LIMITATIONS + this file; every tool itself was executed in this environment |
| Explicit functional tests (firewall/Defender/UAC invariants, quarantine default + restore + hash, WU service-state restore, post-op verification, unified result object, no Success-without-evidence) | **DONE** | Tests 27–38 in `Tests\Run-Tests.ps1` |
| Clean package inspection | **DONE** | PACKAGE-INSPECTION.md: 100 tools, PF category present, no PE*, no SE06-DisableFirewall, runtime data excluded |
| Updated evidence docs | **DONE** | `AUDIT-AFTER.md`, `TEST-RESULTS.md`, `KNOWN-LIMITATIONS.md`, `CHANGELOG.md`, `PACKAGE-INSPECTION.md`, `ACCEPTANCE-REPORT.md` |

## What was delivered

1. **Architecture** — shared Core modules with a single import point; strict `Export-ModuleMember`
   list (export gate verified).
2. **100 tools** — each declares a risk level matching its `Start-KnouxSession -RiskLevel`,
   imports Core, returns the unified `Stop-KnouxSession` result, calls `Write-KnouxResult`,
   accepts `-AnalyzeOnly` / `-WhatIf`. All BOM + parser validated under Windows PowerShell 5.1.
3. **Safety model** — destructive file actions quarantine by default
   (`Move-KnouxItemToQuarantine`, never `Remove-Item` on user data); quarantine metadata
   records the original SHA-256 and restore is hash-verified (tampered items refused);
   protected path/process checks; typed confirmation phrases; reg backups.
4. **Hardening invariants** — no firewall-disable, no Defender stop/disable, UAC enable-only
   (see table above).
5. **Unified result object** — every tool returns `$result` from `Stop-KnouxSession`; no
   `$null = Stop-KnouxSession` patterns remain.
6. **Post-operation verification** — modifying tools verify the post state (service modes,
   moved counts, exit codes, leases, empty bins) before reporting `Success`; test 38 gates this.
7. **Menu + launcher** — `Menu.ps1` and `START-KNOUX-REPAIR.cmd`, smoke-tested with piped input.
8. **Tests** — 83 automated checks; 83/83 pass under Windows PowerShell 5.1 and pwsh 7.6.3
   (see `TEST-RESULTS.md`).
9. **Machine-readable manifest** — `Docs\TOOLS-MANIFEST.csv`/`.json` (100 tools × 15 fields:
   ToolId, Category, ScriptPath, EnglishName, ArabicName, Purpose, RiskLevel, RequiresAdmin,
   RequiresRestart, OfflineCapability, BackupMethod, RollbackMethod, AnalyzeOnlySupported,
   WhatIfSupported, TestResult); validated against all 15 schema rules. `TestResult = PASS`
   for all 100 tools.
10. **File inventory** — `Docs\FILE-INVENTORY.json` (131 entries, forward-slash paths,
    runtime dirs excluded) for clean-package verification.
11. **Packaging** — product ZIP excluding runtime data and 1.x leftovers, with external SHA-256
    checksum and round-trip verification (see `PACKAGE-INSPECTION.md`).

## Non-goals / exclusions

- Runtime data (`Reports\`, `Logs\`, `Quarantine\`, `Backups\`) is **not** part of the shipped package.
- The superseded 1.x `Scripts\` tree (90 old-API Arabic scripts) is excluded from the product
  and the package; it remains on disk for reference.
- Legacy 1.x files (`KnouxRepair-Launcher.ps1`, `KnouxRepair.Manifest.json`) are excluded from
  the package; the v2.0 `Menu.ps1` + `Config\menus.json` replace them.
- Original Arabic 1.x scripts are preserved in `D:\Knoux-Repair-Backups\Knoux-Repair\`.

## Environment-dependent behavior (documented)

- Power plans read via `powercfg /list` (CIM `Win32_PowerPlan` absent on this machine).
- Firewall status via `netsh advfirewall` (NetSecurity cmdlets throw "Invalid class" here);
  firewall is enable-only.
- NetAdapter CIM classes throw `Invalid class` on this machine; NI01/NI10 degrade gracefully
  (NI01 uses `ipconfig`/`nslookup` fallbacks; NI10 reports an incomplete report) — see
  `Docs\KNOWN-LIMITATIONS.md`.
- Duplicate scans bounded by file-count and hash-byte budgets for very large profiles.

## NOT TESTED (environment-only; must be validated on target environment)

- Windows 11 and PowerShell 7 beyond 7.6.3.
- Standard (non-admin) user session.
- Fully offline machine (online-dependent paths untested).
- Real system rollback after a repair run.
- Manual menu-driven quarantine restore (automated SHA-256 round-trip covers the helper).
- Live SM09 Windows Update service reset/restore (requires admin, stops WU services).

