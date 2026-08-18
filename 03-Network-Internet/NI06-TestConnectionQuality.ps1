#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI06 - Test Connection Quality
#  Risk: READ_ONLY | Offline: Partial (needs internet)
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI06' -ToolName 'Test Connection Quality' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $false
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

Write-Host 'This test pings a public host (8.8.8.8) and traces the route.' -ForegroundColor DarkGray
Write-Host 'It requires an active internet connection.' -ForegroundColor DarkGray

$ping = "$env:SystemRoot\System32\ping.exe"
$r = Invoke-KnouxNativeCommand -FilePath $ping -ArgumentList @('-n', '10', '8.8.8.8') -TimeoutSeconds 90
if ($r) {
    $r.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ping-108.txt') -Encoding UTF8
    $rc = $r.ExitCode
    Write-KnouxLog -Session $Session ("ping 8.8.8.8 exit {0}" -f $rc)
    $lines = @($r.Stdout -split "`r?`n")
    foreach ($line in $lines) {
        if ($line -match 'time[=<]|Loss|lost|Minimum|Packets') {
            Write-Host ('  ' + $line.Trim()) -ForegroundColor Cyan
        }
    }
    $lost = 0
    $avg = $null
    if ($r.Stdout -match '\((\d+)% loss\)') { $lost = [int]$matches[1] }
    if ($r.Stdout -match 'Average = (\d+)ms') { $avg = [int]$matches[1] }
    Write-Host ('  Packet loss: ' + $lost + '%   Average latency: ' + $(if ($avg) { $avg.ToString() + ' ms' } else { 'n/a' })) -ForegroundColor Yellow
    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    if ($lost -lt 5 -and $avg -ne $null) {
        $Session.Status = 'Success'
        Write-Host '[OK] Connection quality is good.' -ForegroundColor Green
    } else {
        $Session.Status = 'Warning'
        $Session.ErrorMessage = 'Packet loss or latency is above normal thresholds.'
        Write-Host '[WARN] Connection quality needs attention.' -ForegroundColor Yellow
    }
} else {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'ping could not be started.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
