#Requires -Version 5.1
#  knoux Repair v2.0 | 02-System-Cleanup | SC03 - Clean Browser Cache
#  Risk: SAFE_CLEANUP | Offline: Yes
#  Cleans browser cache folders PER PROFILE for the current user
#  (Chrome, Edge, Brave, Firefox). Never touches other users or
#  system folders such as SoftwareDistribution.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$SkipConfirm)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC03' -ToolName 'Clean Browser Cache' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

function Add-KnouxProfileCacheCandidates {
    param(
        [Parameter(Mandatory)][string]$Browser,
        [string]$UserDataRoot,
        [string[]]$CacheNames
    )
    if (-not $UserDataRoot -or -not (Test-Path -LiteralPath $UserDataRoot)) { return }
    $profileDirs = @(Get-ChildItem -LiteralPath $UserDataRoot -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile*' })
    foreach ($d in $profileDirs) {
        foreach ($cn in $CacheNames) {
            $c = Join-Path $d.FullName $cn
            if (Test-Path -LiteralPath $c) {
                $script:profileCandidates.Add([pscustomobject]@{
                    Browser = $Browser
                    Profile = $d.Name
                    CacheDir = $c
                })
            }
        }
    }
}

try {
    $script:profileCandidates = New-Object System.Collections.Generic.List[object]

    Add-KnouxProfileCacheCandidates -Browser 'Chrome' -UserDataRoot "$env:LOCALAPPDATA\Google\Chrome\User Data" -CacheNames @('Cache', 'Code Cache')
    Add-KnouxProfileCacheCandidates -Browser 'Edge' -UserDataRoot "$env:LOCALAPPDATA\Microsoft\Edge\User Data" -CacheNames @('Cache', 'Code Cache')
    Add-KnouxProfileCacheCandidates -Browser 'Brave' -UserDataRoot "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" -CacheNames @('Cache', 'Code Cache')

    foreach ($fx in @("$env:APPDATA\Mozilla\Firefox\Profiles", "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles")) {
        if (-not $fx -or -not (Test-Path -LiteralPath $fx)) { continue }
        foreach ($p in @(Get-ChildItem -LiteralPath $fx -Directory -Force -ErrorAction SilentlyContinue)) {
            $c2 = Join-Path $p.FullName 'cache2'
            if (Test-Path -LiteralPath $c2) {
                $script:profileCandidates.Add([pscustomobject]@{
                    Browser = 'Firefox'
                    Profile = $p.Name
                    CacheDir = $c2
                })
            }
        }
    }

    $summary = New-Object System.Collections.Generic.List[object]
    $foundFiles = New-Object System.Collections.Generic.List[object]
    $totalBytes = [int64]0

    foreach ($entry in $script:profileCandidates) {
        $files = @(Get-ChildItem -LiteralPath $entry.CacheDir -File -Recurse -Force -ErrorAction SilentlyContinue)
        $bytes = [int64]0
        if ($files.Count -gt 0) { $bytes = [int64](($files | Measure-Object Length -Sum).Sum) }
        $summary.Add([pscustomobject]@{
            Browser = $entry.Browser
            Profile = $entry.Profile
            CacheDir = $entry.CacheDir
            Files = $files.Count
            Bytes = $bytes
        })
        foreach ($f in $files) { $foundFiles.Add($f) }
        $totalBytes += $bytes
    }

    $Session.ItemsFound = $foundFiles.Count
    $Session.BytesPotentiallyRecoverable = $totalBytes

    if ($summary.Count -eq 0) {
        Write-Host '[INFO] No supported browser cache folders found.' -ForegroundColor Yellow
        Write-KnouxLog -Session $Session 'No browser cache folders found'
        $Session.Status = 'Success'
    } else {
        Write-Host '  Browser cache per profile:' -ForegroundColor Cyan
        foreach ($s in $summary) {
            Write-Host ('    {0,-7} {1,-28} {2,6} files, {3}' -f $s.Browser, $s.Profile, $s.Files, (Format-KnouxSize $s.Bytes)) -ForegroundColor DarkGray
        }
        Write-Host ('  Total: {0} files, {1}' -f $foundFiles.Count, (Format-KnouxSize $totalBytes)) -ForegroundColor Cyan

        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session ("Browser cache analysis: {0} files, {1} bytes" -f $foundFiles.Count, $totalBytes)
        } elseif ($foundFiles.Count -eq 0) {
            Write-Host '[OK] No cache files found to clean.' -ForegroundColor Green
            $Session.Status = 'Success'
        } else {
            Write-Host ''
            if ($SkipConfirm -or (Confirm-KnouxAction ('Quarantine ' + $foundFiles.Count + ' browser cache files?'))) {
                $quarantined = 0
                $failed = 0
                $quarantinedBytes = [int64]0
                foreach ($f in $foundFiles) {
                    try {
                        $q = Move-KnouxItemToQuarantine -Path $f.FullName -ToolId 'SC03' -ProjectRoot (Split-Path $PSScriptRoot -Parent) -Session $Session
                        if ($q) {
                            $quarantined++
                            $quarantinedBytes += [int64]$q.SizeBytes
                        } else {
                            $failed++
                        }
                    } catch {
                        $failed++
                        Write-Warning ("Quarantine failed for '{0}': {1}" -f $f.FullName, $_.Exception.Message)
                    }
                }
                $Session.QuarantinedCount = $quarantined
                $Session.ItemsProcessed = $quarantined
                $Session.BytesQuarantined = $quarantinedBytes
                if ($quarantined -gt 0) { $Session.ChangedSystem = $true }
                if ($quarantined -eq $foundFiles.Count) {
                    $Session.Status = 'Success'
                } elseif ($quarantined -gt 0) {
                    $Session.Status = 'Warning'
                    $Session.ErrorMessage = "$failed file(s) could not be quarantined."
                } else {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = 'No browser cache file could be quarantined.'
                }
                Write-Host ('  Quarantined {0}/{1} files ({2})' -f $quarantined, $foundFiles.Count, (Format-KnouxSize $quarantinedBytes)) -ForegroundColor $(if ($quarantined -eq $foundFiles.Count) { 'Green' } elseif ($quarantined -gt 0) { 'Yellow' } else { 'Red' })
                Write-KnouxLog -Session $Session ("Browser cache cleanup: quarantined {0}/{1}, {2} bytes" -f $quarantined, $foundFiles.Count, $quarantinedBytes)
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
            }
        }
    }
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    $rc = 1
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
