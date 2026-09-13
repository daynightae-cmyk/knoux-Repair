#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM05 - Repair System Image
#  Risk: SYSTEM_REPAIR | Offline: Partial | Admin: Required
#  Runs DISM /Online /Cleanup-Image /RestoreHealth. Supports local
#  source (install.wim / install.esd) with proper index detection.
#  Runs CheckHealth and ScanHealth first. Runs post-repair ScanHealth.
#  Returns Inconclusive when result cannot be proven.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [string]$LocalSourcePath, [int]$LocalSourceIndex)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM05' -ToolName 'Repair System Image' -Category '01-System-Maintenance' -RiskLevel 'SYSTEM_REPAIR' -Mode $(if ($AnalyzeOnly) { 'analyze' } elseif ($WhatIf) { 'preview' } else { 'run' })
$Session.RequiresAdmin = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to run DISM.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run DISM CheckHealth, ScanHealth, then RestoreHealth.' -ForegroundColor Green
    Write-Host '[ANALYZE] With validated local install.wim/esd source, adds /Source:wim/esd:<index> and /LimitAccess for offline repair.' -ForegroundColor Green
    Write-Host '[ANALYZE] Without a validated source, missing components are downloaded from Windows Update (requires internet).' -ForegroundColor Yellow
    Write-KnouxLog -Session $Session 'Analyze mode: would run DISM CheckHealth, ScanHealth, RestoreHealth'
} else {
    Write-Host '[ACTION] Repairs the Windows system image (component store).' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with DISM CheckHealth, ScanHealth, and RestoreHealth?') {
        # Step 1: CheckHealth
        Write-Host '[RUN] Starting DISM CheckHealth...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting DISM CheckHealth'
        $check = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/English', '/Online', '/Cleanup-Image', '/CheckHealth') -TimeoutSeconds 600
        if (-not $check) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'DISM CheckHealth could not be started.'
        } else {
            $checkRc = $check.ExitCode
            $check.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-checkhealth-output.txt') -Encoding UTF8
            if ($check.Stderr) { $check.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-checkhealth-stderr.txt') -Encoding UTF8 }
            Write-KnouxLog -Session $Session ("DISM CheckHealth exit {0}" -f $checkRc)
            if ($checkRc -ne 0) {
                Write-Host ("[WARN] CheckHealth exit {0} - component store may have corruption" -f $checkRc) -ForegroundColor Yellow
            } elseif (([string]$check.Stdout) -match 'component store is repairable|component store corruption was detected') {
                Write-Host '[WARN] CheckHealth: repairable corruption detected.' -ForegroundColor Yellow
            } elseif (([string]$check.Stdout) -match 'No component store corruption detected') {
                Write-Host '[OK] CheckHealth: No corruption detected.' -ForegroundColor Green
            } else {
                Write-Host '[WARN] CheckHealth completed but its result was not classified.' -ForegroundColor Yellow
            }
        }

        # Step 2: ScanHealth
        if ($Session.Status -ne 'Failed') {
            Write-Host '[RUN] Starting DISM ScanHealth...' -ForegroundColor Green
            Write-KnouxLog -Session $Session 'Starting DISM ScanHealth'
            $scan = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/English', '/Online', '/Cleanup-Image', '/ScanHealth') -TimeoutSeconds 1800
            if (-not $scan) {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'DISM ScanHealth could not be started.'
            } else {
                $scanRc = $scan.ExitCode
                $scan.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-scanhealth-output.txt') -Encoding UTF8
                if ($scan.Stderr) { $scan.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-scanhealth-stderr.txt') -Encoding UTF8 }
                Write-KnouxLog -Session $Session ("DISM ScanHealth exit {0}" -f $scanRc)
                if ($scanRc -ne 0) {
                    Write-Host ("[WARN] ScanHealth exit {0} - corruption detected" -f $scanRc) -ForegroundColor Yellow
                } elseif (([string]$scan.Stdout) -match 'component store is repairable|component store corruption was detected') {
                    Write-Host '[WARN] ScanHealth: repairable corruption detected.' -ForegroundColor Yellow
                } elseif (([string]$scan.Stdout) -match 'No component store corruption detected') {
                    Write-Host '[OK] ScanHealth: No corruption detected.' -ForegroundColor Green
                } else {
                    Write-Host '[WARN] ScanHealth completed but its result was not classified.' -ForegroundColor Yellow
                }
            }
        }

        # Step 3: RestoreHealth only when English DISM evidence explicitly reports repairable corruption.
        if ($Session.Status -ne 'Failed') {
            $healthEvidence = ([string]$check.Stdout) + "`n" + ([string]$scan.Stdout)
            $needsRepair = $healthEvidence -match 'component store is repairable|component store corruption was detected'
            $unrepairable = $healthEvidence -match 'component store cannot be repaired'
            $healthy = $healthEvidence -match 'No component store corruption detected'
            if ($unrepairable) {
                $Session.Status = 'Failed'
                $Session.VerificationPerformed = $true
                $Session.VerificationResult = 'CORRUPTION_UNREPAIRABLE'
                $Session.ErrorMessage = 'DISM reports component store corruption that cannot be repaired by RestoreHealth.'
            } elseif (-not $needsRepair -and -not $healthy) {
                $Session.Status = 'Inconclusive'
                $Session.VerificationPerformed = $true
                $Session.VerificationResult = 'RESULT_NOT_CLASSIFIED'
                $Session.ErrorMessage = 'Pre-repair DISM checks completed without a recognized health statement. RestoreHealth was not run.'
            }
            $source = $null
            $sourceType = $null
            $sourceIndex = $null
            $useOffline = $false

            if ($needsRepair) {
                # Get local source if available
                $sourcePath = $null
                if (-not [string]::IsNullOrWhiteSpace($LocalSourcePath)) {
                    $src = $LocalSourcePath.Trim()
                    if ($src) {
                        if (-not (Test-Path -LiteralPath $src.Trim())) {
                            Write-Host ('[ERROR] Source not found: ' + $src) -ForegroundColor Red
                            $Session.Status = 'Failed'
                            $Session.ErrorMessage = "Local source not found: $src"
                            Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
                        } else {
                            $sourcePath = $src.Trim()
                            # Detect WIM or ESD and get image info
                            $info = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/Get-WimInfo', '/WimFile:' + $sourcePath) -TimeoutSeconds 60
                            if (-not $info) {
                                $Session.Status = 'Failed'
                                $Session.ErrorMessage = 'Could not read WIM/ESD info.'
                                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                            } else {
                                $info.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-wiminfo-output.txt') -Encoding UTF8
                                Write-KnouxLog -Session $Session 'DISM Get-WimInfo completed'
                                # Parse image indexes
                                $indexes = @()
                                foreach ($line in $info.Stdout -split "`r?`n") {
                                    if ($line -match '^\s*(\d+)\s+.*') {
                                        $idx = $matches[1]
                                        $desc = $line -replace '^\s*\d+\s+', ''
                                        $indexes += [pscustomobject]@{ Index = $idx; Description = $desc.Trim() }
                                    }
                                }
                                if ($indexes.Count -eq 0) {
                                    $Session.Status = 'Failed'
                                    $Session.ErrorMessage = 'No image indexes found in source.'
                                    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                                } else {
                                    Write-Host 'Available image indexes:' -ForegroundColor Cyan
                                    foreach ($i in $indexes) {
                                        Write-Host ("  [{0}] {1}" -f $i.Index, $i.Description) -ForegroundColor Gray
                                    }
                                    # Detect Windows edition
                                    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
                                    $edition = $os.Caption
                                    Write-Host ("Detected edition: {0}" -f $edition) -ForegroundColor Cyan
                                    # Try to match edition
                                    $matched = $indexes | Where-Object { $_.Description -match [regex]::Escape($edition) } | Select-Object -First 1
                                    if ($matched) {
                                        Write-Host ("Recommended index: {0} ({1})" -f $matched.Index, $matched.Description) -ForegroundColor Green
                                    } else {
                                        Write-Host 'No automatic edition match. Please select index manually.' -ForegroundColor Yellow
                                    }
                                    $selIdx = if ($LocalSourceIndex -gt 0) { $LocalSourceIndex } elseif ($matched) { $matched.Index } else { $indexes[0].Index }
                                    if ($selIdx -match '^\d+$' -and ($indexes.Index -contains [int]$selIdx)) {
                                        $sourceIndex = $selIdx
                                        $source = $sourcePath
                                        if ($sourcePath -match '\.esd$') { $sourceType = 'esd' } else { $sourceType = 'wim' }
                                        $useOffline = $true
                                    } else {
                                        Write-Host '[WARN] Invalid index, falling back to Windows Update.' -ForegroundColor Yellow
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if ($needsRepair -and $Session.Status -ne 'Failed') {
                $null = New-KnouxRestorePoint -Description 'Knoux Repair SM05 before DISM RestoreHealth'
                $args = @('/English', '/Online', '/Cleanup-Image', '/RestoreHealth')
                if ($useOffline) {
                    $args += ('/Source:' + $sourceType + ':' + $source + ':' + $sourceIndex)
                    $args += '/LimitAccess'
                    Write-Host ("[INFO] Using local source: {0}:{1}:{2}" -f $sourceType, $source, $sourceIndex) -ForegroundColor Yellow
                    $Session.OfflineCapable = $true
                } else {
                    Write-Host '[INFO] Using Windows Update as source (requires internet).' -ForegroundColor Yellow
                }
                Write-Host '[RUN] Starting DISM RestoreHealth (can take 20+ minutes)...' -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Starting DISM RestoreHealth (source: {0})" -f $(if ($useOffline) { 'local ' + $sourceType + ':' + $source + ':' + $sourceIndex } else { 'Windows Update' }))
                $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList $args -TimeoutSeconds 3600
                if (-not $run) {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = 'DISM could not be started.'
                } else {
                    $rc = $run.ExitCode
                    $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-restorehealth-output.txt') -Encoding UTF8
                    if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-restorehealth-stderr.txt') -Encoding UTF8 }
                    Write-KnouxLog -Session $Session ("DISM RestoreHealth exit {0}" -f $rc)
                    $Session.ItemsProcessed = 1
                    $Session.VerificationPerformed = $true
                    if ($run.Success) {
                        # Post-repair verification
                        Write-Host '[RUN] Post-repair DISM ScanHealth...' -ForegroundColor Green
                        $post = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/English', '/Online', '/Cleanup-Image', '/ScanHealth') -TimeoutSeconds 1800
                        if ($post -and $post.Success -and ([string]$post.Stdout) -match 'No component store corruption detected') {
                            Write-Host '[OK] Post-repair ScanHealth: No corruption detected.' -ForegroundColor Green
                            $Session.Status = 'Success'
                            $Session.VerificationResult = 'OK'
                            $Session.VerificationPerformed = $true
                        } elseif ($post -and ([string]$post.Stdout) -match 'component store is repairable|component store corruption was detected') {
                            Write-Host '[WARN] Post-repair ScanHealth still reports corruption.' -ForegroundColor Yellow
                            $Session.Status = 'Warning'
                            $Session.VerificationResult = 'CORRUPTION_REMAINS'
                        } else {
                            Write-Host '[WARN] Post-repair ScanHealth could not verify.' -ForegroundColor Yellow
                            $Session.Status = 'Inconclusive'
                            $Session.VerificationResult = 'UNVERIFIED'
                        }
                        $Session.ChangedSystem = $true
                        Write-Host '[OK] Component store repair completed.' -ForegroundColor Green
                    } else {
                        $Session.Status = 'Failed'
                        $Session.VerificationResult = 'FAILED'
                        $Session.ErrorMessage = "DISM exited with code $rc. Review the report logs."
                        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                    }
                    if ($run.TimedOut) {
                        $Session.Status = 'Warning'
                        $Session.ErrorMessage = 'DISM exceeded the time limit; result may be incomplete.'
                        Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                    }
                }
            } elseif ($healthy -and -not $needsRepair -and $Session.Status -ne 'Failed') {
                $Session.Status = 'Success'
                $Session.VerificationPerformed = $true
                $Session.VerificationResult = 'NO_REPAIR_NEEDED'
                Write-Host '[OK] Pre-repair checks found no repairable component-store corruption. RestoreHealth was not run.' -ForegroundColor Green
                Write-KnouxLog -Session $Session 'RestoreHealth skipped because pre-repair evidence found no repairable corruption'
            }
        }
    } else {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
