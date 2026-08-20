#Requires -Version 5.1
# Knoux Repair v2.0.2 | 13-Privacy | PR04 - Interactive Privacy Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

function Read-KnouxRegistryValue([string]$Path, [string]$Name) {
  $result = [ordered]@{ Available = $false; Value = $null }
  try {
    if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]$result }
    $item = Get-ItemProperty -LiteralPath $Path -ErrorAction Stop
    $property = @($item.PSObject.Properties | Where-Object { $_.Name -eq $Name } | Select-Object -First 1)
    if ($property.Count -eq 1) { $result.Available = $true; $result.Value = $property[0].Value }
  } catch { }
  return [pscustomobject]$result
}

function Get-KnouxConsentState([string]$Capability) {
  $value = Read-KnouxRegistryValue "HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\$Capability" 'Value'
  $state = if (-not $value.Available) { 'Unknown' } elseif ([string]$value.Value -match '^(?i)allow$') { 'Allowed' } elseif ([string]$value.Value -match '^(?i)deny$') { 'Denied' } else { [string]$value.Value }
  return [pscustomobject]@{ Available = $value.Available; State = $state; RawValue = if ($value.Available) { [string]$value.Value } else { $null } }
}

$Session = Start-KnouxSession -ToolId 'PR04' -ToolName 'Interactive Privacy Preview' -Category '13-Privacy' -RiskLevel 'READ_ONLY'
try {
  $advertising = Read-KnouxRegistryValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo' 'Enabled'
  $tailored = Read-KnouxRegistryValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy' 'TailoredExperiencesWithDiagnosticDataEnabled'
  $trackPrograms = Read-KnouxRegistryValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'Start_TrackProgs'
  $trackDocuments = Read-KnouxRegistryValue 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' 'Start_TrackDocs'
  $clipboard = Read-KnouxRegistryValue 'HKCU:\Software\Microsoft\Clipboard' 'EnableClipboardHistory'
  $telemetry = Read-KnouxRegistryValue 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection' 'AllowTelemetry'
  $location = Get-KnouxConsentState 'location'
  $microphone = Get-KnouxConsentState 'microphone'
  $camera = Get-KnouxConsentState 'webcam'

  $runMruCount = 0
  $runMruAvailable = $false
  try {
    $runMruPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU'
    if (Test-Path -LiteralPath $runMruPath) {
      $runMru = Get-ItemProperty -LiteralPath $runMruPath -ErrorAction Stop
      $runMruCount = @($runMru.PSObject.Properties | Where-Object { $_.Name -match '^[a-z]$' }).Count
      $runMruAvailable = $true
    }
  } catch { }

  $dnsCount = $null
  $dnsAvailable = $false
  try { $dnsCount = @(Get-DnsClientCache -ErrorAction Stop).Count; $dnsAvailable = $true } catch { }

  $settings = @(
    [pscustomobject]@{ Id = 'advertisingId'; Name = 'Advertising identifier for apps'; Category = 'Personalization'; Available = $advertising.Available; State = if (-not $advertising.Available) { 'Unknown' } elseif ([int]$advertising.Value -eq 0) { 'Restricted' } else { 'Enabled' }; Value = $advertising.Value; Detail = 'Registry value: HKCU AdvertisingInfo Enabled' },
    [pscustomobject]@{ Id = 'tailoredExperiences'; Name = 'Tailored experiences with diagnostic data'; Category = 'Personalization'; Available = $tailored.Available; State = if (-not $tailored.Available) { 'Unknown' } elseif ([int]$tailored.Value -eq 0) { 'Restricted' } else { 'Enabled' }; Value = $tailored.Value; Detail = 'Registry value: HKCU Privacy TailoredExperiencesWithDiagnosticDataEnabled' },
    [pscustomobject]@{ Id = 'appLaunchTracking'; Name = 'App launch tracking'; Category = 'Activity'; Available = $trackPrograms.Available; State = if (-not $trackPrograms.Available) { 'Unknown' } elseif ([int]$trackPrograms.Value -eq 0) { 'Disabled' } else { 'Enabled' }; Value = $trackPrograms.Value; Detail = 'Registry value: Explorer Start_TrackProgs' },
    [pscustomobject]@{ Id = 'recentDocumentTracking'; Name = 'Recent document tracking'; Category = 'Activity'; Available = $trackDocuments.Available; State = if (-not $trackDocuments.Available) { 'Unknown' } elseif ([int]$trackDocuments.Value -eq 0) { 'Disabled' } else { 'Enabled' }; Value = $trackDocuments.Value; Detail = 'Registry value: Explorer Start_TrackDocs' },
    [pscustomobject]@{ Id = 'clipboardHistory'; Name = 'Clipboard history'; Category = 'Activity'; Available = $clipboard.Available; State = if (-not $clipboard.Available) { 'Unknown' } elseif ([int]$clipboard.Value -eq 0) { 'Disabled' } else { 'Enabled' }; Value = $clipboard.Value; Detail = 'Registry value: Clipboard EnableClipboardHistory' },
    [pscustomobject]@{ Id = 'locationAccess'; Name = 'App location access'; Category = 'App permissions'; Available = $location.Available; State = $location.State; Value = $location.RawValue; Detail = 'CapabilityAccessManager ConsentStore location' },
    [pscustomobject]@{ Id = 'microphoneAccess'; Name = 'App microphone access'; Category = 'App permissions'; Available = $microphone.Available; State = $microphone.State; Value = $microphone.RawValue; Detail = 'CapabilityAccessManager ConsentStore microphone' },
    [pscustomobject]@{ Id = 'cameraAccess'; Name = 'App camera access'; Category = 'App permissions'; Available = $camera.Available; State = $camera.State; Value = $camera.RawValue; Detail = 'CapabilityAccessManager ConsentStore webcam' },
    [pscustomobject]@{ Id = 'telemetryPolicy'; Name = 'Diagnostics data policy'; Category = 'Policy'; Available = $telemetry.Available; State = if (-not $telemetry.Available) { 'NotConfigured' } else { 'Configured' }; Value = $telemetry.Value; Detail = 'Policy value only; Windows edition and organization policy can affect its meaning.' }
  )

  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    Settings = $settings
    ActivityEvidence = [pscustomobject]@{
      RunHistoryAvailable = $runMruAvailable
      RunHistoryEntryCount = $runMruCount
      DnsCacheAvailable = $dnsAvailable
      DnsCacheEntryCount = $dnsCount
    }
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('HKCU privacy, explorer, clipboard, and consent registry keys', 'HKLM diagnostics data policy', 'RunMRU value count', 'Get-DnsClientCache count')
      Notice = 'Read-only privacy inventory. No registry value, consent setting, history entry, DNS cache entry, or user file is changed or revealed by this preview.'
    }
  }

  $preview | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-privacy-preview.json') -Encoding UTF8
  $Session.ItemsFound = $settings.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Privacy settings and aggregate local-history evidence were read only; no value or history entry was changed.'
  if ($EmitJson) {
    Write-Output '---KNOUX_PRIVACY_JSON_START---'
    $preview | ConvertTo-Json -Depth 7 -Compress
    Write-Output '---KNOUX_PRIVACY_JSON_END---'
  } else {
    Write-Host ('[OK] Read {0} privacy setting(s) and aggregate activity evidence; no changes made.' -f $settings.Count) -ForegroundColor Green
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
