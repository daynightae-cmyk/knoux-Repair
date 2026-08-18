#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS03 - Find Space Hogs
#  Risk: READ_ONLY
#  Ranks folders under user folders by total size using a streaming
#  top-N folder enumerator (iterative post-order, skips reparse
#  points and offline files, never materializes the whole tree).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS03' -ToolName 'Find Space Hogs' -Category '06-Disk-Space' -RiskLevel 'READ_ONLY'
$rc = 0

function Get-DS03Children {
    param([Parameter(Mandatory)][string]$Path)
    try {
        $items = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop)
    } catch {
        Write-Warning "Cannot enumerate '$Path': $($_.Exception.Message)"
        return @()
    }
    $out = [System.Collections.Generic.List[object]]::new()
    foreach ($it in $items) {
        if ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { continue }
        if (-not $it.PSIsContainer -and ($it.Attributes -band [System.IO.FileAttributes]::Offline)) { continue }
        $out.Add($it)
    }
    return @($out)
}

function Get-DS03SpaceHogsFallback {
    param(
        [Parameter(Mandatory)][string[]]$Roots,
        [int]$TopN = 20
    )
    $top = New-Object System.Collections.Generic.List[object]
    $foldersScanned = [int64]0
    $skipped = [int64]0
    $comparer = { param($a, $b) $b.Total.CompareTo($a.Total) }
    foreach ($r in $Roots) {
        if (-not $r -or -not (Test-Path -LiteralPath $r)) { continue }
        $rootFrame = [pscustomobject]@{ Path = $r; Children = @(); ChildIndex = 0; Total = [int64]0; Parent = $null; Included = $false }
        $stack = New-Object System.Collections.Generic.Stack[object]
        $stack.Push($rootFrame)
        while ($stack.Count -gt 0) {
            $fr = $stack.Peek()
            if (-not $fr.Included) {
                $fr.Included = $true
                $fr.Children = @()
                foreach ($it in @(Get-DS03Children -Path $fr.Path)) {
                    if ($it.PSIsContainer) {
                        $fr.Children += $it
                    } else {
                        $fr.Total += [int64]$it.Length
                    }
                }
            }
            if ($fr.ChildIndex -lt $fr.Children.Count) {
                $child = $fr.Children[$fr.ChildIndex]
                $fr.ChildIndex++
                $cf = [pscustomobject]@{ Path = $child.FullName; Children = @(); ChildIndex = 0; Total = [int64]0; Parent = $fr; Included = $false }
                $stack.Push($cf)
            } else {
                [void]$stack.Pop()
                $foldersScanned++
                if ($top.Count -lt $TopN) {
                    $top.Add($fr)
                    if ($top.Count -gt 1) { $top.Sort($comparer) }
                } elseif ($fr.Total -gt $top[$top.Count - 1].Total) {
                    $top[$top.Count - 1] = $fr
                    $top.Sort($comparer)
                }
                if ($fr.Parent) { $fr.Parent.Total += $fr.Total }
            }
        }
    }
    return [pscustomobject]@{
        Items = @($top | Select-Object @{n = 'FullName'; e = { $_.Path } }, @{n = 'TotalBytes'; e = { [int64]$_.Total } })
        FoldersScanned = $foldersScanned
        Skipped = $skipped
    }
}

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

    Write-Host 'Scanning user folders for space hogs (streaming)...' -ForegroundColor Cyan
    $res = $null
    try {
        $res = Get-KnouxLargestFolders -Roots $roots -TopN 20
    } catch {
        Write-Warning "Core enumerator Get-KnouxLargestFolders failed: $($_.Exception.Message)"
        Write-KnouxLog -Session $Session ("Get-KnouxLargestFolders failed, using in-tool fallback: {0}" -f $_.Exception.Message) 'WARN'
    }
    if (-not $res) {
        $res = Get-DS03SpaceHogsFallback -Roots $roots -TopN 20
    }
    $top = @($res.Items)

    $recoverable = [int64]0
    foreach ($f in $top) { $recoverable += [int64]$f.TotalBytes }

    if ($top.Count -eq 0) {
        Write-Host '[OK] No folders found to rank in the scanned roots.' -ForegroundColor Green
    } else {
        Write-Host ('Top space-consuming folders (top {0}):' -f $top.Count) -ForegroundColor Cyan
        for ($i = 0; $i -lt $top.Count; $i++) {
            $f = $top[$i]
            Write-Host ('  {0,2}. {1,10}  {2}' -f ($i + 1), (Format-KnouxSize $f.TotalBytes), $f.FullName) -ForegroundColor Yellow
        }
    }

    $rows = for ($i = 0; $i -lt $top.Count; $i++) {
        [pscustomobject]@{
            Rank = $i + 1
            Folder = $top[$i].FullName
            TotalBytes = [int64]$top[$i].TotalBytes
            SizeHuman = Format-KnouxSize $top[$i].TotalBytes
        }
    }
    $rows = @($rows)
    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'space-hogs.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'space-hogs.json') -Encoding UTF8

    $Session.ItemsFound = $res.FoldersScanned
    $Session.ItemsProcessed = 1
    $Session.SkippedCount = $res.Skipped
    $Session.BytesPotentiallyRecoverable = $recoverable
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session ("Ranked {0} folders, top {1} space hogs total {2}" -f $res.FoldersScanned, $top.Count, (Format-KnouxSize $recoverable))
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
