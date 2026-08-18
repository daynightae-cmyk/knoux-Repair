#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS06 - Compact System Files
#  Risk: SAFE_CLEANUP | Quarantine-backed
#  CompactOS: compresses Windows system files (binary-level). Runs
#  `compact /compactos:always`; reports size impact. Requires admin.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS06' -ToolName 'Compact System Files' -Category '06-Disk-Space' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$rc = 0
$compact = "$env:SystemRoot\System32\compact.exe"

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would query current CompactOS state with `compact /compactos:query`.' -ForegroundColor Green
    $r = Invoke-KnouxNativeCommand -FilePath $compact -ArgumentList @('/compactos:query') -TimeoutSeconds 60
    if ($r) { Write-Host $r.Stdout }
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would query CompactOS state'
} else {
    Write-Host '[ACTION] Enables CompactOS compression of Windows binaries.' -ForegroundColor Yellow
    Write-Host '[WARN] This reduces free-space pressure but can slightly slow disk reads.' -ForegroundColor DarkYellow
    if (Confirm-KnouxAction 'Enable CompactOS compression now?') {
        Write-Host '  Running compact /compactos:always ... (can take several minutes)' -ForegroundColor Green
        $r = Invoke-KnouxNativeCommand -FilePath $compact -ArgumentList @('/compactos:always') -TimeoutSeconds 900
        if ($r -and $r.Success) {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = 1
            Write-Host '[OK] CompactOS compression enabled.' -ForegroundColor Green
            Write-Host $r.Stdout
            Write-KnouxLog -Session $Session 'CompactOS compression enabled'
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = ('compact exited with code ' + $r.ExitCode)
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
            if ($r) { Write-Host $r.Stderr }
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
