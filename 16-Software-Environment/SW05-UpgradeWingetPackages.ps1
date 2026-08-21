# Risk: SYSTEM_REPAIR
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW05' -ToolName 'Upgrade Winget Packages' -Category '16-Software-Environment' -RiskLevel 'SYSTEM_REPAIR'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  if($AnalyzeOnly -or $WhatIf){& winget.exe upgrade 2>&1|Tee-Object -FilePath (Join-Path $Session.RawDir 'winget-upgrades.txt');$Session.VerificationPerformed=$true;$Session.VerificationResult='Available Winget upgrades listed';Write-Host '[OK] Winget upgrade preview collected.' -ForegroundColor Green}else{& winget.exe upgrade --all --silent --accept-package-agreements --accept-source-agreements 2>&1|Tee-Object -FilePath (Join-Path $Session.RawDir 'winget-upgrade-all.txt');if($LASTEXITCODE -ne 0){throw 'winget upgrade failed'};$Session.ChangedSystem=$true;$Session.VerificationPerformed=$true;$Session.VerificationResult='Winget upgrade workflow completed';Write-Host '[OK] Winget upgrade workflow completed.' -ForegroundColor Green}
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
