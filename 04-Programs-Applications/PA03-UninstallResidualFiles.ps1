#Requires -Version 5.1
#  knoux Repair v2.0 | 04-Programs-Applications | PA03 - Uninstall Residual Files
#  Risk: DESTRUCTIVE | Quarantine-backed
#  Detects leftover folders in %ProgramFiles% / %ProgramFiles(x86)% whose
#  program is no longer registered in the Uninstall registry hive.
#  Candidate folders are moved to quarantine (never hard-deleted).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA03' -ToolName 'Uninstall Residual Files' -Category '04-Programs-Applications' -RiskLevel 'DESTRUCTIVE'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $installed = @{}
    foreach ($root in @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
        foreach ($p in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
            if ($p -isnot [System.Management.Automation.PSCustomObject]) { continue }
            $locProp = $p.PSObject.Properties['InstallLocation']
            if ($locProp -and $locProp.Value -and (Test-Path -LiteralPath $locProp.Value)) {
                $installed[(Split-Path -Leaf $locProp.Value).ToLower()] = $true
            }
        }
    }

    $folders = @()
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $base -or -not (Test-Path -LiteralPath $base)) { continue }
        foreach ($d in @(Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue)) {
            $key = $d.Name.ToLower()
            if (-not $installed.ContainsKey($key) -and -not $installed.ContainsKey($key + '.exe')) {
                $folders += [pscustomobject]@{ Path = $d.FullName; SizeMB = [math]::Round((Get-KnouxFolderSize -Path $d.FullName) / 1MB, 1) }
            }
        }
    }

    if ($folders.Count -eq 0) {
        Write-Host '[OK] No obvious residual program folders found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No residual folders detected'
    } else {
        Write-Host ('{0} candidate residual folder(s) found:' -f $folders.Count) -ForegroundColor Cyan
        $folders | ForEach-Object { Write-Host ('  {0,-60} {1,10:N1} MB' -f $_.Path, $_.SizeMB) }
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to quarantine them.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} residual candidates, no changes" -f $folders.Count)
        } elseif (Confirm-KnouxDestructiveAction -Phrase 'REMOVE RESIDUAL' -Prompt 'Move these folders to quarantine? (type REMOVE RESIDUAL to confirm): ') {
            $moved = 0
            foreach ($f in $folders) {
                $dest = Move-KnouxItemToQuarantine -Path $f.Path
                if ($dest) {
                    $moved++
                    Write-Host ('  [MOVED] ' + $f.Path) -ForegroundColor Green
                    Write-KnouxLog -Session $Session ("Quarantined {0} -> {1}" -f $f.Path, $dest)
                } else {
                    Write-Host ('  [SKIP]  ' + $f.Path) -ForegroundColor Yellow
                }
            }
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $moved
            $Session.ItemsFound = $folders.Count
            Write-Host ('[OK] Quarantined {0} folder(s).' -f $moved) -ForegroundColor Green
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
