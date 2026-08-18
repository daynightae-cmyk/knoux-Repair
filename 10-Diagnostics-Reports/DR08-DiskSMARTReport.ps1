#Requires -Version 5.1
#  knoux Repair v2.0 | 10-Diagnostics-Reports | DR08 - Disk SMART Report
#  Risk: READ_ONLY
#  Shows SMART health status for physical disks. Read-only.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR08' -ToolName 'Disk SMART Report' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    if ($disks.Count -eq 0) {
        Write-Host '[INFO] No physical disks reported.' -ForegroundColor Yellow
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'SMART: no physical disks reported'
    } else {
        Write-Host 'Disk SMART health:' -ForegroundColor Cyan
        $rows = @()
        foreach ($d in $disks) {
            $smart = $null
            try {
                $smart = Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -Filter ("InstanceName like '%{0}%'" -f $d.Index) -ErrorAction SilentlyContinue | Select-Object -First 1
            } catch { $smart = $null }
            $predicted = $false
            if ($smart) { $predicted = [bool]$smart.PredictFailure }
            $status = if ($predicted) { 'FAILURE PREDICTED' } else { 'OK' }
            $color = if ($predicted) { 'Red' } else { 'Green' }
            Write-Host ('  {0,-20} {1} ({2:N1} GB)' -f $d.Model, $status, ($d.Size / 1GB)) -ForegroundColor $color
            $rows += [pscustomobject]@{ Disk = $d.Model; Index = $d.Index; SizeGB = [math]::Round($d.Size / 1GB, 1); Status = $status; SmartPredictFailure = $predicted }
        }
        $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'smart.csv') -NoTypeInformation -Encoding UTF8
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'smart.json') -Encoding UTF8
        $Session.ItemsFound = $disks.Count
        $Session.ItemsProcessed = 1
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session "SMART: $($disks.Count) physical disks"
    }
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
