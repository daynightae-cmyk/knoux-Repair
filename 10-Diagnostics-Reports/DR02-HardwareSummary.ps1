#Requires -Version 5.1
#  knoux Repair v2.0.2 | 10-Diagnostics-Reports | DR02 - Hardware Summary
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR02' -ToolName 'Hardware Summary' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    Write-Host 'Hardware Summary:' -ForegroundColor Cyan

    Write-Host '  Video controllers:' -ForegroundColor Gray
    $gpus = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue)
    foreach ($g in $gpus) {
        Write-Host ('    {0}  ({1} MB)' -f $g.Name, $g.AdapterRAM) -ForegroundColor DarkGray
    }

    Write-Host '  Disks:' -ForegroundColor Gray
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    foreach ($d in $disks) {
        Write-Host ('    {0,-40} {1:N1} GB' -f $d.Model, ($d.Size / 1GB)) -ForegroundColor DarkGray
    }

    Write-Host '  Network adapters:' -ForegroundColor Gray
    $nics = @(Get-CimInstance -ClassName Win32_NetworkAdapter -Filter 'PhysicalAdapter=True' -ErrorAction SilentlyContinue)
    foreach ($n in $nics) {
        Write-Host ('    {0}' -f $n.Name) -ForegroundColor DarkGray
    }

    $rows = @($gpus | ForEach-Object { [pscustomobject]@{ Type = 'GPU'; Name = $_.Name; Detail = ('{0} MB' -f $_.AdapterRAM) } })
    $rows += @($disks | ForEach-Object { [pscustomobject]@{ Type = 'Disk'; Name = $_.Model; Detail = ('{0:N1} GB' -f ($_.Size / 1GB)) } })
    $rows += @($nics | ForEach-Object { [pscustomobject]@{ Type = 'NIC'; Name = $_.Name; Detail = '' } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'hardware.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'hardware.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Hardware summary: $($rows.Count) devices"
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
