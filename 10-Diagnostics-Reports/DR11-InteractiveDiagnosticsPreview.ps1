#Requires -Version 5.1
# Knoux Repair v2.0.2 | 10-Diagnostics-Reports | DR11 - Interactive Diagnostics Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR11' -ToolName 'Interactive Diagnostics Preview' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
try {
  $now = Get-Date
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $computer = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
  $cpu = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
  $bootEvent = $null
  try { $bootEvent = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100 } -MaxEvents 1 -ErrorAction Stop } catch { }

  $recentEvents = @()
  try {
    $recentEvents = @(Get-WinEvent -FilterHashtable @{ LogName = 'System', 'Application'; Level = 1, 2; StartTime = $now.AddDays(-7) } -MaxEvents 120 -ErrorAction Stop | Select-Object -First 24 | ForEach-Object {
      [pscustomobject]@{
        Time = $_.TimeCreated.ToString('o')
        Log = [string]$_.LogName
        Provider = [string]$_.ProviderName
        EventId = [int]$_.Id
        Level = [string]$_.LevelDisplayName
      }
    })
  } catch { }

  $reliability = @()
  try {
    $reliability = @(Get-CimInstance Win32_ReliabilityRecords -ErrorAction Stop | Where-Object { $_.TimeGenerated -gt $now.AddDays(-14) } | Sort-Object TimeGenerated -Descending | Select-Object -First 16 | ForEach-Object {
      $message = [string]$_.Message
      if ($message.Length -gt 180) { $message = $message.Substring(0, 177) + '...' }
      [pscustomobject]@{ Time = $_.TimeGenerated.ToString('o'); Id = [string]$_.EventIdentifier; Product = [string]$_.ProductName; Message = $message }
    })
  } catch { }

  $deviceProblems = @()
  try {
    $deviceProblems = @(Get-CimInstance Win32_PnPEntity -ErrorAction Stop | Where-Object { $_.ConfigManagerErrorCode -and $_.ConfigManagerErrorCode -ne 0 } | Select-Object -First 16 | ForEach-Object {
      [pscustomobject]@{ Name = [string]$_.Name; DeviceId = [string]$_.DeviceID; ErrorCode = [int]$_.ConfigManagerErrorCode; Status = [string]$_.Status }
    })
  } catch { }

  $smartByIndex = @{}
  try {
    Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue | ForEach-Object {
      $smartByIndex[[string]$_.InstanceName] = [bool]$_.PredictFailure
    }
  } catch { }
  $disks = @(Get-CimInstance Win32_DiskDrive -ErrorAction SilentlyContinue | ForEach-Object {
    $prediction = $false
    $match = $false
    foreach ($key in $smartByIndex.Keys) {
      if ($key -match [regex]::Escape([string]$_.Index)) { $prediction = [bool]$smartByIndex[$key]; $match = $true; break }
    }
    [pscustomobject]@{ Model = [string]$_.Model; Index = [int]$_.Index; SizeGB = [math]::Round($_.Size / 1GB, 1); SmartAvailable = $match; PredictFailure = $prediction }
  })

  $totalRamGb = [math]::Round($computer.TotalPhysicalMemory / 1GB, 1)
  $freeRamGb = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  $memoryLoad = if ($totalRamGb -gt 0) { [math]::Round((1 - ($freeRamGb / $totalRamGb)) * 100, 1) } else { 0 }
  $bootDurationMs = $null
  if ($bootEvent) {
    try { $bootDurationMs = [int64]$bootEvent.Properties[6].Value } catch { }
  }

  $preview = [pscustomobject]@{
    CapturedAt = $now.ToString('o')
    System = [pscustomobject]@{
      Os = [string]$os.Caption
      Version = [string]$os.Version
      Build = [string]$os.BuildNumber
      Machine = ([string]$computer.Manufacturer + ' ' + [string]$computer.Model).Trim()
      Cpu = if ($cpu) { [string]$cpu.Name } else { 'Unknown CPU' }
      MemoryTotalGB = $totalRamGb
      MemoryFreeGB = $freeRamGb
      MemoryLoadPercent = $memoryLoad
      UptimeHours = [math]::Round(($now - $os.LastBootUpTime).TotalHours, 1)
      BootDurationMs = $bootDurationMs
    }
    Events = [pscustomobject]@{
      WindowDays = 7
      ErrorOrCriticalCount = $recentEvents.Count
      CriticalCount = @($recentEvents | Where-Object Level -eq 'Critical').Count
      Recent = $recentEvents
    }
    Reliability = [pscustomobject]@{
      WindowDays = 14
      RecordsObserved = $reliability.Count
      Recent = $reliability
    }
    Devices = [pscustomobject]@{
      ProblemsObserved = $deviceProblems.Count
      Problems = $deviceProblems
    }
    Storage = [pscustomobject]@{
      DisksObserved = $disks.Count
      SmartFailurePredicted = @($disks | Where-Object PredictFailure).Count
      Disks = $disks
    }
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Win32_OperatingSystem', 'Win32_ComputerSystem', 'Win32_Processor', 'Get-WinEvent', 'Win32_ReliabilityRecords', 'Win32_PnPEntity', 'Win32_DiskDrive', 'MSStorageDriver_FailurePredictStatus')
      Notice = 'Read-only diagnostic telemetry. Event logs, reliability history, devices, and disk state are observed only; no repair, cleanup, driver action, or configuration change is made.'
    }
  }

  $preview | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-diagnostics-preview.json') -Encoding UTF8
  $Session.ItemsFound = $recentEvents.Count + $reliability.Count + $deviceProblems.Count + $disks.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Diagnostics telemetry was read from local Windows sources only; no remediation action was executed.'
  if ($EmitJson) {
    Write-Output '---KNOUX_DIAGNOSTICS_JSON_START---'
    $preview | ConvertTo-Json -Depth 8 -Compress
    Write-Output '---KNOUX_DIAGNOSTICS_JSON_END---'
  } else {
    Write-Host ('[OK] Read diagnostics evidence: {0} recent event(s), {1} reliability record(s), {2} device problem(s), {3} disk(s); no changes made.' -f $recentEvents.Count, $reliability.Count, $deviceProblems.Count, $disks.Count) -ForegroundColor Green
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
