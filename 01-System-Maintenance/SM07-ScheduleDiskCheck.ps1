#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM07 - Schedule Disk Check
#  Risk: REBOOT_REQUIRED | Offline: Yes | Admin: Required
#  Marks the system volume dirty so autochk runs a full chkdsk
#  (/f /r) at the next boot, then verifies the volume is dirty.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM07' -ToolName 'Schedule Disk Check' -Category '01-System-Maintenance' -RiskLevel 'REBOOT_REQUIRED'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to schedule chkdsk.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would mark the system volume dirty so a full chkdsk (/f /r) runs at the next boot.' -ForegroundColor Green
    Write-Host '[ANALYZE] Requires a restart to take effect.' -ForegroundColor Yellow
    Write-KnouxLog -Session $Session 'Analyze mode: would schedule chkdsk at next boot'
} else {
    Write-Host '[ACTION] Schedules a full disk check at the next restart.' -ForegroundColor Yellow
    Write-Host ('[NOTE] A restart is required for chkdsk to run. Save your work first.') -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with scheduling the disk check?') {
        $drive = $env:SystemDrive.TrimEnd('\') + '\'
        $setExit = -1
        try {
            & "$env:SystemRoot\System32\fsutil.exe" dirty set $drive 2>&1 | Out-Null
            $setExit = $LASTEXITCODE
        } catch {
            Write-Warning "fsutil dirty set failed: $($_.Exception.Message)"
        }
        & "$env:SystemRoot\System32\fsutil.exe" dirty query $drive 2>$null | Out-Null
        $queryExit = $LASTEXITCODE
        $Session.VerificationPerformed = $true
        if ($setExit -eq 0 -and $queryExit -eq 0) {
            $Session.Status = 'Warning'
            $Session.VerificationResult = 'SCHEDULED'
            $Session.RestartNeeded = $true
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = 1
            Write-Host ('[OK] Disk check scheduled for next boot on ' + $drive) -ForegroundColor Green
            Write-Host '[WARN] Restart now (or later) for chkdsk to run.' -ForegroundColor Yellow
            Write-KnouxLog -Session $Session "Disk check scheduled on $drive (fsutil dirty set, verified dirty)"
        } else {
            $Session.Status = 'Failed'
            $Session.VerificationResult = 'FAILED'
            $Session.ErrorMessage = "Could not verify the volume is marked dirty on $drive."
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
            Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
        }
    } else {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result