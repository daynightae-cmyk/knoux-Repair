#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC05 - Analyze Cleanup Potential
#  Risk: READ_ONLY | Offline: Yes
#  Measures how much space is reclaimable in common locations
#  WITHOUT deleting anything.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC05' -ToolName 'Analyze Cleanup Potential' -Category '02-System-Cleanup' -RiskLevel 'READ_ONLY'
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$locations = [ordered]@{
    'User temp'                  = $env:TEMP
    'Internet cache'             = "$env:LOCALAPPDATA\Microsoft\Windows\INetCache"
    'Browser caches'             = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"
    'Explorer thumbnails'        = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
    'Windows temp'               = "$env:SystemRoot\Temp"
    'SoftwareDistribution DL'    = "$env:SystemRoot\SoftwareDistribution\Download"
    'Windows Error Reporting'    = "$env:ProgramData\Microsoft\Windows\WER"
}

Write-Host 'Reclaimable space analysis (read-only):' -ForegroundColor Cyan
$total = [int64]0
$rows = @()
foreach ($k in $locations.Keys) {
    $p = $locations[$k]
    $size = [int64]0
    if ($p) { $size = Get-KnouxFolderSize -Path $p }
    $total += $size
    $rows += [pscustomobject]@{ Location = $k; Path = $p; Bytes = $size }
    Write-Host ('  {0,-28} : {1,10}' -f $k, (Format-KnouxSize $size)) -ForegroundColor Green
}
Write-Host ''
Write-Host ('  Estimated reclaimable total : ' + (Format-KnouxSize $total)) -ForegroundColor Cyan

$rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'cleanup-analysis.json') -Encoding UTF8
$rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'cleanup-analysis.csv') -NoTypeInformation -Encoding UTF8
$Session.ItemsFound = $rows.Count
$Session.BytesRecovered = $total
$Session.Status = 'Success'
Write-KnouxLog -Session $Session ("Cleanup analysis: {0} locations, {1} bytes" -f $rows.Count, $total)

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
