#Requires -Version 5.1
#  knoux Repair v2.0.2 | 10-Diagnostics-Reports | DR07 - Memory Diagnostics
#  Risk: READ_ONLY
#  Reports physical memory configuration and usage. Read-only.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR07' -ToolName 'Memory Diagnostics' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop
    $modules = @(Get-CimInstance -ClassName Win32_PhysicalMemory -ErrorAction SilentlyContinue)

    $total = $cs.TotalPhysicalMemory / 1GB
    $free = $os.FreePhysicalMemory / 1MB
    $usedPct = [math]::Round((($total - $free) / $total) * 100, 1)

    Write-Host 'Memory:' -ForegroundColor Cyan
    Write-Host ('  Total physical:  {0:N1} GB' -f $total) -ForegroundColor Gray
    Write-Host ('  Free:            {0:N1} GB' -f $free) -ForegroundColor Gray
    Write-Host ('  In use:          {0:N1}%' -f $usedPct) -ForegroundColor $(if ($usedPct -lt 75) { 'Green' } elseif ($usedPct -lt 90) { 'Yellow' } else { 'Red' })
    Write-Host ('  Page file size:  {0:N1} GB' -f ($os.TotalVirtualMemorySize / 1GB)) -ForegroundColor Gray

    Write-Host '  Modules:' -ForegroundColor Gray
    foreach ($m in $modules) {
        Write-Host ('    {0}  {1:N1} GB' -f $m.Manufacturer, ($m.Capacity / 1GB)) -ForegroundColor DarkGray
    }

    $rows = @($modules | ForEach-Object { [pscustomobject]@{ Bank = $_.DeviceLocator; Speed = $_.Speed; CapacityGB = [math]::Round($_.Capacity / 1GB, 1); Manufacturer = $_.Manufacturer } })
    $rows += [pscustomobject]@{ Bank = 'Total'; Speed = ''; CapacityGB = [math]::Round($total, 1); Manufacturer = '' }
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'memory.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'memory.json') -Encoding UTF8
    $Session.ItemsFound = $modules.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Memory: {0:N1} GB total, {1:N1}% used" -f $total, $usedPct)
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
