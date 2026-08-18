#Requires -Version 5.1
#  knoux Repair v2.0 | 04-Programs-Applications | PA04 - Repair Start Menu Shortcuts
#  Risk: SYSTEM_REPAIR
#  Fixes Start Menu and desktop shortcuts whose target path is broken.
#  Shortcuts pointing to the Recycle Bin root are skipped (false positive).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA04' -ToolName 'Repair Start Menu Shortcuts' -Category '04-Programs-Applications' -RiskLevel 'SYSTEM_REPAIR'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$shell = New-Object -ComObject WScript.Shell

function Test-KnouxShortcutTarget {
    param([string]$Path)
    try {
        $lnk = $shell.CreateShortcut($Path)
        $t = $lnk.TargetPath
        if (-not $t) { return $false }
        if ($t -match '::{645FF040-5081-101B-9F08-00AA002F954E}') { return $true }
        return (Test-Path -LiteralPath $t)
    } catch { return $true }
}

try {
    $roots = @(
        (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'),
        (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu')
    )
    $bad = @()
    foreach ($r in $roots) {
        if (-not (Test-Path -LiteralPath $r)) { continue }
        foreach ($lnk in @(Get-ChildItem -LiteralPath $r -Filter *.lnk -Recurse -ErrorAction SilentlyContinue)) {
            if (-not (Test-KnouxShortcutTarget $lnk.FullName)) {
                $bad += $lnk.FullName
            }
        }
    }

    if ($bad.Count -eq 0) {
        Write-Host '[OK] No broken shortcuts found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No broken shortcuts'
    } else {
        Write-Host ('{0} broken shortcut(s) found:' -f $bad.Count) -ForegroundColor Cyan
        $bad | ForEach-Object { Write-Host ('  ' + $_) }
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to remove them.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} broken shortcuts, no changes" -f $bad.Count)
        } elseif (Confirm-KnouxDestructiveAction -Phrase 'REMOVE SHORTCUTS' -Prompt 'Remove these broken shortcuts? (only the shortcut files) (type REMOVE SHORTCUTS to confirm): ') {
            $removed = 0
            foreach ($b in $bad) {
                $dest = Move-KnouxItemToQuarantine -Path $b
                if ($dest) { $removed++; Write-Host ('  [MOVED] ' + $b) -ForegroundColor Green }
                else { Write-Host ('  [SKIP]  ' + $b) -ForegroundColor Yellow }
            }
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $removed
            $Session.ItemsFound = $bad.Count
            if ($removed -eq $bad.Count) {
                $Session.Status = 'Success'
            } elseif ($removed -gt 0) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = "$($bad.Count - $removed) shortcut(s) could not be quarantined."
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'No shortcut could be quarantined.'
            }
            Write-Host ('[OK] Removed {0} broken shortcut(s).' -f $removed) -ForegroundColor $(if ($removed -eq $bad.Count) { 'Green' } elseif ($removed -gt 0) { 'Yellow' } else { 'Red' })
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
} finally {
    if ($shell) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
