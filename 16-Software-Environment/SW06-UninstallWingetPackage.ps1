[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [string]$PackageId)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW06' -ToolName 'Uninstall Winget Package' -Category '16-Software-Environment' -RiskLevel 'DESTRUCTIVE'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  if([string]::IsNullOrWhiteSpace($PackageId)){throw 'PackageId is required.'}
  if($AnalyzeOnly -or $WhatIf){& winget.exe show --id $PackageId --exact 2>&1|Tee-Object -FilePath (Join-Path $Session.RawDir 'winget-package-preview.txt');$Session.VerificationPerformed=$true;$Session.VerificationResult='Exact Winget package inspected';Write-Host ('[ANALYZE] Would uninstall '+$PackageId) -ForegroundColor Green}else{& winget.exe uninstall --id $PackageId --exact --silent --accept-source-agreements 2>&1|Tee-Object -FilePath (Join-Path $Session.RawDir 'winget-uninstall.txt');if($LASTEXITCODE -ne 0){throw 'winget uninstall failed'};$Session.ChangedSystem=$true;$Session.VerificationPerformed=$true;$Session.VerificationResult='Exact Winget uninstall completed';Write-Host ('[OK] Uninstalled '+$PackageId) -ForegroundColor Green}
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
