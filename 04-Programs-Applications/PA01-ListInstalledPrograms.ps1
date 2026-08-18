#Requires -Version 5.1
#  knoux Repair v2.0.2 | 04-Programs-Applications | PA01 - List Installed Programs
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA01' -ToolName 'List Installed Programs' -Category '04-Programs-Applications' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $rows = @()
    $roots = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    foreach ($root in $roots) {
        foreach ($p in @(Get-ItemProperty -Path $root -ErrorAction SilentlyContinue)) {
            if ($p -isnot [System.Management.Automation.PSCustomObject]) { continue }
            $nameProp = $p.PSObject.Properties['DisplayName']
            if (-not $nameProp -or -not $nameProp.Value) { continue }
            $ver = $p.PSObject.Properties['DisplayVersion']
            $pub = $p.PSObject.Properties['Publisher']
            $date = $p.PSObject.Properties['InstallDate']
            $size = $p.PSObject.Properties['EstimatedSize']
            $un = $p.PSObject.Properties['UninstallString']
            $rows += [pscustomobject]@{
                Name = [string]$nameProp.Value
                Version = if ($ver) { [string]$ver.Value } else { '' }
                Publisher = if ($pub) { [string]$pub.Value } else { '' }
                InstallDate = if ($date) { [string]$date.Value } else { '' }
                EstimatedSizeMB = if ($size -and $size.Value) { [math]::Round([double]$size.Value / 1024, 1) } else { 0 }
                UninstallString = if ($un) { [string]$un.Value } else { '' }
            }
        }
    }
    $rows = @($rows | Sort-Object Name)

    Write-Host ('Found {0} installed programs.' -f $rows.Count) -ForegroundColor Cyan
    foreach ($r in $rows | Select-Object -First 40) {
        Write-Host ('  {0,-45} {1,-15} {2}' -f $r.Name, $r.Version, $r.Publisher)
    }
    if ($rows.Count -gt 40) {
        Write-Host ('  ... and {0} more (see report).' -f ($rows.Count - 40)) -ForegroundColor Yellow
    }

    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'installed-programs.json') -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'installed-programs.csv') -NoTypeInformation -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Enumerated {0} installed programs" -f $rows.Count)
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
