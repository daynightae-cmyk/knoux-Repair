#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI05 - Refresh Network Tables
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Required
#  Flushes NetBIOS cache, ARP table and re-registers DNS records.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI05' -ToolName 'Refresh Network Tables' -Category '03-Network-Internet' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: nbtstat -R, arp -d *, ipconfig /registerdns' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would refresh network tables'
} else {
    Write-Host '[ACTION] Flush NetBIOS/ARP tables and re-register DNS.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Refresh network tables now?') {
        $steps = @(
            @{ Name = 'NetBIOS cache (nbtstat -R)'; Exe = "$env:SystemRoot\System32\nbtstat.exe"; Args = @('-R') },
            @{ Name = 'ARP table (arp -d *)'; Exe = "$env:SystemRoot\System32\arp.exe"; Args = @('-d', '*') },
            @{ Name = 'DNS re-register (ipconfig /registerdns)'; Exe = "$env:SystemRoot\System32\ipconfig.exe"; Args = @('/registerdns') }
        )
        foreach ($step in $steps) {
            Write-Host ('  [RUN] ' + $step.Name + ' ...') -ForegroundColor Green
            $r = Invoke-KnouxNativeCommand -FilePath $step.Exe -ArgumentList $step.Args -TimeoutSeconds 90
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
            Write-Host '[OK] Network tables refreshed.' -ForegroundColor Green
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
