#Requires -Version 5.1
#  knoux Repair v2.0.2 | 04-Programs-Applications | PA01 - List Installed Programs
#  Risk: READ_ONLY | Registry + AppX/MSIX + capability truth (no Win32_Product)
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA01' -ToolName 'List Installed Programs' -Category '04-Programs-Applications' -RiskLevel 'READ_ONLY' -Mode $(if ($AnalyzeOnly) { 'analyze' } elseif ($WhatIf) { 'preview' } else { 'run' })
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would enumerate installed programs from registry + AppX (read-only, no Win32_Product, no changes).' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: installed program inventory plan only'
    $Session.Status = 'Success'
    $Session.ExitCode = 0
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = 'AnalyzeOnly: would enumerate registry Uninstall keys + AppX package inventory; Win32_Product is never used.'
    $result = Stop-KnouxSession -Session $Session
    Write-KnouxResult -Session $Session
    return $result
} else {
try {
    $inventory = Get-KnouxSoftwareInventory
    $rows = @($inventory | ForEach-Object {
      [pscustomobject]@{
        # Normalized fields (new)
        Id = $_.Id
        Name = $_.Name
        DisplayName = $_.Name
        Version = $_.Version
        DisplayVersion = $_.Version
        Publisher = $_.Publisher
        Kind = $_.Kind
        Architecture = $_.Architecture
        Scope = $_.Scope
        Source = $_.Source
        RegistryHive = $_.Source
        InstallLocation = $_.InstallLocation
        Path = $_.InstallLocation
        InstallDate = $_.InstallDate
        EstimatedSizeMB = $_.EstimatedSizeMB
        EstimatedSize = [int64]($_.EstimatedSizeMB * 1024)
        UninstallString = $_.UninstallString
        UninstallAvailable = $_.UninstallCapability
        CanUninstall = $_.UninstallCapability
        RepairCapability = $_.RepairCapability
        UpdateCapability = $_.UpdateCapability
        OpenCapability = $_.OpenCapability
        PackageFullName = $_.PackageId
        PackageProvider = $_.PackageProvider
        Evidence = $_.Evidence
        CapturedAt = $_.CapturedAt
      }
    })

    $rows = @($rows | Sort-Object Name)

    Write-Host ('Found {0} installed programs (Desktop={1} AppX={2}).' -f $rows.Count, @($rows | Where-Object Kind -eq 'Desktop').Count, @($rows | Where-Object Kind -eq 'Appx').Count) -ForegroundColor Cyan
    foreach ($r in $rows | Select-Object -First 40) {
        Write-Host ('  {0,-45} {1,-15} {2,-12} {3}' -f $r.Name, $r.Version, $r.Kind, $r.Publisher)
    }
    if ($rows.Count -gt 40) {
        Write-Host ('  ... and {0} more (see report).' -f ($rows.Count - 40)) -ForegroundColor Yellow
    }

    $rows | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $Session.RawDir 'installed-programs.json') -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'installed-programs.csv') -NoTypeInformation -Encoding UTF8
    # Preserve legacy envelope for bridge consumers that expect KNOUX_PROGRAMS_JSON_START
    $envelope = [pscustomobject]@{ CapturedAt=(Get-Date).ToString('o'); Items=$rows; Total=$rows.Count; InventorySources=@('Registry Uninstall HKLM/HKCU','AppX MSIX') }
    $envelope | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'programs-envelope.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.Status = 'Success'
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = "Enumerated $($rows.Count) installed programs via registry + AppX; Win32_Product was never queried. Capabilities: uninstallAvailable per UninstallString, repair via MSI heuristic, open via InstallLocation existence."
    Write-KnouxLog -Session $Session ("Enumerated {0} installed programs (registry+Appx)" -f $rows.Count)
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
} # end else (normal measurement mode)

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
