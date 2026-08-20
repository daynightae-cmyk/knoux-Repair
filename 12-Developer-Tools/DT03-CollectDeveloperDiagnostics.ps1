# knoux Repair v2.0.2 | 12-Developer-Tools | DT03 - Collect Developer Diagnostics
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'DT03' -ToolName 'Collect Developer Diagnostics' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
[pscustomobject]@{ CurrentDirectory=(Get-Location).Path; Path=$env:Path; PSVersion=$PSVersionTable.PSVersion.ToString(); Timestamp=(Get-Date).ToString('o') } | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $Session.RawDir 'developer-diagnostics.json') -Encoding UTF8
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) { try { & $git.Source status --short 2>&1 | Set-Content (Join-Path $Session.RawDir 'git-status.txt') -Encoding UTF8 } catch { Write-KnouxLog -Session $Session -Message 'Git status could not be collected.' -Level WARN } }
  $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Developer diagnostics collected'; Write-Host '[OK] Developer diagnostics written to raw-output.' -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
