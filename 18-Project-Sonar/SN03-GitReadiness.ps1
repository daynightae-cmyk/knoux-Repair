# Knoux Repair v2.0.2 | 18-Project-Sonar | SN03 - Git Readiness
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ProjectSonar.Engine.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SN03' -ToolName 'Project Sonar Git Readiness' -Category '18-Project-Sonar' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = Resolve-SonarWorkspace $LocalSourcePath
  $snapshot = Get-SonarSnapshot $workspace
  $payload = [pscustomobject]@{ Workspace=$workspace; Git=$snapshot.Git; GitIgnore=($snapshot.Markers|Where-Object Name -eq '.gitignore'|Select-Object -ExpandProperty Present); CapturedAt=(Get-Date).ToString('o') }
  $payload | ConvertTo-Json -Depth 7 | Set-Content (Join-Path $Session.RawDir 'sonar-git-readiness.json') -Encoding UTF8
  $Session.ItemsFound = $snapshot.Git.Status.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = if($snapshot.Git.Repository){'Git branch, state, remotes and ignore marker collected.'}else{'No Git work tree was detected for the selected workspace.'}
  Write-Host ('[OK] ' + $Session.VerificationResult) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
