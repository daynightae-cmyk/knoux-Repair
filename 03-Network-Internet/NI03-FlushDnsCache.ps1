#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI03 - Flush DNS Cache
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Required
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI03' -ToolName 'Flush DNS Cache' -Category '03-Network-Internet' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to flush the DNS cache.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: ipconfig /flushdns (clears the DNS resolver cache).' -ForegroundColor Green
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would flush DNS cache'
} else {
    Write-Host '[ACTION] This clears the DNS resolver cache.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Flush the DNS cache now?') {
        $r = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\ipconfig.exe" -ArgumentList @('/flushdns') -TimeoutSeconds 60
        if ($r) {
            $rc = $r.ExitCode
            $r.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ipconfig-flushdns.txt') -Encoding UTF8
            Write-KnouxLog -Session $Session ("ipconfig /flushdns exit {0}" -f $rc)
            $Session.ItemsProcessed = 1
            if ($r.Success) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                Write-Host '[OK] DNS cache flushed.' -ForegroundColor Green
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = "ipconfig /flushdns failed with exit code $rc."
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
            }
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'ipconfig could not be started.'
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
