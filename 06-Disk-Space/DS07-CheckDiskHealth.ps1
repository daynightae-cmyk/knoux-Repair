#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS07 - Check Disk Health
#  Risk: READ_ONLY
#  Checks disk health via Win32_DiskDrive (SMART status), without
#  any destructive action. Reports per-physical-disk status.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS07' -ToolName 'Check Disk Health' -Category '06-Disk-Space' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    if ($disks.Count -eq 0) {
        Write-Host '[WARN] No physical disks detected.' -ForegroundColor Yellow
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'No physical disks detected.'
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        $rows = @()
        foreach ($d in $disks) {
            $smart = $null
            try {
                $smart = (Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -Filter ("InstanceName like '%{0}%'" -f $d.Index) -ErrorAction SilentlyContinue) | Select-Object -First 1
            } catch { Write-Warning ("SMART query failed: {0}" -f $_.Exception.Message) }
            $status = 'OK'
            $predicted = $false
            if ($smart) {
                $predicted = [bool]$smart.PredictFailure
                if ($predicted) { $status = 'FAILURE PREDICTED' }
            }
            $rows += [pscustomobject]@{ Index = $d.Index; Model = $d.Model; SizeGB = [math]::Round($d.Size / 1GB, 1); Status = $status; SmartPredictFailure = $predicted }
        }
        Write-Host 'Disk health:' -ForegroundColor Cyan
        foreach ($r in $rows) {
            $color = if ($r.SmartPredictFailure) { 'Red' } else { 'Green' }
            Write-Host ('  [{0}] {1} ({2:N1} GB)' -f $r.Status, $r.Model, $r.SizeGB) -ForegroundColor $color
        }
        $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'disk-health.csv') -NoTypeInformation -Encoding UTF8
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'disk-health.json') -Encoding UTF8
        $Session.ItemsFound = $rows.Count
        $Session.ItemsProcessed = 1
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session ("Checked health of {0} physical disks" -f $rows.Count)
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
