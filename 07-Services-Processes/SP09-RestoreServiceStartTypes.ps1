#Requires -Version 5.1
#  knoux Repair v2.0 | 07-Services-Processes | SP09 - Restore Service Start Types
#  Risk: SYSTEM_REPAIR | Requires admin
#  Restores service start types previously backed up by SP08 (Service
#  Recommendations). It scans the Reports tree for service-start-backup.json
#  files, lists the runs that contain one, loads the chosen backup and
#  offers to restore each service to its original start type. Restored
#  start types are verified after the change.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [string]$Selection)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP09' -ToolName 'Restore Service Start Types' -Category '07-Services-Processes' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0

$reportsDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'Reports'

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    if (-not (Test-Path -LiteralPath $reportsDir)) {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = "No Reports directory found ('$reportsDir'). Nothing to restore."
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
        $Session.ExitCode = $rc
        $result = Stop-KnouxSession -Session $Session
        Write-KnouxResult -Session $Session
        return $result
    }

    $backups = @(Get-ChildItem -LiteralPath $reportsDir -Recurse -Filter 'service-start-backup.json' -File -ErrorAction Stop)
    if ($backups.Count -eq 0) {
        Write-Host '[OK] No service start-type backups found. Run SP08 (Service Recommendations) first to create one.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No service start-type backups found'
        $Session.ExitCode = $rc
        $result = Stop-KnouxSession -Session $Session
        Write-KnouxResult -Session $Session
        return $result
    }

    $backups = @($backups | Sort-Object LastWriteTime -Descending)
    Write-Host ('{0} service start-type backup(s) found:' -f $backups.Count) -ForegroundColor Cyan
    $i = 0
    foreach ($b in $backups) {
        $i++
        $runName = Split-Path -Leaf (Split-Path -Parent (Split-Path -Parent $b.FullName))
        Write-Host ('  {0,2}. {1}  (run {2})' -f $i, $b.LastWriteTime, $runName) -ForegroundColor Yellow
    }

    if ($AnalyzeOnly -or $WhatIf) {
        Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to restore.' -ForegroundColor Green
        Write-KnouxLog -Session $Session ("Analyze: {0} backup(s) available, no changes" -f $backups.Count)
        $Session.Status = 'Success'
    } elseif (-not (Test-KnouxAdministrator)) {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Administrator privileges are required.'
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        Write-Host ''
        Write-Host ('Enter the backup number to use (1-{0}) or 0 to cancel:' -f $backups.Count) -ForegroundColor Yellow
        $input = $Selection
        $n = 0
        if ($input -match '^\d+$') { $n = [int]$input }
        if ($n -lt 1 -or $n -gt $backups.Count) {
            $Session.Status = 'Cancelled'
            Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
        } else {
            $backupFile = $backups[$n - 1]
            $entries = @()
            try {
                $entries = @(Get-Content -LiteralPath $backupFile.FullName -Raw | ConvertFrom-Json)
            } catch {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = "Could not read backup '$($backupFile.FullName)': $($_.Exception.Message)"
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
            }
            if ($entries.Count -gt 0) {
                $restored = 0
                $verified = 0
                foreach ($e in $entries) {
                    $name = $e.ServiceName
                    $orig = $e.OriginalStartType
                    Write-Host ('  Restoring {0} to {1} ...' -f $name, $orig) -ForegroundColor Yellow
                    try {
                        Set-Service -Name $name -StartupType $orig -ErrorAction Stop
                        $restored++
                        $now = (Get-Service -Name $name -ErrorAction Stop).StartType
                        if ("$now" -eq "$orig") {
                            $verified++
                            Write-Host ('    [OK] {0} start type now {1}' -f $name, $now) -ForegroundColor Green
                        } else {
                            Write-Host ('    [WARN] {0} start type is {1} (expected {2})' -f $name, $now, $orig) -ForegroundColor Yellow
                        }
                        Write-KnouxLog -Session $Session ("Restored service {0} start type to {1} (now {2})" -f $name, $orig, $now)
                    } catch {
                        Write-Host ('    [ERROR] could not restore {0}: {1}' -f $name, $_.Exception.Message) -ForegroundColor Red
                        Write-KnouxLog -Session $Session ("FAIL restore {0}: {1}" -f $name, $_.Exception.Message)
                    }
                }
                if ($restored -eq 0) {
                    $Session.Status = 'Warning'
                    $Session.ErrorMessage = 'No service could be restored.'
                } else {
                    $Session.Status = 'Success'
                    $Session.ChangedSystem = $true
                    $Session.ItemsProcessed = $restored
                    Write-Host ('[OK] Restored {0} service(s); {1} verified.' -f $restored, $verified) -ForegroundColor Green
                }
            }
        }
    }
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
