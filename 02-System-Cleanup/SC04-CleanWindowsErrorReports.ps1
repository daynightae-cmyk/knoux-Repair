#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC04 - Clean Windows Error Reports
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Recommended
#  Cleans WER (Windows Error Reporting) files under ProgramData.
#  Never touches CBS.log or DISM.log.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC04' -ToolName 'Clean Windows Error Reports' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are recommended to clean all WER folders.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    $wer = "$env:ProgramData\Microsoft\Windows\WER"
    if (-not (Test-Path -LiteralPath $wer)) {
        Write-Host '[INFO] WER folder not found.' -ForegroundColor Yellow
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'WER folder not found'
    } else {
        Write-Host ('  Target: ' + $wer) -ForegroundColor DarkGray
        $res = Invoke-KnouxCleanup -Path $wer -Prompt 'Remove the Windows error report files shown above?' -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
        $Session.ItemsFound = $res.Found
        $Session.ItemsProcessed = $res.Removed
        $Session.BytesRecovered = $res.RemovedBytes
        if ($res.Status -eq 'Failed') { $Session.Status = 'Failed'; $Session.ErrorMessage = $res.Message }
        elseif ($res.Status -eq 'Cancelled') { $Session.Status = 'Cancelled' }
        elseif ($res.Status -eq 'Partial') { $Session.Status = 'Warning'; $Session.ErrorMessage = $res.Message }
        else { $Session.Status = 'Success' }
        Write-Host ('  => ' + $res.Message) -ForegroundColor $(if ($res.Status -eq 'Failed') {'Red'} elseif ($res.Status -eq 'Cancelled') {'Yellow'} else {'Green'})
        Write-KnouxLog -Session $Session -Message $res.Message
        Write-Host '  Note: system CBS/DISM logs are never touched by this tool.' -ForegroundColor DarkGray
    }
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
