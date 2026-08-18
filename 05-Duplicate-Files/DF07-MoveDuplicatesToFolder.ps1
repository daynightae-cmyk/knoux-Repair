#Requires -Version 5.1
#  knoux Repair v2.0 | 05-Duplicate-Files | DF07 - Move Duplicates to Folder
#  Risk: SAFE_CLEANUP | Backup-backed
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF07' -ToolName 'Move Duplicates to Folder' -Category '05-Duplicate-Files' -RiskLevel 'SAFE_CLEANUP'
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

    Write-Host 'Scanning user folders (bounded)...' -ForegroundColor Cyan
    $files = Get-KnouxScanFiles -Roots $roots -MinBytes 1024
    $groups = Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB

    $toMove = @()
    foreach ($g in $groups) {
        foreach ($d in @($g.Duplicates)) { $toMove += $d.FullName }
    }

    if ($toMove.Count -eq 0) {
        Write-Host '[OK] No duplicates found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No duplicates found'
    } else {
        Write-Host ('{0} duplicate copy(ies) would be moved.' -f $toMove.Count) -ForegroundColor Cyan
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to move them.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} duplicates, no changes" -f $toMove.Count)
        } elseif (Confirm-KnouxAction 'Move the duplicates to a review folder?') {
            $destDir = Join-Path (Join-Path $Session.ProjectRoot 'Duplicates-Review') (Get-Date -Format 'yyyyMMdd-HHmmss')
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            $moved = 0
            $movedBytes = [int64]0
            foreach ($p in $toMove) {
                try {
                    $before = if (Test-Path -LiteralPath $p) { (Get-Item -LiteralPath $p -Force).Length } else { 0 }
                    Move-Item -LiteralPath $p -Destination $destDir -Force -ErrorAction Stop
                    $moved++
                    $movedBytes += [int64]$before
                    Write-KnouxLog -Session $Session ("Moved {0} to {1}" -f $p, $destDir)
                } catch {
                    Write-KnouxLog -Session $Session ("MOVE FAIL {0}: {1}" -f $p, $_.Exception.Message)
                }
            }
            $Session.BytesMoved = $movedBytes
            if ($moved -eq $toMove.Count) {
                $Session.Status = 'Success'
            } elseif ($moved -gt 0) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = "$($toMove.Count - $moved) duplicate(s) could not be moved."
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'No duplicate could be moved.'
            }
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $moved
            $Session.ItemsFound = $toMove.Count
            Write-Host ('[OK] Moved {0} duplicate(s) to {1}' -f $moved, $destDir) -ForegroundColor $(if ($moved -eq $toMove.Count) { 'Green' } elseif ($moved -gt 0) { 'Yellow' } else { 'Red' })
            Write-Host '  Review them there, then delete the folder when satisfied.' -ForegroundColor Yellow
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
