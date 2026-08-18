#Requires -Version 5.1
#  knoux Repair v2.0.2 | 09-Security | SE04 - Firewall Status
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE04' -ToolName 'Firewall Status' -Category '09-Security' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $fw = Get-KnouxFirewallStatus
    if (@($fw).Count -eq 0) { throw 'Firewall status could not be read (netsh unavailable).' }
    Write-Host 'Firewall profiles:' -ForegroundColor Cyan
    $rows = @()
    foreach ($p in $fw) {
        $state = if ($p.Enabled) { 'Enabled' } else { 'Disabled' }
        $color = if ($p.Enabled) { 'Green' } else { 'Red' }
        Write-Host ('  {0,-20} {1}' -f $p.Profile, $state) -ForegroundColor $color
        $rows += [pscustomobject]@{ Profile = $p.Profile; Enabled = $p.Enabled }
    }
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'firewall.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'firewall.json') -Encoding UTF8
    $fwCount = @($fw).Count
    $Session.ItemsFound = $fwCount
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Firewall status: {0} profiles" -f $fwCount)
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
