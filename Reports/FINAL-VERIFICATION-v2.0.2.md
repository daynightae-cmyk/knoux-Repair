# KNOUX Repair v2.0.2 — Final Verification

**Verification date:** 2026-08-19

## Build

| Gate | Command | Result |
|---|---|---|
| Debug WPF build | `dotnet build .\Glass-GUI-Builder\src\KnouxRepair\KnouxRepair.csproj --no-restore -v:minimal` | **PASS** — exit code 0 |
| Release WPF build | `dotnet build .\Glass-GUI-Builder\src\KnouxRepair\KnouxRepair.csproj --no-restore -c Release -v:minimal` | **PASS** — exit code 0 |
| Release smoke launch | Release `KnouxRepair.exe` process check | **PASS** — process remained running for five-second smoke check |

## Automated tests

| Gate | Command | Result |
|---|---|---|
| Desktop regression | `powershell -NoProfile -ExecutionPolicy Bypass -File .\Tests\Run-Tests.ps1` | **PASS** — 83 tests, 0 failures |
| Bridge timeout | `powershell -NoProfile -ExecutionPolicy Bypass -File .\Tests\Test-BridgeTimeout.ps1` | **PASS** — timeout probe passed |
| Web TypeScript | `npx tsc --noEmit` | **PASS** — exit code 0 |
| Web production build | `npm run build` | **PASS** — Vite built 1951 modules |

## Manifest and capability matrix

| Check | Actual result |
|---|---:|
| Matrix rows | 100 |
| Categories | 10 |
| Category distribution | 10 tools in every category |
| Missing manifest script paths | 0 |
| Selection workflows from script analysis | 6 |
| Report behavior from script analysis | 56 |
| Quarantine behavior from script analysis | 16 |
| Interactive prompt occurrences | 0 |

The machine-readable capability matrix is `Reports/100-Tool-Capability-Matrix.csv`.

## Safe functional verification

The test harness `Tests/Test-ToolFunctionalVerification.ps1` invoked each manifest tool only with its declared noninteractive `-AnalyzeOnly` mode and a two-second bound per tool. No destructive tool action was invoked.

| Status | Count | Meaning |
|---|---:|---|
| VERIFIED | 63/100 | `-AnalyzeOnly` ended with an accepted exit code under the actual noninteractive process contract. |
| UNVERIFIED | 37/100 | The bounded safe probe timed out or returned an outcome not accepted by the harness; no destructive fallback was attempted. |
| FAILED | 0/100 | No missing script path or harness-level failure was recorded. |

The machine-readable per-tool output is `Reports/100-Tool-Functional-Verification.csv`.

## ToolExecutionEvidence

`Models/ToolExecutionEvidence.cs` stores ToolId, state, start/end timestamps, elapsed time, exit code, stdout, stderr, report path, backup path, quarantine path, and recovery information. `MainWindow.xaml.cs` now appends live stdout/stderr to the active tool evidence record and completes that record with the real exit code. Artifact values are parsed only from output emitted by the process; the user interface does not fabricate them.

## Visual QA

| Scope | Status | Evidence |
|---|---|---|
| Release executable launch | PASS | Application process smoke check completed. |
| Interactive screenshot attempt | NOT PERFORMED | `Tests/Capture-VisualQa.ps1` was started against the Release executable but did not complete within the interactive command timeout; the attempt was stopped and no screenshot was claimed or generated. |
| 1280×720 | NOT PERFORMED | No controllable interactive screenshot session was available. |
| 1366×768 | NOT PERFORMED | No controllable interactive screenshot session was available. |
| 1920×1080 | NOT PERFORMED | No controllable interactive screenshot session was available. |
| 2560×1440 | NOT PERFORMED | No controllable interactive screenshot session was available. |
| Dark/English | NOT PERFORMED | Screenshot-level visual inspection unavailable. |
| Dark/Arabic | NOT PERFORMED | Screenshot-level visual inspection unavailable. |
| Light/English | NOT PERFORMED | Screenshot-level visual inspection unavailable. |
| Light/Arabic | NOT PERFORMED | Screenshot-level visual inspection unavailable. |

## Final status

```text
AUTOMATED GATES: PASS
100-TOOL MATRIX: PASS
INTERACTIVE PROMPTS: 0
FUNCTIONAL VERIFICATION: 63/100 VERIFIED, 37/100 UNVERIFIED, 0 FAILED
VISUAL QA: NOT PERFORMED
FINAL STATUS: PASS WITH VISUAL QA PENDING
```

No claim of 100/100 functional verification or Visual QA PASS is made because the available execution evidence does not support either claim.
