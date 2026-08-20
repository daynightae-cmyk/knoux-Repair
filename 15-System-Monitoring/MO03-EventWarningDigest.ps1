# knoux Repair v2.0.2 | 15-System-Monitoring | MO03 - Event Warning Digest
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'MO03' -ToolName 'Event Warning Digest' -Category '15-System-Monitoring' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$events = @(Get-WinEvent -FilterHashtable @{ LogName='System','Application'; StartTime=(Get-Date).AddDays(-2); Level=2,3 } -ErrorAction SilentlyContinue | Select-Object -First 300 TimeCreated,LogName,Id,LevelDisplayName,ProviderName,Message)
  $events | Export-Csv (Join-Path $Session.RawDir 'event-warning-digest.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound = $events.Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Event warning digest exported'; Write-Host ('[OK] Exported {0} warning and error events.' -f $events.Count) -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
