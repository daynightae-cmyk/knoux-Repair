#Requires -Version 5.1
#  knoux Repair v2.0.2 | 05-Duplicate-Files | DF02 - Clean Duplicate Files
#  Risk: DESTRUCTIVE | Quarantine-backed
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF02' -ToolName 'Clean Duplicate Files' -Category '05-Duplicate-Files' -RiskLevel 'DESTRUCTIVE'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $roots = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) {
        @(
            [Environment]::GetFolderPath('MyDocuments'),
            (Join-Path $env:USERPROFILE 'Downloads'),
            [Environment]::GetFolderPath('Desktop'),
            [Environment]::GetFolderPath('MyPictures'),
            [Environment]::GetFolderPath('MyMusic'),
            [Environment]::GetFolderPath('MyVideos')
        ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    } else {
        if (-not [IO.Path]::IsPathRooted($LocalSourcePath) -or -not (Test-Path -LiteralPath $LocalSourcePath -PathType Container)) { throw 'The selected local folder is unavailable.' }
        @((Resolve-Path -LiteralPath $LocalSourcePath).Path)
    }

    Write-Host 'Scanning user folders (bounded)...' -ForegroundColor Cyan
    $files = Get-KnouxScanFiles -Roots $roots -MinBytes 1024
    $groups = Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB

    $toQuarantine = @()
    foreach ($g in $groups) {
        foreach ($d in @($g.Duplicates)) { $toQuarantine += $d.FullName }
    }

    if ($toQuarantine.Count -eq 0) {
        Write-Host '[OK] No duplicates found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No duplicates found'
    } else {
        Write-Host ('{0} duplicate copy(ies) to quarantine:' -f $toQuarantine.Count) -ForegroundColor Cyan
        $toQuarantine | Select-Object -First 20 | ForEach-Object { Write-Host ('  ' + $_) }
        if ($toQuarantine.Count -gt 20) { Write-Host ('  ... and ' + ($toQuarantine.Count - 20) + ' more.') }

        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to quarantine them.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} duplicates, no changes" -f $toQuarantine.Count)
        } elseif (Confirm-KnouxDestructiveAction -Phrase 'QUARANTINE DUPLICATES' -Prompt 'Quarantine the duplicate copies? (one copy per file is kept) (type QUARANTINE DUPLICATES to confirm): ') {
            $moved = 0
            $quarantinedBytes = [int64]0
            foreach ($p in $toQuarantine) {
                $dest = Move-KnouxItemToQuarantine -Path $p -ToolId 'DF02' -ProjectRoot (Split-Path $PSScriptRoot -Parent) -Session $Session
                if ($dest) { $moved++; $quarantinedBytes += [int64]$dest.SizeBytes; Write-KnouxLog -Session $Session ("Quarantined {0}" -f $p) }
            }
            $Session.BytesQuarantined = $quarantinedBytes
            if ($moved -eq $toQuarantine.Count) {
                $Session.Status = 'Success'
            } elseif ($moved -gt 0) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = "$($toQuarantine.Count - $moved) duplicate(s) could not be quarantined."
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'No duplicate could be quarantined.'
            }
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $moved
            $Session.ItemsFound = $toQuarantine.Count
            Write-Host ('[OK] Quarantined {0} duplicate(s).' -f $moved) -ForegroundColor $(if ($moved -eq $toQuarantine.Count) { 'Green' } elseif ($moved -gt 0) { 'Yellow' } else { 'Red' })
        } else {
            $Session.Status = 'Cancelled'
            Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
        }
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
