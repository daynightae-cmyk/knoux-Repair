#Requires -Version 5.1
#  knoux Repair v2.0.2 | 02-System-Cleanup | SC08 - Clean Large Temp Files
#  Risk: SAFE_CLEANUP | Offline: Yes | Admin: Optional
#  Finds and removes temp files larger than 100 MB in the user
#  and system temp locations.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SC08' -ToolName 'Clean Large Temp Files' -Category '02-System-Cleanup' -RiskLevel 'SAFE_CLEANUP'
$Session.OfflineCapable = $true
$minBytes = 100MB

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$paths = @($env:TEMP, "$env:SystemRoot\Temp") | Select-Object -Unique
$allFiles = @()
foreach ($p in $paths) {
    if ($p -and (Test-Path -LiteralPath $p)) {
        $allFiles += Get-ChildItem -LiteralPath $p -File -Recurse -Force -ErrorAction SilentlyContinue | Where-Object { $_.Length -ge $minBytes }
    }
}
$allFiles = @($allFiles | Sort-Object Length -Descending)
$bytes = [int64]0
if ($allFiles.Count -gt 0) { $bytes = [int64](($allFiles | Measure-Object Length -Sum).Sum) }

Write-Host ('  Large temp files (>= ' + (Format-KnouxSize $minBytes) + '): ' + $allFiles.Count) -ForegroundColor Cyan
foreach ($f in $allFiles | Select-Object -First 20) {
    Write-Host ('    {0,10}  {1}' -f (Format-KnouxSize $f.Length), $f.FullName) -ForegroundColor DarkGray
}
if ($allFiles.Count -gt 20) { Write-Host ('    ... and ' + ($allFiles.Count - 20) + ' more') -ForegroundColor DarkGray }
$Session.ItemsFound = $allFiles.Count

if ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Large temp analysis: {0} files, {1} bytes" -f $allFiles.Count, $bytes)
} elseif ($allFiles.Count -eq 0) {
    Write-Host '[OK] No large temp files found.' -ForegroundColor Green
    $Session.Status = 'Success'
} else {
    Write-Host ''
    if (Confirm-KnouxAction ('Remove these ' + $allFiles.Count + ' large temp files?')) {
        $removed = 0
        $removedBytes = [int64]0
        foreach ($f in $allFiles) {
            $q = Move-KnouxItemToQuarantine -Path $f.FullName -ToolId 'SC08'
            if ($q) {
                $removed++
                $removedBytes += [int64]$f.Length
            }
        }
        $Session.ItemsProcessed = $removed
        $Session.BytesRecovered = $removedBytes
        if ($removed -eq $allFiles.Count) {
            $Session.Status = 'Success'
            $Session.ChangedSystem = $true
        } elseif ($removed -gt 0) {
            $Session.Status = 'Warning'
            $Session.ChangedSystem = $true
            $Session.ErrorMessage = "$($allFiles.Count - $removed) file(s) could not be quarantined."
        } else {
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'No file could be quarantined.'
        }
        Write-Host ('  Quarantined {0}/{1} files ({2})' -f $removed, $allFiles.Count, (Format-KnouxSize $removedBytes)) -ForegroundColor $(if ($removed -eq $allFiles.Count) { 'Green' } elseif ($removed -gt 0) { 'Yellow' } else { 'Red' })
        Write-KnouxLog -Session $Session ("Large temp cleanup: quarantined {0}/{1}, {2} bytes" -f $removed, $allFiles.Count, $removedBytes)
    } else {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    }
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
