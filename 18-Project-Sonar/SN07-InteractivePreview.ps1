# Knoux Repair v2.0.2 | 18-Project-Sonar | SN07 - Interactive Preview
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'ProjectSonar.Engine.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SN07' -ToolName 'Project Sonar Interactive Preview' -Category '18-Project-Sonar' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = Resolve-SonarWorkspace $LocalSourcePath
  $snapshot = Get-SonarSnapshot $workspace
  $findings = @(Get-SonarFindings $snapshot)
  $payload = Export-SonarArtifacts -Session $Session -Snapshot $snapshot -Findings $findings -Prefix 'sonar-interactive-preview'
  $servicePlan = @(
    [pscustomobject]@{ ToolId='SN01'; Action='Map project metadata and technology markers'; Changes=$false }
    [pscustomobject]@{ ToolId='SN02'; Action='Prioritize completeness gaps from local evidence'; Changes=$false }
    [pscustomobject]@{ ToolId='SN03'; Action='Inspect Git readiness and work-tree state'; Changes=$false }
    [pscustomobject]@{ ToolId='SN04'; Action='Inspect build scripts and dependency markers'; Changes=$false }
    [pscustomobject]@{ ToolId='SN05'; Action='Create Arabic and English engineering brief'; Changes=$false }
    [pscustomobject]@{ ToolId='SN06'; Action='Create sanitized model-neutral handoff prompts'; Changes=$false }
  )
  $preview = [pscustomobject]@{
    Workspace = $workspace
    Snapshot = $snapshot
    Findings = $findings
    SeverityCounts = $payload.SeverityCounts
    ServicePlan = $servicePlan
    PromptEnglish = Get-SonarPromptPack -Snapshot $snapshot -Findings $findings -Language 'en'
    PromptArabic = Get-SonarPromptPack -Snapshot $snapshot -Findings $findings -Language 'ar'
    ReportsFolder = $Session.RawDir
  }
  $Session.ItemsFound = $findings.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Interactive preview prepared from local metadata; no source contents or secrets were copied.'
  if ($EmitJson) {
    Write-Output '---KNOUX_SONAR_JSON_START---'
    $preview | ConvertTo-Json -Depth 12 -Compress
    Write-Output '---KNOUX_SONAR_JSON_END---'
  } else {
    Write-Host ('[OK] Interactive preview found {0} prioritized findings.' -f $findings.Count) -ForegroundColor Green
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
