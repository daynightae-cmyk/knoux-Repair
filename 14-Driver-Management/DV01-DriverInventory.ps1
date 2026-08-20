# knoux Repair v2.0.2 | 14-Driver-Management | DV01 - Driver Inventory
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'DV01' -ToolName 'Driver Inventory' -Category '14-Driver-Management' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$drivers = Get-CimInstance Win32_PnPSignedDriver | Select-Object DeviceName,DriverProviderName,DriverVersion,DriverDate,InfName,IsSigned
  $drivers | Export-Csv (Join-Path $Session.RawDir 'driver-inventory.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound = @($drivers).Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Signed driver inventory exported'; Write-Host ('[OK] Exported {0} driver records.' -f $Session.ItemsFound) -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
