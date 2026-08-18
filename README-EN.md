# knoux Repair v2.0

Offline Windows maintenance suite — 10 categories x 10 tools = **100 tools**, a shared
PowerShell Core, a risk-gated safety model, and machine-readable reports.

| | |
|---|---|
| Version | 2.0.2 |
| Platform | Windows 10 / 11, PowerShell 5.1+ (Windows PowerShell) |
| Language | English (interface) with dual-language reports (EN + AR) |
| License | Private / internal use |

## What's inside

- **100 tools** in 10 categories: System Maintenance, System Cleanup, Network & Internet,
  Programs & Applications, Duplicate Files, Disk Space, Services & Processes, Performance,
  Security, Diagnostics & Reports.
- **Core modules** (`Core\`): logging, reporting, safety gates, native-command invocation,
  quarantine, restore points, backups, duplicate scanning.
- **Config** (`Config\`): menu manifest, settings, protected paths, protected processes.
- **Menu** (`Menu.ps1`) + launcher (`START-KNOUX-REPAIR.cmd`).
- **Tests** (`Tests\`): 51 automated checks (see `Docs\TEST-RESULTS.md`).
- **Docs** (`Docs\`): tool manifest (CSV/JSON), safety model, restore guides, audit reports, known limitations.

## Quick start

1. Right-click `START-KNOUX-REPAIR.cmd` and choose **Run as administrator**.
2. Pick a category, then a tool. Each tool can run in:
   - **Normal** mode — performs the action.
   - **Analyze-only** mode — inspects and reports, changes nothing (toggle `A` in the menu).
3. Reports are written to `Reports\<timestamp>-<ToolId>\`:
   `summary-en.txt`, `summary-ar.txt`, `results.json`, `results.csv`, `operation.log`, `errors.log`.

Every tool also accepts `-AnalyzeOnly` and `-WhatIf` directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\09-Security\SE01-SecurityAudit.ps1" -AnalyzeOnly
```

## Safety model (summary)

Each tool carries one risk level, shown in the menu:

| Tag | Risk | Meaning |
|-----|------|---------|
| RO | READ_ONLY | Inspects only; never changes anything |
| SC | SAFE_CLEANUP | Removes/disables junk; items go through quarantine first |
| SR | SYSTEM_REPAIR | Repairs system state; may need admin |
| DX | DESTRUCTIVE | Deletes/replaces system data; requires a typed confirmation phrase |
| RB | REBOOT_REQUIRED | Effect takes place on reboot (e.g. Check Disk) |
| WR | WINRE_ONLY | Must run from Windows Recovery Environment |

Destructive operations:
- require typing an exact confirmation phrase,
- back up items to `Quarantine\` before removal (restore metadata preserved),
- optionally create a restore point first,
- never touch protected system paths or processes.

See `Docs\SAFETY-MODEL.md` for details.

## Running the tests

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Tests\Run-Tests.ps1"
```

Exit code 0 = all 83 tests pass (Windows PowerShell 5.1 and pwsh). Results are written to `Tests\TEST-RESULTS.txt`.

## Tool manifest

`Docs\TOOLS-MANIFEST.csv` / `Docs\TOOLS-MANIFEST.json` describe all 100 tools with a
15-field schema (ToolId, Category, ScriptPath, EnglishName, ArabicName, Purpose, RiskLevel,
RequiresAdmin, RequiresRestart, OfflineCapability, BackupMethod, RollbackMethod,
AnalyzeOnlySupported, WhatIfSupported, TestResult). The JSON is the canonical machine-readable
form; `Docs\FILE-INVENTORY.json` lists the exact package contents.

## Packaging notes

The shipped ZIP excludes runtime data (`Reports\`, `Logs\`, `Quarantine\`, `Backups\`),
the superseded 1.x `Scripts\` tree, and the legacy 1.x launcher/manifest
(`KnouxRepair-Launcher.ps1`, `KnouxRepair.Manifest.json`). Arabic restore guide:
`Docs\RESTORE-GUIDE-AR.md`.
