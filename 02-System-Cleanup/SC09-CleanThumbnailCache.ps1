#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC09 - Clean Thumbnail Cache
#  Risk: SAFE_CLEANUP | Offline: Yes
#  Removes the Explorer thumbnail cache (regenerated on demand).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC09' -ToolName 'Clean Thumbnail Cache' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$thumb = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
if (-not (Test-Path -LiteralPath $thumb)) {
    Write-Host '[INFO] Thumbnail cache folder not found.' -ForegroundColor Yellow
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session 'Thumbnail cache folder not found'
} else {
    Write-Host ('  Target: ' + $thumb) -ForegroundColor DarkGray
    Write-Host '  Note: thumbnails regenerate automatically when folders are browsed.' -ForegroundColor DarkGray
    $res = Invoke-KnouxCleanup -Path $thumb -Prompt 'Remove the thumbnail cache files shown above?' -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
    $Session.ItemsFound = $res.Found
    $Session.ItemsProcessed = $res.Removed
    $Session.BytesRecovered = $res.RemovedBytes
    if ($res.Status -eq 'Failed') { $Session.Status = 'Failed'; $Session.ErrorMessage = $res.Message }
    elseif ($res.Status -eq 'Cancelled') { $Session.Status = 'Cancelled' }
    elseif ($res.Status -eq 'Partial') { $Session.Status = 'Warning'; $Session.ErrorMessage = $res.Message }
    else { $Session.Status = 'Success' }
    Write-Host ('  => ' + $res.Message) -ForegroundColor $(if ($res.Status -eq 'Failed') {'Red'} elseif ($res.Status -eq 'Cancelled') {'Yellow'} else {'Green'})
    Write-KnouxLog -Session $Session -Message $res.Message
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
