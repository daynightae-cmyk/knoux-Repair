#Requires -Version 5.1
#  knoux Repair v2.0.2 | 05-Duplicate-Files | DF10 - Restore Quarantined Items
#  Risk: SAFE_CLEANUP
#  Lists quarantine entries for duplicate-file tools and allows
#  selective restoration with verification. Read-only until user
#  confirms a restore action.
[CmdletBinding()]
param(
    [switch]$AnalyzeOnly,
    [switch]$WhatIf,
    [string]$Selection = ""   # Comma-separated numbers or "all"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DF10' -ToolName 'Restore Quarantined Items' -Category '05-Duplicate-Files' -RiskLevel 'SAFE_CLEANUP'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $qRoot = Join-Path $Session.ProjectRoot 'Quarantine'
    if (-not (Test-Path -LiteralPath $qRoot)) {
        Write-Host '[OK] No quarantine directory found.' -ForegroundColor Green
        $Session.Status = 'Success'
        $Session.ItemsFound = 0
        $Session.ItemsProcessed = 0
        return (Stop-KnouxSession -Session $Session)
    }

    $toolDirs = @(Get-ChildItem -LiteralPath $qRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^DF' })
    if ($toolDirs.Count -eq 0) {
        Write-Host '[OK] No duplicate-file quarantine entries found.' -ForegroundColor Green
        $Session.Status = 'Success'
        return (Stop-KnouxSession -Session $Session)
    }

    $entries = @()
    foreach ($td in $toolDirs) {
        $ids = @(Get-ChildItem -LiteralPath $td.FullName -Directory -ErrorAction SilentlyContinue)
        foreach ($id in $ids) {
            $metaFile = Join-Path $id.FullName 'quarantine-meta.json'
            if (Test-Path -LiteralPath $metaFile) {
                $meta = Get-Content -LiteralPath $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
                $meta.QDir = $id.FullName
                $entries += $meta
            }
        }
    }

    if ($entries.Count -eq 0) {
        Write-Host '[OK] No restorable quarantine entries found.' -ForegroundColor Green
        $Session.Status = 'Success'
        return (Stop-KnouxSession -Session $Session)
    }

    Write-Host ('Found {0} restorable quarantine entr{1}:' -f $entries.Count, $(if ($entries.Count -eq 1) { 'y' } else { 'ies' })) -ForegroundColor Cyan
    $i = 0
    foreach ($e in $entries) {
        $i++
        $status = 'Unknown'
        if ($e.TransactionState -eq 'COMPLETE') { $status = 'Ready to restore' }
        elseif ($e.TransactionState -eq 'RECOVERY_REQUIRED') { $status = 'RECOVERY REQUIRED' }
        elseif ($e.TransactionState -eq 'RECOVERY_REQUIRED') { $status = 'Rollback incomplete' }
        else { $status = $e.TransactionState }
        Write-Host ('  {0,2}. [{1}] {2} ({3} bytes) - {4}' -f $i, $e.ToolId, $e.OriginalPath, $e.OriginalSize, $status) -ForegroundColor Gray
    }

    $Session.ItemsFound = $entries.Count

    if ($WhatIf) {
        Write-Host "WhatIf: Would restore quarantined items based on selection: $Selection" -ForegroundColor Cyan
        Write-KnouxLog -Session $Session "WhatIf: Would restore quarantined items"
        exit 0
    }
    
    if ($AnalyzeOnly) {
        Write-Host '[ANALYZE] Displaying quarantine entries only, no changes.' -ForegroundColor Green
        Write-KnouxLog -Session $Session ("Analyze: {0} quarantine entries listed" -f $entries.Count)
        exit 0
    }
    
    # Non-interactive execution: use Selection parameter
    if ([string]::IsNullOrWhiteSpace($Selection)) {
        Write-Error "Selection parameter is required for non-interactive execution. Provide comma-separated numbers or 'all'."
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Missing Selection parameter'
        exit 1
    }
    
    $input = $Selection
    $chosen = @($input -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
    if ($chosen -contains 0 -or $chosen.Count -eq 0) {
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
        $Session.Status = 'Cancelled'
        return (Stop-KnouxSession -Session $Session)
    }

    $restored = 0
    foreach ($idx in $chosen) {
        if ($idx -lt 1 -or $idx -gt $entries.Count) { continue }
        $e = $entries[$idx - 1]
        Write-Host ('Restoring [{0}] {1}...' -f $idx, $e.OriginalPath) -ForegroundColor Cyan
        $result = Restore-KnouxQuarantinedItem -QuarantinePath $e.QDir -Session $Session
        if ($result) {
            $restored++
            Write-Host ('  [OK] Restored {0}' -f $e.OriginalPath) -ForegroundColor Green
        } else {
            Write-Host ('  [FAILED] Could not restore {0}' -f $e.OriginalPath) -ForegroundColor Red
        }
    }
    if ($restored -gt 0) {
        $Session.Status = 'Success'
        $Session.ChangedSystem = $true
        $Session.ItemsProcessed = $restored
        Write-Host ('[OK] Restored {0} item(s).' -f $restored) -ForegroundColor Green
    } else {
        $Session.Status = 'Failed'
        Write-Host '[ERROR] No items restored.' -ForegroundColor Red
    }
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