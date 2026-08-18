#Requires -Version 5.1
#  knoux Repair v2.0 | 06-Disk-Space | DS01 - Analyze Disk Space Usage
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS01' -ToolName 'Analyze Disk Space Usage' -Category '06-Disk-Space' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $drives = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue)
    if ($drives.Count -eq 0) {
        Write-Host '[WARN] No local fixed drives found.' -ForegroundColor Yellow
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'No local fixed drives found.'
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        $rows = @()
        foreach ($d in $drives) {
            $total = $d.Size
            $free = $d.FreeSpace
            $used = $total - $free
            $pct = if ($total) { [math]::Round(($used / $total) * 100, 1) } else { 0 }
            $rows += [pscustomobject]@{ Drive = $d.DeviceID; TotalGB = [math]::Round($total / 1GB, 1); UsedGB = [math]::Round($used / 1GB, 1); FreeGB = [math]::Round($free / 1GB, 1); UsedPct = $pct }
        }
        Write-Host 'Disk space usage:' -ForegroundColor Cyan
        foreach ($r in $rows) {
            $color = if ($r.UsedPct -gt 90) { 'Red' } elseif ($r.UsedPct -gt 75) { 'Yellow' } else { 'Green' }
            Write-Host ('  {0}  Total: {1,8:N1} GB  Used: {2,8:N1} GB  Free: {3,8:N1} GB  ({4:N1}%)' -f $r.Drive, $r.TotalGB, $r.UsedGB, $r.FreeGB, $r.UsedPct) -ForegroundColor $color
        }
        $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'disk-usage.csv') -NoTypeInformation -Encoding UTF8
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'disk-usage.json') -Encoding UTF8
        $Session.ItemsFound = $rows.Count
        $Session.ItemsProcessed = 1
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session ("Analyzed {0} fixed drives" -f $rows.Count)
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
