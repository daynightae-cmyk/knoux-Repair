#Requires -Version 5.1
#  knoux Repair v2.0 | 05-Duplicate-Files | DF06 - Remove Empty Folders
#  Risk: SAFE_CLEANUP | Quarantine-backed
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF06' -ToolName 'Remove Empty Folders' -Category '05-Duplicate-Files' -RiskLevel 'SAFE_CLEANUP'
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

    $candidates = @()
    foreach ($r in $roots) {
        $candidates += @(Get-ChildItem -LiteralPath $r -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) })
    }
    $sorted = @($candidates | Sort-Object FullName.Length -Descending)

    $empty = @()
    foreach ($d in $sorted) {
        $children = @(Get-ChildItem -LiteralPath $d.FullName -Force -ErrorAction SilentlyContinue)
        if ($children.Count -eq 0) { $empty += $d.FullName }
    }

    if ($empty.Count -eq 0) {
        Write-Host '[OK] No empty folders found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No empty folders'
    } else {
        Write-Host ('{0} empty folder(s) found:' -f $empty.Count) -ForegroundColor Cyan
        $empty | Select-Object -First 30 | ForEach-Object { Write-Host ('  ' + $_) }
        if ($empty.Count -gt 30) { Write-Host ('  ... and ' + ($empty.Count - 30) + ' more.') }

        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to remove them.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} empty folders, no changes" -f $empty.Count)
        } elseif (Confirm-KnouxAction 'Remove these empty folders?') {
            $removed = 0
            $quarantinedBytes = [int64]0
            foreach ($p in $empty) {
                $dest = Move-KnouxItemToQuarantine -Path $p -ToolId 'DF06' -ProjectRoot (Split-Path $PSScriptRoot -Parent) -Session $Session
                if ($dest) { $removed++; $quarantinedBytes += [int64]$dest.SizeBytes; Write-KnouxLog -Session $Session ("Quarantined empty folder {0}" -f $p) }
            }
            $Session.BytesQuarantined = $quarantinedBytes
            if ($removed -eq $empty.Count) {
                $Session.Status = 'Success'
            } elseif ($removed -gt 0) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = "$($empty.Count - $removed) empty folder(s) could not be quarantined."
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'No empty folder could be quarantined.'
            }
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $removed
            $Session.ItemsFound = $empty.Count
            Write-Host ('[OK] Removed {0} empty folder(s).' -f $removed) -ForegroundColor $(if ($removed -eq $empty.Count) { 'Green' } elseif ($removed -gt 0) { 'Yellow' } else { 'Red' })
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
