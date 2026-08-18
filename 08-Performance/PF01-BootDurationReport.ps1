#Requires -Version 5.1
#  knoux Repair v2.0.2 | 08-Performance | PF01 - Boot Duration Report
#  Risk: READ_ONLY
#  Measures the current boot duration and system uptime using
#  performance data and the boot event log when available.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF01' -ToolName 'Boot Duration Report' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $uptime = (Get-Date) - $os.LastBootUpTime

    $bootMs = $null
    try {
        $boot = Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Diagnostics-Performance/Operational'; Id = 100 } -MaxEvents 1 -ErrorAction SilentlyContinue
        if ($boot) {
            $bootMs = [int64]($boot.Properties | Where-Object { $_.Name -eq 'BootTime' } | Select-Object -First 1).Value
        }
    } catch { $bootMs = $null }

    Write-Host 'Boot duration:' -ForegroundColor Cyan
    if ($bootMs) {
        $sec = [math]::Round($bootMs / 1000.0, 1)
        Write-Host ('  Last boot time (event log): {0:N1} s' -f $sec) -ForegroundColor $(if ($sec -lt 60) { 'Green' } elseif ($sec -lt 120) { 'Yellow' } else { 'Red' })
    } else {
        Write-Host '  Last boot time (event log): not available on this system' -ForegroundColor DarkGray
    }
    Write-Host ('  Uptime: {0}d {1}h {2}m' -f $uptime.Days, $uptime.Hours, $uptime.Minutes) -ForegroundColor DarkGray

    $rows = [pscustomobject]@{
        LastBootTime = $os.LastBootUpTime.ToString('s')
        UptimeSeconds = [int64]$uptime.TotalSeconds
        BootDurationMs = $bootMs
        Source = if ($bootMs) { 'event-log' } else { 'uptime-only' }
    }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'boot-duration.json') -Encoding UTF8
    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Boot report: uptime {0}d {1}h, boot-ms {2}" -f $uptime.Days, $uptime.Hours, $bootMs)
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
