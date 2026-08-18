#Requires -Version 5.1
#  knoux Repair v2.0.2 | 03-Network-Internet | NI07 - Show Network Configuration
#  Risk: READ_ONLY | Offline: Yes
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI07' -ToolName 'Show Network Configuration' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    Write-Host '[1] ipconfig /all' -ForegroundColor Cyan
    $r = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\ipconfig.exe" -ArgumentList @('/all') -TimeoutSeconds 60
    if ($r) {
        $rc = $r.ExitCode
        $r.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ipconfig-all.txt') -Encoding UTF8
        $r.Stdout -split "`r?`n" | ForEach-Object { Write-Host ('  ' + $_) -ForegroundColor Gray }
        Write-KnouxLog -Session $Session ("ipconfig /all exit {0}" -f $rc)
    }

    Write-Host ''
    Write-Host '[2] TCP/IP settings per adapter' -ForegroundColor Cyan
    $rows = @()
    $adapters = @(Get-CimInstance -ClassName Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object { $_.PhysicalAdapter -or $_.NetEnabled })
    foreach ($a in $adapters) {
        $cfg = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -Filter ("Index={0}" -f $a.Index) -ErrorAction SilentlyContinue
        if (-not $cfg) { continue }
        $ips = @($cfg.IPAddress | Where-Object { $_ -and $_.Contains('.') })
        $ip = if ($ips.Count -gt 0) { $ips[0] } else { '' }
        $gw = @($cfg.DefaultIPGateway | Where-Object { $_ -and $_.Contains('.') })
        $gwVal = if ($gw.Count -gt 0) { $gw[0] } else { '' }
        $dns = if ($cfg.DNSServerSearchOrder) { ($cfg.DNSServerSearchOrder -join ', ') } else { '' }
        $dhcp = if ($cfg.DHCPEnabled) { 'Enabled' } else { 'Static' }
        $rows += [pscustomobject]@{ Interface = $a.Name; IP = $ip; Gateway = $gwVal; DNS = $dns; DHCP = $dhcp }
        Write-Host ('  {0,-24} IP: {1,-16} GW: {2,-16} DHCP: {3}' -f $a.Name, $ip, $gwVal, $dhcp)
    }
    if ($rows.Count) {
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'adapter-config.json') -Encoding UTF8
        $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'adapter-config.csv') -NoTypeInformation -Encoding UTF8
    }
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Network configuration reported for {0} adapters" -f $rows.Count)
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
