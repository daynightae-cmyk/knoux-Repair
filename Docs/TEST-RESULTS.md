# Test Results — knoux Repair v2.0.2

Executed: 2026-08-04 · Windows PowerShell 5.1 AND PowerShell 7 (pwsh 7.6.3) · machine: Windows 10 Pro 19045 (build 19045)
Command: `powershell -NoProfile -ExecutionPolicy Bypass -File "Tests\Run-Tests.ps1"` (and `pwsh -NoProfile -File "Tests\Run-Tests.ps1"`)

**Result: 83 / 83 tests passed on both runtimes. Exit code 0.** Every one of the 100 tools was
also behaviorally executed (77 in v2.0.1 via the suite + analyze-only smoke, and the 23
previously-untested tools in v2.0.2 via a menu-equivalent invocation harness). `TestResult` in
`Docs\TOOLS-MANIFEST.csv`/`.json` is now **PASS for all 100 tools**.

| # | Test | Result |
|---|------|--------|
| 01 | Core module imports without error | PASS |
| 02 | Core exports required functions | PASS |
| 03 | Core modules are UTF-8 BOM | PASS |
| 04 | All tool files are UTF-8 BOM | PASS |
| 05 | All tool files parse without errors | PASS |
| 06 | Ten categories with exactly ten tools each | PASS |
| 07 | ToolId prefix matches file and folder | PASS |
| 08 | Every tool declares a Risk level | PASS |
| 09 | Every tool imports the Core module | PASS |
| 10 | Every tool ends with Write-KnouxResult | PASS |
| 11 | Config menus.json matches on-disk tools | PASS |
| 12 | settings.json is valid | PASS |
| 13 | Protected lists are present and valid JSON | PASS |
| 14 | Destructive tools use typed confirmation | PASS |
| 15 | No tool removes protected system paths | PASS |
| 16 | Menu.ps1 and launcher exist | PASS |
| 17 | Tool IDs are unique | PASS |
| 18 | No legacy KR API references in tools | PASS |
| 19 | Risk levels use the valid set | PASS |
| 20 | Read-only sample tool produces a report | PASS |
| 21 | Admin tool runs analyze-only cleanly | PASS |
| 22 | Report schema is generated | PASS |
| 23 | Every tool declares AnalyzeOnly/WhatIf switches | PASS |
| 24 | No PS 5.1-incompatible ArgumentList usage | PASS |
| 25 | Quarantine helper is available | PASS |
| 26 | Version and change log exist | PASS |
| 27 | No firewall-disable capability | PASS |
| 28 | No Defender stop/disable capability | PASS |
| 29 | No UAC-disable capability | PASS |
| 30 | Data-destructive tools quarantine by default | PASS |
| 31 | Quarantine move preserves item and metadata | PASS |
| 32 | Quarantine restore verifies SHA-256 | PASS |
| 33 | Quarantine restore rejects tampered item | PASS |
| 34 | SM09 restores start mode and running state | PASS |
| 35 | Unified result object everywhere | PASS |
| 36 | RiskLevel param matches header | PASS |
| 37 | Cleanup helper quarantines by default | PASS |
| 38 | No Success-without-evidence | PASS |
| 39 | Manifest files exist with exact 15-field header | PASS |
| 40 | Manifest has exactly 100 rows (CSV + JSON) | PASS |
| 41 | Manifest rows have 15 fields, none blank | PASS |
| 42 | Manifest RiskLevel uses valid enum | PASS |
| 43 | Manifest OfflineCapability uses valid enum | PASS |
| 44 | Manifest booleans are typed true/false | PASS |
| 45 | Manifest TestResult uses valid enum | PASS |
| 46 | Manifest ToolId and ScriptPath are unique | PASS |
| 47 | Manifest ScriptPaths are valid and exist | PASS |
| 48 | Manifest CSV matches JSON | PASS |
| 49 | No Arabic characters in tool scripts | PASS |
| 50 | Manifest aligns with menus.json | PASS |
| 51 | Manifest matches script risk/admin headers | PASS |
| 52 | Version is consistently 2.0.2 | PASS |
| 53 | All scripts use CRLF line endings | PASS |
| 54 | Stop-KnouxSession rejects a null session | PASS |
| 55 | Exit-code contract maps Success to 0 | PASS |
| 56 | Exit-code contract maps Warning to 1 | PASS |
| 57 | Exit-code contract maps Failed to 2 | PASS |
| 58 | Exit-code contract maps Cancelled to 3 | PASS |
| 59 | Exit-code contract maps Skipped to 4 | PASS |
| 60 | Exit-code contract maps Inconclusive to 5 | PASS |
| 61 | Quarantine file round-trip restores the original path | PASS |
| 62 | Quarantine directory round-trip restores nested files | PASS |
| 63 | Quarantine empty directory round-trip restores an empty dir | PASS |
| 64 | Restore rejects a destination outside the approved root | PASS |
| 65 | Restore rejects a missing metadata file | PASS |
| 66 | Restore rejects an unsupported schema version | PASS |
| 67 | Restore Cancel keeps destination and quarantine | PASS |
| 68 | Restore Replace overwrites the destination | PASS |
| 69 | Restore Alternate writes to a user-supplied path | PASS |
| 70 | Restore Backup keeps a backup of the existing destination | PASS |
| 71 | SC06 aborts when a required service cannot be stopped | PASS |
| 72 | SM09 never emits a Partial session status | PASS |
| 73 | SM05 builds offline DISM source args with /LimitAccess | PASS |
| 74 | SM01 verifies with sfc /verifyonly and CBS evidence | PASS |
| 75 | SM02 runs a post-repair sfc /verifyonly | PASS |
| 76 | Menu offers B/H/Q/R/A navigation and an operation lock | PASS |
| 77 | Write-KnouxResult colour-maps all six statuses | PASS |
| 78 | Arabic status map covers all six statuses | PASS |
| 79 | No tool assigns the removed Partial status | PASS |
| 80 | SC06 cleanup target is restricted to the Download cache | PASS |
| 81 | FILE-INVENTORY.json covers every on-disk tool file | PASS |
| 82 | NI01 degrades gracefully without CIM data | PASS |
| 83 | NI10 degrades gracefully without CIM data | PASS |

## What the functional tests (27–38) prove

- **27–29**: no tool can disable the firewall, stop/disable Windows Defender, or disable UAC —
  searched across all 100 tool files, all clear.
- **30**: the data-destructive duplicate/cleanup tools (DF02–DF06, DF08) all call
  `Move-KnouxItemToQuarantine` and contain no `Remove-Item`.
- **31–33**: real quarantine round-trip — move preserves the item and writes
  `quarantine-meta.json` (with original SHA-256), restore is hash-verified and returns the
  original bytes, and a tampered quarantined copy is refused.
- **34**: `SM09` restores both original start mode and original running state of WU services
  and verifies a count (`restoreVerified -eq saved.Count`).
- **35**: every tool ends with `$result = Stop-KnouxSession`, `Write-KnouxResult`,
  `return $result`; no `$null = Stop-KnouxSession` remains.
- **36**: each tool's `-RiskLevel` matches its header `Risk:` declaration (no drift).
- **37**: `Invoke-KnouxCleanup` quarantines by default (3 files → 3 quarantine metadata
  records, originals gone).
- **38**: every tool that mutates the system (`ChangedSystem`) contains post-operation
  verification evidence (count-vs-expected, exit code, or a re-read of state).

## What the v2.0.2 release tests (52–83) prove

- **52–53**: version is consistently 2.0.2 across VERSION, settings.json, Menu/START headers and
  CHANGELOG; all shipped files use CRLF line endings (PS 5.1 safe).
- **54–60**: the exit-code contract lives in `Stop-KnouxSession` — the returned result/report
  `ExitCode` maps Success→0, Warning→1, Failed→2, Cancelled→3, Skipped→4, Inconclusive→5, and a
  null session is rejected.
- **61–66**: full quarantine restore semantics — file round-trip, directory (nested files)
  round-trip, empty-directory round-trip, and rejection of traversal destinations, missing
  metadata, and unsupported schema versions.
- **67–70**: interactive restore paths driven through a real child process with piped stdin —
  Cancel (keeps both), Replace (overwrites), Alternate path, and Backup & Replace.
- **71–80**: structural guarantees for the repaired tools — SC06 abort-on-failed-service,
  SM09 no `Partial` status, SM05 offline DISM `/LimitAccess` source args, SM01/SM02
  `sfc /verifyonly` + CBS evidence, Menu B/H/Q/R/A + operation lock, six-colour status mapping,
  six-entry Arabic status map, no tool assigns the removed `Partial` status, SC06 target
  restricted to the Download cache, and FILE-INVENTORY coverage of every on-disk tool file.
- **82–83**: the two network tools that previously hard-failed on machines whose NetAdapter
  CIM classes are unavailable now degrade gracefully (NI01 warns + uses `ipconfig` fallback;
  NI10 warns + reports incomplete) and honour the exit-code contract.

## What the manifest TestResult column reflects

At final packaging time every tool was behaviorally executed and is marked `PASS`:

- 77 tools were executed in `-AnalyzeOnly` mode by the v2.0.1 suite + smoke runs.
- The remaining **23 tools** (SM01–SM09, DS06, DS09, NI01–NI05, NI08–NI10, PA02, SC04, SC06,
  SC07) were executed in v2.0.2 via a dedicated harness that invoked each tool exactly as the
  menu does (child `pwsh` with `$ErrorActionPreference='Stop'`, Core imported, `&` invocation)
  and asserted the report's `ExitCode` matches its `Status`. All 23 PASS; NI01/NI10 also have
  permanent regression tests (82/83).

See `TOOLS-MANIFEST.json`.

## Live smoke runs performed during validation (per-category spot checks)

- SE01 Security Audit: firewall (Domain/Private/Public), UAC, Defender real-time — OK.
- SE09 Security Report: 5 threat detections listed.
- DR01 System Information / DR03 Event Log Errors / DR05 Driver Report / DR07 Memory / DR08
  SMART (TEAM T253256GB, OK).
- DF01 Duplicate Analysis: real duplicate groups, recoverable space (bounded scan).
- Menu smoke with piped input: category listing, tool launch, back-to-main, exit all work.
- Network tools NI01/NI10 exercised in full mode (not just analyze-only) — degrade gracefully
  when the NetAdapter CIM classes are missing.

## Notes

- Tests 04/05 cover all 100 tools + 4 Core modules (BOM + parse).
- Re-run anytime: `powershell -NoProfile -ExecutionPolicy Bypass -File "Tests\Run-Tests.ps1"`.
- Environment-only items (Windows 11, fully offline, real rollback, live menu quarantine
  restore, real SM09 reset) remain listed in `KNOWN-LIMITATIONS.md`; they are not release
  blockers — every tool itself has been executed and validated in this environment.
