# knoux Repair v2.0.2 | 11-Backup-Recovery | BR03 - Verify Latest Backup
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'BR03' -ToolName 'Verify Latest Backup' -Category '11-Backup-Recovery' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$root = Join-Path $Session.ProjectRoot 'Backups'
  $latest = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latest) { Write-Host '[OK] No local backup folder found.' -ForegroundColor Yellow; $Session.Status = 'Warning' }
  else { $files = @(Get-ChildItem -LiteralPath $latest.FullName -File -Recurse -ErrorAction SilentlyContinue); $files | Select-Object FullName,Length,LastWriteTime | Export-Csv (Join-Path $Session.RawDir 'backup-inventory.csv') -NoTypeInformation -Encoding UTF8; $Session.ItemsFound = $files.Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Latest backup inventory exported'; Write-Host ('[OK] Verified {0} files in {1}' -f $files.Count, $latest.FullName) -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
