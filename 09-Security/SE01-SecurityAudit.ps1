#Requires -Version 5.1
#  knoux Repair v2.0 | 09-Security | SE01 - Security Audit
#  Risk: READ_ONLY
#  Reports the status of key security controls: real-time protection,
#  firewall (all profiles), UAC, and Defender signature age.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE01' -ToolName 'Security Audit' -Category '09-Security' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $checks = @()
    $mp = Get-MpComputerStatus -ErrorAction SilentlyContinue
    if ($mp) {
        $checks += [pscustomobject]@{ Check = 'Real-time protection'; Status = $(if ($mp.RealTimeProtectionEnabled) { 'Enabled' } else { 'Disabled' }) }
        $checks += [pscustomobject]@{ Check = 'Antivirus signatures'; Status = ('{0} days old' -f $mp.AntivirusSignatureAge) }
        $checks += [pscustomobject]@{ Check = 'Antispyware signatures'; Status = ('{0} days old' -f $mp.AntispywareSignatureAge) }
        $checks += [pscustomobject]@{ Check = 'Tamper protection'; Status = $(if ($mp.IsTamperProtected) { 'Enabled' } else { 'Disabled' }) }
    } else {
        $checks += [pscustomobject]@{ Check = 'Windows Defender'; Status = 'Not available' }
    }

    $fw = Get-KnouxFirewallStatus
    if (@($fw).Count -gt 0) {
        foreach ($p in $fw) {
            $checks += [pscustomobject]@{ Check = ('Firewall ({0})' -f $p.Profile); Status = $(if ($p.Enabled) { 'Enabled' } else { 'Disabled' }) }
        }
    } else {
        $checks += [pscustomobject]@{ Check = 'Firewall'; Status = 'Not available' }
    }

    $enableLua = (Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
    $checks += [pscustomobject]@{ Check = 'UAC (EnableLUA)'; Status = $(if ($enableLua -eq 1) { 'Enabled' } else { 'Disabled' }) }

    foreach ($c in $checks) {
        $color = if ($c.Status -like 'Enable*' -or $c.Status -like '*not available*') { 'Gray' } elseif ($c.Status -like 'Disable*') { 'Red' } else { 'Green' }
        Write-Host ('  {0,-28} {1}' -f $c.Check, $c.Status) -ForegroundColor $color
    }

    $checks | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'security-audit.csv') -NoTypeInformation -Encoding UTF8
    $checks | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'security-audit.json') -Encoding UTF8
    $Session.ItemsFound = $checks.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Security audit: $($checks.Count) checks"
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
