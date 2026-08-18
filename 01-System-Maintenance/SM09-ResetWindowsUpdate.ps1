#Requires -Version 5.1
#  knoux Repair v2.0.2 | 01-System-Maintenance | SM09 - Reset Windows Update
#  Risk: DESTRUCTIVE | Offline: Yes | Admin: Required
#  Safe Windows Update repair: records the start mode and running
#  state of the WU services, stops them, renames (never deletes) the
#  SoftwareDistribution DataStore + Download folders, then restores
#  each service to its original start mode and running state.
#  Valid statuses: Success, Warning, Failed, Cancelled, Skipped, Inconclusive.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SM09' -ToolName 'Reset Windows Update' -Category '01-System-Maintenance' -RiskLevel 'DESTRUCTIVE'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

$svcNames = @('wuauserv', 'bits', 'cryptsvc')

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would stop wuauserv/bits/cryptsvc, rename SoftwareDistribution DataStore+Download, then restore service states.' -ForegroundColor Green
    Write-Host '[ANALYZE] Folders are renamed (backed up), never deleted.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would reset Windows Update caches (rename, not delete)'
} else {
    Write-Host '[ACTION] Resets Windows Update download/data caches.' -ForegroundColor Yellow
    if (-not (Confirm-KnouxDestructiveAction -Phrase 'RESET WINDOWS UPDATE')) {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    } else {
        $orig = @{}
        foreach ($n in $svcNames) {
            $svc = Get-Service -Name $n -ErrorAction SilentlyContinue
            if ($svc) { $orig[$n] = [pscustomobject]@{ StartType = $svc.StartType; Running = ($svc.Status -eq 'Running') } }
        }
        $stopped = $true
        foreach ($n in $svcNames) {
            if (-not $orig.ContainsKey($n)) { continue }
            try {
                Stop-Service -Name $n -Force -ErrorAction Stop
                Write-KnouxLog -Session $Session ("Stopped service {0}" -f $n)
            } catch {
                $stopped = $false
                Write-KnouxLog -Session $Session -Message ("Could not stop service {0}: {1}" -f $n, $_.Exception.Message) 'WARN'
                Write-Warning ("Could not stop service {0}: {1}" -f $n, $_.Exception.Message)
            }
        }
        if ($stopped) {
            $sd = Join-Path $env:SystemRoot 'SoftwareDistribution'
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $renamed = @()
            foreach ($sub in @('DataStore', 'Download')) {
                $src = Join-Path $sd $sub
                if (Test-Path -LiteralPath $src) {
                    $dst = ($src + '.KnouxBackup-' + $stamp)
                    try {
                        Move-Item -LiteralPath $src -Destination $dst -Force
                        $renamed += $dst
                        Write-KnouxLog -Session $Session ("Renamed {0} -> {1}" -f $src, $dst)
                    } catch {
                        Write-KnouxLog -Session $Session -Message ("Could not rename {0}: {1}" -f $src, $_.Exception.Message) 'WARN'
                        Write-Warning ("Could not rename {0}: {1}" -f $src, $_.Exception.Message)
                    }
                }
            }
            $Session.QuarantinePath = $sd
        }
        foreach ($n in $svcNames) {
            if (-not $orig.ContainsKey($n)) { continue }
            try {
                Set-Service -Name $n -StartupType $orig[$n].StartType -ErrorAction Stop
                Write-KnouxLog -Session $Session ("Restored start type for {0} to {1}" -f $n, $orig[$n].StartType)
                if ($orig[$n].Running) {
                    Start-Service -Name $n -ErrorAction Stop
                    Write-KnouxLog -Session $Session ("Started service {0}" -f $n)
                }
            } catch {
                Write-KnouxLog -Session $Session -Message ("Could not restore service {0}: {1}" -f $n, $_.Exception.Message) 'WARN'
                Write-Warning ("Could not restore service {0}: {1}" -f $n, $_.Exception.Message)
            }
        }
        $allRestored = $true
        foreach ($n in $svcNames) {
            if (-not $orig.ContainsKey($n)) { continue }
            $now = Get-Service -Name $n -ErrorAction SilentlyContinue
            if (-not $now) { $allRestored = $false; continue }
            if ($now.StartType -ne $orig[$n].StartType) { $allRestored = $false }
            if ($orig[$n].Running -and $now.Status -ne 'Running') { $allRestored = $false }
        }
        $Session.VerificationPerformed = $true
        if ($allRestored -and $stopped) {
            $Session.Status = 'Success'
            $Session.VerificationResult = 'OK'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $svcNames.Count
            Write-Host '[OK] Windows Update caches reset; service states restored.' -ForegroundColor Green
        } elseif ($stopped) {
            # Some renames failed but services restored
            $Session.Status = 'Warning'
            $Session.VerificationResult = 'PARTIAL_RENAME'
            $Session.ChangedSystem = $true
            Write-Host '[WARN] Services restored but some caches could not be renamed.' -ForegroundColor Yellow
        } else {
            $Session.Status = 'Failed'
            $Session.VerificationResult = 'MISMATCH'
            $Session.ErrorMessage = 'Windows Update service states could not be fully restored.'
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        }
        Write-Host '[INFO] Old caches were renamed, not deleted. See Quarantine/backup note in the report.' -ForegroundColor Gray
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result