#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS02 - Find Large Files
#  Risk: READ_ONLY
#  Finds the largest files under user folders using a streaming
#  top-N enumerator (iterative, skips reparse points and offline
#  files, never materializes the whole tree).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS02' -ToolName 'Find Large Files' -Category '06-Disk-Space' -RiskLevel 'READ_ONLY'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $candidates = @(
        (Join-Path $env:USERPROFILE 'Downloads'),
        (Join-Path $env:USERPROFILE 'Documents'),
        (Join-Path $env:USERPROFILE 'Desktop'),
        (Join-Path $env:USERPROFILE 'Pictures'),
        (Join-Path $env:USERPROFILE 'Videos'),
        (Join-Path $env:USERPROFILE 'Music')
    )
    $roots = @($candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) })
    if ($roots.Count -eq 0) {
        Write-Host '[WARN] None of the default user folders exist; the scan will be empty.' -ForegroundColor Yellow
    }

    $exclude = @('\.git\', '\node_modules\')
    $systemRoot = $null
    if (-not ($AnalyzeOnly -or $WhatIf) -and (Test-KnouxAdministrator) -and (Test-Path -LiteralPath "$env:SystemDrive\")) {
        if (Confirm-KnouxAction 'Include the system drive in the scan? This can take a while.') {
            $systemRoot = "$env:SystemDrive\"
            Write-Host '  System drive included (min file size 100 MB for this pass).' -ForegroundColor DarkGray
        }
    } elseif ($AnalyzeOnly -or $WhatIf) {
        Write-Host '[ANALYZE] System drive scan is skipped in analyze mode.' -ForegroundColor DarkGray
    }

    $filesScanned = [int64]0
    $skipped = [int64]0
    $topItems = New-Object System.Collections.Generic.List[object]

    Write-Host 'Scanning user folders for large files (streaming, min 1 MB)...' -ForegroundColor Cyan
    $res = Get-KnouxLargestFiles -Roots $roots -TopN 20 -MinBytes 1MB -ExcludeSubstrings $exclude
    $filesScanned += $res.FilesScanned
    $skipped += $res.Skipped
    foreach ($it in @($res.Items)) { $topItems.Add($it) }

    if ($systemRoot) {
        Write-Host 'Scanning the system drive for large files (streaming, min 100 MB)...' -ForegroundColor Cyan
        $resSys = Get-KnouxLargestFiles -Roots @($systemRoot) -TopN 20 -MinBytes 100MB -ExcludeSubstrings $exclude
        $filesScanned += $resSys.FilesScanned
        $skipped += $resSys.Skipped
        foreach ($it in @($resSys.Items)) { $topItems.Add($it) }
    }

    $top = @($topItems | Sort-Object @{ e = { [int64]$_.Length } } -Descending | Select-Object -First 20)
    $recoverable = [int64]0
    foreach ($f in $top) { $recoverable += [int64]$f.Length }

    if ($top.Count -eq 0) {
        Write-Host '[OK] No files larger than 1 MB found in the scanned roots.' -ForegroundColor Green
    } else {
        Write-Host ('Largest files (top {0}):' -f $top.Count) -ForegroundColor Cyan
        for ($i = 0; $i -lt $top.Count; $i++) {
            $f = $top[$i]
            Write-Host ('  {0,2}. {1,10}  {2}' -f ($i + 1), (Format-KnouxSize $f.Length), $f.FullName) -ForegroundColor Yellow
            Write-Host ('      last modified {0:yyyy-MM-dd HH:mm:ss}' -f $f.LastWriteTime) -ForegroundColor DarkGray
        }
    }

    $rows = for ($i = 0; $i -lt $top.Count; $i++) {
        [pscustomobject]@{
            Rank = $i + 1
            Path = $top[$i].FullName
            SizeBytes = [int64]$top[$i].Length
            SizeHuman = Format-KnouxSize $top[$i].Length
            LastWriteTime = $top[$i].LastWriteTime
        }
    }
    $rows = @($rows)
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'large-files.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'large-files.json') -Encoding UTF8

    $Session.ItemsFound = $filesScanned
    $Session.ItemsProcessed = 1
    $Session.SkippedCount = $skipped
    $Session.BytesPotentiallyRecoverable = $recoverable
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Scanned {0} files, top {1} large files total {2}" -f $filesScanned, $top.Count, (Format-KnouxSize $recoverable))
} catch {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = $_.Exception.Message
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
