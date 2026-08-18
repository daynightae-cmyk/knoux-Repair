#Requires -Version 5.1
#  knoux Repair v2.0 | 08-Performance | PF02 - Startup Impact Analysis
#  Risk: READ_ONLY
#  Lists startup commands from all locations (Run keys, startup
#  folders, services) so the user can spot impact on boot time.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF02' -ToolName 'Startup Impact Analysis' -Category '08-Performance' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $startups = @(Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction SilentlyContinue)
    Write-Host ('Startup entries: {0}' -f $startups.Count) -ForegroundColor Cyan
    foreach ($s in $startups) {
        Write-Host ('  {0,-28} [{1}] {2}' -f $s.Name, $s.Location, $s.Command) -ForegroundColor DarkGray
    }

    $rows = $startups | ForEach-Object {
        [pscustomobject]@{ Name = $_.Name; Location = $_.Location; Command = $_.Command; User = $_.User }
    }
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'startup-impact.json') -Encoding UTF8
    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = $rows.Count
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Startup entries found: {0}" -f $rows.Count)
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
