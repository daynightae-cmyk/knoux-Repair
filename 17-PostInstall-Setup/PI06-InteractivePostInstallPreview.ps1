#Requires -Version 5.1
# Knoux Repair v2.0.2 | 17-PostInstall-Setup | PI06 - Interactive Post-Install Preview
# Risk: READ_ONLY | Live baseline: installed registry + winget resolution per-package.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PI06' -ToolName 'Interactive Post-Install Preview' -Category '17-PostInstall-Setup' -RiskLevel 'READ_ONLY'
try {
  $catalogPath = Join-Path $PSScriptRoot 'post-install.catalog.json'
  if (-not (Test-Path -LiteralPath $catalogPath)) { throw "Structured catalog not found at $catalogPath" }
  $catalogRaw = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json

  # Host-local truth: installed programs via registry
  $installedPrograms = Get-KnouxInstalledPrograms
  $wingetCap = Get-KnouxWingetCapability

  # Per-package live WinGet resolution (external reference, bounded, truthful)
  $catalogState = @()
  foreach ($entry in ($catalogRaw | Sort-Object selection)) {
    $selection = [int]$entry.selection
    $name = [string]$entry.displayName
    $pkgId = [string]$entry.providerPackageId
    $category = [string]$entry.category
    $pattern = [string]$entry.detectionPattern

    # Local detection (registry only)
    $match = @()
    try { $match = @($installedPrograms | Where-Object { $_.Name -match $pattern } | Select-Object -First 1) } catch { $match = @() }
    $detected = ($match.Count -gt 0)
    $matchedName = if ($match.Count) { $match[0].Name } else { $null }
    $matchedVersion = if ($match.Count) { $match[0].Version } else { $null }

    # Live WinGet resolution (may be unavailable, may fail per-package)
    $resolve = $null
    if ($wingetCap.Available) {
      try { $resolve = Resolve-KnouxWingetPackage -PackageId $pkgId } catch {
        $resolve = [pscustomobject]@{ Resolved = $false; AvailableVersion = $null; Source = $null; Error = $_.Exception.Message }
      }
    } else {
      $resolve = [pscustomobject]@{ Resolved = $false; AvailableVersion = $null; Source = $null; Error = 'Winget not available on this host' }
    }

    $evidence = if ($detected) {
      "Local installed-program registry match (DisplayName pattern '$pattern'); winget live resolution Resolved=$($resolve.Resolved) Source=$($resolve.Source) Version=$($resolve.AvailableVersion)"
    } else {
      "Not detected in local installed-program registry (pattern '$pattern'); winget live resolution Resolved=$($resolve.Resolved) Source=$($resolve.Source) Version=$($resolve.AvailableVersion). Absence is not an installation recommendation."
    }

    $catalogState += [pscustomobject]@{
      Selection               = $selection
      Name                    = $name
      PackageId               = $pkgId
      Category                = $category
      Detected                = $detected
      MatchedDisplayName      = $matchedName
      MatchedVersion          = $matchedVersion
      Evidence                = $evidence
      # Extended live-resolution truth (additive, non-breaking)
      WingetResolved          = [bool]$resolve.Resolved
      WingetAvailableVersion  = $resolve.AvailableVersion
      WingetSource            = $resolve.Source
      WingetError             = $resolve.Error
      Publisher               = [string]$entry.publisher
      OfficialSite            = [string]$entry.officialSite
      Provider                = [string]$entry.provider
      License                 = [string]$entry.license
      LastVerified            = [string]$entry.lastVerified
    }
  }

  $updateServices = @('wuauserv', 'BITS') | ForEach-Object {
    try { $svc = Get-Service -Name $_ -ErrorAction Stop; [pscustomobject]@{ Name = $svc.Name; Status = [string]$svc.Status; StartType = [string]$svc.StartType } } catch { [pscustomobject]@{ Name = $_; Status = 'Unavailable'; StartType = 'Unavailable' } }
  }

  # Driver offers: truthful - PI06 does NOT query Windows Update COM search (unbounded, blocks bridge).
  # PI01 owns live discovery. We keep state truthful and document blocker.
  $driverOffers = [ordered]@{
    Available = $false
    Count     = $null
    Offers    = @()
    Error     = 'Driver offers were not queried by PI06. Run PI01 Discover Windows Driver Updates for live Windows Update driver evidence.'
  }

  $pendingRestart = @()
  if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $pendingRestart += 'WindowsUpdate' }
  if (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations') { $pendingRestart += 'PendingFileRenameOperations' }
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop

  $wingetForPreview = [pscustomobject]@{
    Available   = [bool]$wingetCap.Available
    SourceCount = $wingetCap.SourceCount
    Version     = $wingetCap.Version
    Error       = $wingetCap.Error
  }

  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    System = [pscustomobject]@{
      Caption = [string]$os.Caption; Build = [string]$os.BuildNumber; LastBoot = if ($os.LastBootUpTime) { ([datetime]$os.LastBootUpTime).ToString('o') } else { $null }
      InstalledProgramCount = $installedPrograms.Count; PendingRestartSignals = $pendingRestart
    }
    Winget = $wingetForPreview
    UpdateServices = $updateServices
    DriverOffers = [pscustomobject]$driverOffers
    Catalog = $catalogState
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Installed-program registry', 'post-install.catalog.json (verified seed)', 'winget show --id per-package live resolution', 'winget --version and source list', 'Windows Update and BITS services', 'reboot evidence registry keys')
      Notice = 'Read-only post-install baseline with per-package live winget resolution. Driver offers are intentionally not queried here; PI01 owns live Windows Update driver discovery. No package source is refreshed, no update is downloaded, and no app or driver is installed by this preview.'
    }
  }
  $preview | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-postinstall-preview.json') -Encoding UTF8
  # Also export catalog-resolved evidence
  $catalogState | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'catalog-resolved.json') -Encoding UTF8
  $Session.ItemsFound = $catalogState.Count
  $Session.VerificationPerformed = $true
  $resolvedCount = @($catalogState | Where-Object { $_.WingetResolved }).Count
  $Session.VerificationResult = "Post-install baseline was read only; $resolvedCount/$($catalogState.Count) catalog packages resolved live via winget; driver offers remain unverified until PI01 is run explicitly. No package source, application, driver, service, or system setting was changed."
  if ($EmitJson) {
    Write-Output '---KNOUX_POST_INSTALL_JSON_START---'
    $preview | ConvertTo-Json -Depth 7 -Compress
    Write-Output '---KNOUX_POST_INSTALL_JSON_END---'
  } else {
    Write-Host ("[OK] Read post-install baseline for {0} catalog item(s) ($resolvedCount live-resolved); driver offers not queried; no changes made." -f $catalogState.Count) -ForegroundColor Green
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
