#Requires -Version 5.1
#  knoux Repair v2.0.2 | 09-Security | SE09 - Security Report
#  Risk: READ_ONLY
#  Comprehensive security report: Defender status, signatures,
#  firewall profiles, UAC, recent threat detections. Read-only.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE09' -ToolName 'Security Report' -Category '09-Security' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $rows = @()
    $mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
    if ($mp) {
        Write-Host 'Windows Defender:' -ForegroundColor Cyan
        Write-Host ('  Real-time protection: {0}' -f $(if ($mp.RealTimeProtectionEnabled) { 'Enabled' } else { 'Disabled' })) -ForegroundColor $(if ($mp.RealTimeProtectionEnabled) { 'Green' } else { 'Red' })
        Write-Host ('  Antivirus signatures: {0} days old' -f $mp.AntivirusSignatureAge) -ForegroundColor Gray
        Write-Host ('  Antispyware signatures: {0} days old' -f $mp.AntispywareSignatureAge) -ForegroundColor Gray
        Write-Host ('  Tamper protection: {0}' -f $(if ($mp.IsTamperProtected) { 'Enabled' } else { 'Disabled' })) -ForegroundColor Gray
        Write-Host ('  Last full scan: {0}' -f $mp.FullScanEndTime) -ForegroundColor Gray
        Write-Host ('  Last quick scan: {0}' -f $mp.QuickScanEndTime) -ForegroundColor Gray
        $rows += [pscustomobject]@{ Item = 'Defender real-time'; Value = $mp.RealTimeProtectionEnabled }
        $rows += [pscustomobject]@{ Item = 'Signature age (days)'; Value = $mp.AntivirusSignatureAge }
    } else {
        Write-Host '[WARN] Windows Defender is not available.' -ForegroundColor Yellow
        $rows += [pscustomobject]@{ Item = 'Defender real-time'; Value = 'unavailable' }
    }

    $fw = Get-NetFirewallProfile -ErrorAction SilentlyContinue
    if ($fw) {
        Write-Host 'Firewall:' -ForegroundColor Cyan
        foreach ($p in $fw) {
            $state = if ($p.Enabled) { 'Enabled' } else { 'Disabled' }
            Write-Host ('  {0}: {1}' -f $p.Name, $state) -ForegroundColor $(if ($p.Enabled) { 'Green' } else { 'Red' })
            $rows += [pscustomobject]@{ Item = ('Firewall ' + $p.Name); Value = $state }
        }
    }

    $detections = @(Get-MpThreatDetection -ErrorAction SilentlyContinue | Sort-Object InitialDetectionTime -Descending | Select-Object -First 10)
    Write-Host ('Recent threat detections ({0} shown):' -f $detections.Count) -ForegroundColor Cyan
    if ($detections.Count -eq 0) {
        Write-Host '  (none)' -ForegroundColor Gray
    }
    foreach ($d in $detections) {
        Write-Host ('  {0}  {1}' -f $d.InitialDetectionTime, ($d.Resources -join '; ')) -ForegroundColor Red
    }

    $rows += @($detections | ForEach-Object { [pscustomobject]@{ Item = 'Threat detection'; Value = ('{0} | {1}' -f $_.InitialDetectionTime, ($_.Resources -join ';')) } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'security-report.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'security-report.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Security report: $($rows.Count) entries, $($detections.Count) recent detections"
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
