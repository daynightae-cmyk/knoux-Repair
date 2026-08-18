#Requires -Version 5.1
#  knoux Repair v2.0 | 08-Performance | PF08 - Thermal Information
#  Risk: READ_ONLY
#  Reads thermal zone temperature via ACPI WMI when the hardware
#  exposes it. On most desktops this class is absent; the tool
#  then reports 'not available' instead of failing.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF08' -ToolName 'Thermal Information' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $zones = @(Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue)
    if ($zones.Count -eq 0) {
        Write-Host 'Thermal zones: not available on this system (no ACPI thermal sensor exposed).' -ForegroundColor DarkGray
        $rows = [pscustomobject]@{ Available = $false; Zones = @() }
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'thermal.json') -Encoding UTF8
        $Session.ItemsFound = 0
        $Session.ItemsProcessed = 0
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'Thermal information: not available on this system'
    } else {
        Write-Host 'Thermal zones:' -ForegroundColor Cyan
        $zoneRows = @()
        foreach ($z in $zones) {
            $tempC = [math]::Round(($z.CurrentTemperature / 10.0) - 273.15, 1)
            $zoneRows += [pscustomobject]@{ Instance = $z.InstanceName; CurrentC = $tempC }
            Write-Host ('  {0}: {1:N1} C' -f $z.InstanceName, $tempC) -ForegroundColor $(if ($tempC -lt 75) { 'Green' } elseif ($tempC -lt 90) { 'Yellow' } else { 'Red' })
        }
        $rows = [pscustomobject]@{ Available = $true; Zones = $zoneRows }
        $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'thermal.json') -Encoding UTF8
        $Session.ItemsFound = $zoneRows.Count
        $Session.ItemsProcessed = $zoneRows.Count
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session ("Thermal zones read: {0}" -f $zoneRows.Count)
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
