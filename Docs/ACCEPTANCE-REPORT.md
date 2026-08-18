# knoux Repair v2.0.2 — Final Verdict & Acceptance Report

Date: 2026-08-04 · Auditor: opencode agent

## Verdict

**READY for production release.** All 100 tools were behaviorally executed and validated in this
environment (Windows 10 Pro 19045, non-elevated): 77 via the v2.0.1 suite + analyze-only smoke
validation, and the 23 previously-untested tools via a dedicated v2.0.2 harness that invoked
each one exactly as the menu does. The 83-test suite is green on both Windows PowerShell 5.1 and
PowerShell 7 (exit code 0). `TestResult` in the manifest is **PASS for all 100 tools**. The two
network tools that could not run on machines whose NetAdapter CIM classes are unavailable were
repaired to degrade gracefully and are covered by permanent regression tests (82/83).

---

## Validation Summary

| Validation Layer | Result |
|------------------|--------|
| Static validation (file existence, counts, structure) | PASS |
| Parser validation (all 100 tools + 4 Core modules parse under PS 5.1) | PASS |
| Manifest validation (15 rules, 100 rows × 15 fields) | PASS |
| Behavioral tool execution | PASS — 100/100 tools (all TestResult = PASS) |
| PowerShell 5.1 test suite | 83/83 PASS |
| PowerShell 7 (pwsh) test suite | 83/83 PASS |
| Production environment validation | PASS in this environment; environment-only items (Win 11, offline, real rollback) remain listed as NOT TESTED in KNOWN-LIMITATIONS.md |
| Immutable package (ZIP + SHA-256 sidecar + round-trip) | PASS |

---

## 32 Acceptance Items

### Architecture & Core (items 1–8)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | 10 categories × 10 tools = exactly 100 tools on disk | PASS |
| 2 | Shared Core modules (Core, Safety, NativeCommands, Reporting) with single import point | PASS |
| 3 | Strict `Export-ModuleMember` gate verified (33 exported functions) | PASS |
| 4 | All 4 Core modules are UTF-8 BOM, parse under Windows PowerShell 5.1 | PASS |
| 5 | `Menu.ps1` is data-driven from `Config\menus.json`; no hardcoded tool references | PASS |
| 6 | `menus.json` consistency check: ALL CONSISTENT (10 categories, 100 tools) | PASS |
| 7 | All 100 tools declare `-AnalyzeOnly` and `-WhatIf` switches | PASS |
| 8 | All 100 tools import Core, end with `Write-KnouxResult`, return unified `$result` from `Stop-KnouxSession` | PASS |

### Tool Quality & Manifest (items 9–16)

| # | Criterion | Result |
|---|-----------|--------|
| 9 | Machine-readable manifest `Docs\TOOLS-MANIFEST.csv` + `.json` generated (100 rows × 15 fields) | PASS |
| 10 | Manifest 15-field schema exact: ToolId, Category, ScriptPath, EnglishName, ArabicName, Purpose, RiskLevel, RequiresAdmin, RequiresRestart, OfflineCapability, BackupMethod, RollbackMethod, AnalyzeOnlySupported, WhatIfSupported, TestResult | PASS |
| 11 | All manifest enum values valid: RiskLevel (6 values), OfflineCapability (3 values), TestResult (4 values) | PASS |
| 12 | All manifest booleans are real JSON `true`/`false` (not strings) | PASS |
| 13 | No blank fields in any manifest row | PASS |
| 14 | ToolId and ScriptPath unique across all 100 rows | PASS |
| 15 | All ScriptPath forward-slash paths resolve to existing on-disk files | PASS |
| 16 | CSV↔JSON manifest equivalence verified (Import-Csv round-trip matches JSON) | PASS |

### Behavioral Execution & TestResult (items 17–20)

| # | Criterion | Result |
|---|-----------|--------|
| 17 | 100/100 tools behaviorally executed → TestResult = PASS for every tool | PASS |
| 18 | The 23 v2.0.1 NOT_TESTED tools verified via a menu-equivalent harness (child pwsh, EAP=Stop, `&` invocation, report ExitCode ↔ Status contract asserted) | PASS |
| 19 | No tool has TestResult = FAIL or NOT_APPLICABLE | PASS |
| 20 | Manifest re-generated after TestResult updates; all 15 validation rules still pass | PASS |

### Safety & Hardening (items 21–28)

| # | Criterion | Result |
|---|-----------|--------|
| 21 | No firewall-disable capability — `Set-KnouxFirewallState` is enable-only; old `SE06-DisableFirewall` removed | PASS |
| 22 | No Defender stop/disable — `SE03` only enables (Automatic/Running, `DisableRealtimeMonitoring $false`) and verifies | PASS |
| 23 | No UAC-disable — `SE07` enable-only (`EnableLUA=1`, `ConsentPromptBehaviorAdmin=2`) with pre-change backup + post-change verify | PASS |
| 24 | Destructive file actions default to quarantine (`Move-KnouxItemToQuarantine`); no `Remove-Item` on user data | PASS |
| 25 | Quarantine metadata records original SHA-256; restore is hash-verified; tampered items refused | PASS |
| 26 | Unified result object: every tool returns `$result = Stop-KnouxSession`; no `$null = Stop-KnouxSession` patterns | PASS |
| 27 | Post-operation verification on all modifying tools (service modes, moved counts, exit codes, lease checks, recycle-bin-empty checks) | PASS |
| 28 | `RequiresRestart` set only for {SM07, NI04, NI08, SE07}; `OfflineCapability` map correct (all FULL except SM05=PARTIAL, NI01/NI06=PARTIAL, PA09=NO) | PASS |

### Test Suite (items 29–30)

| # | Criterion | Result |
|---|-----------|--------|
| 29 | 83 automated tests pass under Windows PowerShell 5.1 (exit code 0) | PASS |
| 30 | 83 automated tests pass under PowerShell 7 / pwsh (exit code 0) | PASS |

### Package & Delivery (items 31–32)

| # | Criterion | Result |
|---|-----------|--------|
| 31 | Immutable ZIP (`Knoux-Repair-Full-v2.0.2-English-Console.zip`) + external SHA-256 sidecar + round-trip verify (132 files extracted — 131 listed in `FILE-INVENTORY.json` plus the inventory itself; no runtime dirs, no legacy files) | PASS |
| 32 | All evidence docs updated: AUDIT-AFTER.md, TEST-RESULTS.md, KNOWN-LIMITATIONS.md, CHANGELOG.md, PACKAGE-INSPECTION.md, README-EN.md, README-AR.md, BUILD-VALIDATION-EN.txt, BUILD-VALIDATION-AR.txt, FILE-INVENTORY.json, ACCEPTANCE-REPORT.md | PASS |

---

## Tools verified in this release (v2.0.2 harness)

All 23 tools that were NOT_TESTED in v2.0.1 were executed with the exact menu invocation path
(child process, `$ErrorActionPreference = 'Stop'`, Core imported, `&` invocation) and their
report `ExitCode` was asserted to match the declared `Status`:

| ToolId | Result | Status observed |
|--------|--------|-----------------|
| SM01–SM09 | PASS (9/9) | Success |
| DS06, DS09 | PASS (2/2) | Success |
| NI01 | PASS | Success (ipconfig gateway fallback; CIM degraded) |
| NI02–NI05 | PASS (4/4) | Success |
| NI08, NI09 | PASS (2/2) | Success |
| NI10 | PASS | Warning (CIM unavailable; report incomplete by design) |
| PA02 | PASS | Success |
| SC04, SC06, SC07 | PASS (3/3) | Success |

The full harness run is documented in `Docs\BUILD-VALIDATION-EN.txt`. NI01 and NI10 are also
covered by permanent regression tests 82/83 in `Tests\Run-Tests.ps1`.

---

## Bugs Fixed in the v2.0.2 round-2 pass

| Bug | Area | Fix |
|-----|------|-----|
| Directory restore nested the directory inside itself | `KnouxRepair.Safety.psm1` | Restore copies the quarantined directory's **contents** into the target (`Get-ChildItem -LiteralPath ... \| Copy-Item`); no self-nesting |
| Directory restore used a concatenated garbage path | `KnouxRepair.Safety.psm1` | The directory manifest path is stored as the relative `quarantine-manifest.json` and resolved against `$QuarantinePath` (Windows `Join-Path` concatenates absolute second args instead of replacing) |
| NI01 hard-failed with `Invalid class` | `NI01-TestNetworkConnectivity.ps1` | `Get-NetAdapter`/`Get-NetIPConfiguration` guarded; gateway read from `ipconfig.exe` with `Get-NetRoute` fallback; `Resolve-DnsName` guarded with `nslookup.exe` fallback; scoped `$ErrorActionPreference` + try/catch everywhere |
| NI10 hard-failed with `Invalid class` | `NI10-NetworkReport.ps1` | CIM block wrapped in try/catch; `$cimOk` flag → `Warning` + "Network configuration CIM data is unavailable; report is incomplete." |
| `$gwOk` unset under StrictMode when no gateway | `NI01-TestNetworkConnectivity.ps1` | Default `$gwOk = 'NONE'` + explicit `gateway:none` result line |
| Missing `DF10-RestoreQuarantinedItems.ps1` + stale entries | `Docs\FILE-INVENTORY.json` | Regenerated (131 entries) with a script |

---

## Package Artifacts

| Artifact | Path | SHA-256 |
|----------|------|---------|
| Immutable ZIP (final) | `D:\Knoux-Repair-Full-v2.0.2-English-Console.zip` | See external `.sha256` sidecar |
| SHA-256 sidecar (full hash) | `D:\Knoux-Repair-Full-v2.0.2-English-Console.zip.sha256` | See sidecar |
| Manifest (JSON) | `D:\Knoux-Repair-v2.0.2\Docs\TOOLS-MANIFEST.json` | — |
| Manifest (CSV) | `D:\Knoux-Repair-v2.0.2\Docs\TOOLS-MANIFEST.csv` | — |
| File inventory | `D:\Knoux-Repair-v2.0.2\Docs\FILE-INVENTORY.json` (131 entries) | — |
| Test suite | `D:\Knoux-Repair-v2.0.2\Tests\Run-Tests.ps1` (83 tests) | — |

---

*Generated by knoux Repair v2.0.2 audit-and-fix round-2 — 2026-08-04.*
