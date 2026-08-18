#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI10 - Network Report
#  Risk: READ_ONLY | Offline: Yes
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI10' -ToolName 'Network Report' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $rows = @()
    $cimOk = $true
    $netEAP = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $configs = @(Get-NetIPConfiguration)
    } catch {
        $cimOk = $false
        $configs = @()
    } finally { $ErrorActionPreference = $netEAP }
    foreach ($c in $configs) {
        $netEAP = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        try { $ad = @(Get-NetAdapter -InterfaceIndex $c.InterfaceIndex)[0] } catch { $ad = $null } finally { $ErrorActionPreference = $netEAP }
        $rows += [pscustomobject]@{
            Interface = $c.InterfaceAlias
            Index = $c.InterfaceIndex
            Status = if ($ad) { $ad.Status.ToString() } else { '' }
            LinkSpeed = if ($ad) { $ad.LinkSpeed.ToString() } else { '' }
            IP = if ($c.IPv4Address) { (($c.IPv4Address.IPAddress) -join ', ') } else { '' }
            Gateway = if ($c.IPv4DefaultGateway) { $c.IPv4DefaultGateway.NextHop } else { '' }
            DNS = if ($c.DNSServer) { (($c.DNSServer.ServerAddresses) -join ', ') } else { '' }
            DHCP = if ($c.NetAdapter) { if ($c.NetAdapter.DhcpEnabled) { 'Enabled' } else { 'Static' } } else { '' }
        }
    }

    Write-Host 'Network report:' -ForegroundColor Cyan
    foreach ($row in $rows) {
        Write-Host ''
        Write-Host ('  Interface : ' + $row.Interface) -ForegroundColor Green
        Write-Host ('  Status    : ' + $row.Status + '   Speed: ' + $row.LinkSpeed) -ForegroundColor Gray
        Write-Host ('  IP        : ' + $row.IP) -ForegroundColor Gray
        Write-Host ('  Gateway   : ' + $row.Gateway) -ForegroundColor Gray
        Write-Host ('  DNS       : ' + $row.DNS) -ForegroundColor Gray
        Write-Host ('  DHCP      : ' + $row.DHCP) -ForegroundColor Gray
    }

    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'network-report.json') -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'network-report.csv') -NoTypeInformation -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1
    if (-not $cimOk) {
        $Session.Status = 'Warning'
        $Session.ErrorMessage = 'Network configuration CIM data is unavailable; report is incomplete.'
        Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
    } else {
        $Session.Status = 'Success'
    }
    Write-KnouxLog -Session $Session ("Network report generated for {0} adapters" -f $rows.Count)
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
