# Restore Guide (English)

How to recover anything a knoux Repair tool may have removed or changed.

## 1. Before you start

- Run tools in **Analyze-only** mode first (`A` in the menu, or `-AnalyzeOnly` on the command line).
- On the real machine, run from an account with Administrator rights and accept the
  "create a restore point" prompt when a destructive tool offers it.

## 2. Restoring quarantined files

Every removed file is moved to `Quarantine\<session>-<timestamp>\` and never hard-deleted.

1. Open the `Quarantine\` folder next to the project.
2. Find the folder whose timestamp matches the run (the tool prints the quarantine path at the end).
3. Restore a single item:
   ```powershell
   Import-Module ".\Core\KnouxRepair.Core.psm1" -Force
   Restore-KnouxQuarantinedItem -QuarantinePath "Quarantine\20260803-101500-SC01" -Name "filename.ext"
   ```
4. Or copy files back manually from the quarantine folder to their original location
   (the original path is recorded in `restore-info.json` inside the quarantine folder).

## 3. Windows system restore

If a system-level repair caused problems:

1. Open **Control Panel > Recovery > Open System Restore**.
2. Choose the restore point created before the run.
3. Follow the wizard and reboot.

## 4. Windows Update folders (SM06)

SM06 renames (never deletes) `SoftwareDistribution` and `catroot2`:

1. Open `C:\Windows\SoftwareDistribution.old-<timestamp>\` and
   `C:\Windows\System32\catroot2.old-<timestamp>\`.
2. To revert, stop the Update services, rename the folders back, and restart the services.

## 5. Registry removals (SP09 and similar)

SP09 exports the affected registry keys to `Backups\` before removing values.
To restore:

1. Open `Backups\` and find the exported `.reg` file.
2. Double-click it (or run `reg import file.reg`) and confirm the import.
3. Reboot.

## 6. Reset Windows Update (SM06)

If `Windows Update` still misbehaves after SM06:

```powershell
net stop wuauserv
net stop cryptSvc
net stop bits
ren C:\Windows\SoftwareDistribution SoftwareDistribution.old
ren C:\Windows\System32\catroot2 catroot2.old
net start wuauserv
net start cryptSvc
net start bits
```

## 7. If a restore is impossible

- Re-run the tool with `-WhatIf` to confirm exactly what it would do before accepting.
- Use Windows **File History** or your own backup for user data.
- For system files, run `DISM /Online /Cleanup-Image /RestoreHealth` and `sfc /scannow`.
