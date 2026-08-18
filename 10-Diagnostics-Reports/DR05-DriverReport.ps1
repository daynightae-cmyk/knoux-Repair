#Requires -Version 5.1
#  knoux Repair v2.0 | 10-Diagnostics-Reports | DR05 - Driver Report
#  Risk: READ_ONLY
#  Lists installed signed drivers and flags drivers with problems.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR05' -ToolName 'Driver Report' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $drivers = @(Get-CimInstance -ClassName Win32_PnPSignedDriver -ErrorAction SilentlyContinue | Where-Object { $_.DeviceName } | Sort-Object DeviceName)
    $bad = @(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { $_.ConfigManagerErrorCode -and $_.ConfigManagerErrorCode -ne 0 })
    Write-Host ('Drivers: {0} installed, {1} with a problem' -f $drivers.Count, $bad.Count) -ForegroundColor Cyan

    if ($bad.Count -gt 0) {
        Write-Host 'Drivers with problems:' -ForegroundColor Yellow
        foreach ($d in $bad) {
            $name = if ($d.Name) { $d.Name } else { $d.DeviceID }
            Write-Host ('  {0,-40} error {1}' -f $name, $d.ConfigManagerErrorCode) -ForegroundColor Red
        }
    }

    $rows = @($drivers | Select-Object -First 300 | ForEach-Object {
        [pscustomobject]@{ Device = $_.DeviceName; Driver = $_.DriverProviderName; Version = $_.DriverVersion; Date = $_.DriverDate }
    })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'drivers.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'drivers.json') -Encoding UTF8
    $Session.ItemsFound = $drivers.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session "Drivers: $($drivers.Count) total, $($bad.Count) problem"
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
