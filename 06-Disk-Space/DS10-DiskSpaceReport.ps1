#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS10 - Disk Space Report
#  Risk: READ_ONLY
#  Aggregates disk usage, top large files, and space hogs into a report.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS10' -ToolName 'Disk Space Report' -Category '06-Disk-Space' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $drives = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue)
    $totalGB = 0; $usedGB = 0; $freeGB = 0
    foreach ($d in $drives) {
        $totalGB += [math]::Round($d.Size / 1GB, 1)
        $usedGB += [math]::Round(($d.Size - $d.FreeSpace) / 1GB, 1)
        $freeGB += [math]::Round($d.FreeSpace / 1GB, 1)
    }

    $profile = if ($AnalyzeOnly -or $WhatIf) { $null } else { [Environment]::GetFolderPath('UserProfile') }
    $largeFiles = @()
    if ($AnalyzeOnly -or $WhatIf) {
        Write-Host '[ANALYZE] User-profile recursive scan is skipped in analyze mode; full execution adds the top files larger than 50 MB.' -ForegroundColor DarkGray
    } elseif ($profile -and (Test-Path -LiteralPath $profile)) {
        $files = Get-KnouxScanFiles -Roots @($profile) -MinBytes 50MB
        $largeFiles = @($files | Sort-Object Length -Descending | Select-Object -First 10)
    }

    $rows = @(
        [pscustomobject]@{ Metric = 'Total capacity'; Value = $totalGB; Unit = 'GB' },
        [pscustomobject]@{ Metric = 'Used'; Value = $usedGB; Unit = 'GB' },
        [pscustomobject]@{ Metric = 'Free'; Value = $freeGB; Unit = 'GB' },
        [pscustomobject]@{ Metric = 'Files >50MB (top 10)'; Value = $largeFiles.Count; Unit = 'files' },
        [pscustomobject]@{ Metric = 'Largest file (top 10)'; Value = if ($largeFiles.Count) { [math]::Round($largeFiles[0].Length / 1MB, 1) } else { 0 }; Unit = 'MB' }
    )

    Write-Host 'Disk space report:' -ForegroundColor Cyan
    foreach ($r in $rows) {
        Write-Host ('  {0,-28} {1,10:N1} {2}' -f $r.Metric, $r.Value, $r.Unit)
    }
    if ($largeFiles.Count) {
        Write-Host ''
        Write-Host 'Largest files on the profile:' -ForegroundColor Cyan
        foreach ($f in $largeFiles) {
            Write-Host ('  {0,9:N1} MB  {1}' -f ($f.Length / 1MB), $f.FullName) -ForegroundColor Yellow
        }
    }

    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'disk-report.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'disk-report.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Disk space report generated: $totalGB GB total, $freeGB GB free"
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
