#Requires -Version 5.1
#  knoux Repair v2.0.2 | 09-Security | SE02 - Enable Real-time Protection
#  Risk: SYSTEM_REPAIR | Requires admin
#  Enables Windows Defender real-time protection and restores its
#  service startup if it was disabled.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE02' -ToolName 'Enable Real-time Protection' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    try {
        $svc = Get-Service -Name 'WinDefend' -ErrorAction SilentlyContinue
        if ($svc -and $svc.StartType -eq 'Disabled') {
            if ($AnalyzeOnly -or $WhatIf) {
                Write-Host '[ANALYZE] WinDefend service is disabled; would re-enable it.' -ForegroundColor Green
            } else {
                Set-Service -Name 'WinDefend' -StartupType Automatic -ErrorAction Stop
                Start-Service -Name 'WinDefend' -ErrorAction SilentlyContinue
                Write-Host '[OK] WinDefend service re-enabled.' -ForegroundColor Green
            }
        }
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] Would enable real-time protection.' -ForegroundColor Green
            Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session 'Analyze: would enable real-time protection'
        } else {
            Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue
            $null = Start-MpWDOScan -ScanType QuickScan -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
            $mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
            if ($mp -and $mp.RealTimeProtectionEnabled) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = 1
                Write-Host '[OK] Real-time protection enabled.' -ForegroundColor Green
                Write-KnouxLog -Session $Session 'Real-time protection enabled'
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'Real-time protection could not be confirmed as enabled.'
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
            }
        }
    } catch {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = $_.Exception.Message
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
