#Requires -Version 5.1
#  knoux Repair v2.0 | 07-Services-Processes | SP03 - Restart Explorer
#  Risk: SYSTEM_REPAIR | Offline: Yes
#  Restarts Windows Explorer (shell) to clear UI glitches and memory.
#  Safe: explorer.exe is excluded from the protected-process kill list.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP03' -ToolName 'Restart Explorer' -Category '07-Services-Processes' -RiskLevel 'SYSTEM_REPAIR'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would restart explorer.exe (shell).' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would restart Explorer'
} else {
    Write-Host '[ACTION] Restarts Windows Explorer. Your taskbar will blink.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Restart Explorer now?') {
        $null = Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        if (-not (Get-Process -Name explorer -ErrorAction SilentlyContinue)) {
            $null = Start-Process explorer.exe
            Start-Sleep -Seconds 2
        }
        $running = [bool](Get-Process -Name explorer -ErrorAction SilentlyContinue)
        if ($running) {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = 1
            Write-Host '[OK] Explorer restarted.' -ForegroundColor Green
            Write-KnouxLog -Session $Session 'Explorer restarted'
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'Explorer did not restart.'
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
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
