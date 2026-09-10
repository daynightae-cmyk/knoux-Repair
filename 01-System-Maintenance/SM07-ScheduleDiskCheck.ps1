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

$Session = Start-KnouxSession -ToolId 'SM07' -ToolName 'Schedule Disk Check' -Category '01-System-Maintenance' -RiskLevel 'REBOOT_REQUIRED' -Mode $(if ($AnalyzeOnly) { 'analyze' } elseif ($WhatIf) { 'preview' } else { 'run' })
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
        # All native calls flow through Invoke-KnouxNativeCommand (captured
        # exit code, stdout/stderr, timeout). No raw string execution.
        $setExit = -1
        try {
            $setRun = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\fsutil.exe" -ArgumentList @('dirty', 'set', $drive) -TimeoutSeconds 60
            if ($setRun) {
                $setExit = $setRun.ExitCode
                $setRun.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'fsutil-dirty-set-output.txt') -Encoding UTF8
                Write-KnouxLog -Session $Session ("fsutil dirty set exit {0}" -f $setExit)
            }
        } catch {
            Write-Warning "fsutil dirty set failed: $($_.Exception.Message)"
            Write-KnouxLog -Session $Session -Message ("fsutil dirty set failed: " + $_.Exception.Message) 'WARN'
        }
        $queryExit = -1
        try {
            $queryRun = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\fsutil.exe" -ArgumentList @('dirty', 'query', $drive) -TimeoutSeconds 60
            if ($queryRun) {
                $queryExit = $queryRun.ExitCode
                $queryRun.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'fsutil-dirty-query-output.txt') -Encoding UTF8
                Write-KnouxLog -Session $Session ("fsutil dirty query exit {0}" -f $queryExit)
            }
        } catch {
            Write-Warning "fsutil dirty query failed: $($_.Exception.Message)"
            Write-KnouxLog -Session $Session -Message ("fsutil dirty query failed: " + $_.Exception.Message) 'WARN'
        }
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