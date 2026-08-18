#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI02 - Renew IP Address
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Required
#  ipconfig /release then /renew on all adapters.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI02' -ToolName 'Renew IP Address' -Category '03-Network-Internet' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required for ipconfig /release and /renew.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: ipconfig /release then ipconfig /renew on all adapters.' -ForegroundColor Green
    Write-Host '[ANALYZE] Brief loss of connectivity is expected. No changes in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would renew IP addresses'
} else {
    Write-Host '[ACTION] This renews DHCP leases on all adapters.' -ForegroundColor Yellow
    Write-Host '[NOTE] A brief loss of connectivity may occur.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Renew all IP addresses now?') {
        Write-Host '[1/2] ipconfig /release ...' -ForegroundColor Green
        $r1 = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\ipconfig.exe" -ArgumentList @('/release') -TimeoutSeconds 120
        if ($r1) { $r1.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ipconfig-release.txt') -Encoding UTF8; Write-KnouxLog -Session $Session ("ipconfig /release exit {0}" -f $r1.ExitCode); $rc = $r1.ExitCode }
        Write-Host '[2/2] ipconfig /renew ...' -ForegroundColor Green
        $r2 = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\ipconfig.exe" -ArgumentList @('/renew') -TimeoutSeconds 180
        if ($r2) {
            $r2.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ipconfig-renew.txt') -Encoding UTF8
            Write-KnouxLog -Session $Session ("ipconfig /renew exit {0}" -f $r2.ExitCode)
            $rc = $r2.ExitCode
        }
        $Session.ItemsProcessed = 2
        $ipOk = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -notlike '127.*' }).Count -gt 0
        if ($rc -eq 0 -and $ipOk) {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
            Write-Host '[OK] IP addresses renewed and verified (adapter has an IPv4 lease).' -ForegroundColor Green
        } else {
            $Session.Status = 'Warning'
            $Session.ErrorMessage = "ipconfig exit code $rc; no valid IPv4 lease found after renew."
            Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
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
