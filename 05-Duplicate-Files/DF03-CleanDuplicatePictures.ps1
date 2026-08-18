#Requires -Version 5.1
#  knoux Repair v2.0 | 05-Duplicate-Files | DF03 - Clean Duplicate Pictures
#  Risk: DESTRUCTIVE | Quarantine-backed
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF03' -ToolName 'Clean Duplicate Pictures' -Category '05-Duplicate-Files' -RiskLevel 'DESTRUCTIVE'
$rc = 0
$exts = @('.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff')

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $pictures = [Environment]::GetFolderPath('MyPictures')
    if (-not $pictures -or -not (Test-Path -LiteralPath $pictures)) {
        Write-Host '[WARN] Pictures folder not found.' -ForegroundColor Yellow
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Pictures folder not found.'
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        Write-Host ('Scanning {0} ...' -f $pictures) -ForegroundColor Cyan
        $files = Get-KnouxScanFiles -Roots @($pictures) -IncludeExtensions $exts
        $groups = Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB

        $toQuarantine = @()
        $totalMB = 0
        foreach ($g in $groups) {
            foreach ($d in @($g.Duplicates)) {
                $toQuarantine += $d.FullName
                $totalMB += $d.Length / 1MB
            }
        }

        if ($toQuarantine.Count -eq 0) {
            Write-Host '[OK] No duplicate pictures found.' -ForegroundColor Green
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session 'No duplicate pictures'
        } else {
            Write-Host ('{0} duplicate picture(s) ({1:N1} MB) to quarantine:' -f $toQuarantine.Count, $totalMB) -ForegroundColor Cyan
            $toQuarantine | Select-Object -First 20 | ForEach-Object { Write-Host ('  ' + $_) }
            if ($toQuarantine.Count -gt 20) { Write-Host ('  ... and ' + ($toQuarantine.Count - 20) + ' more.') }

            if ($AnalyzeOnly -or $WhatIf) {
                Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to quarantine them.' -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Analyze: {0} duplicate pictures, no changes" -f $toQuarantine.Count)
            } elseif (Confirm-KnouxDestructiveAction -Phrase 'QUARANTINE PICTURES' -Prompt 'Quarantine the duplicate pictures? (type QUARANTINE PICTURES to confirm): ') {
                $moved = 0
                $quarantinedBytes = [int64]0
                foreach ($p in $toQuarantine) {
                    $dest = Move-KnouxItemToQuarantine -Path $p -ToolId 'DF03' -ProjectRoot (Split-Path $PSScriptRoot -Parent) -Session $Session
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
                Write-Host ('[OK] Quarantined {0} duplicate picture(s).' -f $moved) -ForegroundColor $(if ($moved -eq $toQuarantine.Count) { 'Green' } elseif ($moved -gt 0) { 'Yellow' } else { 'Red' })
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
            }
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
