#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC02 - Empty Recycle Bin
#  Risk: DESTRUCTIVE | Offline: Yes
#  Permanently empties the Recycle Bin for all drives after a
#  typed confirmation. Nothing here can be restored afterwards.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC02' -ToolName 'Empty Recycle Bin' -Category '02-System-Cleanup' -RiskLevel 'DESTRUCTIVE'
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $shell = New-Object -ComObject Shell.Application
    $rb = $shell.Namespace(10)
    $items = @($rb.Items())
    $count = $items.Count
    $bytes = [int64]0
    foreach ($i in $items) {
        $sz = $i.ExtendedProperty('Size')
        if ($sz) { $bytes += [int64]$sz }
    }
    Write-Host ('  Items in Recycle Bin : {0}' -f $count) -ForegroundColor Cyan
    Write-Host ('  Estimated size       : {0}' -f (Format-KnouxSize $bytes)) -ForegroundColor Cyan
    $Session.ItemsFound = $count

    if ($AnalyzeOnly -or $WhatIf) {
        Write-Host '[ANALYZE] Would permanently empty the Recycle Bin for all drives.' -ForegroundColor Green
        Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
        Write-KnouxLog -Session $Session 'Analyze mode: would empty recycle bin'
        $Session.Status = 'Success'
    } elseif ($count -eq 0) {
        Write-Host '[OK] Recycle Bin is already empty.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'Recycle bin already empty'
    } else {
        Write-Host ''
        Write-Host '[WARN] This permanently deletes the files listed above.' -ForegroundColor Yellow
        if (Confirm-KnouxDestructiveAction -Phrase 'EMPTY BIN') {
            $null = Clear-RecycleBin -Force -ErrorAction Stop
            $remaining = @($rb.Items()).Count
            if ($remaining -eq 0) {
                $Session.ItemsProcessed = $count
                $Session.BytesRecovered = $bytes
                $Session.ChangedSystem = $true
                $Session.Status = 'Success'
                Write-Host ('[OK] Recycle Bin emptied and verified empty. Recovered: ' + (Format-KnouxSize $bytes)) -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Recycle bin emptied and verified: {0} items, {1} bytes" -f $count, $bytes)
            } else {
                $Session.Status = 'Warning'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = $count - $remaining
                $Session.BytesRecovered = $bytes
                $Session.ErrorMessage = "$remaining item(s) remain in the Recycle Bin."
                Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                Write-KnouxLog -Session $Session $Session.ErrorMessage 'WARN'
            }
        } else {
            $Session.Status = 'Cancelled'
            Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
        }
    }
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
