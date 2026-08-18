#Requires -Version 5.1
#  knoux Repair v2.0.2 | 06-Disk-Space | DS05 - Clear File History Cache
#  Risk: SAFE_CLEANUP | Quarantine-backed
#  Clears the File History cache if it is disabled/unused. If File
#  History is active, reports instead of clearing.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DS05' -ToolName 'Clear File History Cache' -Category '06-Disk-Space' -RiskLevel 'SAFE_CLEANUP'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
    $fh = Get-Service -Name 'fhsvc' -ErrorAction SilentlyContinue
    $running = ($fh -and $fh.Status -eq 'Running')
    $cache = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\FileHistory'

    if ($running) {
        Write-Host '[INFO] File History service is running. Cache left intact to preserve backup history.' -ForegroundColor Yellow
        $Session.Status = 'Success'
        $Session.ItemsProcessed = 0
        Write-KnouxLog -Session $Session 'File History active; cache untouched'
    } elseif (-not (Test-Path -LiteralPath $cache)) {
        Write-Host '[OK] No File History cache found.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No File History cache'
    } else {
        $sz = Get-KnouxFolderSize -Path $cache
        Write-Host ('File History cache found (~{0:N1} MB).' -f ($sz / 1MB)) -ForegroundColor Cyan
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to clear the cache.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: File History cache {0:N1} MB, no changes" -f ($sz / 1MB))
        } elseif (Confirm-KnouxAction 'Clear the unused File History cache?') {
            $dest = Move-KnouxItemToQuarantine -Path $cache
            if ($dest) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = 1
                $Session.BytesRecovered = $sz
                Write-Host ('[OK] File History cache moved to quarantine.' -f $sz) -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Moved File History cache ({0:N1} MB) to quarantine" -f ($sz / 1MB))
            } else {
                $Session.Status = 'Failed'
                $Session.ErrorMessage = 'Could not move File History cache.'
                Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
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

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
