# knoux Repair v2.0.2 | 13-Privacy | PR01 - Privacy Audit
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PR01' -ToolName 'Privacy Audit' -Category '13-Privacy' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$paths = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Privacy','HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
  $rows = foreach ($path in $paths) { if (Test-Path $path) { Get-ItemProperty -Path $path | Select-Object PSPath,* } }
  $rows | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Session.RawDir 'privacy-audit.json') -Encoding UTF8
  $Session.ItemsFound = @($rows).Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Privacy registry values exported'; Write-Host '[OK] Privacy audit exported.' -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
