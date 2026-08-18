#Requires -Version 5.1
#  knoux Repair v2.0.2 | 10-Diagnostics-Reports | DR01 - System Information
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DR01' -ToolName 'System Information' -Category '10-Diagnostics-Reports' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop
    $cpu = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction SilentlyContinue

    Write-Host 'System Information:' -ForegroundColor Cyan
    Write-Host ('  OS:                {0} ({1})' -f $os.Caption, $os.OSArchitecture) -ForegroundColor Gray
    Write-Host ('  Version / Build:   {0}  Build {1}' -f $os.Version, $os.BuildNumber) -ForegroundColor Gray
    Write-Host ('  Computer:          {0} ({1})' -f $cs.Manufacturer, $cs.Model) -ForegroundColor Gray
    Write-Host ('  CPU:               {0}' -f $cpu.Name) -ForegroundColor Gray
    Write-Host ('  CPU cores:         {0} / {1} logical' -f $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors) -ForegroundColor Gray
    Write-Host ('  Memory:            {0:N1} GB' -f ($cs.TotalPhysicalMemory / 1GB)) -ForegroundColor Gray
    Write-Host ('  BIOS:              {0}  {1}' -f $bios.Manufacturer, $bios.SMBIOSBIOSVersion) -ForegroundColor Gray
    Write-Host ('  Last boot:         {0}' -f $os.LastBootUpTime) -ForegroundColor Gray
    Write-Host ('  Up time:           {0:N1} days' -f ((Get-Date) - $os.LastBootUpTime).TotalDays) -ForegroundColor Gray

    $rows = [pscustomobject]@{
        OS = $os.Caption; Version = $os.Version; Build = $os.BuildNumber; Architecture = $os.OSArchitecture
        Manufacturer = $cs.Manufacturer; Model = $cs.Model; CPU = $cpu.Name; Cores = $cpu.NumberOfCores
        Logical = $cpu.NumberOfLogicalProcessors; RAMGB = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
        BIOS = $bios.SMBIOSBIOSVersion; LastBoot = $os.LastBootUpTime
    }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'system-info.json') -Encoding UTF8
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'system-info.csv') -NoTypeInformation -Encoding UTF8
    $Session.ItemsFound = 1
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session 'System information collected'
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
