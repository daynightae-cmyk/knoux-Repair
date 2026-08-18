#Requires -Version 5.1
#  knoux Repair v2.0.2 | 08-Performance | PF03 - Power Plan Audit
#  Risk: READ_ONLY
#  Audits all power plans and shows which one is active. Read-only.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF03' -ToolName 'Power Plan Audit' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $p = Get-KnouxPowerPlans
    Write-Host 'Power plans:' -ForegroundColor Cyan
    foreach ($plan in $p.Plans) {
        $marker = if ($plan.Active) { ' [ACTIVE]' } else { '' }
        Write-Host ('  {0}  {1}{2}' -f $plan.Name, $plan.Guid, $marker) -ForegroundColor $(if ($plan.Active) { 'Green' } else { 'DarkGray' })
    }
    if (-not $p.ActivePlan) { Write-Host '  (none active / powercfg unavailable)' -ForegroundColor DarkGray }

    $rows = $p.Plans | ForEach-Object { [pscustomobject]@{ Name = $_.Name; Guid = $_.Guid; Active = $_.Active } }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'power-plans.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = $rows.Count
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Power plans audited: {0}" -f $rows.Count)
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
