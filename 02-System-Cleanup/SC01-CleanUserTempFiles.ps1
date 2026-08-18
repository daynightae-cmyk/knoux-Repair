#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC01 - Clean User Temp Files
#  Risk: SAFE_CLEANUP | Offline: Yes
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC01' -ToolName 'Clean User Temp Files' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$paths = @($env:TEMP, "$env:LOCALAPPDATA\Temp") | Select-Object -Unique
foreach ($p in $paths) {
    if (-not $p) { continue }
    Write-Host ('  Target: ' + $p) -ForegroundColor DarkGray
    $res = Invoke-KnouxCleanup -Path $p -Prompt ('Remove the temp files shown above from ' + (Split-Path $p -Leaf) + '?') -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
    $Session.ItemsFound += $res.Found
    $Session.ItemsProcessed += $res.Removed
    $Session.BytesRecovered += $res.RemovedBytes
    if ($res.Status -eq 'Failed') {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = $res.Message
    } elseif ($res.Status -eq 'Cancelled') {
        $Session.Status = 'Cancelled'
    } elseif ($res.Status -eq 'Partial') {
        $Session.Status = 'Warning'
        $Session.ErrorMessage = $res.Message
    } elseif ($Session.Status -ne 'Failed' -and $Session.Status -ne 'Cancelled' -and $Session.Status -ne 'Warning') {
        $Session.Status = 'Success'
    }
    Write-Host ('  => ' + $res.Message) -ForegroundColor $(if ($res.Status -eq 'Failed') {'Red'} elseif ($res.Status -eq 'Cancelled') {'Yellow'} else {'Green'})
    Write-KnouxLog -Session $Session -Message $res.Message
}

if ($Session.Status -ne 'Failed' -and $Session.Status -ne 'Cancelled') {
    Write-Host ''
    Write-Host ('  Total recovered: ' + (Format-KnouxSize $Session.BytesRecovered)) -ForegroundColor Cyan
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
