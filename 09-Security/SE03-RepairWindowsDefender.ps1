#Requires -Version 5.1
#  knoux Repair v2.0.2 | 09-Security | SE03 - Repair Windows Defender
#  Risk: SYSTEM_REPAIR | Requires admin
#  Repairs Microsoft Defender without ever stopping or disabling it:
#  ensures the WinDefend service is set to Automatic and running,
#  re-enables real-time protection, and refreshes signatures.
#  The Defender service is never stopped or disabled.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE03' -ToolName 'Repair Windows Defender' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
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
        $rt = $null
        try { $rt = (Get-MpComputerStatus -ErrorAction SilentlyContinue).RealTimeProtectionEnabled } catch { $rt = $null }
        if (-not $svc) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'Windows Defender service not found.'
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        } else {
            Write-Host ('WinDefend service: {0} (startup {1})' -f $svc.Status, $svc.StartType)
            Write-Host ('Real-time protection: {0}' -f $(if ($rt) { 'ON' } else { 'OFF / unknown' }))

            if ($AnalyzeOnly -or $WhatIf) {
                Write-Host '[ANALYZE] Would ensure WinDefend runs (Automatic), re-enable real-time protection, and update signatures.' -ForegroundColor Green
                Write-Host '[ANALYZE] The Defender service is never stopped or disabled.' -ForegroundColor Green
                Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
                $Session.Status = 'Success'
                Write-KnouxLog -Session $Session 'Analyze: would repair Windows Defender'
            } else {
                Write-Host '[ACTION] Repairs Defender: service running, real-time protection ON, signatures updated.' -ForegroundColor Yellow
                if (Confirm-KnouxAction 'Proceed with Defender repair?') {
                    if ($svc.StartType -ne 'Automatic') { Set-Service -Name 'WinDefend' -StartupType Automatic -ErrorAction SilentlyContinue }
                    if ($svc.Status -ne 'Running') { Start-Service -Name 'WinDefend' -ErrorAction SilentlyContinue }
                    try { Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction Stop } catch { Write-Warning ("Set-MpPreference failed: {0}" -f $_.Exception.Message) }
                    $null = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Arguments @('-NoProfile', '-Command', 'Update-MpSignature') -TimeoutSeconds 300

                    $svcAfter = Get-Service -Name 'WinDefend' -ErrorAction SilentlyContinue
                    $rtAfter = $null
                    try { $rtAfter = (Get-MpComputerStatus -ErrorAction SilentlyContinue).RealTimeProtectionEnabled } catch { $rtAfter = $null }
                    if ($svcAfter -and $svcAfter.Status -eq 'Running' -and $rtAfter -eq $true) {
                        $Session.Status = 'Success'
                        $Session.ChangedSystem = $true
                        $Session.ItemsProcessed = 1
                        Write-Host '[OK] Windows Defender running with real-time protection ON.' -ForegroundColor Green
                        Write-KnouxLog -Session $Session 'Windows Defender repaired and verified (running, real-time ON)'
                    } else {
                        $Session.Status = 'Warning'
                        $Session.ErrorMessage = 'Defender is running but real-time protection could not be verified.'
                        Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                        Write-KnouxLog -Session $Session $Session.ErrorMessage 'WARN'
                    }
                } else {
                    $Session.Status = 'Cancelled'
                    Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
                }
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
