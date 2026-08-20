# Knoux Repair v2.0.2 | 18-Project-Sonar | SN01 - Project Discovery
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ProjectSonar.Engine.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SN01' -ToolName 'Project Sonar Discovery' -Category '18-Project-Sonar' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = Resolve-SonarWorkspace $LocalSourcePath
  $snapshot = Get-SonarSnapshot $workspace
  $snapshot | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $Session.RawDir 'sonar-discovery.json') -Encoding UTF8
  $Session.ItemsFound = $snapshot.FileCount
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Mapped {0} files and {1} detected languages.' -f $snapshot.FileCount,$snapshot.Languages.Count)
  Write-Host ('[OK] Project mapped: ' + $workspace) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
