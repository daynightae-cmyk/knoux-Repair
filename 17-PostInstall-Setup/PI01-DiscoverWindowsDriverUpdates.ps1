# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PI01' -ToolName 'Discover Windows Driver Updates' -Category '17-PostInstall-Setup' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $session=New-Object -ComObject Microsoft.Update.Session;$searcher=$session.CreateUpdateSearcher();$result=$searcher.Search("IsInstalled=0 and Type='Driver'")
  $items=for($i=0;$i-lt$result.Updates.Count;$i++){$update=$result.Updates.Item($i);[pscustomobject]@{Selection=($i+1);Title=$update.Title;DriverModel=$update.DriverModel;DriverClass=$update.DriverClass;DriverVerDate=$update.DriverVerDate}}
  $items|Export-Csv (Join-Path $Session.RawDir 'windows-driver-offers.csv') -NoTypeInformation -Encoding UTF8;$Session.ItemsFound=@($items).Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Windows Update driver offers exported';Write-Host ('[OK] Found '+$Session.ItemsFound+' driver offers.') -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
