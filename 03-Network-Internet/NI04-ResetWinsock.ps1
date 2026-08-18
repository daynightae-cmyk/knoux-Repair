#Requires -Version 5.1
#  knoux Repair v2.0.2 | 03-Network-Internet | NI04 - Reset Winsock
#  Risk: SYSTEM_REPAIR | Offline: Yes | Admin: Required
#  netsh winsock reset. A restart is required afterwards.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI04' -ToolName 'Reset Winsock' -Category '03-Network-Internet' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required for netsh winsock reset.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: netsh winsock reset (reinitializes Winsock catalog).' -ForegroundColor Green
    Write-Host '[ANALYZE] A restart is required afterwards. No changes in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would reset Winsock'
} else {
    Write-Host '[ACTION] This reinitializes the Winsock catalog.' -ForegroundColor Yellow
    Write-Host '[WARN] A restart is required for the change to take effect.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Reset Winsock now?') {
        $null = New-KnouxRestorePoint -Description 'Knoux Repair NI04 before Winsock reset'
        $r = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\netsh.exe" -ArgumentList @('winsock', 'reset') -TimeoutSeconds 120
        if ($r) {
            $rc = $r.ExitCode
            $r.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'netsh-winsock-reset.txt') -Encoding UTF8
            Write-KnouxLog -Session $Session ("netsh winsock reset exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            if ($r.Success) {
                $Session.Status = 'Warning'
                $Session.RestartNeeded = $true
                $Session.ChangedSystem = $true
                Write-Host '[OK] Winsock reset completed. Please restart the PC.' -ForegroundColor Green
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = "netsh exited with code $rc."
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
            }
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'netsh could not be started.'
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
