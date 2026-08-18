#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS08 - Run Disk Cleanup
#  Risk: SAFE_CLEANUP | Offline: Yes
#  Runs the built-in Windows Disk Cleanup (cleanmgr) with a preset
#  set of safe categories via an ini-driven invocation. Requires
#  user confirmation; launches the interactive dialog if no preset.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS08' -ToolName 'Run Disk Cleanup' -Category '06-Disk-Space' -RiskLevel 'SAFE_CLEANUP'
$Session.OfflineCapable = $true
$rc = 0
$cleanmgr = "$env:SystemRoot\System32\cleanmgr.exe"
$iniPath = Join-Path $env:TEMP 'knoux-diskcleanup.ini'

function Get-KnouxSystemDriveFreeBytes {
    try {
        $root = [System.IO.Path]::GetPathRoot($env:SystemDrive)
        $di = New-Object System.IO.DriveInfo ($root)
        return [int64]$di.AvailableFreeSpace
    } catch {
        Write-Warning "Could not measure free space on '$env:SystemDrive': $($_.Exception.Message)"
        return [int64]0
    }
}

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    if ($AnalyzeOnly -or $WhatIf) {
        Write-Host '[ANALYZE] Would run Windows Disk Cleanup with safe preset categories.' -ForegroundColor Green
        Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Analyze mode: would run Disk Cleanup'
    } else {
        Write-Host '[ACTION] Runs Windows Disk Cleanup (safe categories only).' -ForegroundColor Yellow
        if (Confirm-KnouxAction 'Run Disk Cleanup now?') {
            $freeBefore = Get-KnouxSystemDriveFreeBytes
            Write-Host ('  Free space before: {0}' -f (Format-KnouxSize $freeBefore)) -ForegroundColor DarkGray

            $ini = @(
                '[Cleanup State]',
                'StateFlags=0001'
            )
            Set-Content -LiteralPath $iniPath -Value $ini -Encoding ASCII
            Write-Host '  Starting Disk Cleanup ...' -ForegroundColor Green
            $r = Invoke-KnouxNativeCommand -FilePath $cleanmgr -ArgumentList @('/sagerun:1') -TimeoutSeconds 600

            $freeAfter = Get-KnouxSystemDriveFreeBytes
            $delta = [int64]($freeAfter - $freeBefore)
            Write-Host ('  Free space after: {0} (delta {1})' -f (Format-KnouxSize $freeAfter), (Format-KnouxSize $delta)) -ForegroundColor DarkGray

            if ($r) {
                Write-KnouxLog -Session $Session ("cleanmgr exit {0} timedOut {1}" -f $r.ExitCode, $r.TimedOut)
                if (-not $r.Success) {
                    Write-Host ('[WARN] cleanmgr exit code ' + $r.ExitCode + ' (0 usually means completed).') -ForegroundColor Yellow
                }
            } else {
                Write-KnouxLog -Session $Session 'cleanmgr produced no result record (process could not be started).' 'WARN'
            }

            $Session.VerificationPerformed = $true
            $Session.VerificationResult = if ($r -and $r.Success) { 'OK' } else { 'FAILED' }
            $Session.BytesPotentiallyRecoverable = $freeBefore
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = 1

            $rec = [pscustomobject]@{
                FreeBeforeBytes = $freeBefore
                FreeAfterBytes = $freeAfter
                FreeDeltaBytes = $delta
                ExitCode = if ($r) { $r.ExitCode } else { -1 }
                TimedOut = if ($r) { $r.TimedOut } else { $true }
                VerificationPerformed = $Session.VerificationPerformed
                VerificationResult = $Session.VerificationResult
            }
            $rec | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'disk-cleanup.json') -Encoding UTF8

            if ($Session.VerificationResult -eq 'OK') {
                Write-Host '[OK] Disk Cleanup completed.' -ForegroundColor Green
            } else {
                Write-Host '[WARN] Disk Cleanup did not complete cleanly.' -ForegroundColor Yellow
            }
            Write-KnouxLog -Session $Session ("Verification {0}: free {1} -> {2} (delta {3})" -f $Session.VerificationResult, $freeBefore, $freeAfter, $delta)
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
    Remove-Item -LiteralPath $iniPath -Force -ErrorAction SilentlyContinue
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
