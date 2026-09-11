# Known Limitations — KNOUX Repair v2.0.2

This file describes the **current repository**, not only the original 100-tool console release baseline.

## Current product scope

The repository now contains 18 service categories and 158 registered tools/scripts, plus multiple product surfaces:

- PowerShell console (`Menu.ps1` / `START-KNOUX-REPAIR.cmd`),
- React + TypeScript web UI (KNOUX Repair),
- Electron desktop packaging,
- WPF/.NET desktop project,
- localhost execution bridge (`web-frontend/server/bridge.mjs`).

The historical v2.0.2 console acceptance documents remain useful evidence for the original 100-tool baseline, but they must not be read as a complete inventory of the expanded repository.

## Environment-specific behavior

- Windows behavior depends on the host's available CIM/WMI providers, Defender components, filesystem layout, installed services, and PowerShell version.
- Power plans may require `powercfg` fallbacks when `Win32_PowerPlan` is unavailable.
- Network and PnP inventory paths degrade gracefully where Windows CIM classes are unavailable, but evidence may be incomplete.
- Duplicate scanning is deliberately bounded to prevent pathological scans from consuming unbounded time or memory. A bounded scan may not discover every duplicate in extremely large profiles.
- SMART/drive telemetry is hardware- and vendor-dependent. Capacity evidence is more portable than low-level SMART details.

## Execution / privilege limits

- Admin-required tools cannot run through a non-elevated execution bridge. The bridge returns `ELEVATION_REQUIRED` before spawning PowerShell.
- The application does not bypass Windows UAC. Elevation must be granted through the normal Windows security boundary.
- `AnalyzeOnly` / `WhatIf` remain the preferred first pass where the selected tool supports them.
- Some repair operations depend on Windows services, DISM/SFC state, Windows Update availability, or a future reboot and therefore cannot be made deterministic by the application.

## UI / service maturity

The presence of a service card is not considered proof that the full workflow is complete. The current service inventory identifies these remaining product-depth gaps:

- **System Maintenance:** the first full diagnosis/repair workflow is implemented; deeper DISM-chain streaming remains an expansion area.
- **System Cleanup:** real preview/execution exists; post-clean reporting can be richer.
- **Network:** real diagnostics/execution exist; a dedicated repair-plan workspace remains incomplete.
- **Programs / Software:** real inventory exists; uninstall verification UX needs additional depth.
- **Storage:** capacity evidence exists; a SMART-first diagnostic workspace remains incomplete.
- **Security:** protection evidence and repair tools exist; a richer scan-results workspace remains incomplete.
- **Backup & Recovery:** restore-point/backup evidence exists; a complete end-user file-recovery workflow is still incomplete.
- **Driver Management:** inventory exists; update/rollback workflow depth remains incomplete.

See `Docs/SERVICE-INVENTORY.md` for the current per-service evidence matrix.

## Web / Electron runtime

- The supported web runtime is local-first. The application gateway and execution bridge bind to loopback (`127.0.0.1`) and are not intended to be exposed as public network services.
- `npm run dev` / `npm start` must use the real bridge. Fabricated Windows state or simulated tool success is not an accepted production path.
- Optional OAuth requires locally configured provider credentials. If no provider is configured, authentication can remain disabled for a purely local deployment.
- Electron's web surface is sandboxed and uses security headers, but it still executes powerful local repair operations through the separately validated bridge. Treat the installed application as privileged maintenance software, not a generic browser app.

## Testing limits

The GitHub Windows quality gate verifies dependency installation, production dependency audit, TypeScript, frontend tests, web build, .NET restore/build, bridge timeout handling, and the PowerShell functional suite.

Items that still require environment/manual validation include:

- visual/manual E2E interaction on representative Windows 10 and Windows 11 machines,
- full standard-user session behavior across every UI surface,
- fully offline behavior for tools that intentionally depend on network services,
- a real system rollback after a destructive repair,
- a real reboot-required workflow through completion,
- broad screen-reader/keyboard testing beyond static ARIA/semantic coverage,
- hardware-specific SMART/driver scenarios.

`Tests/Capture-VisualQa.ps1` can assist visual evidence capture, but automated CI is not a substitute for real-machine E2E acceptance of destructive maintenance flows.

## Data / reports

- Runtime evidence and reports can accumulate locally. Operators should apply an appropriate retention policy for `Reports`, logs, backups, and quarantine data.
- Reports may contain local machine paths, installed software names, device information, or diagnostic details. They should be treated as local operational data even when the application does not require cloud storage.

## Non-goals

- No arbitrary remote shell/API exposure.
- No silent UAC bypass or privilege escalation.
- No disk formatting / partition-management product scope.
- No claim that every hardware-vendor diagnostic signal is available on every Windows machine.
- No claim that historical 100-tool release evidence proves the newer 158-tool UI expansion by itself.
