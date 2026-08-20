#Requires -Version 5.1
# Knoux Repair v2.0.2 | 14-Driver-Management | DV04 - Interactive Driver Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

function Convert-KnouxDate([object]$value) {
  if ($null -eq $value) { return $null }
  try { return [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$value).ToString('o') } catch { }
  try { return ([datetime]$value).ToString('o') } catch { return [string]$value }
}

$Session = Start-KnouxSession -ToolId 'DV04' -ToolName 'Interactive Driver Preview' -Category '14-Driver-Management' -RiskLevel 'READ_ONLY'
try {
  $now = Get-Date
  $devices = @{}
  try {
    Get-CimInstance Win32_PnPEntity -ErrorAction Stop | ForEach-Object {
      if ($_.DeviceID) {
        $devices[[string]$_.DeviceID] = [pscustomobject]@{
          Name = [string]$_.Name
          Status = [string]$_.Status
          ErrorCode = if ($null -eq $_.ConfigManagerErrorCode) { 0 } else { [int]$_.ConfigManagerErrorCode }
        }
      }
    }
  } catch { }

  $rawDrivers = @(Get-CimInstance Win32_PnPSignedDriver -ErrorAction Stop)
  $drivers = @($rawDrivers | ForEach-Object {
    $device = if ($_.DeviceID -and $devices.ContainsKey([string]$_.DeviceID)) { $devices[[string]$_.DeviceID] } else { $null }
    $dateText = Convert-KnouxDate $_.DriverDate
    $ageYears = $null
    try { $ageYears = [math]::Round(($now - [datetime]$dateText).TotalDays / 365.25, 1) } catch { }
    $provider = [string]$_.DriverProviderName
    $signed = [bool]$_.IsSigned
    [pscustomobject]@{
      DeviceName = if ($_.DeviceName) { [string]$_.DeviceName } elseif ($device) { $device.Name } else { 'Unnamed device' }
      DeviceClass = [string]$_.DeviceClass
      Provider = $provider
      ProviderGroup = if ($provider -match '(?i)microsoft') { 'Microsoft' } elseif ([string]::IsNullOrWhiteSpace($provider)) { 'Unknown' } else { 'ThirdParty' }
      Version = [string]$_.DriverVersion
      DriverDate = $dateText
      AgeYears = $ageYears
      InfName = [string]$_.InfName
      Signed = $signed
      DeviceStatus = if ($device) { $device.Status } else { '' }
      ProblemCode = if ($device) { $device.ErrorCode } else { 0 }
      ReviewSignals = @(
        if (-not $signed) { 'Unsigned' }
        if ($device -and $device.ErrorCode -ne 0) { 'DeviceProblem' }
        if ($ageYears -ne $null -and $ageYears -ge 5) { 'OlderDriverDate' }
      )
    }
  })

  $problemDevices = @($devices.GetEnumerator() | Where-Object { $_.Value.ErrorCode -ne 0 } | Sort-Object { $_.Value.ErrorCode } | Select-Object -First 30 | ForEach-Object {
    [pscustomobject]@{ DeviceId = $_.Key; Name = $_.Value.Name; Status = $_.Value.Status; ErrorCode = $_.Value.ErrorCode }
  })
  $reviewDrivers = @($drivers | Where-Object { $_.ReviewSignals.Count -gt 0 } | Sort-Object @{ Expression = { $_.ProblemCode -ne 0 }; Descending = $true }, @{ Expression = { -not $_.Signed }; Descending = $true }, @{ Expression = { $_.AgeYears }; Descending = $true } | Select-Object -First 40)
  $classSummary = @($drivers | Group-Object DeviceClass | Sort-Object Count -Descending | Select-Object -First 10 | ForEach-Object { [pscustomobject]@{ Class = if ([string]::IsNullOrWhiteSpace($_.Name)) { 'Unclassified' } else { $_.Name }; Count = $_.Count } })

  $preview = [pscustomobject]@{
    CapturedAt = $now.ToString('o')
    Summary = [pscustomobject]@{
      TotalDrivers = $drivers.Count
      SignedDrivers = @($drivers | Where-Object Signed).Count
      UnsignedDrivers = @($drivers | Where-Object { -not $_.Signed }).Count
      ThirdPartyDrivers = @($drivers | Where-Object ProviderGroup -eq 'ThirdParty').Count
      OlderDateSignals = @($drivers | Where-Object { $_.AgeYears -ne $null -and $_.AgeYears -ge 5 }).Count
      DeviceProblems = $problemDevices.Count
    }
    DeviceProblems = $problemDevices
    ReviewDrivers = $reviewDrivers
    ClassSummary = $classSummary
    RecentInventory = @($drivers | Sort-Object DriverDate -Descending | Select-Object -First 24)
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Win32_PnPSignedDriver', 'Win32_PnPEntity')
      Notice = 'Read-only driver and device inventory. Signature, device-problem, and older-date values are review signals only; this preview does not update, remove, install, roll back, or export a driver.'
    }
  }

  $preview | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-driver-preview.json') -Encoding UTF8
  $Session.ItemsFound = $drivers.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Driver and device inventory was read locally only; no Driver Store or device configuration was modified.'
  if ($EmitJson) {
    Write-Output '---KNOUX_DRIVERS_JSON_START---'
    $preview | ConvertTo-Json -Depth 8 -Compress
    Write-Output '---KNOUX_DRIVERS_JSON_END---'
  } else {
    Write-Host ('[OK] Read {0} driver record(s), {1} device problem(s), and {2} review signal(s); no changes made.' -f $drivers.Count, $problemDevices.Count, $reviewDrivers.Count) -ForegroundColor Green
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
