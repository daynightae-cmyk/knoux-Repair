#Requires -Version 5.1
#  knoux Repair v2.0.2 | 08-Performance | PF05 - Disk & TRIM Audit
#  Risk: READ_ONLY
#  Reports disk free space, whether the media is solid state, and
#  the TRIM setting (DisableDeleteNotify) via fsutil when readable.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF05' -ToolName 'Disk & TRIM Audit' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $disks = @(Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue)
    $rows = @()
    foreach ($d in $disks) {
        $trim = $null
        $trimOut = @(& fsutil.exe behavior query DisableDeleteNotify 2>$null)
        foreach ($line in $trimOut) { if ($line -match 'DisableDeleteNotify\s*=\s*(\d)') { $trim = $matches[1]; break } }
        $media = 'HDD'
        if ($d.MediaType -match 'SSD|Solid') { $media = 'SSD' }
        elseif ($d.Caption -match 'NVMe|SSD') { $media = 'SSD' }
        $rows += [pscustomobject]@{
            Model = $d.Caption
            SizeGB = [math]::Round($d.Size / 1GB, 1)
            MediaType = $media
            TrimEnabled = if ($trim -eq 0) { $true } elseif ($trim -eq 1) { $false } else { $null }
        }
    }

    Write-Host 'Disks:' -ForegroundColor Cyan
    foreach ($r in $rows) {
        $trimTxt = if ($null -eq $r.TrimEnabled) { 'n/a' } elseif ($r.TrimEnabled) { 'TRIM ON' } else { 'TRIM OFF' }
        Write-Host ('  {0,-30} {1,8:N0} GB  {2}  {3}' -f $r.Model, $r.SizeGB, $r.MediaType, $trimTxt) -ForegroundColor DarkGray
    }

    Write-Host 'Volumes (free space):' -ForegroundColor Cyan
    foreach ($v in @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue)) {
        $pct = if ($v.Size -gt 0) { [math]::Round(($v.FreeSpace / $v.Size) * 100, 1) } else { 0 }
        Write-Host ('  {0,-4} free {1,10:N0} GB of {2,10:N0} GB ({3:N1}%)' -f $v.DeviceID, ($v.FreeSpace / 1GB), ($v.Size / 1GB), $pct) -ForegroundColor $(if ($pct -lt 10) { 'Red' } elseif ($pct -lt 20) { 'Yellow' } else { 'Green' })
    }

    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'disk-trim-audit.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = $rows.Count
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Disk/TRIM audit: {0} disk(s)" -f $rows.Count)
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
