#Requires -Version 5.1
#  knoux Repair v2.0 | 09-Security | SE07 - UAC Settings
#  Risk: SYSTEM_REPAIR | Requires admin
#  Shows the current UAC configuration and can only ever ENABLE
#  UAC (restore the default level) after a registry backup.
#  UAC is never disabled by this tool; read-only status is shown
#  even without admin rights.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE07' -ToolName 'UAC Settings' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0
$policyPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $enableLua = (Get-ItemProperty -Path $policyPath -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
    $consent = (Get-ItemProperty -Path $policyPath -Name ConsentPromptBehaviorAdmin -ErrorAction SilentlyContinue).ConsentPromptBehaviorAdmin
    $uacState = if ($enableLua -eq 1) { 'Enabled' } else { 'Disabled' }
    Write-Host ('UAC: {0}  (EnableLUA={1}, ConsentPromptBehaviorAdmin={2})' -f $uacState, $enableLua, $consent) -ForegroundColor $(if ($enableLua -eq 1) { 'Green' } else { 'Red' })

    if ($AnalyzeOnly -or $WhatIf) {
        Write-Host ('[ANALYZE] Would set EnableLUA=1 and ConsentPromptBehaviorAdmin=2.' -f $uacState) -ForegroundColor Green
        Write-Host '[ANALYZE] UAC is never disabled by this tool.' -ForegroundColor Green
        Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session ("Analyze: UAC state = {0}" -f $uacState)
    } elseif (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Administrator privileges are required to change UAC.'
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        if ($enableLua -eq 1 -and $consent -eq 2) {
            Write-Host '[OK] UAC is already enabled at the default level.' -ForegroundColor Green
            $Session.Status = 'Success'
        } else {
            Write-Host '[ACTION] Enables UAC and restores the default prompt level (registry backup first).' -ForegroundColor Yellow
            if (Confirm-KnouxAction 'Enable UAC at the default level?') {
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $backupDir = Join-Path (Join-Path $Session.ProjectRoot 'Backups') ('SE07-' + $stamp)
                New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
                $regBackup = Join-Path $backupDir 'policies-system.reg'
                $null = & reg.exe export 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' $regBackup /y 2>$null
                if (Test-Path -LiteralPath $regBackup) {
                    $Session.BackupPath = $backupDir
                    Write-Host ('[OK] Registry backup: {0}' -f $regBackup) -ForegroundColor Green
                    Write-KnouxLog -Session $Session ("UAC registry backed up to $regBackup")
                } else {
                    Write-KnouxLog -Session $Session 'UAC registry export failed; continuing' 'WARN'
                }
                Set-ItemProperty -Path $policyPath -Name EnableLUA -Value 1 -Type DWord -ErrorAction Stop
                Set-ItemProperty -Path $policyPath -Name ConsentPromptBehaviorAdmin -Value 2 -Type DWord -ErrorAction Stop
                $afterLua = (Get-ItemProperty -Path $policyPath -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
                $afterConsent = (Get-ItemProperty -Path $policyPath -Name ConsentPromptBehaviorAdmin -ErrorAction SilentlyContinue).ConsentPromptBehaviorAdmin
                if ($afterLua -eq 1 -and $afterConsent -eq 2) {
                    $Session.Status = 'Success'
                    $Session.ChangedSystem = $true
                    $Session.ItemsProcessed = 1
                    Write-Host '[OK] UAC enabled. A reboot is required.' -ForegroundColor Green
                    Write-KnouxLog -Session $Session 'UAC enabled and verified (EnableLUA=1, Consent=2)'
                } else {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = 'UAC change could not be verified.'
                    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                }
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
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
