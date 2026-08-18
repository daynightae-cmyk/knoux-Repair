#Requires -Version 5.1
#  knoux Repair v2.0.2 | 08-Performance | PF07 - Resource Sampling
#  Risk: READ_ONLY
#  Samples CPU, memory, and disk activity over a short window and
#  reports averages and peaks.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF07' -ToolName 'Resource Sampling' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $samples = 6
    $intervalSec = 2
    $cpuSamples = @()
    $diskSamples = @()
    $memPeakPct = 0

    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $total = $os.TotalVisibleMemorySize / 1MB

    for ($i = 0; $i -lt $samples; $i++) {
        $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object LoadPercentage -Average
        $cpuSamples += [double]$cpu.Average
        $disk = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '_Total' } | Measure-Object PercentDiskTime -Average
        $diskSamples += [double]$disk.Average
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
        $free = $os.FreePhysicalMemory / 1MB
        $memPct = [math]::Round((($total - $free) / $total) * 100, 1)
        if ($memPct -gt $memPeakPct) { $memPeakPct = $memPct }
        Start-Sleep -Seconds $intervalSec
    }

    $cpuAvg = [math]::Round(($cpuSamples | Measure-Object -Average).Average, 1)
    $cpuPeak = [math]::Round(($cpuSamples | Measure-Object -Maximum).Maximum, 1)
    $diskAvg = [math]::Round(($diskSamples | Measure-Object -Average).Average, 1)
    $diskPeak = [math]::Round(($diskSamples | Measure-Object -Maximum).Maximum, 1)

    Write-Host 'Resource sample (approx 12 s):' -ForegroundColor Cyan
    Write-Host ('  CPU  avg {0:N1}%  peak {1:N1}%' -f $cpuAvg, $cpuPeak) -ForegroundColor $(if ($cpuAvg -lt 60) { 'Green' } elseif ($cpuAvg -lt 85) { 'Yellow' } else { 'Red' })
    Write-Host ('  Disk avg {0:N1}%  peak {1:N1}%' -f $diskAvg, $diskPeak) -ForegroundColor DarkGray
    Write-Host ('  Memory peak {0:N1}%' -f $memPeakPct) -ForegroundColor $(if ($memPeakPct -lt 75) { 'Green' } elseif ($memPeakPct -lt 90) { 'Yellow' } else { 'Red' })

    $rows = [pscustomobject]@{
        CpuAvgPct = $cpuAvg; CpuPeakPct = $cpuPeak
        DiskAvgPct = $diskAvg; DiskPeakPct = $diskPeak
        MemoryPeakPct = $memPeakPct
        Samples = $samples; IntervalSeconds = $intervalSec
        Timestamp = (Get-Date).ToString('s')
    }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'resource-sampling.json') -Encoding UTF8
    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Resource sample: CPU {0:N1}%, Mem peak {1:N1}%" -f $cpuAvg, $memPeakPct)
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
