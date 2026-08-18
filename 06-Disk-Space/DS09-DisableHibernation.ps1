#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS09 - Disable Hibernation
#  Risk: SAFE_CLEANUP | Requires admin
#  Disables hibernation (frees the hiberfil.sys file). Shows the
#  reclaimed space. Can be re-enabled with `powercfg /h on`.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS09' -ToolName 'Disable Hibernation' -Category '06-Disk-Space' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$rc = 0
$powercfg = "$env:SystemRoot\System32\powercfg.exe"

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run `powercfg /h off` to disable hibernation.' -ForegroundColor Green
    Write-Host '[ANALYZE] hiberfil.sys would be removed, freeing several GB.' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would disable hibernation'
} else {
    Write-Host '[ACTION] Disables hibernation. Fast Startup and Sleep-To-Hibernate are affected.' -ForegroundColor Yellow
    Write-Host '[WARN] Re-enable any time with: powercfg /h on  (run as admin)' -ForegroundColor DarkYellow
    if (Confirm-KnouxAction 'Disable hibernation now?') {
        $r = Invoke-KnouxNativeCommand -FilePath $powercfg -ArgumentList @('/h', 'off') -TimeoutSeconds 60
        if ($r -and $r.Success) {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = 1
            Write-Host '[OK] Hibernation disabled. hiberfil.sys will be removed.' -ForegroundColor Green
            Write-KnouxLog -Session $Session 'Hibernation disabled'
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = ('powercfg /h off failed with exit code ' + $r.ExitCode)
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
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
