# knoux Repair v2.0.2 | 14-Driver-Management | DV03 - Export Third-Party Drivers
# Risk: SYSTEM_REPAIR
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'DV03' -ToolName 'Export Third-Party Drivers' -Category '14-Driver-Management' -RiskLevel 'SYSTEM_REPAIR'
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
$destination = Join-Path $Session.ProjectRoot ('Backups\Drivers-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  $Session.BackupPath = $destination
  if ($AnalyzeOnly -or $WhatIf) { Write-Host ('[ANALYZE] Third-party drivers would be exported to {0}' -f $destination) -ForegroundColor Green; $Session.Status = 'Success' }
  else { New-Item -ItemType Directory -Path $destination -Force | Out-Null; & pnputil.exe /export-driver * $destination 2>&1 | Tee-Object -FilePath (Join-Path $Session.RawDir 'pnputil-export.txt'); if ($LASTEXITCODE -ne 0) { throw "pnputil export failed with exit code $LASTEXITCODE" }; $Session.ItemsProcessed = @(Get-ChildItem -LiteralPath $destination -Directory -ErrorAction SilentlyContinue).Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'pnputil export completed'; Write-Host ('[OK] Exported driver packages to {0}' -f $destination) -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
