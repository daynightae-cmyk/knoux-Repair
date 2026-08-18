#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI09 - Optimize TCP/IP Settings
#  Risk: SYSTEM_REPAIR | Offline: Yes | Admin: Required
#  Restores sane TCP auto-tuning and congestion defaults. Saves
#  the previous values for rollback.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI09' -ToolName 'Optimize TCP/IP Settings' -Category '03-Network-Internet' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0
$netsh = "$env:SystemRoot\System32\netsh.exe"

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would read and show current TCP global settings.' -ForegroundColor Green
    Write-Host '[ANALYZE] Would restore: autotuninglevel=normal, congestion=default, ecncapability=enabled.' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    $q = Invoke-KnouxNativeCommand -FilePath $netsh -ArgumentList @('int', 'tcp', 'show', 'global') -TimeoutSeconds 60
    if ($q) { Write-Host $q.Stdout }
    Write-KnouxLog -Session $Session 'Analyze mode: would show TCP global settings'
} else {
    Write-Host '[ACTION] Applies safe, standard TCP/IP optimization values.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Apply TCP/IP optimization now?') {
        $null = New-KnouxRestorePoint -Description 'Knoux Repair NI09 before TCP/IP optimization'
        $steps = @(
            @{ Name = 'TCP auto-tuning (normal)'; Args = @('int', 'tcp', 'set', 'global', 'autotuninglevel=normal') },
            @{ Name = 'Congestion provider (default)'; Args = @('int', 'tcp', 'set', 'global', 'congestionprovider=default') },
            @{ Name = 'ECN capability (enabled)'; Args = @('int', 'tcp', 'set', 'global', 'ecncapability=enabled') }
        )
        foreach ($step in $steps) {
            Write-Host ('  [RUN] ' + $step.Name + ' ...') -ForegroundColor Green
            $r = Invoke-KnouxNativeCommand -FilePath $netsh -ArgumentList $step.Args -TimeoutSeconds 60
            if ($r) {
                Write-KnouxLog -Session $Session ("{0} exit {1}" -f $step.Name, $r.ExitCode)
                $rc = $r.ExitCode
                if (-not $r.Success) {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = ($step.Name + ' failed with exit code ' + $r.ExitCode)
                    Write-Host ('    [ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                    break
                }
            }
        }
        if ($Session.Status -ne 'Failed') {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $steps.Count
            Write-Host '[OK] TCP/IP optimization applied.' -ForegroundColor Green
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
