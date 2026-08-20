# knoux Repair v2.0.2 | 15-System-Monitoring | MO02 - Top Resource Processes
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'MO02' -ToolName 'Top Resource Processes' -Category '15-System-Monitoring' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$processes = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 30 ProcessName,Id,CPU,WorkingSet64,Path
  $processes | Export-Csv (Join-Path $Session.RawDir 'top-resource-processes.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound = @($processes).Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Top process list exported'; Write-Host ('[OK] Exported {0} process records.' -f $Session.ItemsFound) -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
