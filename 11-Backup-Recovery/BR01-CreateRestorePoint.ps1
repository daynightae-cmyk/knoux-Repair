# knoux Repair v2.0.2 | 11-Backup-Recovery | BR01 - Create System Restore Point
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'BR01' -ToolName 'Create System Restore Point' -Category '11-Backup-Recovery' -RiskLevel 'SYSTEM_REPAIR'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
if ($AnalyzeOnly -or $WhatIf) { Write-Host '[ANALYZE] A restore point would be created. No changes made.' -ForegroundColor Green; $Session.Status = 'Success' }
  else {
    Checkpoint-Computer -Description ('KnouxRepair-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) -RestorePointType 'MODIFY_SETTINGS'
    $Session.ChangedSystem = $true; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Checkpoint-Computer completed'; Write-Host '[OK] Restore point created.' -ForegroundColor Green
  }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
