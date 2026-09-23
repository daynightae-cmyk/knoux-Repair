#Requires -Version 5.1
# Knoux Repair v2.0.2 | 17-PostInstall-Setup | PI03 - Essential Apps Catalog
# Risk: READ_ONLY | Structured catalog + live WinGet resolution (truthful).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PI03' -ToolName 'Essential Apps Catalog' -Category '17-PostInstall-Setup' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $catalogPath = Join-Path $PSScriptRoot 'post-install.catalog.json'
  if (-not (Test-Path -LiteralPath $catalogPath)) { throw "Structured catalog not found at $catalogPath" }
  $catalogRaw = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
  # Normalize to objects with selection order
  $catalog = @($catalogRaw | ForEach-Object {
    [pscustomobject]@{
      Selection                  = [int]$_.selection
      Name                       = [string]$_.displayName
      PackageId                  = [string]$_.providerPackageId
      Category                   = [string]$_.category
      Publisher                  = [string]$_.publisher
      OfficialSite               = [string]$_.officialSite
      Provider                   = [string]$_.provider
      Platform                   = [string]$_.platform
      Architecture               = [string]$_.architecture
      License                    = [string]$_.license
      SourceUrl                  = [string]$_.sourceUrl
      InstallMethod              = [string]$_.installMethod
      UpdateMethod               = [string]$_.updateMethod
      UninstallMethod            = [string]$_.uninstallMethod
      VerificationMethod         = [string]$_.verificationMethod
      RequiresAdmin              = [bool]$_.requiresAdmin
      OfflineInstallerAvailable  = [bool]$_.offlineInstallerAvailable
      LastVerified               = [string]$_.lastVerified
      Notes                      = [string]$_.notes
      DetectionPattern           = [string]$_.detectionPattern
      Id                         = [string]$_.id
    }
  } | Sort-Object Selection)

  # Host capability truth (never invented)
  $wingetCap = Get-KnouxWingetCapability

  # Live per-package resolution (external reference data, bounded per-package)
  $resolved = @()
  foreach ($entry in $catalog) {
    $res = $null
    if ($wingetCap.Available) {
      try {
        # Per-package timeout is enforced by winget itself; we add an outer measure
        $res = Resolve-KnouxWingetPackage -PackageId $entry.PackageId
      } catch {
        $res = [pscustomobject]@{ Resolved = $false; PackageId = $entry.PackageId; Error = $_.Exception.Message; AvailableVersion = $null; Source = $null }
      }
    } else {
      $res = [pscustomobject]@{ Resolved = $false; PackageId = $entry.PackageId; Error = 'Winget not available on this host'; AvailableVersion = $null; Source = $null }
    }
    $resolved += [pscustomobject]@{
      Selection         = $entry.Selection
      Id                = $entry.Id
      Name              = $entry.Name
      PackageId         = $entry.PackageId
      Category          = $entry.Category
      Publisher         = $entry.Publisher
      OfficialSite      = $entry.OfficialSite
      Provider          = $entry.Provider
      Platform          = $entry.Platform
      Architecture      = $entry.Architecture
      License           = $entry.License
      SourceUrl         = $entry.SourceUrl
      InstallMethod     = $entry.InstallMethod
      UpdateMethod      = $entry.UpdateMethod
      UninstallMethod   = $entry.UninstallMethod
      VerificationMethod= $entry.VerificationMethod
      RequiresAdmin     = $entry.RequiresAdmin
      OfflineInstallerAvailable = $entry.OfflineInstallerAvailable
      LastVerified      = $entry.LastVerified
      Notes             = $entry.Notes
      WingetResolved    = [bool]$res.Resolved
      WingetAvailableVersion = $res.AvailableVersion
      WingetSource      = $res.Source
      WingetError       = $res.Error
      WingetPublisher   = $res.Publisher
      WingetName        = $res.Name
    }
  }

  # Export structured evidence (canonical)
  $resolved | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'essential-apps-catalog.json') -Encoding UTF8
  $resolved | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'essential-apps-catalog-resolved.json') -Encoding UTF8
  $resolved | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'essential-apps-catalog.csv') -NoTypeInformation -Encoding UTF8
  # Preserve legacy path name expected by some UI/tests
  $wingetCap | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'winget-capability.json') -Encoding UTF8

  # Also emit compact JSON for bridge when requested via -EmitJson (not used by PI03 preview mode, but kept for symmetry)
  $evidence = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    Winget     = $wingetCap
    Catalog    = $resolved
    Safety     = [pscustomobject]@{
      ChangesMade = $false
      Sources     = @('post-install.catalog.json (verified seed)', 'winget show --id per-package live resolution', 'winget --version / source list')
      Notice      = 'Read-only catalog export. Live winget resolution was attempted per package; unresolved entries remain truthfully unresolved and are not fabricated.'
    }
  }
  $evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'pi03-evidence.json') -Encoding UTF8

  $Session.ItemsFound = $resolved.Count
  $Session.VerificationPerformed = $true
  $resolvedCount = @($resolved | Where-Object { $_.WingetResolved }).Count
  $Session.VerificationResult = "Catalog exported: $($resolved.Count) entries, $resolvedCount resolved live via winget, $($resolved.Count - $resolvedCount) unresolved/partial; host winget Available=$($wingetCap.Available)"

  if ($EmitJson) {
    Write-Output '---KNOUX_CATALOG_JSON_START---'
    $evidence | ConvertTo-Json -Depth 6 -Compress
    Write-Output '---KNOUX_CATALOG_JSON_END---'
  } else {
    Write-Host ("[OK] Exported $($resolved.Count) catalog entries ($resolvedCount live-resolved, $($resolved.Count-$resolvedCount) unresolved).") -ForegroundColor Green
    if (-not $wingetCap.Available) {
      Write-Host "[INFO] Winget not available; catalog exported from verified seed only." -ForegroundColor Yellow
    }
  }
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
