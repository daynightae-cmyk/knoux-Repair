#Requires -Version 5.1
# Knoux Repair v2.0.2 | 03-Network-Internet | NI11 - Interactive Network Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom=[System.Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=$utf8NoBom;$OutputEncoding=$utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session=Start-KnouxSession -ToolId 'NI11' -ToolName 'Interactive Network Preview' -Category '03-Network-Internet' -RiskLevel 'READ_ONLY'
try {
  $configurations=@(Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction Stop | Where-Object { $_.IPEnabled })
  $adapters=@($configurations | ForEach-Object {
    $ips=@($_.IPAddress | Where-Object { $_ -and $_ -match '^\d{1,3}(\.\d{1,3}){3}$' -and $_ -notlike '169.254.*' })
    $gateways=@($_.DefaultIPGateway | Where-Object { $_ -and $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
    [pscustomobject]@{ Description=[string]$_.Description; IPv4=if($ips){$ips[0]}else{''}; Gateway=if($gateways){$gateways[0]}else{''}; DNS=@($_.DNSServerSearchOrder | Where-Object { $_ }) ; DHCP=[bool]$_.DHCPEnabled; MacAddress=[string]$_.MACAddress }
  })
  $preview=[pscustomobject]@{Adapters=$adapters;ActiveAdapters=$adapters.Count;WithGateway=@($adapters|Where-Object Gateway).Count;WithDns=@($adapters|Where-Object{$_.DNS.Count}).Count;Safety=[pscustomobject]@{ChangesMade=$false;Sources=@('Win32_NetworkAdapterConfiguration')}}
  $preview|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-network-preview.json') -Encoding UTF8
  $Session.ItemsFound=$adapters.Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Adapter configuration read locally; no network settings changed.'
  if($EmitJson){Write-Output '---KNOUX_NETWORK_JSON_START---';$preview|ConvertTo-Json -Depth 6 -Compress;Write-Output '---KNOUX_NETWORK_JSON_END---'}else{Write-Host ('[OK] Read {0} active network adapter(s).' -f $adapters.Count) -ForegroundColor Green}
}catch{$Session.Status='Failed';$Session.ErrorMessage=$_.Exception.Message;Write-Host ('[ERROR] '+$Session.ErrorMessage) -ForegroundColor Red;Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR}
$result=Stop-KnouxSession -Session $Session;Write-KnouxResult -Session $Session;return $result
