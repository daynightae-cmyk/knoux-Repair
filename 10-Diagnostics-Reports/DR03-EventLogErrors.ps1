#Requires -Version 5.1
#  knoux Repair v2.0 | 10-Diagnostics-Reports | DR03 - Event Log Errors
#  Risk: READ_ONLY
#  Lists recent Error-level events from System and Application logs.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR03' -ToolName 'Event Log Errors' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0
$max = 15

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    foreach ($logName in @('System', 'Application')) {
        Write-Host ('{0} log - last {1} Error/Critical events:' -f $logName, $max) -ForegroundColor Cyan
        $events = @(Get-WinEvent -FilterHashtable @{ LogName = $logName; Level = 1, 2; StartTime = (Get-Date).AddDays(-7) } -MaxEvents $max -ErrorAction SilentlyContinue)
        if ($events.Count -eq 0) {
            Write-Host '  (none in the last 7 days)' -ForegroundColor Gray
        } else {
            foreach ($ev in $events) {
                $src = $ev.ProviderName
                if ($src.Length -gt 38) { $src = $src.Substring(0, 35) + '...' }
                Write-Host ('  {0,-38} {1,-12} {2}' -f $src, $ev.TimeCreated.ToString('MM-dd HH:mm'), $ev.Id) -ForegroundColor Red
            }
        }
    }
    $all = @(Get-WinEvent -FilterHashtable @{ LogName = 'System', 'Application'; Level = 1, 2; StartTime = (Get-Date).AddDays(-7) } -MaxEvents 200 -ErrorAction SilentlyContinue)
    $rows = @($all | Select-Object -First 50 | ForEach-Object { [pscustomobject]@{ Time = $_.TimeCreated; Log = $_.LogName; Id = $_.Id; Provider = $_.ProviderName; Level = $_.LevelDisplayName } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'event-errors.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'event-errors.json') -Encoding UTF8
    $Session.ItemsFound = $all.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Event log errors: $($all.Count) found in last 7 days"
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
