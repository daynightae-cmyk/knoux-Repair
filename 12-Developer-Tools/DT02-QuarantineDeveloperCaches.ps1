# knoux Repair v2.0.2 | 12-Developer-Tools | DT02 - Quarantine Developer Caches
# Risk: SAFE_CLEANUP
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'DT02' -ToolName 'Quarantine Developer Caches' -Category '12-Developer-Tools' -RiskLevel 'SAFE_CLEANUP'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$candidates = @((Join-Path $env:LOCALAPPDATA 'npm-cache'),(Join-Path $env:LOCALAPPDATA 'Yarn\Cache'),(Join-Path $env:LOCALAPPDATA 'pip\Cache')) | Where-Object { Test-Path -LiteralPath $_ }
  $Session.ItemsFound = $candidates.Count
  $qRoot = Join-Path $Session.ProjectRoot ('Quarantine\DT02\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  $Session.QuarantinePath = $qRoot
  if ($AnalyzeOnly -or $WhatIf) { Write-Host ('[ANALYZE] {0} cache folders would be moved to quarantine.' -f $candidates.Count) -ForegroundColor Green; $Session.Status = 'Success' }
  else { New-Item -ItemType Directory -Path $qRoot -Force | Out-Null; foreach ($item in $candidates) { Move-Item -LiteralPath $item -Destination (Join-Path $qRoot (Split-Path $item -Leaf)) -Force; $Session.ItemsProcessed++; $Session.QuarantinedCount++ }; $Session.ChangedSystem = $true; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Developer caches moved to quarantine'; Write-Host ('[OK] Quarantined {0} developer cache folders.' -f $Session.ItemsProcessed) -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
