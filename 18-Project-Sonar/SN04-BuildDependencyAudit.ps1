# Knoux Repair v2.0.2 | 18-Project-Sonar | SN04 - Build and Dependency Audit
# Risk: READ_ONLY
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ProjectSonar.Engine.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SN04' -ToolName 'Project Sonar Build and Dependency Audit' -Category '18-Project-Sonar' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = Resolve-SonarWorkspace $LocalSourcePath
  $snapshot = Get-SonarSnapshot $workspace
  $lockfiles = @($snapshot.Markers | Where-Object { $_.Name -match 'lock|package-lock|pnpm|yarn|requirements|pyproject|Pipfile|go.mod|Cargo|composer|Gemfile' -and $_.Present })
  [pscustomobject]@{ Workspace=$workspace; PackageName=$snapshot.PackageName; Scripts=$snapshot.PackageScripts; LockMarkers=$lockfiles; Languages=$snapshot.Languages; PackageParseError=$snapshot.PackageParseError } | ConvertTo-Json -Depth 7 | Set-Content (Join-Path $Session.RawDir 'sonar-build-dependencies.json') -Encoding UTF8
  $Session.ItemsFound = $lockfiles.Count + $snapshot.PackageScripts.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Collected {0} build/dependency markers.' -f $Session.ItemsFound)
  Write-Host ('[OK] Build and dependency evidence collected for: ' + $workspace) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
