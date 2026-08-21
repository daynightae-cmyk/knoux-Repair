# knoux Repair v2.0.2 | 13-Privacy | PR03 - Flush DNS Privacy Cache
# Risk: SAFE_CLEANUP
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PR03' -ToolName 'Flush DNS Privacy Cache' -Category '13-Privacy' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
if (-not ($AnalyzeOnly -or $WhatIf) -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
    $result = Stop-KnouxSession -Session $Session
    Write-KnouxResult -Session $Session
    return $result
}
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
if ($AnalyzeOnly -or $WhatIf) { Write-Host '[ANALYZE] The local DNS resolver cache would be cleared. No changes made.' -ForegroundColor Green; $Session.Status = 'Success' }
  else { Clear-DnsClientCache; $Session.ChangedSystem = $true; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Clear-DnsClientCache completed'; Write-Host '[OK] DNS resolver cache cleared.' -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
