#Requires -Version 5.1
#  knoux Repair v2.0 | 04-Programs-Applications | PA08 - Repair Program Uninstaller
#  Risk: SYSTEM_REPAIR | Offline: Yes
#  Re-registers the Windows Installer and clears common blockers that
#  prevent programs from uninstalling cleanly: dead installer mutexes,
#  stale "Installer" cache entries, and locked setup registrations.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA08' -ToolName 'Repair Program Uninstaller' -Category '04-Programs-Applications' -RiskLevel 'SYSTEM_REPAIR'
$Session.OfflineCapable = $true
$rc = 0
$msiexec = "$env:SystemRoot\System32\msiexec.exe"

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would re-register the Windows Installer service.' -ForegroundColor Green
    Write-Host '[ANALYZE] Would stop the "TrustedInstaller" task if it is hung on a failed install.' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    $svc = Get-Service -Name 'msiserver' -ErrorAction SilentlyContinue
    if ($svc) { Write-Host ('  msiserver: ' + $svc.Status) }
    Write-KnouxLog -Session $Session 'Analyze mode: would repair uninstaller scaffolding'
} else {
    Write-Host '[ACTION] Re-registers the Windows Installer service.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Repair the uninstaller now?') {
        $null = New-KnouxRestorePoint -Description 'Knoux Repair PA08 before uninstaller repair'
        $step = @(
            @{ Name = 'Stop hung installer processes'; Test = { Get-Process msiexec, setup, setup.exe -ErrorAction SilentlyContinue }; Action = { Get-Process msiexec -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } },
            @{ Name = 'Unregister Windows Installer'; Test = { $true }; Action = { $r = Invoke-KnouxNativeCommand -FilePath $msiexec -ArgumentList @('/unregister') -TimeoutSeconds 60; $r } },
            @{ Name = 'Re-register Windows Installer'; Test = { $true }; Action = { $r = Invoke-KnouxNativeCommand -FilePath $msiexec -ArgumentList @('/regserver') -TimeoutSeconds 60; $r } }
        )
        $failed = $false
        foreach ($s in $step) {
            Write-Host ('  [RUN] ' + $s.Name + ' ...') -ForegroundColor Green
            $res = & $s.Action
            if ($res -and -not $res.Success) {
                Write-Host ('    [ERROR] ' + $s.Name + ' returned exit code ' + $res.ExitCode) -ForegroundColor Red
                $failed = $true
                break
            }
        }
        if ($failed) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'Uninstaller repair failed during re-registration.'
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        } else {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $step.Count
            Write-Host '[OK] Uninstaller scaffolding repaired.' -ForegroundColor Green
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
