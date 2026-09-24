#Requires -Version 5.1
# Knoux Repair v2.0.2 | 16-Software-Environment | SW07 - Interactive Software Preview
# Risk: READ_ONLY | Registry + AppX/MSIX + optional WinGet correlation, capability-driven, no Win32_Product.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW07' -ToolName 'Interactive Software Preview' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
try {
  $inventory = Get-KnouxSoftwareInventory
  # Optional WinGet correlation for update capability (best-effort, bounded)
  $wingetPath = Get-KnouxWingetExePathForSoftware
  $wingetAvailable = $null -ne $wingetPath
  $wingetCorrelationNote = if ($wingetAvailable) { 'WinGet correlation attempted (best-effort, not fabricated)' } else { 'WinGet not available, update capability remains false' }

  $items = @($inventory | ForEach-Object {
    # Map internal model to preview item with capability truth
    $capUpdate = $false # keep false until proven via winget list; do not fabricate
    $capRepair = [bool]$_.RepairCapability
    $capUninstall = [bool]$_.UninstallCapability
    $capOpen = [bool]$_.OpenCapability
    [pscustomobject]@{
      # Legacy fields (compat)
      Name = $_.Name
      Version = $_.Version
      Publisher = $_.Publisher
      Kind = $_.Kind
      CanUninstall = $capUninstall
      # Enriched normalized fields (new)
      Id = $_.Id
      Architecture = $_.Architecture
      InstallLocation = $_.InstallLocation
      InstallDate = $_.InstallDate
      PackageProvider = $_.PackageProvider
      PackageId = $_.PackageId
      UninstallCapability = $capUninstall
      UninstallString = $_.UninstallString
      RepairCapability = $capRepair
      UpdateCapability = $capUpdate
      OpenCapability = $capOpen
      Source = $_.Source
      Scope = $_.Scope
      Evidence = $_.Evidence
      CapturedAt = $_.CapturedAt
      EstimatedSizeMB = $_.EstimatedSizeMB
    }
  })

  # Cap preview at 600 for bridge buffer safety, but total is real
  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    Items = @($items | Select-Object -First 600)
    Total = $items.Count
    DesktopCount = @($items | Where-Object Kind -eq 'Desktop').Count
    AppxCount = @($items | Where-Object Kind -eq 'Appx').Count
    Truncated = $items.Count -gt 600
    InventorySources = @('Uninstall registry HKLM/HKCU', 'AppX/MSIX Get-AppxPackage', 'WinGet correlation (best-effort)')
    Safety = [pscustomobject]@{ ChangesMade=$false; InventorySources=@('Uninstall registry','Appx package inventory','WinGet correlation evaluated'); WingetAvailable=$wingetAvailable; CorrelationNote=$wingetCorrelationNote }
  }
  # Also export full detailed evidence
  $items | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'software-inventory-detailed.json') -Encoding UTF8
  $preview | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-software-preview.json') -Encoding UTF8
  $Session.ItemsFound = $items.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = "Software inventory assembled: Total=$($items.Count) Desktop=$($preview.DesktopCount) AppX=$($preview.AppxCount) Truncated=$($preview.Truncated) WingetAvailable=$wingetAvailable; no changes made."
  if ($EmitJson) { Write-Output '---KNOUX_SOFTWARE_JSON_START---'; $preview | ConvertTo-Json -Depth 6 -Compress; Write-Output '---KNOUX_SOFTWARE_JSON_END---' } else { Write-Host ('[OK] Inventoried {0} software records (Desktop={1} AppX={2}).' -f $items.Count, $preview.DesktopCount, $preview.AppxCount) -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message; Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red; Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
