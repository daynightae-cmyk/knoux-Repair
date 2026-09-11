# KNOUX Repair v2.0.2

Local-first Windows diagnostics, repair, cleanup, recovery, security, performance, developer, and project-analysis workstation.

The current repository is an expanded product, not only the original console package. It contains **18 service categories / 158 registered tools and scripts** with shared safety, reporting, and execution infrastructure.

## Product surfaces

- **KNOUX Repair Web UI** — React 18 + TypeScript + Vite.
- **Electron Desktop** — sandboxed desktop shell.
- **Windows Desktop** — native Windows desktop workstation powered by Electron and a hardened local PowerShell execution bridge.
- **PowerShell Console** — `Menu.ps1` + `START-KNOUX-REPAIR.cmd`.
- **Local Execution Bridge** — `web-frontend/server/bridge.mjs`, bound to `127.0.0.1`, executes only registered KNOUX tools.

The historical 100-tool v2.0.2 release evidence remains in `Docs/`, but the authoritative current service map is `Docs/SERVICE-INVENTORY.md`.

## Current service map

1. System Maintenance
2. System Cleanup
3. Network & Internet
4. Programs & Applications
5. Duplicate Files
6. Disk Space
7. Services & Processes
8. Performance
9. Security
10. Diagnostics & Reports
11. Backup & Recovery
12. Developer Tools
13. Privacy
14. Driver Management
15. System Monitoring
16. Software Environment
17. Post-Install Setup
18. Project Sonar

## Safety model

Every registered tool carries risk and capability metadata. The product uses:

- `READ_ONLY`, `SAFE_CLEANUP`, `SYSTEM_REPAIR`, `DESTRUCTIVE`, `REBOOT_REQUIRED`, and recovery-specific risk classes,
- explicit confirmation before destructive execution,
- quarantine / backup / restore evidence where supported,
- protected path and protected process policies,
- registered-tool allowlisting in the bridge,
- bounded scan/input validation,
- an explicit Windows UAC boundary.

Admin-required tools are rejected by a non-elevated bridge with `403 / ELEVATION_REQUIRED`; KNOUX Repair does not bypass UAC.

See `Docs/SAFETY-MODEL.md`.

## Local web development

From the repository root:

```powershell
npm --prefix web-frontend ci
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

The local web gateway starts/reuses the **real** localhost execution bridge and proxies `/api` to it. It does not provide fabricated Windows state or simulated tool success.

For admin-required repair tools, launch the terminal/process through the normal Windows **Run as administrator** / UAC flow.

## Web verification

```powershell
npm --prefix web-frontend run typecheck
npm --prefix web-frontend test
npm --prefix web-frontend run build
```

Production dependency audit:

```powershell
npm --prefix web-frontend audit --omit=dev --audit-level=high
```

## Electron desktop

```powershell
npm --prefix web-frontend run desktop:dev
```

Package the desktop application:

```powershell
npm --prefix web-frontend run desktop:package
```

Electron uses `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, loopback-only local serving, navigation restrictions, and response security headers.

## PowerShell console

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Menu.ps1"
```

Or use `START-KNOUX-REPAIR.cmd`.

Tools that support analysis can also be invoked directly with `-AnalyzeOnly` / `-WhatIf`.

Reports are written under runtime report directories and typically include structured `results.json` plus human-readable/log evidence.

## Tests and CI

GitHub Actions runs the Windows quality gate on pushes and pull requests to `main`:

- `npm ci`
- production dependency audit
- TypeScript validation
- frontend tests
- web build
- .NET restore/build
- isolated bridge timeout verification
- PowerShell desktop functional suite

Manual/real-machine validation is still required for destructive E2E workflows, reboot flows, rollback, hardware-specific telemetry, and broad accessibility testing. See `Docs/KNOWN-LIMITATIONS.md`.

## Authentication

Authentication is optional for a local installation. When `KNOUX_AUTH_REQUIRED=true`, the local bridge supports configured GitHub OAuth and/or Microsoft Entra ID providers using state + PKCE. Provider access tokens remain in the bridge process; the browser receives an `HttpOnly`, `SameSite=Lax` loopback session cookie.

Configuration examples are in `.env.example`, `web-frontend/.env.example`, and `Docs/LOCAL-OAUTH-SETUP.md`.

## Source of truth

Use these files for current decisions:

- `Docs/SERVICE-INVENTORY.md` — current service/tool/UI maturity matrix.
- `Docs/SAFETY-MODEL.md` — execution, UAC, authentication, quarantine, and protection boundaries.
- `Docs/KNOWN-LIMITATIONS.md` — current product limitations and manual acceptance boundaries.
- `Docs/TOOLS-MANIFEST.json` + `Config/menus.json` — registered execution inventory.
- `.github/workflows/ci.yml` — automated release/quality gate.

Historical acceptance documents that refer to 100 tools describe the earlier console baseline and are retained as release evidence, not as the complete current product inventory.
