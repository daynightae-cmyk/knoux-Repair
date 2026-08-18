#Requires -Version 5.1
#  knoux Repair v2.0 | 07-Services-Processes | SP01 - List Services
#  Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP01' -ToolName 'List Services' -Category '07-Services-Processes' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $svcs = @(Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue | Sort-Object Name)
    $running = @($svcs | Where-Object { $_.State -eq 'Running' }).Count
    Write-Host ('{0} services total, {1} running:' -f $svcs.Count, $running) -ForegroundColor Cyan
    foreach ($s in $svcs) {
        $state = $s.State
        $color = if ($state -eq 'Running') { 'Green' } else { 'Gray' }
        Write-Host ('  {0,-30} {1,-10} {2}' -f $s.Name, $state, $s.StartMode) -ForegroundColor $color
    }
    $rows = @($svcs | ForEach-Object { [pscustomobject]@{ Name = $_.Name; DisplayName = $_.DisplayName; State = $_.State; StartMode = $_.StartMode; PathName = $_.PathName } })
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'services.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'services.json') -Encoding UTF8
    $Session.ItemsFound = $svcs.Count
    $Session.ItemsProcessed = 1
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Listed {0} services ({1} running)" -f $svcs.Count, $running)
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
