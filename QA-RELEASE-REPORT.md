# KNOUX Repair v2.0.2 — RELEASE GATE FINAL REPORT

**Date:** 2026-08-18 · **Gate:** Release Candidate Lock · **Scope:** 30-phase QA / hardening / release validation

---

## VERDICT

# RELEASE READY

---

## Artifact (deployed binary)

| Item | Value |
|------|-------|
| Path | `D:\Knoux-Repair-v2.0.2\KnouxRepair.exe` |
| Size | 71,751,534 bytes (68.4 MB, single-file self-extracting) |
| SHA256 | `8FCD0DE812367520D250AADADE726CA2DB6787274C6F35C93B632EDBB4FA7EF1` |
| FileVersion / Product | 2.0.2.0 / 2.0.2 |
| Elevation | Embedded manifest `requireAdministrator` (UAC-verified, elevated instance confirmed) |
| Signature | Not signed (NOT a defect — external certificate not in scope) |

## Gate phases

| Phase | Check | Result |
|-------|-------|--------|
| 0 | Baseline freeze (hash, layout, no git) | PASS |
| 1 | Static source audit (props, bindings, network primitives, dispatcher chain) | PASS — CLEAN |
| 2 | Localization EN/AR round-trip + persistence + parity | PASS — 21/21 UI suite, 2 defects fixed |
| 3 | Navigation (8 pages via UIA) | PASS |
| 4 | 100-tool integrity (IDs, search, detail panel, manifest meta) | PASS |
| 5 | Tool execution safety (SAFE read-only) | PASS — LIVE elevated: DF01 Analyze ran (PS child peaked 192MB, released); app stable |
| 6–13 | Pages: Dashboard/Reports/Backups/Quarantine/TestCenter/Settings/About/Splash | PASS — 12/12 |
| 14 | Admin/security (manifest embed, secrets scan) | PASS — 1 defect fixed |
| 15 | Offline guarantee (zero network primitives) | PASS |
| 16 | Performance/stability (memory, nav loop, reopen) | PASS — LIVE elevated: 90s Analyze + Run-Tests(83) + 160 navs; no crash, mem 283–320MB stable |
| 17 | Error handling (PS error capture, cancellation, safe conditions) | PASS |
| 18 | Build | PASS — 0 errors / 0 warnings |
| 19 | Test suite | PASS — 83/83 |
| 20 | Publish + deploy | PASS — fresh single-file EXE deployed |
| 21 | Hash / integrity | PASS — re-recorded (see table above) |
| 22 | Repo hygiene | PASS — `publish-tmp` removed, settings match backup, no stale processes |
| 23 | Final report | PASS — this document |

¹ Phases 5/16 elevated live pass completed 2026-08-18 with clean results (see evidence section above).

## Defects fixed this gate

1. **Arabic never loaded** (`lang.StartsWith("ar")` vs persisted `"العربية"`). Fixed via `ThemeService.IsArabic()` (ar prefix + U+0600–U+06FF), applied at 5 call sites. Verified: 43–49 Arabic strings, RTL flip, restart persistence.
2. **7 stale Arabic strings after AR-restart → EN toggle** (code-behind `FindResource` snapshots). Fixed via `ThemeService.LanguageChanged` event + re-apply handlers in MainWindow, DashboardPage, AboutPage, ToolDetailPanel. Verified: only by-design toggle label remains; round-trip suite 21/21.
3. **Release-blocking: EXE ran `asInvoker`** — source manifest declared `requireAdministrator` but csproj never referenced it. Fixed: `<ApplicationManifest>` now embeds the manifest. Elevated launch + elevated QA suite verified under UIPI integrity.

## Zero-regression compliance

- No re-architecture; all changes are targeted defect fixes at 4 code sites + csproj + manifest.
- 83/83 tests green on final source; build 0/0; UI parity 208/208 (both directions); pixel-diff verified (page transitions 2.5–99.8%, AR vs EN 53%+, all renders non-black); 12 screenshots in `QA-Screenshots\`.
- Details: Phase 1 static audit CLEAN (no UWP/MAUI-only props, no invalid DataGrid props, `Mode=OneWay` bindings, zero network primitives, no duplicate x:Key, timer→`SafeDispatch`→`BeginInvoke` chain correct).

## Known items (non-blocking)

- Binary not Authenticode-signed (external decision).

## Phase 5/16 live evidence (elevated, 2026-08-18)

Instrumented diagnostic (`qa-diag.ps1`) under elevation: app launched, ran DF01 Analyze (bounded 20k files / 500MB hash budget) — PowerShell child peaked ~192MB then released, app stable 282–314MB; ran TestCenter Run-Tests (83/83, 3 concurrent PS children, UI reachable every 5s, window 1280×800); then 160 navigations across all 8 pages. **No crash, no WER bucket, no System/Defender event, memory stable 283–320MB, CPU 15–20s.** The single earlier "FAIL" in `qa-exec.ps1` was a test-harness bug (stale UI handle → auto-relaunch logic `Stop-Process` killed the live app), not an application defect.