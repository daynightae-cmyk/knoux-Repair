#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC06 - Clean Update Download Cache
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Required
#  Removes the contents of %SystemRoot%\SoftwareDistribution\Download
#  only (never DataStore, never the whole SoftwareDistribution folder).
#  Required services (wuauserv, bits, cryptsvc) are stopped for the cleanup
#  and their start type and running state are restored and verified afterwards.
#  If ANY required service cannot be stopped and verified, cleanup is ABORTED.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$SkipConfirm)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC06' -ToolName 'Clean Update Download Cache' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Administrator privileges are required.'
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        $dl = "$env:SystemRoot\SoftwareDistribution\Download"
        if (-not (Test-Path -LiteralPath $dl)) {
            Write-Host '[SKIPPED] Windows Update download cache folder not found.' -ForegroundColor Yellow
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session 'Update download cache folder not found; skipped'
        } else {
            Write-Host ('  Target: ' + $dl) -ForegroundColor DarkGray
            Write-Host '  Note: only the download cache is removed; DataStore is never touched.' -ForegroundColor DarkGray

            $items = @(Get-ChildItem -LiteralPath $dl -Force -ErrorAction SilentlyContinue)
            $totalBytes = [int64]0
            foreach ($it in $items) {
                if ($it.PSIsContainer) {
                    $totalBytes += Get-KnouxFolderSize -Path $it.FullName
                } else {
                    $totalBytes += [int64]$it.Length
                }
            }
            $Session.ItemsFound = $items.Count
            $Session.BytesPotentiallyRecoverable = $totalBytes

            Write-Host ('  Found: {0} file/folder(s), {1}' -f $items.Count, (Format-KnouxSize $totalBytes)) -ForegroundColor Cyan

            if ($AnalyzeOnly -or $WhatIf) {
                $svcInfo = 'unknown'
                try {
                    $svc = Get-Service -Name wuauserv -ErrorAction Stop
                    $svcInfo = ('{0}, StartType={1}' -f $svc.Status, $svc.StartType)
                } catch {
                    Write-Warning ("Could not read wuauserv state: {0}" -f $_.Exception.Message)
                }
                Write-Host ('[ANALYZE] Would stop required services and quarantine {0} item(s) ({1}).' -f $items.Count, (Format-KnouxSize $totalBytes)) -ForegroundColor Green
                Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
                $Session.Status = 'Success'
                Write-KnouxLog -Session $Session ("Update download cache analysis: {0} item(s), {1} bytes" -f $items.Count, $totalBytes)
            } elseif ($items.Count -eq 0) {
                Write-Host '[OK] Nothing to clean in the update download cache.' -ForegroundColor Green
                $Session.Status = 'Success'
            } else {
                Write-Host ''
                if ($SkipConfirm -or (Confirm-KnouxAction ('Quarantine ' + $items.Count + ' item(s) from the update download cache? Required services will be stopped temporarily.'))) {
                    $quarantined = 0
                    $failed = 0
                    $quarantinedBytes = [int64]0
                    $serviceStates = @{}
                    $allServicesStopped = $true
                    $allServicesRestored = $true

                    $requiredServices = @(
                        @{ Name = 'wuauserv'; DisplayName = 'Windows Update' },
                        @{ Name = 'bits'; DisplayName = 'Background Intelligent Transfer Service' },
                        @{ Name = 'cryptsvc'; DisplayName = 'Cryptographic Services' }
                    )

                    foreach ($svcInfo in $requiredServices) {
                        $svcName = $svcInfo.Name
                        try {
                            $svc = Get-Service -Name $svcName -ErrorAction Stop
                            $state = [pscustomobject]@{
                                Name = $svcName
                                DisplayName = $svcInfo.DisplayName
                                OriginalStartType = $svc.StartType
                                WasRunning = ($svc.Status -eq 'Running')
                                Stopped = $false
                            }
                            if ($state.WasRunning) {
                                Write-Host ('  Stopping {0} ({1})...' -f $state.DisplayName, $svcName) -ForegroundColor Yellow
                                Stop-Service -Name $svcName -Force -ErrorAction Stop
                                $state.Stopped = $true
                                Write-KnouxLog -Session $Session ("{0} stopped for cleanup" -f $svcName)
                            }
                            $serviceStates[$svcName] = $state
                        } catch {
                            $allServicesStopped = $false
                            Write-Warning ("Could not stop {0} ({1}): {2}" -f $svcInfo.DisplayName, $svcName, $_.Exception.Message)
                            Write-KnouxLog -Session $Session ("Failed to stop {0}: {1}" -f $svcName, $_.Exception.Message) 'WARN'
                            $serviceStates[$svcName] = [pscustomobject]@{ Name = $svcName; Error = $_.Exception.Message }
                        }
                    }

                    if (-not $allServicesStopped) {
                        # ABORT: restore any stopped services immediately
                        Write-Warning 'One or more required services could not be stopped. ABORTING cleanup.'
                        Write-KnouxLog -Session $Session 'Cleanup aborted: required services could not be stopped' 'WARN'
                        foreach ($svcName in $requiredServices.Name) {
                            if ($serviceStates[$svcName] -and $serviceStates[$svcName].Stopped) {
                                try { Start-Service -Name $svcName -ErrorAction Stop } catch { }
                            }
                        }
                        $Session.Status = 'Failed'
                        $Session.ErrorMessage = 'Required services could not be stopped. Cleanup aborted.'
                        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
                    } else {
                        # All services stopped successfully - proceed with cleanup
                        foreach ($it in $items) {
                            try {
                                $q = Move-KnouxItemToQuarantine -Path $it.FullName -ToolId 'SC06' -ProjectRoot (Split-Path $PSScriptRoot -Parent) -Session $Session -AllowWUDownloadCache
                                if ($q) {
                                    $quarantined++
                                    $quarantinedBytes += [int64]$q.OriginalSize
                                } else {
                                    $failed++
                                }
                            } catch {
                                $failed++
                                Write-Warning ("Quarantine failed for '{0}': {1}" -f $it.FullName, $_.Exception.Message)
                            }
                        }

                        # Restore all services
                        $restoreErrors = @()
                        foreach ($svcInfo in $requiredServices) {
                            $svcName = $svcInfo.Name
                            $state = $serviceStates[$svcName]
                            try {
                                if ($state.OriginalStartType -ne (Get-Service -Name $svcName -ErrorAction SilentlyContinue).StartType) {
                                    Set-Service -Name $svcName -StartupType $state.OriginalStartType -ErrorAction Stop
                                }
                                if ($state.WasRunning) {
                                    Start-Service -Name $svcName -ErrorAction Stop
                                }
                                # Verify
                                $after = Get-Service -Name $svcName -ErrorAction Stop
                                $startOk = ($after.StartType -eq $state.OriginalStartType)
                                $runOk = (($after.Status -eq 'Running') -eq $state.WasRunning)
                                if (-not $startOk -or -not $runOk) {
                                    $restoreErrors += [pscustomobject]@{ Service = $svcName; StartTypeOk = $startOk; RunningOk = $runOk }
                                    $allServicesRestored = $false
                                }
                            } catch {
                                $restoreErrors += [pscustomobject]@{ Service = $svcName; Error = $_.Exception.Message }
                                $allServicesRestored = $false
                            }
                        }

                        $Session.QuarantinedCount = $quarantined
                        $Session.ItemsProcessed = $quarantined
                        $Session.BytesQuarantined = $quarantinedBytes
                        if ($quarantined -gt 0) { $Session.ChangedSystem = $true }
                        $Session.VerificationPerformed = $true

                        if (-not $allServicesRestored) {
                            $Session.VerificationResult = 'MISMATCH'
                            $Session.ErrorMessage = 'One or more required services could not be fully restored.'
                            Write-Host ('  Service restore verification: MISMATCH') -ForegroundColor Red
                            Write-Warning $Session.ErrorMessage
                        } else {
                            $Session.VerificationResult = 'OK'
                        }

                        if ($quarantined -eq $items.Count -and $allServicesRestored) {
                            $Session.Status = 'Success'
                        } elseif ($quarantined -gt 0 -and $allServicesRestored) {
                            $Session.Status = 'Warning'
                            if (-not $Session.ErrorMessage) { $Session.ErrorMessage = "$($items.Count - $quarantined) item(s) could not be quarantined." }
                        } else {
                            $Session.Status = 'Failed'
                            if (-not $Session.ErrorMessage) { $Session.ErrorMessage = 'Cleanup failed or service restore failed.' }
                        }

                        Write-Host ('  Quarantined {0}/{1} item(s) ({2})' -f $quarantined, $items.Count, (Format-KnouxSize $quarantinedBytes)) -ForegroundColor $(if ($quarantined -eq $items.Count) { 'Green' } elseif ($quarantined -gt 0) { 'Yellow' } else { 'Red' })
                        Write-Host ('  Service restore verification: ' + $Session.VerificationResult) -ForegroundColor $(if ($Session.VerificationResult -eq 'OK') { 'Green' } else { 'Red' })
                        Write-KnouxLog -Session $Session ("Update download cache cleanup: quarantined {0}/{1}, {2} bytes, service restore {3}" -f $quarantined, $items.Count, $quarantinedBytes, $Session.VerificationResult)
                    }
                } else {
                    $Session.Status = 'Cancelled'
                    Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
                }
            }
        }
    }
} catch {
    # Emergency restore on unexpected error
    foreach ($svcName in @('wuauserv', 'bits', 'cryptsvc')) {
        try { $svc = Get-Service -Name $svcName -ErrorAction SilentlyContinue; if ($svc -and $svc.Status -ne 'Running') { Start-Service -Name $svcName -ErrorAction SilentlyContinue } } catch { }
    }
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