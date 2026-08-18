#Requires -Version 5.1
#  knoux Repair v2.0 | 04-Programs-Applications | PA06 - Check Runtime Components
#  Risk: READ_ONLY | Offline: Yes
#  Reports the presence/version of common runtime components:
#  .NET Framework, Microsoft Visual C++ Redistributables, and
#  the WebView2 runtime. No changes are ever made.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA06' -ToolName 'Check Runtime Components' -Category '04-Programs-Applications' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $rows = @()

    $dotnet = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -ErrorAction SilentlyContinue
    if ($dotnet) {
        $rows += [pscustomobject]@{ Component = '.NET Framework 4.x'; Detail = ('Release ' + $dotnet.Release + ' (installed)'); Present = $true }
    } else {
        $rows += [pscustomobject]@{ Component = '.NET Framework 4.x'; Detail = 'Not found'; Present = $false }
    }

    $vcredist = @('HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64', 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86')
    foreach ($p in $vcredist) {
        $r = Get-ItemProperty -LiteralPath $p -ErrorAction SilentlyContinue
        if ($r) {
            $arch = if ($p -match 'x64') { 'x64' } else { 'x86' }
            $rows += [pscustomobject]@{ Component = ('VC++ 2015-2022 Redistributable (' + $arch + ')'); Detail = ('Version ' + $r.Version); Present = $true }
        } else {
            $arch = if ($p -match 'x64') { 'x64' } else { 'x86' }
            $rows += [pscustomobject]@{ Component = ('VC++ 2015-2022 Redistributable (' + $arch + ')'); Detail = 'Not found'; Present = $false }
        }
    }

    $webview = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
    if ($webview) {
        $rows += [pscustomobject]@{ Component = 'Microsoft Edge WebView2 Runtime'; Detail = ('Version ' + $webview.pv); Present = $true }
    } else {
        $rows += [pscustomobject]@{ Component = 'Microsoft Edge WebView2 Runtime'; Detail = 'Not found'; Present = $false }
    }

    foreach ($r in $rows) {
        $mark = if ($r.Present) { 'OK  ' } else { 'MISS' }
        Write-Host ('  [{0}] {1,-50} {2}' -f $mark, $r.Component, $r.Detail) -ForegroundColor $(if ($r.Present) { 'Green' } else { 'Yellow' })
    }
    $missing = @($rows | Where-Object { -not $_.Present })
    if ($missing.Count) {
        Write-Host ('{0} runtime component(s) missing. Some programs may require them.' -f $missing.Count) -ForegroundColor Yellow
    } else {
        Write-Host '[OK] All checked runtime components are present.' -ForegroundColor Green
    }

    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'runtime-components.json') -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'runtime-components.csv') -NoTypeInformation -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Checked {0} runtime components" -f $rows.Count)
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
