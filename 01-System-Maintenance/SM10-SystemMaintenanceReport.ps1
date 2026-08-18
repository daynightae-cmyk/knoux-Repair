#Requires -Version 5.1
#  knoux Repair v2.0 | 01-System-Maintenance | SM10 - System Maintenance Report
#  Risk: READ_ONLY | Offline: Yes
#  Aggregates maintenance-relevant facts: OS/build, uptime, free
#  space, last SFC/CBS activity, and component store size.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM10' -ToolName 'System Maintenance Report' -Category '01-System-Maintenance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-KnouxOperatingSystemInfo
    $drive = (Get-PSDrive -Name $env:SystemDrive.TrimEnd(':'))
    $cbs = @(Get-ChildItem -LiteralPath "$env:SystemRoot\Logs\CBS" -Filter 'CBS.log' -ErrorAction SilentlyContinue)
    $lastCbs = if ($cbs.Count -gt 0) { $cbs[0].LastWriteTime } else { $null }

    $report = [pscustomobject]@{
        OS = if ($os) { $os.Caption } else { 'Unknown' }
        Build = if ($os) { $os.BuildNumber } else { 'Unknown' }
        UptimeSince = if ($os -and $os.LastBootUpTime) { $os.LastBootUpTime.ToString('s') } else { 'Unknown' }
        FreeSpaceGB = if ($drive) { [math]::Round($drive.Free / 1GB, 2) } else { 0 }
        TotalSpaceGB = if ($drive) { [math]::Round(($drive.Free + $drive.Used) / 1GB, 2) } else { 0 }
        LastCbsLog = if ($lastCbs) { $lastCbs.ToString('s') } else { $null }
        MaintenanceRecommendation = 'Run SM01 (verify) then SM04 (scan) periodically; schedule SM07 after errors.'
    }
    $report | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'maintenance-report.json') -Encoding UTF8

    Write-Host 'System Maintenance Report:' -ForegroundColor Cyan
    Write-Host ('  OS: {0} (build {1})' -f $report.OS, $report.Build) -ForegroundColor White
    Write-Host ('  Uptime since: {0}' -f $report.UptimeSince) -ForegroundColor White
    Write-Host ('  System drive free: {0:N2} GB of {1:N2} GB' -f $report.FreeSpaceGB, $report.TotalSpaceGB) -ForegroundColor White
    Write-Host ('  Last CBS (component servicing) log: {0}' -f $report.LastCbsLog) -ForegroundColor White
    Write-Host ('  Recommendation: {0}' -f $report.MaintenanceRecommendation) -ForegroundColor Gray

    $Session.ItemsFound = 6
    $Session.ItemsProcessed = 6
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session 'System maintenance report generated'
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