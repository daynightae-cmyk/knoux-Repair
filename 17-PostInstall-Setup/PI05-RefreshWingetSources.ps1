# Risk: SAFE_CLEANUP
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PI05' -ToolName 'Refresh Winget Sources' -Category '17-PostInstall-Setup' -RiskLevel 'SAFE_CLEANUP'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  if($AnalyzeOnly -or $WhatIf){& winget.exe source list 2>&1|Tee-Object -FilePath (Join-Path $Session.RawDir 'winget-sources.txt');$Session.VerificationPerformed=$true;$Session.VerificationResult='Winget sources listed';Write-Host '[OK] Winget sources listed.' -ForegroundColor Green}else{& winget.exe source update 2>&1|Tee-Object -FilePath (Join-Path $Session.RawDir 'winget-source-update.txt');if($LASTEXITCODE -ne 0){throw 'winget source update failed'};$Session.ChangedSystem=$true;$Session.VerificationPerformed=$true;$Session.VerificationResult='Winget sources refreshed';Write-Host '[OK] Winget sources refreshed.' -ForegroundColor Green}
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
