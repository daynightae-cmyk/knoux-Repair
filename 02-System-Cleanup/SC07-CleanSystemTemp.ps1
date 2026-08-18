#Requires -Version 5.1
#  knoux Repair v2.0 | 02-System-Cleanup | SC07 - Clean System Temp
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Required
#  Cleans C:\Windows\Temp. Files in use are skipped silently.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC07' -ToolName 'Clean System Temp' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required to clean the system temp folder.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    $p = "$env:SystemRoot\Temp"
    if (-not (Test-Path -LiteralPath $p)) {
        Write-Host '[INFO] System temp folder not found.' -ForegroundColor Yellow
        $Session.Status = 'Success'
    } else {
        Write-Host ('  Target: ' + $p) -ForegroundColor DarkGray
        $res = Invoke-KnouxCleanup -Path $p -Prompt 'Remove the system temp files shown above?' -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
        $Session.ItemsFound = $res.Found
        $Session.ItemsProcessed = $res.Removed
        $Session.BytesRecovered = $res.RemovedBytes
        if ($res.Status -eq 'Failed') { $Session.Status = 'Failed'; $Session.ErrorMessage = $res.Message }
        elseif ($res.Status -eq 'Cancelled') { $Session.Status = 'Cancelled' }
        elseif ($res.Status -eq 'Partial') { $Session.Status = 'Warning'; $Session.ErrorMessage = $res.Message }
        else { $Session.Status = 'Success' }
        Write-Host ('  => ' + $res.Message) -ForegroundColor $(if ($res.Status -eq 'Failed') {'Red'} elseif ($res.Status -eq 'Cancelled') {'Yellow'} else {'Green'})
        Write-KnouxLog -Session $Session -Message $res.Message
        Write-Host '  Note: files currently in use are skipped.' -ForegroundColor DarkGray
    }
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
