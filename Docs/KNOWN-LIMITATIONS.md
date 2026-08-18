# Known Limitations — knoux Repair v2.0

## Environment-specific behavior (validated on Windows 10 Pro 19045)

- **Power plans** are enumerated through `powercfg /list` + `/getactivescheme` (GUID/name regex).
  The CIM class `Win32_PowerPlan` returns nothing on some Windows 10 machines.
- **Firewall state** is read with `netsh advfirewall show allprofiles state`. Firewall tools
  are **enable-only**: `Set-KnouxFirewallState` only ever runs `netsh advfirewall set
  allprofiles state on` and verifies the result. The `state off` variant and the
  `Get/Set-NetFirewallProfile` cmdlets (which throw "Invalid class" on some machines) are
  never used; there is no firewall-disable tool.
- **Driver status** (`DR05`/`DR08`) reads `Win32_PnPSignedDriver.DeviceName` (the `Name` property
  is empty on this machine) and `Win32_PnPEntity.ConfigManagerErrorCode`. On systems where
  `Win32_PnPEntity` is empty, the problem-driver count reports 0.
- **Duplicate scanning** is bounded on purpose (`defaultMaxFiles` = 20,000 files, skip reparse
  points/offline files, `HashByteBudget` = 500 MB default) so scans terminate quickly on
  pathological profiles (e.g. 443k files / 38 GB with OneDrive reparse). Deep scans of such
  profiles will not find every duplicate — increase the budget if you need a fuller scan.

## Tool execution status (validated 2026-08-04)

All 100 tools were behaviorally executed in this environment (Windows 10 Pro 19045,
non-elevated) and are marked `TestResult = PASS` in the manifest:

- 77 tools were executed by the v2.0.1 suite + analyze-only smoke validation.
- The 23 tools NOT_TESTED in v2.0.1 (SM01-SM09, DS06, DS09, NI01-NI05, NI08-NI10, PA02,
  SC04, SC06, SC07) were executed via a dedicated v2.0.2 harness using the exact menu
  invocation path (child `pwsh`, `$ErrorActionPreference='Stop'`, Core imported, `&`
  invocation); each report's `ExitCode` was asserted to match its `Status`.
- NI01/NI10 use CIM classes (`Get-NetAdapter`, `Get-NetIPConfiguration`) that throw
  `Invalid class` on some machines. Both were fixed to degrade gracefully — NI01 reads the
  gateway via `ipconfig.exe` (with `Get-NetRoute` fallback) and DNS via `nslookup.exe`
  fallback; NI10 reports `Warning` + "incomplete" when CIM data is unavailable. Both have
  permanent regression tests (82/83).

Environment-only items that remain NOT TESTED (not release blockers) and must be validated on
the target environment:

- **Windows 11** — all tools are `#Requires -Version 5.1` PowerShell; Windows 11 behavior is
  untested beyond this build machine.
- **PowerShell 7 (pwsh)** — validated on pwsh 7.6.3 (83/83); newer 7.x releases are untested
  beyond that.
- **Standard (non-admin) user** — admin-requiring tools show an explicit failure path, but a
  full standard-user session has not been exercised.
- **Fully offline machine** — online-dependent paths (signature update SE10, program updates
  PA09, network tests NI01/NI06, update download cache SC06) are untested offline.
- **Real rollback** — creating a restore point (`New-KnouxRestorePoint`) is best-effort;
  an actual system restore after a real repair run was not performed.
- **Live quarantine restore through the menu** — `Restore-KnouxQuarantinedItem` is covered by
  automated SHA-256 round-trip tests, but no manual menu-driven restore was performed.
- **SM09 Windows Update service restore on a real system** — start-mode and running-state
  restore logic is statically verified and unit-tested via the suite, but a real reset run was
  not executed (it requires admin and stops WU services).

## Behavioral limits

- **Analyze-only mode** is the default recommendation; some data (e.g. SMART attributes) is
  vendor-specific and may be missing on certain SSDs.
- **Schedule Disk Check (SM07)** schedules `chkdsk` for the next reboot; it does not reboot for
  you, and it is the only `REBOOT_REQUIRED` tool in the suite.
- **System Image Repair (SM05)** repairs with a local `DISM` source first (`/LimitAccess`)
  and falls back to Windows Update only when no local source is available; it cannot run
  inside the Windows Recovery Environment in this build.
- **Defender/AV scan (SE08)** duration depends on the profile; the `-Quick` switch performs a
  quick scan. Full scans may take a long time.
- **Reports** accumulate in `Reports\`; `reportsKeepDays` (30) is a setting — automatic pruning
  is not implemented, remove old folders manually if disk matters.

## Non-goals (by design)

- No online/cloud functionality — everything runs offline.
- No GUI beyond the console menu (`Menu.ps1`).
- The product does not modify partition tables or format drives.
- The superseded 1.x `Scripts\` tree is not part of the product and is not validated by the
  test suite.

