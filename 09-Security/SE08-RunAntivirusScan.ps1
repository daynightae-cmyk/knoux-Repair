#Requires -Version 5.1
#  knoux Repair v2.0.2 | 09-Security | SE08 - Run Antivirus Scan
#  Risk: SYSTEM_REPAIR | Requires admin
#  Runs a Windows Defender scan (Full by default; pass -Quick for a
#  quick scan). This can take a long time on large disks.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$Quick)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE08' -ToolName 'Run Antivirus Scan' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0
$scanType = if ($Quick) { 'QuickScan' } else { 'FullScan' }

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif (-not (Get-Command Start-MpWDOScan -ErrorAction SilentlyContinue)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Windows Defender scan cmdlets are not available.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    try {
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host ('[ANALYZE] Would start a {0}.' -f $(if ($Quick) { 'Quick scan' } else { 'Full scan' })) -ForegroundColor Green
            Write-Host '[ANALYZE] No scan is started in analyze mode.' -ForegroundColor Green
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session ("Analyze: would run {0}" -f $scanType)
        } else {
            if (Confirm-KnouxAction ("Start {0}? This may take a long time." -f $(if ($Quick) { 'quick scan' } else { 'full scan' }))) {
                Write-Host '[INFO] Starting scan... (this runs in the background via Defender)' -ForegroundColor Cyan
                Start-MpWDOScan -ScanType $scanType -ErrorAction Stop
                $status = Get-MpComputerStatus -ErrorAction SilentlyContinue
                $scanDone = $null -eq $status -or -not $status.DefenderScanInProgress
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = 1
                if ($scanDone) {
                    $Session.Status = 'Success'
                    Write-Host ('[OK] {0} completed (no scan still in progress).' -f $(if ($Quick) { 'Quick scan' } else { 'Full scan' })) -ForegroundColor Green
                    Write-KnouxLog -Session $Session ("{0} completed and verified" -f $scanType)
                } else {
                    $Session.Status = 'Warning'
                    $Session.ErrorMessage = 'Scan still reported in progress after completion.'
                    Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                    Write-KnouxLog -Session $Session $Session.ErrorMessage 'WARN'
                }
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No scan started.' -ForegroundColor Yellow
            }
        }
    } catch {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = $_.Exception.Message
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
