# Knoux Repair v2.0.2 | 18-Project-Sonar | SN06 - Model-Neutral Handoff Bundle
# Risk: READ_ONLY
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ProjectSonar.Engine.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SN06' -ToolName 'Project Sonar Model-Neutral Handoff Bundle' -Category '18-Project-Sonar' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = Resolve-SonarWorkspace $LocalSourcePath
  $snapshot = Get-SonarSnapshot $workspace
    $findings = @(Get-SonarFindings $snapshot)

  $payload = Export-SonarArtifacts -Session $Session -Snapshot $snapshot -Findings $findings -Prefix 'sonar-handoff'
  $manifest = [pscustomobject]@{ Workspace=$workspace; GeneratedAt=(Get-Date).ToString('o'); Artifact='sanitized metadata, findings, Arabic and English prompt packs'; SecretsIncluded=$false; FileContentsIncluded=$false }
  $manifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'sonar-handoff-manifest.json') -Encoding UTF8
  $Session.ItemsFound = $findings.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Created a sanitized model-neutral project handoff bundle without source-file contents or secrets.'
  Write-Host '[OK] Sanitized model-neutral handoff bundle created.' -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
