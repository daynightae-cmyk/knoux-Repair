#Requires -Version 5.1
#  knoux Repair v2.0 | 05-Duplicate-Files | DF01 - Analyze Duplicate Files
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF01' -ToolName 'Analyze Duplicate Files' -Category '05-Duplicate-Files' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $roots = @(
        [Environment]::GetFolderPath('MyDocuments'),
        (Join-Path $env:USERPROFILE 'Downloads'),
        [Environment]::GetFolderPath('Desktop'),
        [Environment]::GetFolderPath('MyPictures'),
        [Environment]::GetFolderPath('MyMusic'),
        [Environment]::GetFolderPath('MyVideos')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    Write-Host 'Scanning user folders (bounded to the first 20000 files)...' -ForegroundColor Cyan
    $files = Get-KnouxScanFiles -Roots $roots -MinBytes 1024

    Write-Host ('Analyzing {0} files for duplicates (size + SHA-256, byte-budgeted)...' -f $files.Count) -ForegroundColor Cyan
    $groups = Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB

    $totalMB = 0
    $dupCopies = 0
    foreach ($g in $groups) { $dupCopies += $g.Duplicates.Count; $totalMB += (($g.Duplicates | Measure-Object Length -Sum).Sum) / 1MB }

    if ($groups.Count -eq 0) {
        Write-Host '[OK] No duplicate files found.' -ForegroundColor Green
    } else {
        Write-Host ('{0} duplicate group(s), {1} extra copy(ies), ~{2:N1} MB recoverable:' -f $groups.Count, $dupCopies, $totalMB) -ForegroundColor Cyan
        $groups | Sort-Object { ($_.Duplicates | Measure-Object Length -Sum).Sum } -Descending | Select-Object -First 15 | ForEach-Object {
            Write-Host ('  {0} copies x {1:N2} MB' -f $_.Files.Count, ($_.Files[0].Length / 1MB))
            $_.Files | Select-Object -First 2 | ForEach-Object { Write-Host ('      ' + $_.FullName) }
        }
    }
    $rows = @($groups | ForEach-Object { [pscustomobject]@{ Hash = $_.Hash; Count = $_.Files.Count; SizeMB = [math]::Round($_.Files[0].Length / 1MB, 2); Files = ($_.Files.FullName -join ';') } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'duplicates.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'duplicates.json') -Encoding UTF8
    $Session.ItemsFound = $groups.Count
    $Session.BytesRecovered = [int64]$totalMB * 1MB
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Found {0} duplicate groups ({1} copies, {2:N1} MB)" -f $groups.Count, $dupCopies, $totalMB)
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
