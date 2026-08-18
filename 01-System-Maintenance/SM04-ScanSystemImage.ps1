#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM04 - Scan System Image
#  Risk: READ_ONLY | Offline: Yes | Admin: Required
#  Runs DISM /Online /Cleanup-Image /ScanHealth: a full read-only
#  scan of the component store. Does not repair.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM04' -ToolName 'Scan System Image' -Category '01-System-Maintenance' -RiskLevel 'READ_ONLY'
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
    Write-Host '[ANALYZE] Would run: DISM /Online /Cleanup-Image /ScanHealth' -ForegroundColor Green
    Write-Host '[ANALYZE] Full read-only scan; takes 10-30 minutes.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would run DISM ScanHealth'
} else {
    Write-Host '[ACTION] Full read-only scan of the system image.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with DISM ScanHealth?') {
        Write-Host '[RUN] Running DISM /ScanHealth (10-30 minutes, read-only)...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting DISM ScanHealth'
        $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/Online', '/Cleanup-Image', '/ScanHealth') -TimeoutSeconds 2400
        if (-not $run) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'DISM could not be started.'
        } else {
            $rc = $run.ExitCode
            $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-scanhealth-output.txt') -Encoding UTF8
            if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-scanhealth-stderr.txt') -Encoding UTF8 }
            Write-KnouxLog -Session $Session ("DISM ScanHealth exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            $Session.VerificationPerformed = $true
            if ($run.Success) {
                $Session.Status = 'Success'
                $Session.VerificationResult = 'OK'
                Write-Host '[OK] No corruption detected by the scan.' -ForegroundColor Green
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