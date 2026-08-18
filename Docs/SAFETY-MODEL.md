# knoux Repair v2.0 — Safety Model

This document describes how knoux Repair keeps destructive operations contained and reversible.

## 1. Risk levels

Every tool header declares exactly one risk level. The menu displays the short tag.

| Risk | Tag | Meaning | Example |
|------|-----|---------|---------|
| `READ_ONLY` | RO | Inspects only; performs no writes to user or system data | DR01 System Information, DF01 Analyze Duplicates |
| `SAFE_CLEANUP` | SC | Removes or disables junk/temp data; items are quarantined before removal | SC01 Clean User Temp, DF06 Remove Empty Folders |
| `SYSTEM_REPAIR` | SR | Repairs or reconfigures system state; may require elevation | SM01 Verify System Files, SP05 Reset Service Start Types |
| `DESTRUCTIVE` | DX | Deletes or replaces data in a way that is hard to reverse; always gated | SM06 Reset Windows Update, SE06 Disable Firewall |
| `REBOOT_REQUIRED` | RB | The effect is applied by Windows at next reboot (e.g. chkdsk) | SM04 Check Disk |
| `WINRE_ONLY` | WR | Must be executed from the Windows Recovery Environment | SM05 Repair Boot Options |

## 2. Confirmation gates

- Every `DESTRUCTIVE` tool calls `Confirm-KnouxDestructiveAction`, which requires the user to
  type an exact phrase (e.g. `RESET UPDATE`, `EMPTY BIN`, `RUN CLEANUP`, `DISABLE FIREWALL`).
- Typing anything else aborts the operation before any change is made.
- `-AnalyzeOnly` and `-WhatIf` skip the confirmation gate entirely and change nothing.

## 3. Quarantine

- Any file that a cleanup tool removes is first moved to
  `Quarantine\<session>-<timestamp>\` via `Move-KnouxItemToQuarantine`.
- Restore metadata (original path, timestamp, tool) is recorded inside the quarantine folder
  as `restore-info.json`; `Restore-KnouxQuarantinedItem` restores the file to its original path.
- The whole project tree is never quarantined as a single key — registry removals that are not
  reversible are backed up first with `reg.exe export`.

## 4. Protected resources

- `Config\protected-paths.json` — system paths that no tool may delete, rename, or overwrite
  (e.g. `C:\Windows\System32\Config`, `C:\Windows\WinSxS`, `C:\Windows\Prefetch`, `C:\Windows\Boot`).
  All destructive path operations are checked against this list via `Test-KnouxProtectedPath`.
- `Config\protected-processes.json` — processes that must never be force-terminated
  (e.g. `csrss`, `lsass`, `winlogon`, `system`, `svchost`). `Test-KnouxProtectedProcess`
  guards `Stop-Process` paths.
- Prefetch is never deleted. Windows Update folders (`SoftwareDistribution`,
  `System32\catroot2`) are renamed (never deleted) in SM06.

## 5. Reversibility options

| Action | Reversibility |
|--------|---------------|
| Quarantine move | Restorable to original path |
| Restore point (`New-KnouxRestorePoint`) | Optional; recommended before destructive tools |
| Backup folder (`New-KnouxBackup`) | Registry/state backups kept in `Backups\` |
| `reg.exe export` | Full key backup before `Remove-ItemProperty` |
| Rename (SM06) | Original folders are renamed with a timestamp, not removed |

## 6. What the tools will NOT do

- Delete or modify files inside `C:\Windows` protected paths.
- Force-terminate protected system processes.
- Disable the firewall or Defender without a typed confirmation.
- Touch a user profile beyond a bounded scan budget (`Get-KnouxScanFiles` caps at
  `defaultMaxFiles` = 20,000 files and skips reparse points / offline files).
- Format disks or modify partition tables.
