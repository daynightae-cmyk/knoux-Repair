#Requires -Version 5.1
#  knoux Repair v2.0 | 01-System-Maintenance | SM03 - Check Component Store
#  Risk: READ_ONLY | Offline: Yes | Admin: Required
#  Runs DISM /Online /Cleanup-Image /CheckHealth: a fast check that
#  reports whether corruption was flagged by a prior scan. It does
#  not scan deeply and does not modify anything.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM03' -ToolName 'Check Component Store' -Category '01-System-Maintenance' -RiskLevel 'READ_ONLY'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to run DISM.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: DISM /Online /Cleanup-Image /CheckHealth' -ForegroundColor Green
    Write-Host '[ANALYZE] Fast read-only check; use SM04 (Scan) for a deep scan.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would run DISM CheckHealth'
} else {
    Write-Host '[ACTION] Quick read-only component store check.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with DISM CheckHealth?') {
        Write-Host '[RUN] Running DISM /CheckHealth (fast, read-only)...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting DISM CheckHealth'
        $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/Online', '/Cleanup-Image', '/CheckHealth') -TimeoutSeconds 600
        if (-not $run) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'DISM could not be started.'
        } else {
            $rc = $run.ExitCode
            $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-checkhealth-output.txt') -Encoding UTF8
            if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-checkhealth-stderr.txt') -Encoding UTF8 }
            Write-KnouxLog -Session $Session ("DISM CheckHealth exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            $Session.VerificationPerformed = $true
            if ($run.Success) {
                $Session.Status = 'Success'
                $Session.VerificationResult = 'OK'
                Write-Host '[OK] Component store check completed (read-only).' -ForegroundColor Green
            } else {
                $Session.Status = 'Failed'
                $Session.VerificationResult = 'FAILED'
                $Session.ErrorMessage = "DISM exited with code $rc."
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
            }
            if ($run.TimedOut) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = 'DISM exceeded the time limit.'
                Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
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