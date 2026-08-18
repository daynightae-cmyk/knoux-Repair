#Requires -Version 5.1
#  knoux Repair v2.0 | 10-Diagnostics-Reports | DR10 - Full Diagnostic Report
#  Risk: READ_ONLY
#  Combines system, hardware, disk, memory, and event information into
#  one report. Read-only.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR10' -ToolName 'Full Diagnostic Report' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    Write-Host 'Collecting full diagnostics...' -ForegroundColor Cyan

    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    $vols = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue)
    $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue)

    Write-Host '  System' -ForegroundColor Gray
    Write-Host ('    OS: {0} ({1})  Build {2}' -f $os.Caption, $os.OSArchitecture, $os.BuildNumber) -ForegroundColor DarkGray
    Write-Host ('    Machine: {0} {1}' -f $cs.Manufacturer, $cs.Model) -ForegroundColor DarkGray
    Write-Host ('    CPU: {0}  ({1} cores / {2} logical)' -f $cpu.Name, $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors) -ForegroundColor DarkGray
    Write-Host ('    RAM: {0:N1} GB   BIOS: {1}' -f ($cs.TotalPhysicalMemory / 1GB), $bios.SMBIOSBIOSVersion) -ForegroundColor DarkGray
    Write-Host ('    Uptime: {0:N1} days' -f ((Get-Date) - $os.LastBootUpTime).TotalDays) -ForegroundColor DarkGray

    Write-Host '  Storage' -ForegroundColor Gray
    foreach ($v in $vols) {
        $free = if ($v.FreeSpace) { [math]::Round($v.FreeSpace / 1GB, 1) } else { 0 }
        $size = if ($v.Size) { [math]::Round($v.Size / 1GB, 1) } else { 0 }
        $pct = if ($size -gt 0) { [math]::Round((($size - $free) / $size) * 100, 1) } else { 0 }
        Write-Host ('    {0}: {1:N1} GB free of {2:N1} GB ({3:N1}% used)' -f $v.DeviceID, $free, $size, $pct) -ForegroundColor DarkGray
    }

    Write-Host '  Graphics' -ForegroundColor Gray
    foreach ($g in $gpus) {
        Write-Host ('    {0}' -f $g.Name) -ForegroundColor DarkGray
    }

    $cpuLoad = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object LoadPercentage -Average
    $memFree = $os.FreePhysicalMemory / 1MB
    $memTotal = $os.TotalVisibleMemorySize / 1MB
    Write-Host '  Load' -ForegroundColor Gray
    Write-Host ('    CPU: {0:N1}%   Memory: {1:N1}% used' -f $cpuLoad.Average, [math]::Round((($memTotal - $memFree) / $memTotal) * 100, 1)) -ForegroundColor DarkGray

    $summary = [pscustomobject]@{
        Generated = (Get-Date); OS = $os.Caption; Build = $os.BuildNumber; Machine = ($cs.Manufacturer + ' ' + $cs.Model)
        CPU = $cpu.Name; RAMGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1); UptimeDays = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1)
        CPU_Pct = [math]::Round($cpuLoad.Average, 1); MemoryUsed_Pct = [math]::Round((($memTotal - $memFree) / $memTotal) * 100, 1)
        Disks = ($disks.Count); Volumes = ($vols.Count); GPUs = ($gpus.Count)
    }
    $summary | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'diagnostics-summary.json') -Encoding UTF8
    $summary | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'diagnostics-summary.csv') -NoTypeInformation -Encoding UTF8

    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-Host '[OK] Full diagnostic report generated.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Full diagnostic report generated'
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
