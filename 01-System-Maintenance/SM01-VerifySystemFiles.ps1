#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM01 - Verify System Files
#  Risk: SYSTEM_REPAIR | Offline: Yes | Admin: Required
#  Runs sfc /verifyonly: checks protected system files for corruption
#  WITHOUT repairing. Run SM02 to repair any violations found.
#  Evidence: captures native exit code, raw output, and relevant CBS.log entries.
#  Does not claim "no violations" from exit code alone - uses Inconclusive when CBS evidence unavailable.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM01' -ToolName 'Verify System Files' -Category '01-System-Maintenance' -RiskLevel 'SYSTEM_REPAIR'
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
    Write-Host '[ANALYZE] Would run: sfc.exe /verifyonly (verify only, no repair)' -ForegroundColor Green
    Write-Host '[ANALYZE] Takes several minutes. Does not modify any files.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would run sfc /verifyonly'
} else {
    Write-Host '[ACTION] This only verifies system file integrity; nothing is repaired.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with sfc /verifyonly?') {
        Write-Host '[RUN] Starting sfc /verifyonly (can take several minutes)...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting sfc /verifyonly'
        $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\sfc.exe" -ArgumentList @('/verifyonly') -TimeoutSeconds 1800
        if (-not $run) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'sfc.exe could not be started.'
        } else {
            $rc = $run.ExitCode
            $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'sfc-verifyonly-output.txt') -Encoding UTF8
            if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'sfc-verifyonly-stderr.txt') -Encoding UTF8 }
            
            # Extract CBS.log relevant entries
            $cbsLog = "$env:SystemRoot\Logs\CBS\CBS.log"
            $cbsEntries = @()
            if (Test-Path -LiteralPath $cbsLog) {
                try {
                    $cbsContent = Get-Content -LiteralPath $cbsLog -Raw -ErrorAction SilentlyContinue
                    # Extract relevant lines (corruption, repair, verify)
                    $cbsEntries = @($cbsContent -split "`r?`n" | Where-Object { $_ -match '(Corrupt|Repair|Verify|Cannot repair|Missing)' } | Select-Object -Last 50)
                    $cbsEntries | Out-File -LiteralPath (Join-Path $Session.RawDir 'cbs-relevant-entries.txt') -Encoding UTF8
                } catch {
                    Write-Warning "Could not read CBS.log: $($_.Exception.Message)"
                }
            }
            
            Write-KnouxLog -Session $Session ("sfc /verifyonly exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            $Session.VerificationPerformed = $true
            
            if ($rc -eq 0) {
                if ($cbsEntries.Count -gt 0) {
                    $Session.Status = 'Warning'
                    $Session.VerificationResult = 'CBS_EVIDENCE_PRESENT'
                    $Session.ErrorMessage = 'sfc exit 0 but CBS log contains corruption-related entries.'
                    Write-Host '[WARN] sfc exit 0 but CBS log shows corruption-related entries.' -ForegroundColor Yellow
                } else {
                    $Session.Status = 'Success'
                    $Session.VerificationResult = 'OK'
                    Write-Host '[OK] No integrity violations found.' -ForegroundColor Green
                }
            } elseif ($rc -eq 1) {
                $Session.Status = 'Warning'
                $Session.VerificationResult = 'VIOLATIONS_FOUND'
                $Session.ErrorMessage = 'Integrity violations found. Run SM02 (Repair System Files) to fix them.'
                Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
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
            if ($cbsEntries.Count -eq 0 -and $rc -eq 0) {
                $Session.Status = 'Inconclusive'
                $Session.VerificationResult = 'NO_CBS_EVIDENCE'
                Write-Host '[INFO] CBS.log could not be read or contained no relevant entries. Result is inconclusive.' -ForegroundColor Yellow
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