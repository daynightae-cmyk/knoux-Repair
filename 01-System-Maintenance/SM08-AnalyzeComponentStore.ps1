#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM08 - Analyze Component Store
#  Risk: READ_ONLY | Offline: Yes | Admin: Required
#  Runs DISM /Online /Cleanup-Image /AnalyzeComponentStore to report
#  WinSxS component store size and whether cleanup is recommended.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM08' -ToolName 'Analyze Component Store' -Category '01-System-Maintenance' -RiskLevel 'READ_ONLY'
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
    Write-Host '[ANALYZE] Would run: DISM /Online /Cleanup-Image /AnalyzeComponentStore' -ForegroundColor Green
    Write-Host '[ANALYZE] Read-only analysis of the WinSxS component store.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would run DISM AnalyzeComponentStore'
} else {
    Write-Host '[ACTION] Read-only analysis of the component store.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Proceed with AnalyzeComponentStore?') {
        Write-Host '[RUN] Analyzing component store (read-only, may take a few minutes)...' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Starting DISM AnalyzeComponentStore'
        $run = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\Dism.exe" -ArgumentList @('/Online', '/Cleanup-Image', '/AnalyzeComponentStore') -TimeoutSeconds 1200
        if (-not $run) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'DISM could not be started.'
        } else {
            $rc = $run.ExitCode
            $run.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-analyzecomponentstore-output.txt') -Encoding UTF8
            if ($run.Stderr) { $run.Stderr | Out-File -LiteralPath (Join-Path $Session.RawDir 'dism-analyzecomponentstore-stderr.txt') -Encoding UTF8 }
            Write-KnouxLog -Session $Session ("DISM AnalyzeComponentStore exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            $Session.VerificationPerformed = $true
            if ($run.Success) {
                $Session.Status = 'Success'
                $Session.VerificationResult = 'OK'
                Write-Host '[OK] Component store analysis completed (read-only).' -ForegroundColor Green
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