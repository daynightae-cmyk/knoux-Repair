#Requires -Version 5.1
#  knoux Repair v2.0.2 | 07-Services-Processes | SP02 - Analyze Processes
#  Risk: READ_ONLY
#  Lists top processes by CPU and memory usage, plus total memory load.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP02' -ToolName 'Analyze Processes' -Category '07-Services-Processes' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    $totalMem = $os.TotalVisibleMemorySize
    $freeMem = $os.FreePhysicalMemory
    $loadPct = [math]::Round((($totalMem - $freeMem) / $totalMem) * 100, 1)

    Write-Host ('Memory load: {0:N1}% ({1:N1} GB used of {2:N1} GB)' -f $loadPct, (($totalMem - $freeMem) / 1MB), ($totalMem / 1MB)) -ForegroundColor Cyan

    $procs = @(Get-Process -ErrorAction SilentlyContinue)
    Write-Host ('{0} processes:' -f $procs.Count) -ForegroundColor Cyan
    Write-Host '  Top by memory:'
    foreach ($p in @($procs | Sort-Object WorkingSet64 -Descending | Select-Object -First 10)) {
        Write-Host ('    {0,-40} {1,10:N1} MB' -f $p.ProcessName, ($p.WorkingSet64 / 1MB)) -ForegroundColor Yellow
    }
    Write-Host '  Top by CPU:'
     $topCpu = @($procs | Where-Object { $null -ne $_.TotalProcessorTime } | Sort-Object { try { $_.TotalProcessorTime.TotalSeconds } catch { 0 } } -Descending | Select-Object -First 10)
    foreach ($p in $topCpu) {
        try { $cpu = $p.TotalProcessorTime.TotalSeconds } catch { Write-Verbose "CPU read failed for $($p.ProcessName)"; $cpu = 0 }
        Write-Host ('    {0,-40} {1,10:N1} s' -f $p.ProcessName, $cpu) -ForegroundColor Yellow
    }

     $rows = @($procs | ForEach-Object {
         if (-not $_) { return }
         $cpuSec = 0
         try { $cpuSec = [math]::Round($_.TotalProcessorTime.TotalSeconds, 1) } catch { $cpuSec = 0 }
         try { [pscustomobject]@{ Name = $_.ProcessName; PID = $_.Id; MemMB = [math]::Round($_.WorkingSet64 / 1MB, 1); CPUSec = $cpuSec } } catch { [pscustomobject]@{ Name = 'unknown'; PID = -1; MemMB = 0; CPUSec = 0 } }
     })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'processes.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'processes.json') -Encoding UTF8
    $Session.ItemsFound = $procs.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Analyzed {0} processes, memory load {1:N1}%" -f $procs.Count, $loadPct)
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
