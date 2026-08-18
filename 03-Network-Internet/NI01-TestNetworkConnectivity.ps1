#Requires -Version 5.1
#  knoux Repair v2.0 | 03-Network-Internet | NI01 - Test Network Connectivity
#  Risk: READ_ONLY | Offline: Partial (needs a reachable network)
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI01' -ToolName 'Test Network Connectivity' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $false
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $ping = "$env:SystemRoot\System32\ping.exe"
    $results = @()

    Write-Host '[1] Local adapter status' -ForegroundColor Cyan
    $adapters = @()
    try {
        $adapters = @(Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' })
    } catch { }
    Write-Host ('  Up adapters: ' + $adapters.Count) -ForegroundColor Green
    foreach ($a in $adapters | Select-Object -First 5) {
        Write-Host ('    {0,-20} {1}  {2}' -f $a.Name, $a.InterfaceDescription, $a.LinkSpeed)
    }

    Write-Host '[2] Ping gateway' -ForegroundColor Cyan
    $gateway = $null
    try {
        $gwLine = ipconfig | Select-String -Pattern 'Default Gateway' | Select-Object -First 1
        if ($gwLine) { $gateway = (($gwLine.ToString() -split ':\s*')[-1]).Trim() }
    } catch { }
    if (-not $gateway) {
        try {
            $route = @(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $_.NextHop } | Select-Object -First 1)
            if ($route.Count -gt 0) { $gateway = [string]$route[0].NextHop }
        } catch { }
    }
    $gwOk = 'NONE'
    if ($gateway) {
        Write-Host ('  Gateway: ' + $gateway)
        $r1 = Invoke-KnouxNativeCommand -FilePath $ping -ArgumentList @('-n', '4', $gateway) -TimeoutSeconds 60
        if ($r1) { $r1.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ping-gateway.txt') -Encoding UTF8; $results += "gateway:$($r1.Success)" }
        $gwOk = if ($r1 -and $r1.Success) { 'REACHABLE' } else { 'FAILED' }
        Write-Host ('  => ' + $gwOk) -ForegroundColor $(if ($gwOk -eq 'REACHABLE') {'Green'} else {'Red'})
    } else {
        Write-Host '  => no IPv4 gateway detected' -ForegroundColor Yellow
        $results += 'gateway:none'
    }

    Write-Host '[3] DNS resolution' -ForegroundColor Cyan
    $dnsOk = $false
    try { $dnsOk = [bool](Resolve-DnsName -Name 'www.microsoft.com' -ErrorAction SilentlyContinue) } catch { }
    if (-not $dnsOk) {
        try {
            $ns = Invoke-KnouxNativeCommand -FilePath "$env:SystemRoot\System32\nslookup.exe" -ArgumentList @('www.microsoft.com') -TimeoutSeconds 60
            $dnsOk = ($ns -and $ns.Success -and ($ns.Stdout -match 'Address'))
        } catch { }
    }
    if ($dnsOk) {
        Write-Host '  => DNS resolution OK' -ForegroundColor Green
        $results += 'dns:ok'
    } else {
        Write-Host '  => DNS resolution FAILED' -ForegroundColor Red
        $results += 'dns:fail'
    }

    Write-Host '[4] Internet reachability' -ForegroundColor Cyan
    $r2 = Invoke-KnouxNativeCommand -FilePath $ping -ArgumentList @('-n', '4', '8.8.8.8') -TimeoutSeconds 60
    if ($r2) { $r2.Stdout | Out-File -LiteralPath (Join-Path $Session.RawDir 'ping-internet.txt') -Encoding UTF8 }
    $netOk = if ($r2 -and $r2.Success) { 'REACHABLE' } else { 'UNREACHABLE' }
    Write-Host ('  => 8.8.8.8 ' + $netOk) -ForegroundColor $(if ($netOk -eq 'REACHABLE') {'Green'} else {'Red'})

    $results | Out-File -LiteralPath (Join-Path $Session.RawDir 'connectivity-results.txt') -Encoding UTF8
    $Session.ItemsFound = 4
    $Session.ItemsProcessed = 1
    if ($gwOk -eq 'REACHABLE' -and $netOk -eq 'REACHABLE') { $Session.Status = 'Success' }
    else { $Session.Status = 'Warning'; $Session.ErrorMessage = 'One or more connectivity checks failed.' }
    Write-KnouxLog -Session $Session "Connectivity: $($results -join ', ')"
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
