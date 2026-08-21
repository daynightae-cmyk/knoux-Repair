#Requires -Version 5.1
# Knoux Repair v2.0.2 | 07-Services-Processes | SP11 - Interactive Operations Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP11' -ToolName 'Interactive Operations Preview' -Category '07-Services-Processes' -RiskLevel 'READ_ONLY'
try {
  $serviceDetails = @{}
  Get-CimInstance Win32_Service -ErrorAction Stop | ForEach-Object {
    $serviceDetails[$_.Name] = $_
  }

  $services = @(Get-Service -ErrorAction Stop | ForEach-Object {
    $detail = $serviceDetails[$_.Name]
    [pscustomobject]@{
      Name = [string]$_.Name
      DisplayName = [string]$_.DisplayName
      Status = [string]$_.Status
      StartMode = if ($detail) { [string]$detail.StartMode } else { 'Unknown' }
      ProcessId = if ($detail) { [int]$detail.ProcessId } else { 0 }
    }
  })

  $processes = @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
    $memoryMb = 0.0
    $cpuSeconds = 0.0
    $responding = $null
    try { $memoryMb = [math]::Round($_.WorkingSet64 / 1MB, 1) } catch { }
    try { $cpuSeconds = [math]::Round($_.TotalProcessorTime.TotalSeconds, 1) } catch { }
    try { $responding = [bool]$_.Responding } catch { }
    [pscustomobject]@{
      Name = [string]$_.ProcessName
      ProcessId = [int]$_.Id
      MemoryMB = $memoryMb
      CpuSeconds = $cpuSeconds
      Responding = $responding
    }
  })

  $automaticStopped = @($services | Where-Object { $_.StartMode -eq 'Auto' -and $_.Status -ne 'Running' } | Sort-Object DisplayName | Select-Object -First 12)
  $hung = @($processes | Where-Object { $_.Responding -eq $false } | Sort-Object MemoryMB -Descending | Select-Object -First 12)
  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    Services = [pscustomobject]@{
      Total = $services.Count
      Running = @($services | Where-Object Status -eq 'Running').Count
      Stopped = @($services | Where-Object Status -eq 'Stopped').Count
      Automatic = @($services | Where-Object StartMode -eq 'Auto').Count
      AutomaticStoppedForReview = $automaticStopped
    }
    Processes = [pscustomobject]@{
      Total = $processes.Count
      NotResponding = $hung.Count
      TopMemory = @($processes | Sort-Object MemoryMB -Descending | Select-Object -First 14)
      TopCpuTime = @($processes | Sort-Object CpuSeconds -Descending | Select-Object -First 14)
      NotRespondingForReview = $hung
    }
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Get-Service', 'Win32_Service', 'Get-Process')
      Notice = 'Read-only telemetry. No process is terminated and no service state or start mode is changed.'
    }
  }

  $preview | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-operations-preview.json') -Encoding UTF8
  $Session.ItemsFound = $services.Count + $processes.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Service and process telemetry was read locally; no service or process was modified.'
  if ($EmitJson) {
    Write-Output '---KNOUX_OPERATIONS_JSON_START---'
    $preview | ConvertTo-Json -Depth 7 -Compress
    Write-Output '---KNOUX_OPERATIONS_JSON_END---'
  } else {
    Write-Host ('[OK] Read {0} service(s) and {1} process(es); no changes made.' -f $services.Count, $processes.Count) -ForegroundColor Green
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
