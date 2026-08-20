#Requires -Version 5.1
# Knoux Repair v2.0.2 | 08-Performance | PF11 - Interactive Performance Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF11' -ToolName 'Interactive Performance Preview' -Category '08-Performance' -RiskLevel 'READ_ONLY'
try {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $computer = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
  $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
  $cpuPerf = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction SilentlyContinue | Select-Object -First 1
  $memoryPerf = Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory -ErrorAction SilentlyContinue | Select-Object -First 1
  $diskPerfByName = @{}
  Get-CimInstance Win32_PerfFormattedData_PerfDisk_LogicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.Name -and $_.Name -ne '_Total' } | ForEach-Object {
    $diskPerfByName[$_.Name] = $_
  }

  $totalRamGb = [math]::Round($computer.TotalPhysicalMemory / 1GB, 1)
  $freeRamGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  $usedRamGb = [math]::Round([math]::Max(0, $totalRamGb - $freeRamGb), 1)
  $memoryLoad = if ($totalRamGb -gt 0) { [math]::Round(($usedRamGb / $totalRamGb) * 100, 1) } else { 0 }
  $cpuLoad = if ($cpuPerf) { [math]::Round([double]$cpuPerf.PercentProcessorTime, 1) } elseif ($cpu) { [math]::Round([double]$cpu.LoadPercentage, 1) } else { 0 }

  $drives = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction Stop | ForEach-Object {
    $counter = $diskPerfByName[$_.DeviceID]
    $totalGb = [math]::Round($_.Size / 1GB, 1)
    $freeGb = [math]::Round($_.FreeSpace / 1GB, 1)
    [pscustomobject]@{
      Name = [string]$_.DeviceID
      TotalGB = $totalGb
      FreeGB = $freeGb
      UsedPercent = if ($_.Size -gt 0) { [math]::Round((1 - ($_.FreeSpace / $_.Size)) * 100, 1) } else { 0 }
      ActiveTimePercent = if ($counter) { [math]::Round([double]$counter.PercentDiskTime, 1) } else { $null }
      ReadBytesPerSecond = if ($counter) { [int64]$counter.DiskReadBytesPersec } else { $null }
      WriteBytesPerSecond = if ($counter) { [int64]$counter.DiskWriteBytesPersec } else { $null }
    }
  })

  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    Cpu = [pscustomobject]@{ Name = if ($cpu) { [string]$cpu.Name } else { 'Unknown CPU' }; LoadPercent = $cpuLoad; LogicalProcessors = if ($cpu) { [int]$cpu.NumberOfLogicalProcessors } else { 0 } }
    Memory = [pscustomobject]@{ TotalGB = $totalRamGb; UsedGB = $usedRamGb; FreeGB = $freeRamGb; LoadPercent = $memoryLoad; AvailableMB = if ($memoryPerf) { [int]$memoryPerf.AvailableMBytes } else { [int]($freeRamGb * 1024) }; PagesPerSecond = if ($memoryPerf) { [int]$memoryPerf.PagesPersec } else { $null } }
    Disks = $drives
    ProcessCount = @(Get-Process -ErrorAction SilentlyContinue).Count
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Win32_OperatingSystem', 'Win32_ComputerSystem', 'Win32_PerfFormattedData_PerfOS_Processor', 'Win32_PerfFormattedData_PerfOS_Memory', 'Win32_PerfFormattedData_PerfDisk_LogicalDisk', 'Win32_LogicalDisk')
      Notice = 'Read-only performance telemetry. No power, visual-effect, disk, memory, or process configuration is changed.'
    }
  }

  $preview | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-performance-preview.json') -Encoding UTF8
  $Session.ItemsFound = $drives.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'CPU, memory, disk, and process telemetry was read locally; no performance configuration was changed.'
  if ($EmitJson) {
    Write-Output '---KNOUX_PERFORMANCE_JSON_START---'
    $preview | ConvertTo-Json -Depth 7 -Compress
    Write-Output '---KNOUX_PERFORMANCE_JSON_END---'
  } else {
    Write-Host ('[OK] Read CPU, memory, {0} drive(s), and process count; no changes made.' -f $drives.Count) -ForegroundColor Green
  }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
