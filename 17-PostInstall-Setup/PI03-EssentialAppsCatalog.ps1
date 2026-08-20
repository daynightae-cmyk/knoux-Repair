[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PI03' -ToolName 'Essential Apps Catalog' -Category '17-PostInstall-Setup' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $items=@([pscustomobject]@{Selection=1;Name='Google Chrome';PackageId='Google.Chrome';Category='Browser'},[pscustomobject]@{Selection=2;Name='7-Zip';PackageId='7zip.7zip';Category='Utilities'},[pscustomobject]@{Selection=3;Name='VLC media player';PackageId='VideoLAN.VLC';Category='Media'},[pscustomobject]@{Selection=4;Name='Visual Studio Code';PackageId='Microsoft.VisualStudioCode';Category='Developer'},[pscustomobject]@{Selection=5;Name='PowerToys';PackageId='Microsoft.PowerToys';Category='Productivity'},[pscustomobject]@{Selection=6;Name='Notepad++';PackageId='Notepad++.Notepad++';Category='Utilities'},[pscustomobject]@{Selection=7;Name='Everything';PackageId='voidtools.Everything';Category='Search'},[pscustomobject]@{Selection=8;Name='WinDirStat';PackageId='WinDirStat.WinDirStat';Category='Storage'})
  $items|Export-Csv (Join-Path $Session.RawDir 'essential-apps-catalog.csv') -NoTypeInformation -Encoding UTF8;$Session.ItemsFound=$items.Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Essential app catalog exported';Write-Host ('[OK] Exported '+$items.Count+' catalog entries.') -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
