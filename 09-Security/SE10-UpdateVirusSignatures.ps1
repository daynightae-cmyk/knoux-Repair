#Requires -Version 5.1
#  knoux Repair v2.0.2 | 09-Security | SE10 - Update Virus Signatures
#  Risk: SYSTEM_REPAIR | Requires admin
#  Forces Windows Defender to download the latest virus definitions.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SE10' -ToolName 'Update Virus Signatures' -Category '09-Security' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    try {
        $before = (Get-MpComputerStatus -ErrorAction SilentlyContinue).AntivirusSignatureVersion
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host ('[ANALYZE] Current signature version: {0}' -f $before) -ForegroundColor Green
            Write-Host '[ANALYZE] Would trigger an update from Windows Update.' -ForegroundColor Green
            $Session.Status = 'Success'
            Write-KnouxLog -Session $Session ("Analyze: signature {0} would update" -f $before)
        } else {
            if (Confirm-KnouxAction 'Update virus definitions now?') {
                $null = Update-MpSignature -ErrorAction Stop
                $after = (Get-MpComputerStatus -ErrorAction SilentlyContinue).AntivirusSignatureVersion
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = 1
                Write-Host ('[OK] Signatures updated: {0} -> {1}' -f $before, $after) -ForegroundColor Green
                Write-KnouxLog -Session $Session "Signatures updated: $before -> $after"
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No update performed.' -ForegroundColor Yellow
            }
        }
    } catch {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = $_.Exception.Message
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
