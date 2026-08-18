#Requires -Version 5.1
#  knoux Repair v2.0.2 | 05-Duplicate-Files | DF09 - List Duplicate System Files
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF09' -ToolName 'List Duplicate System Files' -Category '05-Duplicate-Files' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $roots = @(
        $env:TEMP,
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\INetCache'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer'),
        (Join-Path $env:APPDATA 'Microsoft\Windows')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    $files = Get-KnouxScanFiles -Roots $roots -MinBytes 1024
    $groups = Find-KnouxDuplicateGroups -Files $files -HashByteBudget 200MB

    $groupsTotal = 0
    $dupCount = 0
    $totalMB = 0
    foreach ($g in $groups) {
        $groupsTotal++
        $dupCount += $g.Duplicates.Count
        $totalMB += ($g.Duplicates | Measure-Object Length -Sum).Sum / 1MB
    }

    if ($groupsTotal -eq 0) {
        Write-Host '[OK] No duplicate system/cache files found.' -ForegroundColor Green
    } else {
        Write-Host ('{0} group(s) with {1} duplicate copy(ies) totaling {2:N1} MB.' -f $groupsTotal, $dupCount, $totalMB) -ForegroundColor Cyan
        foreach ($g in $groups) {
            Write-Host ('  Group ({0} copies):' -f $g.Files.Count)
            foreach ($f in $g.Files) { Write-Host ('    ' + $f.FullName) }
        }
    }
    $rows = @($groups | ForEach-Object { [pscustomobject]@{ Hash = $_.Hash; Count = $_.Files.Count; Files = ($_.Files.FullName -join ';') } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'system-duplicates.csv') -NoTypeInformation -Encoding UTF8
    $Session.ItemsFound = $groupsTotal
    $Session.BytesRecovered = [int64]$totalMB * 1MB
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Found {0} duplicate groups ({1} copies, {2:N1} MB)" -f $groupsTotal, $dupCount, $totalMB)
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
