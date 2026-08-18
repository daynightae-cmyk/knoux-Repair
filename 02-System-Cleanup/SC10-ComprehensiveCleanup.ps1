#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC10 - Comprehensive Cleanup
#  Risk: DESTRUCTIVE | Offline: Yes | Admin: Recommended
#  Runs the full cleanup sequence (temp, system temp, update
#  cache, thumbnail cache, WER) after a single typed confirmation.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC10' -ToolName 'Comprehensive Cleanup' -Category '02-System-Cleanup' -RiskLevel 'DESTRUCTIVE'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$targets = [ordered]@{
    'User temp'                 = $env:TEMP
    'System temp'               = "$env:SystemRoot\Temp"
    'Update download cache'     = "$env:SystemRoot\SoftwareDistribution\Download"
    'Thumbnail cache'           = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
    'Windows error reports'     = "$env:ProgramData\Microsoft\Windows\WER"
}

$total = [int64]0
$files = @()
foreach ($k in $targets.Keys) {
    $p = $targets[$k]
    if ($p -and (Test-Path -LiteralPath $p)) {
        $f = @(Get-ChildItem -LiteralPath $p -File -Recurse -Force -ErrorAction SilentlyContinue)
        $files += $f
        $sz = [int64]0
        if ($f.Count -gt 0) { $sz = [int64](($f | Measure-Object Length -Sum).Sum) }
        $total += $sz
        Write-Host ('  {0,-26} : {1,6} files, {2}' -f $k, $f.Count, (Format-KnouxSize $sz)) -ForegroundColor Cyan
    }
}
$Session.ItemsFound = $files.Count
Write-Host ('  Total: {0} files, {1}' -f $files.Count, (Format-KnouxSize $total)) -ForegroundColor Cyan

if ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Comprehensive cleanup analysis: {0} files, {1} bytes" -f $files.Count, $total)
} elseif ($files.Count -eq 0) {
    Write-Host '[OK] Nothing to clean.' -ForegroundColor Green
    $Session.Status = 'Success'
} else {
    Write-Host ''
    Write-Host '[WARN] This removes temporary files and caches that will regenerate.' -ForegroundColor Yellow
    if (Confirm-KnouxDestructiveAction -Phrase 'RUN CLEANUP') {
        $removed = 0
        $removedBytes = [int64]0
        foreach ($f in $files) {
            $q = Move-KnouxItemToQuarantine -Path $f.FullName -ToolId 'SC10'
            if ($q) {
                $removed++
                $removedBytes += [int64]$f.Length
            }
        }
        $Session.ItemsProcessed = $removed
        $Session.BytesRecovered = $removedBytes
        $Session.ChangedSystem = $true
        if ($removed -eq $files.Count) {
            $Session.Status = 'Success'
        } elseif ($removed -gt 0) {
            $Session.Status = 'Warning'
            $Session.ErrorMessage = "$($files.Count - $removed) file(s) could not be quarantined."
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'No file could be quarantined.'
        }
        Write-Host ('[OK] Quarantined {0}/{1} files ({2})' -f $removed, $files.Count, (Format-KnouxSize $removedBytes)) -ForegroundColor $(if ($removed -eq $files.Count) { 'Green' } elseif ($removed -gt 0) { 'Yellow' } else { 'Red' })
        Write-KnouxLog -Session $Session ("Comprehensive cleanup: quarantined {0}/{1}, {2} bytes" -f $removed, $files.Count, $removedBytes)
    } else {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    }
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
