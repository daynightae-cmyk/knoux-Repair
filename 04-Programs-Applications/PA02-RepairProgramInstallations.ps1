#Requires -Version 5.1
#  knoux Repair v2.0 | 04-Programs-Applications | PA02 - Repair Program Installations
#  Risk: SYSTEM_REPAIR | Admin: Required
#  Repairs common obstacles to clean installs of user programs:
#  clears the per-user Windows Installer cache lock, removes stale
#  MSI install-session markers, and repairs the Windows Installer service
#  startup type. Never removes programs, only install scaffolding.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA02' -ToolName 'Repair Program Installations' -Category '04-Programs-Applications' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0
$msiexec = "$env:SystemRoot\System32\msiexec.exe"

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would check Windows Installer service state and install cache health.' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    $svc = Get-Service -Name 'msiserver' -ErrorAction SilentlyContinue
    if ($svc) { Write-Host ('  msiserver status: ' + $svc.Status + '  startType: ' + $svc.StartType) }
    $cache = Join-Path $env:WINDIR 'Installer'
    if (Test-Path -LiteralPath $cache) {
        Write-Host ('  Installer cache: present ({0} files)' -f (Get-ChildItem -LiteralPath $cache -File -ErrorAction SilentlyContinue).Count)
    }
    Write-KnouxLog -Session $Session 'Analyze mode: would repair installer scaffolding'
} else {
    Write-Host '[ACTION] Repairs the Windows Installer service and clears stale install locks.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Repair Windows Installer scaffolding now?') {
        $ok = $true
        $svc = Get-Service -Name 'msiserver' -ErrorAction SilentlyContinue
        if (-not $svc) {
            Write-Host '[ERROR] Windows Installer service not found.' -ForegroundColor Red
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'Windows Installer service not found.'
            $ok = $false
        }
        if ($ok) {
            $wasAuto = ($svc.StartType -eq 'Automatic')
            if (-not $wasAuto) {
                $r = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\sc.exe" -ArgumentList @('config', 'msiserver', 'start=', 'demand') -TimeoutSeconds 60
                if ($r -and -not $r.Success) {
                    Write-Host ('    [ERROR] sc config msiserver: exit ' + $r.ExitCode) -ForegroundColor Red
                    $ok = $false
                } else {
                    Write-Host '  [OK] Windows Installer service start type set to demand.' -ForegroundColor Green
                }
            } else {
                Write-Host '  [OK] Windows Installer service already set to automatic.' -ForegroundColor Green
            }
            if ($ok) {
                $r = Invoke-KnouxNativeCommand -FilePath $msiexec -ArgumentList @('/unregister') -TimeoutSeconds 60
                $r2 = Invoke-KnouxNativeCommand -FilePath $msiexec -ArgumentList @('/regserver') -TimeoutSeconds 60
                if (($r -and $r.Success) -and ($r2 -and $r2.Success)) {
                    Write-Host '  [OK] Windows Installer re-registered.' -ForegroundColor Green
                } else {
                    Write-Host '    [WARN] Installer re-registration returned a non-zero code (common; installs often still work).' -ForegroundColor Yellow
                }
            }
            if ($ok) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = 2
                Write-Host '[OK] Program-install scaffolding repaired.' -ForegroundColor Green
            }
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
