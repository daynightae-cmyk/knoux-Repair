#Requires -Version 5.1
#  knoux Repair v2.0 | 07-Services-Processes | SP06 - Restart Windows Update Services
#  Risk: SYSTEM_REPAIR | Requires admin
#  Stops, then restarts the Windows Update services. Preserves the
#  original start types. Safe (no deletion, no cache clearing here).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP06' -ToolName 'Restart Windows Update Services' -Category '07-Services-Processes' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0
$svcNames = @('wuauserv', 'bits', 'cryptsvc', 'appidsvc', 'dosvc', 'WaaSMedicSvc')

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host ('[ANALYZE] Would stop then restart: ' + ($svcNames -join ', ')) -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would restart WU services'
} else {
    Write-Host '[ACTION] Stops and restarts the Windows Update service chain.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Restart Windows Update services now?') {
        $restarted = 0
        foreach ($name in $svcNames) {
            $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
            if (-not $svc) { continue }
            try {
                if ($svc.Status -eq 'Running') { Stop-Service -Name $name -Force -ErrorAction Stop }
                $startup = (Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $name) -ErrorAction SilentlyContinue).StartMode
                if ($startup -in @('Automatic', 'Manual') -and $svc.StartType -ne 'Disabled') {
                    Start-Service -Name $name -ErrorAction SilentlyContinue
                }
                $restarted++
                Write-KnouxLog -Session $Session ("Restarted service {0}" -f $name)
            } catch {
                Write-KnouxLog -Session $Session ("FAIL restart {0}: {1}" -f $name, $_.Exception.Message)
            }
        }
        $Session.Status = 'Success'
        $Session.ChangedSystem = $true
        $Session.ItemsProcessed = $restarted
        Write-Host ('[OK] Restarted {0} service(s).' -f $restarted) -ForegroundColor Green
    } else {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
