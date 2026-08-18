#Requires -Version 5.1
#  knoux Repair v2.0 | 09-Security | SE05 - Enable Firewall
#  Risk: SYSTEM_REPAIR | Requires admin
#  Enables Windows Firewall on all profiles.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE05' -ToolName 'Enable Firewall' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
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
        if ($AnalyzeOnly -or $WhatIf) {
         Write-Host ('[ANALYZE] Would enable firewall on {0} profile(s).' -f @($fw).Count) -ForegroundColor Green
             Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
             $Session.Status = 'Success'
             Write-KnouxLog -Session $Session 'Analyze: would enable firewall'
         } else {
             if (Confirm-KnouxAction 'Enable Windows Firewall on all profiles?') {
                 $ok = Set-KnouxFirewallState
                 if ($ok) {
                     $Session.Status = 'Success'
                     $Session.ChangedSystem = $true
                     $Session.ItemsProcessed = @($fw).Count
                     Write-Host ('[OK] Firewall enabled on {0} profile(s).' -f @($fw).Count) -ForegroundColor Green
                    Write-KnouxLog -Session $Session "Firewall enabled on $($fw.Count) profiles"
                } else {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = 'Firewall could not be enabled.'
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
