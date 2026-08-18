#Requires -Version 5.1
#  knoux Repair v2.0 | 07-Services-Processes | SP10 - Services & Processes Report
#  Risk: READ_ONLY
#  Generates a full diagnostic report on services and processes:
#  counts by state/start-mode, top consumers, suspicious entries,
#  hung processes. Read-only, safe.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP10' -ToolName 'Services & Processes Report' -Category '07-Services-Processes' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $svcs = @(Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue)
    $procs = @(Get-Process -ErrorAction SilentlyContinue)

    Write-Host ('Services: {0} total, {1} running' -f $svcs.Count, @($svcs | Where-Object { $_.State -eq 'Running' }).Count) -ForegroundColor Cyan
    Write-Host ('Processes: {0} total, memory ~{1:N0} MB' -f $procs.Count, (($procs | Measure-Object WorkingSet64 -Sum).Sum / 1MB)) -ForegroundColor Cyan

    $runningSvcs = @($svcs | Where-Object { $_.State -eq 'Running' } | Sort-Object Name)
    Write-Host 'Running services:' -ForegroundColor Cyan
    foreach ($s in $runningSvcs) { Write-Host ('  {0,-30} {1}' -f $s.Name, $s.DisplayName) -ForegroundColor Gray }

    $topMem = @($procs | Sort-Object WorkingSet64 -Descending | Select-Object -First 5)
    Write-Host 'Top 5 processes by memory:' -ForegroundColor Cyan
    foreach ($p in $topMem) { Write-Host ('  {0,-30} {1:N1} MB' -f $p.ProcessName, ($p.WorkingSet64 / 1MB)) -ForegroundColor Gray }

    $suspicious = @($procs | Where-Object { $_.Path -and $_.Path -like '*\Users\*\AppData\*' -and $_.Path -notlike '*\Microsoft\*' } | Select-Object -First 10)
    if ($suspicious.Count -gt 0) {
        Write-Host 'Possible user-level (non-Microsoft) processes:' -ForegroundColor Yellow
        foreach ($p in $suspicious) { Write-Host ('  {0,-30} {1}' -f $p.ProcessName, $p.Path) }
    }

    $rows = @($svcs | ForEach-Object { [pscustomobject]@{ Name = $_.Name; DisplayName = $_.DisplayName; State = $_.State; StartMode = $_.StartMode; PathName = $_.PathName } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'services-report.csv') -NoTypeInformation -Encoding UTF8
    $prows = @($procs | ForEach-Object { [pscustomobject]@{ Name = $_.ProcessName; PID = $_.Id; MemMB = [math]::Round($_.WorkingSet64 / 1MB, 1) } })
    $prows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'processes-report.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'services-report.json') -Encoding UTF8

    $Session.ItemsFound = $svcs.Count + $procs.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Report: {0} services, {1} processes" -f $svcs.Count, $procs.Count)
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
