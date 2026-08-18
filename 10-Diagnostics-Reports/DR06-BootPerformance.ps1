#Requires -Version 5.1
#  knoux Repair v2.0 | 10-Diagnostics-Reports | DR06 - Boot Performance
#  Risk: READ_ONLY
#  Reports last boot time, boot duration (from the event log), and
#  current performance counters.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR06' -ToolName 'Boot Performance' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $sys = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_System -ErrorAction SilentlyContinue

    Write-Host 'Boot performance:' -ForegroundColor Cyan
    Write-Host ('  Last boot:       {0}' -f $os.LastBootUpTime) -ForegroundColor Gray
    $uptime = (Get-Date) - $os.LastBootUpTime
    Write-Host ('  Up time:         {0:N2} hours' -f $uptime.TotalHours) -ForegroundColor Gray

    $bootEvent = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100; StartTime = (Get-Date).AddDays(-7) } -MaxEvents 1 -ErrorAction SilentlyContinue)
    if ($bootEvent.Count -gt 0) {
        $durMs = [regex]::Match($bootEvent[0].Message, 'Total boot (?:time|duration):\s*(\d+)')
        if ($durMs.Success) {
            $sec = [math]::Round([int]$durMs.Groups[1].Value / 1000, 1)
            Write-Host ('  Last boot duration: {0} s (from event log)' -f $sec) -ForegroundColor Gray
        }
    }

    if ($sys) {
        Write-Host ('  Processes:       {0}' -f $sys.Processes) -ForegroundColor Gray
        Write-Host ('  Threads:         {0}' -f $sys.Threads) -ForegroundColor Gray
        Write-Host ('  System up time:  {0} s' -f $sys.SystemUpTime) -ForegroundColor Gray
    }

    $rows = [pscustomobject]@{ LastBoot = $os.LastBootUpTime; UptimeHours = [math]::Round($uptime.TotalHours, 2); Processes = $(if ($sys) { $sys.Processes } else { '' }) }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'boot-perf.json') -Encoding UTF8
    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session 'Boot performance collected'
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
