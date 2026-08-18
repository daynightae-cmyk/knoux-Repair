#Requires -Version 5.1
#  knoux Repair v2.0.2 | 04-Programs-Applications | PA09 - Check Program Updates
#  Risk: READ_ONLY | Offline: False | Needs network
#  Uses winget to list installed programs that have newer versions
#  available. Read-only: reports only, never updates.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA09' -ToolName 'Check Program Updates' -Category '04-Programs-Applications' -RiskLevel 'READ_ONLY'
$rc = 0
$winget = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    if (-not (Test-Path -LiteralPath $winget)) {
        Write-Host '[ERROR] winget is not installed. Install the App Installer from the Microsoft Store.' -ForegroundColor Yellow
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'winget not found'
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    } else {
        Write-Host '[INFO] Checking for newer versions (requires network). This can take a while...' -ForegroundColor Cyan
        $out = Join-Path $Session.RawDir 'winget-upgrade.json'
        $args = @('upgrade', '--include-unknown', '--format', 'json', '--accept-source-agreements', '--disable-interactivity')
        $r = Invoke-KnouxNativeCommand -FilePath $winget -ArgumentList $args -TimeoutSeconds 300
        if (-not $r) {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'winget failed to run'
            Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        } else {
            if ($r.Success) {
                try {
                    $data = $r.Stdout | ConvertFrom-Json
                    $updates = @($data | ForEach-Object { $_.Matches } | Where-Object { $_ } )
                    if ($updates.Count -eq 0) {
                        Write-Host '[OK] No updates available (or winget returned no data).' -ForegroundColor Green
                    } else {
                        Write-Host ('{0} update(s) available:' -f $updates.Count) -ForegroundColor Cyan
                        foreach ($u in $updates | Select-Object -First 40) {
                            Write-Host ('  {0,-40} {1} -> {2}' -f $u.Name, $u.InstalledVersion, $u.AvailableVersion)
                        }
                        $updates | ConvertTo-Json -Depth 4 | Out-File -LiteralPath $out -Encoding UTF8
                    }
                    $Session.ItemsFound = $updates.Count
                } catch {
                    Write-Host '[INFO] winget returned no parseable update list.' -ForegroundColor Yellow
                    Write-Host ($r.Stdout.Substring(0, [Math]::Min(2000, $r.Stdout.Length)))
                    $Session.ItemsFound = 0
                }
            } else {
                Write-Host ('[WARN] winget exit code ' + $r.ExitCode + ' (often means no updates or offline).') -ForegroundColor Yellow
                $Session.ItemsFound = 0
            }
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session ("winget update check exit {0}" -f $r.ExitCode)
        }
    }
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
