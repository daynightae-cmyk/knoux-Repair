#Requires -Version 5.1
#  knoux Repair v2.0.2 | 08-Performance | PF10 - Full Performance Report
#  Risk: READ_ONLY
#  Aggregates boot, startup, memory, disk, power plan, and thermal
#  data into one performance report saved under raw-output.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF10' -ToolName 'Full Performance Report' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $total = $os.TotalVisibleMemorySize / 1MB
    $free = $os.FreePhysicalMemory / 1MB
    $memPct = [math]::Round((($total - $free) / $total) * 100, 1)
    $uptime = (Get-Date) - $os.LastBootUpTime

    $plans = Get-KnouxPowerPlans
    $activePlan = if ($plans.ActivePlan) { $plans.ActivePlan.Name } else { 'n/a' }

    $startupCount = @(Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction SilentlyContinue).Count
    $taskCount = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.State -ne 'Disabled' }).Count
    $thermalAvailable = @(Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue).Count -gt 0

    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object LoadPercentage -Average
    $cpuAvg = [math]::Round($cpu.Average, 1)

    $summary = [ordered]@{
        GeneratedAt = (Get-Date).ToString('s')
        OS = $os.Caption
        UptimeDays = [math]::Round($uptime.TotalDays, 1)
        CpuLoadPct = $cpuAvg
        MemoryUsedPct = $memPct
        TotalMemoryGB = [math]::Round($total, 1)
        StartupEntries = $startupCount
        EnabledScheduledTasks = $taskCount
        ActivePowerPlan = $activePlan
        ThermalSensor = $thermalAvailable
    }

    Write-Host 'Full performance report:' -ForegroundColor Cyan
    foreach ($k in $summary.Keys) {
        Write-Host ('  {0,-22} {1}' -f $k, $summary[$k]) -ForegroundColor DarkGray
    }

    $summary | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'full-performance-report.json') -Encoding UTF8
    $Session.ItemsFound = $summary.Keys.Count
    $Session.ItemsProcessed = $summary.Keys.Count
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session 'Full performance report generated'
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
