#Requires -Version 5.1
#  knoux Repair v2.0 | 06-Disk-Space | DS04 - Clean Recycle Bin
#  Risk: DESTRUCTIVE | Confirmation required
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS04' -ToolName 'Clean Recycle Bin' -Category '06-Disk-Space' -RiskLevel 'DESTRUCTIVE'
$rc = 0
$shell = New-Object -ComObject Shell.Application

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $rb = $shell.NameSpace(0xA)
    $items = @($rb.Items())
    $bytes = 0
    foreach ($it in $items) { $bytes += $it.Size }

    if ($items.Count -eq 0) {
        Write-Host '[OK] Recycle Bin is already empty.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'Recycle Bin already empty'
    } else {
        Write-Host ('{0} item(s) in the Recycle Bin, ~{1:N1} MB.' -f $items.Count, ($bytes / 1MB)) -ForegroundColor Cyan
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to empty it.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} items in Recycle Bin, no changes" -f $items.Count)
        } elseif (Confirm-KnouxDestructiveAction -Phrase 'EMPTY BIN' -Prompt 'Empty the Recycle Bin permanently? (type EMPTY BIN to confirm): ') {
            Clear-RecycleBin -Force -ErrorAction SilentlyContinue
            $remaining = @($rb.Items()).Count
            if ($remaining -eq 0) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = $items.Count
                $Session.BytesRecovered = $bytes
                Write-Host ('[OK] Recycle Bin emptied and verified empty ({0:N1} MB recovered).' -f ($bytes / 1MB)) -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Emptied and verified Recycle Bin ({0} items, {1:N1} MB)" -f $items.Count, ($bytes / 1MB))
            } else {
                $Session.Status = 'Warning'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = $items.Count - $remaining
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
} finally {
    if ($shell) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($shell) }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
