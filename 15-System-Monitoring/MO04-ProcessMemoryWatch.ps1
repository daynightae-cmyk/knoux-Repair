# knoux Repair v2.0.2 | 15-System-Monitoring | MO04 - Process & Memory Watch
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'MO04' -ToolName 'Process & Memory Watch' -Category '15-System-Monitoring' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
  $logicalProcessors = [Math]::Max([Environment]::ProcessorCount, 1)
  $before = @{}
  Get-Process | ForEach-Object {
    $cpuValue = if ($null -eq $_.CPU) { 0 } else { [double]$_.CPU }
    $before[$_.Id] = [pscustomobject]@{ Cpu = $cpuValue; WorkingSet = [int64]$_.WorkingSet64 }
  }

  Start-Sleep -Seconds 2

  $rows = foreach ($process in Get-Process) {
    $previous = $before[$process.Id]
    $currentCpu = if ($null -eq $process.CPU) { 0 } else { [double]$process.CPU }
    $deltaCpu = if ($previous) { [Math]::Max(($currentCpu - $previous.Cpu), 0) } else { 0 }
    [pscustomobject]@{
      ProcessName = $process.ProcessName
      Id = $process.Id
      MemoryMB = [Math]::Round($process.WorkingSet64 / 1MB, 1)
      PrivateMemoryMB = [Math]::Round($process.PrivateMemorySize64 / 1MB, 1)
      CpuPercentApprox = [Math]::Round(($deltaCpu / 2 / $logicalProcessors) * 100, 2)
      Responding = $process.Responding
      Path = $process.Path
    }
  }

  $topMemory = @($rows | Sort-Object MemoryMB -Descending | Select-Object -First 30)
  $topCpu = @($rows | Sort-Object CpuPercentApprox -Descending | Select-Object -First 30)
  $os = Get-CimInstance Win32_OperatingSystem
  $summary = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    SampleWindowSeconds = 2
    LogicalProcessors = $logicalProcessors
    TotalMemoryMB = [Math]::Round($os.TotalVisibleMemorySize / 1024, 1)
    FreeMemoryMB = [Math]::Round($os.FreePhysicalMemory / 1024, 1)
    UsedMemoryMB = [Math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1024, 1)
    ProcessCount = $rows.Count
    TopMemoryProcesses = $topMemory
    TopCpuProcesses = $topCpu
  }

  $topMemory | Export-Csv (Join-Path $Session.RawDir 'top-memory-processes.csv') -NoTypeInformation -Encoding UTF8
  $topCpu | Export-Csv (Join-Path $Session.RawDir 'top-cpu-processes.csv') -NoTypeInformation -Encoding UTF8
  $summary | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'process-memory-watch.json') -Encoding UTF8

  $Session.ItemsFound = $rows.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Two-sample process and memory report exported'
  Write-Host ('[OK] Captured {0} processes. Memory available: {1} MB.' -f $rows.Count, $summary.FreeMemoryMB) -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
