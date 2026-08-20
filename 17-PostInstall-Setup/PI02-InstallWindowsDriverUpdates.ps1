[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [string]$Selection)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PI02' -ToolName 'Install Windows Driver Updates' -Category '17-PostInstall-Setup' -RiskLevel 'SYSTEM_REPAIR'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  if([string]::IsNullOrWhiteSpace($Selection)){throw 'Selection is required.'};$session=New-Object -ComObject Microsoft.Update.Session;$result=$session.CreateUpdateSearcher().Search("IsInstalled=0 and Type='Driver'");$numbers=$Selection-split ','|ForEach-Object {[int]$_.Trim()};$collection=New-Object -ComObject Microsoft.Update.UpdateColl
  foreach($number in $numbers){if($number -lt 1 -or $number -gt $result.Updates.Count){throw 'Selection outside available driver range.'};[void]$collection.Add($result.Updates.Item($number-1))}
  if($AnalyzeOnly -or $WhatIf){$collection|ForEach-Object Title|Set-Content (Join-Path $Session.RawDir 'selected-driver-offers.txt') -Encoding UTF8;$Session.VerificationPerformed=$true;$Session.VerificationResult='Selected driver offers listed';Write-Host ('[ANALYZE] Would install '+$collection.Count+' driver offer(s).') -ForegroundColor Green}else{$downloader=$session.CreateUpdateDownloader();$downloader.Updates=$collection;[void]$downloader.Download();$installer=$session.CreateUpdateInstaller();$installer.Updates=$collection;$outcome=$installer.Install();$Session.ItemsProcessed=$collection.Count;$Session.ChangedSystem=$true;$Session.RequiresRestart=[bool]$outcome.RebootRequired;$Session.VerificationPerformed=$true;$Session.VerificationResult=('Driver install result '+$outcome.ResultCode);Write-Host ('[OK] Driver install result: '+$outcome.ResultCode) -ForegroundColor Green}
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
