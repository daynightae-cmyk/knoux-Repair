#Requires -Version 5.1
# Knoux Repair v2.0.2 | 16-Software-Environment | SW07 - Interactive Software Preview
# Risk: READ_ONLY
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
  $keys = @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')
  $desktop = foreach ($key in $keys) { Get-ItemProperty $key -ErrorAction SilentlyContinue | Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName } | ForEach-Object { [pscustomobject]@{ Name=[string]$_.DisplayName; Version=if($_.PSObject.Properties['DisplayVersion']){[string]$_.DisplayVersion}else{''}; Publisher=if($_.PSObject.Properties['Publisher']){[string]$_.Publisher}else{''}; Kind='Desktop'; CanUninstall=[bool]($_.PSObject.Properties['UninstallString'] -and $_.UninstallString) } } }
  $appx = @()
  try { $appx = @(Get-AppxPackage -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ Name=[string]$_.Name; Version=[string]$_.Version; Publisher=[string]$_.Publisher; Kind='Appx'; CanUninstall=$true } }) }
  catch { Write-KnouxLog -Session $Session -Message 'Appx inventory is unavailable in the current PowerShell host; desktop registry inventory remains available.' -Level WARN }
  $items = @($desktop) + @($appx) | Sort-Object Kind,Name -Unique
  $preview = [pscustomobject]@{
    Items = @($items | Select-Object -First 600)
    Total = $items.Count
    DesktopCount = @($items | Where-Object Kind -eq 'Desktop').Count
    AppxCount = @($items | Where-Object Kind -eq 'Appx').Count
    Truncated = $items.Count -gt 600
    Safety = [pscustomobject]@{ ChangesMade=$false; InventorySources=@('Uninstall registry','Appx package inventory') }
  }
  $preview | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-software-preview.json') -Encoding UTF8
  $Session.ItemsFound = $items.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Software inventory assembled from local registry and Appx inventory; no changes made.'
  if ($EmitJson) { Write-Output '---KNOUX_SOFTWARE_JSON_START---'; $preview | ConvertTo-Json -Depth 6 -Compress; Write-Output '---KNOUX_SOFTWARE_JSON_END---' } else { Write-Host ('[OK] Inventoried {0} software records.' -f $items.Count) -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message; Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red; Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
