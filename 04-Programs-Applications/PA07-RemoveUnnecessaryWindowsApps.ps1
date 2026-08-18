#Requires -Version 5.1
#  knoux Repair v2.0.2 | 04-Programs-Applications | PA07 - Remove Unnecessary Windows Apps
#  Risk: DESTRUCTIVE | Admin: Required (machine-wide) or user (per-user)
#  Lists provisioned Windows Store apps. Lets the user remove selected
#  apps for the current user (or machine-wide when run as admin).
[CmdletBinding()]
param(
    [switch]$AnalyzeOnly,
    [switch]$WhatIf,
    [string]$Selection = ""   # Comma-separated numbers or "all"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA07' -ToolName 'Remove Unnecessary Windows Apps' -Category '04-Programs-Applications' -RiskLevel 'DESTRUCTIVE'
$rc = 0
$isAdmin = Test-KnouxAdministrator

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $apps = @(Get-AppxPackage -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -notmatch 'Microsoft\.(Store|WindowsStore|WindowsCalculator|Windows.Photos|Paint|Notepad|WindowsTerminal|ScreenSketch|SnippingTool|People|Alarms|Clock|Calculator)' } | Sort-Object Name)

    if ($apps.Count -eq 0) {
        Write-Host '[OK] No removable apps detected for the current user.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No removable apps'
    } else {
        $i = 0
        Write-Host 'Apps that can be removed (not default essentials):' -ForegroundColor Cyan
        foreach ($a in $apps) {
            $i++
            Write-Host ('  {0,2}. {1,-45} {2}' -f $i, $a.Name, $a.PackageFullName)
        }
        
        if ($WhatIf) {
            Write-Host "WhatIf: Would remove Windows apps based on selection: $Selection" -ForegroundColor Cyan
            Write-KnouxLog -Session $Session "WhatIf: Would remove Windows apps"
            exit 0
        }
        
        if ($AnalyzeOnly) {
            Write-Host '[ANALYZE] Displaying removable apps only, no changes.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} removable apps, no changes" -f $apps.Count)
            exit 0
        }
        
        # Non-interactive execution: use Selection parameter
        if ([string]::IsNullOrWhiteSpace($Selection)) {
            Write-Error "Selection parameter is required for non-interactive execution. Provide comma-separated numbers or 'all'."
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'Missing Selection parameter'
            exit 1
        }
        
        $input = $Selection
        $chosen = @($input -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
        if (-not (Confirm-KnouxDestructiveAction -Phrase 'REMOVE APPS' -Prompt 'Remove the selected apps? (type REMOVE APPS to confirm): ')) {
            $Session.Status = 'Cancelled'
            Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
        } else {
            $removed = 0
            foreach ($idx in $chosen) {
                if ($idx -lt 1 -or $idx -gt $apps.Count) { continue }
                $a = $apps[$idx - 1]
                Write-Host ('  [REMOVE] ' + $a.Name + ' ...') -ForegroundColor Green
                if ($isAdmin) {
                    Get-AppxPackage -Name $a.Name -AllUsers -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
                } else {
                    Remove-AppxPackage -Package $a.PackageFullName -ErrorAction SilentlyContinue
                }
                $stillThere = @(Get-AppxPackage -Name $a.Name -ErrorAction SilentlyContinue).Count -gt 0
                if (-not $stillThere) {
                    $removed++
                    Write-KnouxLog -Session $Session ("Removed appx package {0}" -f $a.Name)
                } else {
                    Write-KnouxLog -Session $Session ("Appx package {0} still present after removal" -f $a.Name) 'WARN'
                }
            }
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $removed
            if ($removed -eq $chosen.Count) {
                $Session.Status = 'Success'
            } elseif ($removed -gt 0) {
                $Session.Status = 'Warning'
                $Session.ErrorMessage = "$($chosen.Count - $removed) app(s) could not be removed."
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'No app could be removed.'
            }
            Write-Host ('[OK] Removed {0} app(s).' -f $removed) -ForegroundColor $(if ($removed -eq $chosen.Count) { 'Green' } elseif ($removed -gt 0) { 'Yellow' } else { 'Red' })
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
