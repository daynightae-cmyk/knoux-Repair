# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT07' -ToolName 'IDE and Extension Inventory' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $locations = @(
    [pscustomobject]@{ Product='Visual Studio Code'; Path=(Join-Path $env:USERPROFILE '.vscode\\extensions') },
    [pscustomobject]@{ Product='Cursor'; Path=(Join-Path $env:USERPROFILE '.cursor\\extensions') },
    [pscustomobject]@{ Product='VSCodium'; Path=(Join-Path $env:USERPROFILE '.vscode-oss\\extensions') }
  )
  $inventory = foreach ($location in $locations) {
    $extensions = if (Test-Path -LiteralPath $location.Path) { @(Get-ChildItem -LiteralPath $location.Path -Directory -Force -ErrorAction SilentlyContinue | Select-Object -First 500 | ForEach-Object { $_.Name }) } else { @() }
    [pscustomobject]@{ Product=$location.Product; Path=$location.Path; Present=(Test-Path -LiteralPath $location.Path); ExtensionCount=$extensions.Count; Extensions=$extensions }
  }
  $cliRows = @()
  foreach ($commandName in @('code','cursor')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($command) { try { $cliRows += [pscustomobject]@{ Command=$commandName; Extensions=@(& $command.Source --list-extensions --show-versions 2>$null | Select-Object -First 500) } } catch { $cliRows += [pscustomobject]@{ Command=$commandName; Extensions=@() } } }
  }
  [pscustomobject]@{ CapturedAt=(Get-Date).ToString('o'); Locations=$inventory; CliInventories=$cliRows } | ConvertTo-Json -Depth 7 | Set-Content (Join-Path $Session.RawDir 'ide-extension-inventory.json') -Encoding UTF8
  $Session.ItemsFound = @($inventory | Measure-Object -Property ExtensionCount -Sum).Sum
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('IDE inventory completed across {0} locations.' -f $inventory.Count)
  Write-Host ('[OK] IDE extension inventory completed across {0} locations.' -f $inventory.Count) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
