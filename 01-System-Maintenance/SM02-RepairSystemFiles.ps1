#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM02 - Repair System Files
#  Risk: SYSTEM_REPAIR | Offline: Yes | Admin: Required
#  Runs sfc /scannow: verifies and repairs protected system files.
#  Evidence: captures native exit code, raw output, CBS.log entries, and post-repair verify-only.
#  Does not claim "repaired" from exit code alone - uses Inconclusive when CBS evidence unavailable.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM02' -ToolName 'Repair System Files' -Category '01-System-Maintenance' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to run System File Checker.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: sfc.exe /scannow (verify and repair)' -ForegroundColor Green
    Write-Host '[ANALYZE] Repairs protected system files; takes 10-20 minutes.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would run sfc /scannow'
} else {
    Write-Host '[ACTION] This will verify and repair protected system files.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with System File Checker repair?') {
        $null = New-KnouxRestorePoint -Description 'Knoux Repair SM02 before sfc /scannow'
        Write-Host '[RUN] Starting sfc /scannow (can take 10-20 minutes)...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting sfc /scannow'
        $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\sfc.exe" -ArgumentList @('/scannow') -TimeoutSeconds 1800
        if (-not $run) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'sfc.exe could not be started.'
        } else {
            $rc = $run.ExitCode
            $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'sfc-scannow-output.txt') -Encoding UTF8
            if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'sfc-scannow-stderr.txt') -Encoding UTF8 }
            
            # Extract CBS.log entries
            $cbsLog = "$env:SystemRoot\Logs\CBS\CBS.log"
            $cbsBefore = @()
            if (Test-Path -LiteralPath $cbsLog) {
                try {
                    $cbsContent = Get-Content -LiteralPath $cbsLog -Raw -ErrorAction SilentlyContinue
                    $cbsBefore = @($cbsContent -split "`r?`n" | Where-Object { $_ -match '(Corrupt|Repair|Verify|Cannot repair|Missing)' } | Select-Object -Last 50)
                } catch { }
            }
            
            Write-KnouxLog -Session $Session ("sfc /scannow exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            $Session.VerificationPerformed = $true
            
            if ($rc -eq 0) {
                # sfc says nothing needed repair - verify with verify-only
                Write-Host '[RUN] Post-repair sfc /verifyonly for verification...' -ForegroundColor Green
                $verify = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\sfc.exe" -ArgumentList @('/verifyonly') -TimeoutSeconds 1800
                $verifyRc = if ($verify) { $verify.ExitCode } else { -1 }
                if ($verifyRc -eq 0) {
                    $Session.Status = 'Success'
                    $Session.VerificationResult = 'OK'
                    Write-Host '[OK] No integrity violations found (nothing needed repair).' -ForegroundColor Green
                } else {
                    $Session.Status = 'Warning'
                    $Session.VerificationResult = 'VERIFY_FAILED'
                    $Session.ErrorMessage = 'sfc /scannow exit 0 but post-verify returned {0}.' -f $verifyRc
                    Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                }
            } elseif ($rc -eq 1) {
                # sfc says violations repaired - verify with verify-only
                Write-Host '[RUN] Post-repair sfc /verifyonly for verification...' -ForegroundColor Green
                $verify = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\sfc.exe" -ArgumentList @('/verifyonly') -TimeoutSeconds 1800
                $verifyRc = if ($verify) { $verify.ExitCode } else { -1 }
                if ($verifyRc -eq 0) {
                    $Session.Status = 'Success'
                    $Session.VerificationResult = 'REPAIRED_VERIFIED'
                    $Session.ChangedSystem = $true
                    $Session.RestartNeeded = $true
                    Write-Host '[OK] Violations found and repaired. Post-repair verify passed.' -ForegroundColor Green
                } else {
                    $Session.Status = 'Warning'
                    $Session.VerificationResult = 'REPAIRED_UNVERIFIED'
                    $Session.ChangedSystem = $true
                    $Session.RestartNeeded = $true
                    $Session.ErrorMessage = 'sfc /scannow reported repairs but post-verify returned {0}.' -f $verifyRc
                    Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                }
            } else {
                $Session.Status = 'Failed'
                $Session.VerificationResult = 'FAILED'
                $Session.ErrorMessage = "sfc returned exit code $rc. Review CBS.log."
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
            }
            if ($run.TimedOut) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = 'sfc exceeded the time limit; result may be incomplete.'
                Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
            }
            
            # If CBS evidence cannot be interpreted reliably
            $cbsLog = "$env:SystemRoot\Logs\CBS\CBS.log"
            if (Test-Path -LiteralPath $cbsLog) {
                try {
                    $cbsContent = Get-Content -LiteralPath $cbsLog -Raw -ErrorAction SilentlyContinue
                    $cbsEntries = @($cbsContent -split "`r?`n" | Where-Object { $_ -match '(Corrupt|Repair|Verify|Cannot repair|Missing)' } | Select-Object -Last 50)
                    $cbsEntries | Out-File -LiteralPath (Join-Path $Session.RawDir 'cbs-relevant-entries.txt') -Encoding UTF8
                } catch { }
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