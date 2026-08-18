#Requires -Version 5.1
#  knoux Repair v2.0 | 01-System-Maintenance | SM06 - Check Disk Online
#  Risk: READ_ONLY | Offline: Yes | Admin: Required
#  Runs chkdsk /scan on the system drive: online read-only scan.
#  Use SM07 to schedule a full repair at the next boot.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM06' -ToolName 'Check Disk Online' -Category '01-System-Maintenance' -RiskLevel 'READ_ONLY'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to run chkdsk.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: chkdsk.exe /scan (online, read-only)' -ForegroundColor Green
    Write-Host '[ANALYZE] No repair is performed; use SM07 to schedule a repair.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would run chkdsk /scan'
} else {
    Write-Host ('[ACTION] Online read-only scan of drive ' + $env:SystemDrive) -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with chkdsk /scan?') {
        Write-Host '[RUN] Running chkdsk /scan (read-only, may take several minutes)...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting chkdsk /scan'
        $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\chkdsk.exe" -ArgumentList @($env:SystemDrive.TrimEnd('\') + '\', '/scan') -TimeoutSeconds 1200
        if (-not $run) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'chkdsk could not be started.'
        } else {
            $rc = $run.ExitCode
            $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'chkdsk-scan-output.txt') -Encoding UTF8
            if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'chkdsk-scan-stderr.txt') -Encoding UTF8 }
            Write-KnouxLog -Session $Session ("chkdsk /scan exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            $Session.VerificationPerformed = $true
            if ($rc -eq 0) {
                $Session.Status = 'Success'
                $Session.VerificationResult = 'OK'
                Write-Host '[OK] No disk errors found (scan only).' -ForegroundColor Green
            } else {
                $Session.Status = 'Warning'
                $Session.VerificationResult = 'ERRORS_FOUND'
                $Session.ErrorMessage = "chkdsk reported errors (exit $rc). Schedule a repair with SM07."
                Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
            }
            if ($run.TimedOut) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = 'chkdsk exceeded the time limit.'
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