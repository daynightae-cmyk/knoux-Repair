# Knoux Repair v2.0.2 | 18-Project-Sonar | SN05 - Bilingual Engineering Brief
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ProjectSonar.Engine.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SN05' -ToolName 'Project Sonar Bilingual Engineering Brief' -Category '18-Project-Sonar' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = Resolve-SonarWorkspace $LocalSourcePath
  $snapshot = Get-SonarSnapshot $workspace
    $findings = @(Get-SonarFindings $snapshot)

  $payload = Export-SonarArtifacts -Session $Session -Snapshot $snapshot -Findings $findings -Prefix 'sonar-engineering-brief'
  $Session.ItemsFound = $findings.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'English and Arabic evidence reports plus model-neutral prompt packs were created.'
  Write-Host '[OK] Bilingual engineering brief and prompt packs created.' -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
