#Requires -Version 5.1
#  knoux Repair v2.0.2 | 10-Diagnostics-Reports | DR09 - Performance Snapshot
#  Risk: READ_ONLY
#  Live snapshot of CPU, memory, disk, and network performance.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR09' -ToolName 'Performance Snapshot' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object LoadPercentage -Average
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $total = $os.TotalVisibleMemorySize / 1MB
    $free = $os.FreePhysicalMemory / 1MB
    $memPct = [math]::Round((($total - $free) / $total) * 100, 1)

    Write-Host 'Performance snapshot:' -ForegroundColor Cyan
    Write-Host ('  CPU load:       {0:N1}%' -f $cpu.Average) -ForegroundColor $(if ($cpu.Average -lt 60) { 'Green' } elseif ($cpu.Average -lt 85) { 'Yellow' } else { 'Red' })
    Write-Host ('  Memory used:    {0:N1}%' -f $memPct) -ForegroundColor $(if ($memPct -lt 75) { 'Green' } elseif ($memPct -lt 90) { 'Yellow' } else { 'Red' })

    Write-Host '  Disks (active time):' -ForegroundColor Gray
    $disks = @(Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne '_Total' })
    foreach ($d in $disks) {
        Write-Host ('    {0,-10} {1,6:N1}%' -f $d.Name, $d.PercentDiskTime) -ForegroundColor DarkGray
    }

    Write-Host '  Network (bytes/sec):' -ForegroundColor Gray
    $nics = @(Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '_*' })
    foreach ($n in $nics) {
        $up = $n.BytesSentPerSec / 1KB
        $dn = $n.BytesReceivedPerSec / 1KB
        Write-Host ('    {0,-30} up {1,8:N0} KB/s   down {2,8:N0} KB/s' -f $n.Name, $up, $dn) -ForegroundColor DarkGray
    }

    $rows = [pscustomobject]@{ CPULoad = [math]::Round($cpu.Average, 1); MemoryUsedPct = $memPct; Timestamp = (Get-Date) }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'perf-snapshot.json') -Encoding UTF8
    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Perf snapshot: CPU {0:N1}%, Mem {1:N1}%" -f $cpu.Average, $memPct)
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
