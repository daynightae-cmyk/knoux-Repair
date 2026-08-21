# knoux Repair v2.0.2 | 11-Backup-Recovery | BR02 - Backup User Profile
# Risk: SAFE_CLEANUP
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'BR02' -ToolName 'Backup User Profile' -Category '11-Backup-Recovery' -RiskLevel 'SAFE_CLEANUP'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$roots = @('Documents','Desktop','Pictures','Music','Videos') | ForEach-Object { Join-Path $env:USERPROFILE $_ } | Where-Object { Test-Path -LiteralPath $_ }
  $destination = Join-Path $Session.ProjectRoot ('Backups\UserProfile-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  $Session.BackupPath = $destination
  $Session.ItemsFound = $roots.Count
  if ($AnalyzeOnly -or $WhatIf) { Write-Host ('[ANALYZE] {0} user folders would be copied to {1}' -f $roots.Count, $destination) -ForegroundColor Green; $Session.Status = 'Success' }
  else {
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    foreach ($root in $roots) { Copy-Item -LiteralPath $root -Destination (Join-Path $destination (Split-Path $root -Leaf)) -Recurse -Force; $Session.ItemsProcessed++ }
    $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Backup destination created and source folders copied'; Write-Host ('[OK] Backup saved to {0}' -f $destination) -ForegroundColor Green
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
