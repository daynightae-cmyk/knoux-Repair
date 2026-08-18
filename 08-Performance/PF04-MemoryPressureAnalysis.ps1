#Requires -Version 5.1
#  knoux Repair v2.0 | 08-Performance | PF04 - Memory Pressure Analysis
#  Risk: READ_ONLY
#  Reports physical memory usage, page file pressure, and the top
#  processes by working set.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF04' -ToolName 'Memory Pressure Analysis' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $total = $os.TotalVisibleMemorySize / 1MB
    $free = $os.FreePhysicalMemory / 1MB
    $memPct = [math]::Round((($total - $free) / $total) * 100, 1)
    Write-Host ('Memory: {0:N1}% used ({1:N0} of {2:N0} GB)' -f $memPct, ($total - $free), $total) -ForegroundColor $(if ($memPct -lt 75) { 'Green' } elseif ($memPct -lt 90) { 'Yellow' } else { 'Red' })

    $page = Get-CimInstance -ClassName Win32_PageFileUsage -ErrorAction SilentlyContinue
    $pfPct = 0
    if ($page) {
        $pfPct = [math]::Round(($page.CurrentUsage / [math]::Max($page.AllocatedBaseSize, 1)) * 100, 1)
        Write-Host ('Page file: {0:N1}% in use' -f $pfPct) -ForegroundColor DarkGray
    }

    $top = @(Get-Process -ErrorAction SilentlyContinue | Sort-Object WorkingSet64 -Descending | Select-Object -First 5)
    Write-Host 'Top processes by memory:' -ForegroundColor Cyan
    foreach ($proc in $top) {
        Write-Host ('  {0,-30} {1,10:N0} MB' -f $proc.ProcessName, ($proc.WorkingSet64 / 1MB)) -ForegroundColor DarkGray
    }

    $rows = [pscustomobject]@{
        TotalGB = [math]::Round($total, 1)
        UsedGB = [math]::Round($total - $free, 1)
        UsedPct = $memPct
        PageFilePct = $pfPct
        TopProcesses = @($top | ForEach-Object { [pscustomobject]@{ Name = $_.ProcessName; WorkingSetMB = [math]::Round($_.WorkingSet64 / 1MB, 1) } })
    }
    $rows | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $Session.RawDir 'memory-pressure.json') -Encoding UTF8
    $Session.ItemsFound = $top.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Memory pressure: {0:N1}% used" -f $memPct)
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
