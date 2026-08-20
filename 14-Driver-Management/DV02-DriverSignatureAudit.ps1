# knoux Repair v2.0.2 | 14-Driver-Management | DV02 - Driver Signature Audit
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'DV02' -ToolName 'Driver Signature Audit' -Category '14-Driver-Management' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$unsigned = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.IsSigned -ne $true } | Select-Object DeviceName,DriverProviderName,DriverVersion,InfName,IsSigned
  $unsigned | Export-Csv (Join-Path $Session.RawDir 'unsigned-driver-audit.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound = @($unsigned).Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Unsigned driver audit exported'; Write-Host ('[OK] Found {0} unsigned driver records.' -f $Session.ItemsFound) -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
