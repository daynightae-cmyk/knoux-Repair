# Changelog — knoux Repair

## 2.0.2 (2026-08-04) — Release round-2 (verification + hardening)
- **Quarantine directory restore fixed** (`Core\KnouxRepair.Safety.psm1`): the directory
  manifest path is now stored as the relative `quarantine-manifest.json` and resolved against
  the quarantine folder (Windows `Join-Path` concatenates absolute second arguments instead of
  replacing them), and restore copies the quarantined directory's **contents** into the target
  instead of nesting the directory inside itself. File, nested-directory, and empty-directory
  round-trips all verified (tests 61–63).
- **Exit-code contract locked down**: `Stop-KnouxSession` maps the six statuses to exit codes
  0–5 (Success/Warning/Failed/Cancelled/Skipped/Inconclusive) and rejects a null session.
  Tests 54–60 assert the mapping; every tool's report `ExitCode` is asserted against its
  `Status` by the tool harness.
- **`Partial` status removed**: no tool may assign it; `SM09` never emits it (tests 72, 79).
  Arabic status map and `Write-KnouxResult` colour map cover all six statuses (tests 77–78).
- **All 23 previously-NOT_TESTED tools behaviorally verified** (SM01–SM09, DS06, DS09,
  NI01–NI05, NI08–NI10, PA02, SC04, SC06, SC07) via a menu-equivalent harness (child `pwsh`,
  `$ErrorActionPreference='Stop'`, Core imported, `&` invocation). `TestResult` in
  `Docs\TOOLS-MANIFEST.csv`/`.json` is now **PASS for all 100 tools**.
- **NI01 / NI10 robustness fix**: `Get-NetAdapter`/`Get-NetIPConfiguration` can throw a hard
  `Invalid class` error on some machines (ignored by `-ErrorAction SilentlyContinue` when the
  caller has `$ErrorActionPreference='Stop'`). NI01 now reads the gateway from `ipconfig.exe`
  (with `Get-NetRoute` fallback), guards DNS with a `Resolve-DnsName`/`nslookup.exe` fallback,
  and wraps every CIM call in try/catch; NI10 catches the CIM failure and reports `Warning` +
  "report is incomplete" (`$cimOk` flag). Regression tests 82–83.
- **Test suite extended from 51 to 83 tests**: exit-code contract (52–60), quarantine
  file/dir/empty-dir round-trips and restore rejections (61–66), interactive child-process
  restore R/B/A/C paths (67–70), structural gates for the repaired tools (71–81:
  SC06 abort/SC06 target, SM09 no-Partial, SM05 offline DISM, SM01/SM02 CBS evidence, menu
  navigation + operation lock, result/Arabic colour maps, inventory coverage), and the two
  network-tool degradation tests (82–83). All 83 pass under Windows PowerShell 5.1 **and**
  pwsh 7.6.3 (exit code 0).
- **`Docs\FILE-INVENTORY.json` regenerated** (131 entries) — was missing
  `DF10-RestoreQuarantinedItems.ps1`, `Config\service-allowlist.json`, and
  `Docs\ACCEPTANCE-REPORT.md`.
- Evidence docs regenerated for release: TEST-RESULTS.md (83 tests), ACCEPTANCE-REPORT.md
  (verdict **READY**, 100/100 tools PASS), PACKAGE-INSPECTION.md, KNOWN-LIMITATIONS.md,
  AUDIT-AFTER.md, BUILD-VALIDATION-EN/AR.txt (now include PS 5.1 + PS 7 environment evidence:
  module import, 33 exported functions, session round-trip), README-EN/AR.md.
- Packaging: immutable ZIP rebuilt (`Knoux-Repair-Full-v2.0.2-English-Console.zip`, 131
  entries) + external SHA-256 sidecar + round-trip verify.

## 2.0.2 (2026-08-03) — Audit-and-fix pass
- **`Config\menus.json` repaired**: the SM block pointed 8 of 10 entries at deleted files and
  12 tools had wrong `RequiresAdmin` flags. All 100 entries now match on-disk tools 1:1;
  `PA07` correctly `RequiresAdmin:false` (per-user AppX removal; header documents both modes).
- **Machine-readable tool manifest added** (`Docs\TOOLS-MANIFEST.csv` + `.json`): 100 tools x
  15 fields (ToolId, Category, ScriptPath, EnglishName, ArabicName, Purpose, RiskLevel,
  RequiresAdmin, RequiresRestart, OfflineCapability, BackupMethod, RollbackMethod,
  AnalyzeOnlySupported, WhatIfSupported, TestResult). CSV BOM'd; JSON BOM-less UTF-8 with real
  booleans. Purpose text curated for all 100 tools.
- **`Docs\FILE-INVENTORY.json` regenerated** (129 entries, forward-slash paths, runtime dirs
  excluded) as the package-content authority.
- **Test suite extended from 38 to 51 tests**: manifest schema validation (tests 39-51) covers
  header, row counts, enums, typed booleans, uniqueness, path resolution, CSV/JSON
  equivalence, no Arabic inside scripts, menus.json alignment, and header-vs-script agreement.
  All 51 pass under Windows PowerShell 5.1 **and** pwsh (exit code 0).
- **Per-tool behavioral smoke**: every tool executed once in `-AnalyzeOnly` mode where
  feasible; `TestResult` flipped to PASS / NOT_TESTED accordingly.
- Docs updated: README-EN/AR, CHANGELOG, AUDIT-BEFORE/AFTER, TEST-RESULTS, KNOWN-LIMITATIONS,
  BUILD-VALIDATION-EN, PACKAGE-INSPECTION.
- Packaging: immutable ZIP (`Knoux-Repair-Full-v2.0.2-English-Console.zip`) + external SHA-256
  sidecar + round-trip verify; runtime data and legacy files excluded.

## 2.0.2 (2026-08-03)
- Rebuilt as the English v2.0 console product: 10 categories x 10 tools = 100 tools.
- Shared Core modules (`Core\KnouxRepair.Core.psm1` + Safety, NativeCommands, Reporting) with a single import point.
- Per-run report schema: `Reports\<timestamp>-<ToolId>\` with `summary-en.txt`, `summary-ar.txt`, `results.json`, `results.csv`, `operation.log`, `errors.log`, `raw-output\`.
- Risk gating model: READ_ONLY / SAFE_CLEANUP / SYSTEM_REPAIR / DESTRUCTIVE / REBOOT_REQUIRED / WINRE_ONLY.
- Destructive actions require typed confirmation phrases; all deleted/disabled items go through quarantine with restore metadata.
- `-AnalyzeOnly` and `-WhatIf` switches on every tool; menu has a global analyze-only mode.
- Safety helpers: protected path/process checks, restore points, backups, bounded duplicate scanning (`Get-KnouxScanFiles`, `Find-KnouxDuplicateGroups`) for very large user profiles.
- All PowerShell files are UTF-8 **with BOM** for reliable parsing under Windows PowerShell 5.1.
- Interactive menu (`Menu.ps1`) and launcher (`START-KNOUX-REPAIR.cmd`).

### Safety hardening (STOP-review round, 2026-08-03)
- **No firewall-disable capability.** Firewall tools are enable/repair/inspect only
  (`Set-KnouxFirewallState` is enable-only and verifies the post state). Removed the old
  `SE06-DisableFirewall` tool; replaced by `SE06-RepairFirewall` (enable + verify).
- **No Defender stop/disable.** `SE03-RepairWindowsDefender` only sets `WinDefend` to
  Automatic/Running and `DisableRealtimeMonitoring $false`; it verifies after (`$svcAfter`).
- **No UAC-disable.** `SE07-UACSettings` can only enable UAC (`EnableLUA=1`,
  `ConsentPromptBehaviorAdmin=2`), backs up `policies\system` to `Backups\SE07-<stamp>\`
  before changes, and verifies after. `SP05` audits UAC/DEP read-only.
- **Category 08 rebuilt as real Performance** (`08-Performance\PF01..PF10`, all read-only
  except PF09 which backs up + verifies) replacing the old `08-Power-Energy\PE01..PE10`.
- **Destructive file actions default to Quarantine** (`Move-KnouxItemToQuarantine`) instead
  of `Remove-Item`; cleanup counts go to `ItemsProcessed`/`BytesRecovered`, never freed space.
- **Quarantine metadata now records the original SHA-256**; `Restore-KnouxQuarantinedItem`
  verifies the quarantined copy against the stored hash before restoring and verifies the
  restored copy after — tampered items are refused.
- **Unified result object:** every tool returns `$result` from `Stop-KnouxSession` and calls
  `Write-KnouxResult`; zero `$null = Stop-KnouxSession` patterns remain.
- **Post-operation verification:** modifying tools verify state after the change (service
  start mode + running state in SM06, moved counts vs expected in DF/PA/SC/DS, exit codes in
  SM/NI/DS native calls, lease check in NI02, recycle-bin-empty check in SC02/DS04). No
  tool reports `Success` without post-change evidence.
- **Test suite extended from 26 to 38 tests**, including functional quarantine round-trip /
  tamper-rejection, cleanup-default-quarantine, firewall/Defender/UAC invariants, SM06
  service-state restore, unified result object, RiskLevel header/param consistency, and a
  no-Success-without-evidence gate. All 38 pass under Windows PowerShell 5.1 (exit code 0).

### Fixes vs the Arabic 1.x originals
- Fixed the three scripts that previously failed the PS 5.1 parser (missing expression / `$var:` tokenization).
- Native command invocation rewritten to build a properly quoted argument string (`Join-KnouxArguments`) because `ProcessStartInfo.ArgumentList` does not exist in PS 5.1.
- Registry enumeration made StrictMode-safe (path keys return the path string, not an object).
- Network/firewall/power-plan status moved to CIM or `netsh`/`powercfg` (locale-tolerant) because several `Net*`/`Storage`/`Win32_PowerPlan` cmdlets fail on some machines.
- Windows Defender service restart refactored to avoid an AMSI false positive on the previous `Stop-Service/Start-Service` pattern.
- `Write-KnouxResult` no longer blocks forever when input is redirected (safe for automation and the test suite).
- Duplicate scans are bounded by file count and hashing byte budget so the tool terminates quickly on 400k+ file profiles.

## 1.x (Arabic, superseded)
- 90 Arabic scripts in 10 categories. Superseded by 2.0.2; originals are preserved in the project backup under `D:\Knoux-Repair-Backups\Knoux-Repair\`.

