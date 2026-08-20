[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW04' -ToolName 'Quarantine Software Caches' -Category '16-Software-Environment' -RiskLevel 'SAFE_CLEANUP'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $paths=@((Join-Path $env:LOCALAPPDATA 'npm-cache'),(Join-Path $env:LOCALAPPDATA 'Yarn\Cache'),(Join-Path $env:LOCALAPPDATA 'pip\Cache'),(Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Cache'))|Where-Object {Test-Path $_};$Session.ItemsFound=$paths.Count;$target=Join-Path $Session.ProjectRoot ('Quarantine\SW04\'+(Get-Date -Format 'yyyyMMdd-HHmmss'));$Session.QuarantinePath=$target
  if($AnalyzeOnly -or $WhatIf){Write-Host ('[ANALYZE] '+$paths.Count+' cache folders would move to quarantine.') -ForegroundColor Green;$Session.Status='Success'}else{New-Item -ItemType Directory -Path $target -Force|Out-Null;foreach($item in $paths){Move-Item -LiteralPath $item -Destination (Join-Path $target (($item -replace '[:\\]','_').Trim('_'))) -Force;$Session.ItemsProcessed++;$Session.QuarantinedCount++};$Session.ChangedSystem=$true;$Session.VerificationPerformed=$true;$Session.VerificationResult='Supported cache folders quarantined';Write-Host ('[OK] Quarantined '+$Session.ItemsProcessed+' cache folders.') -ForegroundColor Green}
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
