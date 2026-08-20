[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT12' -ToolName 'Local Development Trust Inspector' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $hostsPath = Join-Path $env:WINDIR 'System32\\drivers\\etc\\hosts'
  $hostsLines = if (Test-Path -LiteralPath $hostsPath) { @(Get-Content -LiteralPath $hostsPath -ErrorAction SilentlyContinue | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') }) } else { @() }
  $certs = @()
  try {
    $certs = @(Get-ChildItem -Path Cert:\\CurrentUser\\My -ErrorAction Stop | Where-Object { $_.Subject -match 'localhost|127\\.0\\.0\\.1|dev|local' } | ForEach-Object { [pscustomobject]@{ Subject=$_.Subject; Issuer=$_.Issuer; NotAfter=$_.NotAfter.ToString('o'); Thumbprint=$_.Thumbprint; HasPrivateKey=$_.HasPrivateKey } })
  } catch { Write-KnouxLog -Session -Message 'Current-user certificate store could not be queried.' -Level WARN }
  [pscustomobject]@{ HostsPath=$hostsPath; HostsEntries=$hostsLines; LocalDevelopmentCertificates=$certs; CapturedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $Session.RawDir 'local-development-trust.json') -Encoding UTF8
  $Session.ItemsFound = $hostsLines.Count + $certs.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Collected {0} hosts entries and {1} local-development certificate records.' -f $hostsLines.Count,$certs.Count)
  Write-Host '[OK] Local development trust inspection completed.' -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
