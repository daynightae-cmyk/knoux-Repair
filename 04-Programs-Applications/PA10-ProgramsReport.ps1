#Requires -Version 5.1
#  knoux Repair v2.0.2 | 04-Programs-Applications | PA10 - Programs Report
#  Risk: READ_ONLY | Offline: Yes
#  Aggregates program-health facts into one report: installed count,
#  startup count, broken shortcuts, missing runtimes, and recent installs.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA10' -ToolName 'Programs Report' -Category '04-Programs-Applications' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $report = [ordered]@{}
    $installed = @()
    foreach ($root in @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*')) {
        foreach ($p in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
            if ($p -isnot [System.Management.Automation.PSCustomObject]) { continue }
            $dn = $p.PSObject.Properties['DisplayName']
            if ($dn -and $dn.Value) { $installed += $p }
        }
    }
    $report.InstalledPrograms = $installed.Count

    $startup = @()
    foreach ($k in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run')) {
        if (Test-Path -LiteralPath $k) {
            foreach ($p in @(Get-ItemProperty -LiteralPath $k -ErrorAction SilentlyContinue)) {
                if ($p -isnot [System.Management.Automation.PSCustomObject]) { continue }
                foreach ($prop in $p.PSObject.Properties) {
                    if ($prop.Name -match '^(PSPath|PSParentPath|PSChildName|PSDrive|PSProvider)$') { continue }
                    $startup += $prop.Name
                }
            }
        }
    }
    $report.StartupEntries = $startup.Count

    $shell = New-Object -ComObject WScript.Shell
    $bad = 0
    try {
        foreach ($r in @(
            (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'),
            (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu'))) {
            foreach ($lnk in @(Get-ChildItem -LiteralPath $r -Filter *.lnk -Recurse -ErrorAction SilentlyContinue)) {
                try {
                    $t = $shell.CreateShortcut($lnk.FullName).TargetPath
                    if ($t -and $t -notmatch '::{645FF040-5081-101B-9F08-00AA002F954E}' -and -not (Test-Path -LiteralPath $t)) { $bad++ }
                } catch { Write-Warning ("Shortcut resolve failed: {0}" -f $_.Exception.Message) }
            }
        }
    } finally {
        if ($shell) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
    }
    $report.BrokenShortcuts = $bad

    $missing = @()
    if (-not (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full')) { $missing += '.NET Framework 4.x' }
    if (-not (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64')) { $missing += 'VC++ 2015-2022 x64' }
    if (-not (Test-Path -LiteralPath 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86')) { $missing += 'VC++ 2015-2022 x86' }
    $report.MissingRuntimes = $missing

    Write-Host 'Programs health report:' -ForegroundColor Cyan
    Write-Host ('  Installed programs : {0}' -f $report.InstalledPrograms)
    Write-Host ('  Startup entries    : {0}' -f $report.StartupEntries)
    Write-Host ('  Broken shortcuts   : {0}' -f $report.BrokenShortcuts)
    Write-Host ('  Missing runtimes   : {0}' -f ($missing -join ', '))

    $report | ConvertTo-Json -Depth 4 | Out-File -LiteralPath (Join-Path $Session.RawDir 'programs-report.json') -Encoding UTF8
    [pscustomobject]$report | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'programs-report.csv') -NoTypeInformation -Encoding UTF8
    $Session.Status = 'Success'
    $Session.ItemsFound = $report.InstalledPrograms
    $Session.ItemsProcessed = 1
    Write-KnouxLog -Session $Session 'Programs report generated'
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
