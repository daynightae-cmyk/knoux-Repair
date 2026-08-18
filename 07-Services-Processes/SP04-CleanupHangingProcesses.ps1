#Requires -Version 5.1
#  knoux Repair v2.0.2 | 07-Services-Processes | SP04 - Cleanup Hanging Processes
#  Risk: SYSTEM_REPAIR | Offline: Yes
#  Lists hung (not-responding) user processes and offers to end them.
#  System/protected processes are excluded.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP04' -ToolName 'Cleanup Hanging Processes' -Category '07-Services-Processes' -RiskLevel 'SYSTEM_REPAIR'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $all = @(Get-Process -ErrorAction SilentlyContinue)
    $hung = @()
    foreach ($p in $all) {
        if ($p.Responding -eq $false) {
            $pp = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
            if ($pp -and -not (Test-KnouxProtectedProcess -ProcessName $pp.ProcessName)) {
                $hung += $pp
            }
        }
    }
    $hung = @($hung | Sort-Object ProcessName -Unique)

    if ($hung.Count -eq 0) {
        Write-Host '[OK] No not-responding processes found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No hanging processes'
    } else {
        Write-Host ('{0} hanging process(es):' -f $hung.Count) -ForegroundColor Cyan
        foreach ($p in $hung) { Write-Host ('  {0,-30} PID {1}' -f $p.ProcessName, $p.Id) }
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to end them.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} hanging processes, no changes" -f $hung.Count)
        } elseif (Confirm-KnouxAction 'End these hanging processes?') {
            $ended = 0
            foreach ($p in $hung) {
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                $ended++
                Write-KnouxLog -Session $Session ("Ended process {0} (PID {1})" -f $p.ProcessName, $p.Id)
            }
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $ended
            $Session.ItemsFound = $hung.Count
            Write-Host ('[OK] Ended {0} hanging process(es).' -f $ended) -ForegroundColor Green
        } else {
            $Session.Status = 'Cancelled'
            Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
        }
    }
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
