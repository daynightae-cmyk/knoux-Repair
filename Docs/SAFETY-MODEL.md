# knoux Repair v2.0 — Safety Model

This document describes how knoux Repair keeps destructive operations contained and reversible across the PowerShell, Web/Electron, and desktop surfaces.

## 1. Risk levels

Every tool header declares exactly one risk level. The interfaces expose that risk before execution.

| Risk | Tag | Meaning | Example |
|------|-----|---------|---------|
| `READ_ONLY` | RO | Inspects only; performs no writes to user or system data | DR01 System Information, DF01 Analyze Duplicates |
| `SAFE_CLEANUP` | SC | Removes or disables junk/temp data; items are quarantined before removal | SC01 Clean User Temp, DF06 Remove Empty Folders |
| `SYSTEM_REPAIR` | SR | Repairs or reconfigures system state; may require elevation | SM01 Verify System Files, SP05 Reset Service Start Types |
| `DESTRUCTIVE` | DX | Deletes or replaces data in a way that is hard to reverse; always gated | SM09 Reset Windows Update |
| `REBOOT_REQUIRED` | RB | The effect is applied by Windows at next reboot (e.g. chkdsk) | SM07 Schedule Disk Check |
| `WINRE_ONLY` | WR | Must be executed from the Windows Recovery Environment | Environment-specific recovery tools |

## 2. Confirmation gates

- Every destructive operation is routed through an explicit confirmation gate before the underlying PowerShell action is allowed to proceed.
- Console tools use the typed confirmation contracts implemented by the shared safety module.
- The Web/Electron surface uses its execution confirmation dialog and still delegates the final operation to the registered PowerShell tool.
- `-AnalyzeOnly` and `-WhatIf` are preferred where supported and are designed to avoid system changes.

## 3. Quarantine

- File cleanup/removal paths use the project quarantine model before destructive deletion where the tool supports reversible quarantine.
- Restore metadata records the original path, timestamp, and tool evidence.
- Registry/state operations that cannot use file quarantine are backed up first where the tool contract declares a backup method.

## 4. Protected resources

- `Config\protected-paths.json` defines system locations that tools must not delete, rename, or overwrite through the shared safety layer.
- `Config\protected-processes.json` defines processes that must not be force-terminated through protected execution paths.
- Destructive path operations are validated before execution and the bridge does not expose an arbitrary-command endpoint.
- The execution bridge resolves tools from `Docs\TOOLS-MANIFEST.json` and `Config\menus.json`; the requested script must remain registered and inside the project root.

## 5. Reversibility options

| Action | Reversibility |
|--------|---------------|
| Quarantine move | Restorable to original path when the tool uses quarantine |
| Restore point (`New-KnouxRestorePoint`) | Optional/best-effort protection before repair |
| Backup folder (`New-KnouxBackup`) | State backups kept under the project/runtime data root |
| Registry export | Backup before supported registry removal/change paths |
| Rename-based reset | Original state can be retained instead of immediately destroyed where implemented |

## 6. What the tools will NOT do

- Execute arbitrary shell commands supplied by the browser; only registered tools are launchable through the bridge.
- Silently bypass Windows UAC.
- Force-run an admin-required tool from a non-elevated bridge.
- Format disks or modify partition tables as part of the supported product scope.
- Trust arbitrary duplicate-file plans: duplicate selections are bound to a current preview and validated before execution.
- Accept unrestricted filesystem targets: bridge options are normalized, bounded, and validated against each tool's supported parameter contract.

## 7. Administrator / UAC boundary

Elevation is an explicit operating-system security boundary, not an implicit product permission.

- Every registered tool exposes `RequiresAdmin` metadata.
- The console menu checks the current Windows token. If a selected tool requires elevation, the user is offered an explicit relaunch through `Start-Process ... -Verb RunAs`; Windows UAC remains the authority that grants or rejects elevation.
- The local execution bridge independently checks its own elevation state before launching a tool. If `RequiresAdmin` is true and the bridge is not elevated, execution is rejected with HTTP `403` / `ELEVATION_REQUIRED` before PowerShell starts.
- The bridge is bound to `127.0.0.1` only and does not listen on a LAN interface.
- Electron runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`. External navigation is denied in-app and opened through the operating system instead.

This design deliberately does **not** attempt privilege escalation. Admin execution requires an elevated process created through the normal Windows/UAC path.

## 8. Local authentication boundary

Authentication is optional for a local installation and controlled through `KNOUX_AUTH_REQUIRED`.

When enabled:

- supported OAuth providers are configured locally (GitHub OAuth and/or Microsoft Entra ID),
- OAuth state + PKCE are used for the authorization transaction,
- provider access tokens remain inside the local bridge process,
- the browser receives only an `HttpOnly`, `SameSite=Lax` loopback session cookie,
- the configured frontend callback origin must be an explicit `localhost` / `127.0.0.1` origin.

Authentication does not replace Windows authorization: an authenticated user still cannot execute an admin-required tool through a non-elevated bridge.
