#Requires -Version 5.1
#  knoux Repair v2.0 | 09-Security | SE06 - Repair Firewall
#  Risk: SYSTEM_REPAIR | Requires admin
#  Repairs the Windows Firewall: exports a policy backup, ensures
#  the firewall service (mpssvc) and base filtering engine (BFE)
#  are running, then enables the firewall on all profiles and
#  verifies the result. This tool can never disable the firewall.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE06' -ToolName 'Repair Firewall' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    try {
        $fw = Get-KnouxFirewallStatus
        $offProfiles = @($fw | Where-Object { -not $_.Enabled })
        $svc = Get-Service -Name 'mpssvc' -ErrorAction SilentlyContinue
        $bfe = Get-Service -Name 'BFE' -ErrorAction SilentlyContinue
        Write-Host 'Firewall profile state:'
        foreach ($p in $fw) {
            Write-Host ('  {0,-8}: {1}' -f $p.Profile, $(if ($p.Enabled) { 'ON' } else { 'OFF' })) -ForegroundColor $(if ($p.Enabled) { 'Green' } else { 'Red' })
        }
        if ($svc) { Write-Host ('  Firewall service (mpssvc): {0}' -f $svc.Status) }
        if ($bfe) { Write-Host ('  Base filtering engine (BFE): {0}' -f $bfe.Status) }

        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host ('[ANALYZE] Would restore firewall ON for {0} profile(s), start required services, and export a policy backup.' -f $offProfiles.Count) -ForegroundColor Green
            Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session ("Analyze: {0} profile(s) OFF" -f $offProfiles.Count)
        } else {
            Write-Host '[ACTION] Repair: export policy backup, ensure services running, enable firewall ON for all profiles.' -ForegroundColor Yellow
            Write-Host '[SAFETY] The firewall is never disabled by this tool.' -ForegroundColor DarkGray
            if (Confirm-KnouxAction 'Proceed with firewall repair?') {
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $backupDir = Join-Path (Join-Path $Session.ProjectRoot 'Backups') ('SE06-' + $stamp)
                New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
                $policy = Join-Path $backupDir 'firewall-policy.wfw'
                $null = & netsh.exe advfirewall export $policy 2>$null
                if (Test-Path -LiteralPath $policy) {
                    $Session.BackupPath = $backupDir
                    Write-Host ('[OK] Policy backup: {0}' -f $policy) -ForegroundColor Green
                    Write-KnouxLog -Session $Session ("Firewall policy exported to $policy")
                } else {
                    Write-KnouxLog -Session $Session 'Firewall policy export failed' 'WARN'
                }

                foreach ($s in @('BFE', 'mpssvc')) {
                    $g = Get-Service -Name $s -ErrorAction SilentlyContinue
                    if ($g) {
                        if ($g.StartType -ne 'Automatic') { Set-Service -Name $s -StartupType Automatic -ErrorAction SilentlyContinue }
                        if ($g.Status -ne 'Running') { Start-Service -Name $s -ErrorAction SilentlyContinue }
                    }
                }

                $enabled = Set-KnouxFirewallState
                $verify = @(Get-KnouxFirewallStatus)
                $allOn = ($verify.Count -gt 0) -and (@($verify | Where-Object { -not $_.Enabled }).Count -eq 0)
                $svcAfter = Get-Service -Name 'mpssvc' -ErrorAction SilentlyContinue
                $svcRunning = $svcAfter -and $svcAfter.Status -eq 'Running'

                if ($enabled -and $allOn -and $svcRunning) {
                    $Session.Status = 'Success'
                    $Session.ChangedSystem = $true
                    $Session.ItemsProcessed = $verify.Count
                    Write-Host ('[OK] Firewall ON on {0} profile(s); services running.' -f $verify.Count) -ForegroundColor Green
                    Write-KnouxLog -Session $Session 'Firewall repair completed and verified'
                } else {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = 'Firewall repair could not be fully verified.'
                    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                }
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
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
