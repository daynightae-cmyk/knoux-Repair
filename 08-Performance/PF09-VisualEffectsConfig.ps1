#Requires -Version 5.1
#  knoux Repair v2.0 | 08-Performance | PF09 - Visual Effects Configuration
#  Risk: SAFE_CLEANUP
#  Reads the current visual effects setting and can optionally
#  switch to 'adjust for best performance' after backing up the
#  current registry values. Changes are verified after writing.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PF09' -ToolName 'Visual Effects Configuration' -Category '08-Performance' -RiskLevel 'SAFE_CLEANUP'
$rc = 0
$vePath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects'
$spPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects\SystemPerformance'

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

try {
     $veItem = Get-ItemProperty -Path $vePath -Name VisualFXSetting -ErrorAction SilentlyContinue
     $visualFX = if ($veItem) { $veItem.VisualFXSetting } else { $null }
     $spItem = Get-ItemProperty -Path $spPath -Name SystemPerformance -ErrorAction SilentlyContinue
     $systemPerf = if ($spItem) { $spItem.SystemPerformance } else { $null }
    $current = if ($systemPerf -eq 2) { 'best-performance' } elseif ($systemPerf -eq 3) { 'custom' } else { 'let-windows-choose' }
    Write-Host ('Visual effects: {0}  (VisualFXSetting={1}, SystemPerformance={2})' -f $current, $visualFX, $systemPerf) -ForegroundColor Cyan

    if ($AnalyzeOnly -or $WhatIf) {
        Write-Host '[ANALYZE] Would set visual effects to best performance (SystemPerformance=2) after a registry backup.' -ForegroundColor Green
        Write-Host '[ANALYZE] No changes are made in analyze mode.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session ("Analyze: visual effects = {0}" -f $current)
    } else {
        if ($systemPerf -eq 2) {
            Write-Host '[OK] Visual effects are already set to best performance.' -ForegroundColor Green
            $Session.Status = 'Success'
        } else {
            Write-Host '[ACTION] Sets visual effects to "adjust for best performance".' -ForegroundColor Yellow
            if (Confirm-KnouxAction 'Set visual effects to best performance?') {
                $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
                $backupDir = Join-Path (Join-Path $Session.ProjectRoot 'Backups') ('PF09-' + $stamp)
                New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
                $regBackup = Join-Path $backupDir 'visual-effects.reg'
                $null = & reg.exe export 'HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects' $regBackup /y 2>$null
                if (Test-Path -LiteralPath $regBackup) {
                    $Session.BackupPath = $backupDir
                    Write-Host ('[OK] Registry backup: {0}' -f $regBackup) -ForegroundColor Green
                    Write-KnouxLog -Session $Session ("Visual effects backed up to $regBackup")
                } else {
                    Write-KnouxLog -Session $Session 'Visual effects registry export failed; continuing' 'WARN'
                }
                New-Item -ItemType Directory -Path $spPath -Force | Out-Null
                Set-ItemProperty -Path $spPath -Name SystemPerformance -Value 2 -Type DWord -ErrorAction Stop
                Set-ItemProperty -Path $vePath -Name VisualFXSetting -Value 2 -Type DWord -ErrorAction Stop
                $after = (Get-ItemProperty -Path $spPath -Name SystemPerformance -ErrorAction SilentlyContinue).SystemPerformance
                if ($after -eq 2) {
                    $Session.Status = 'Success'
                    $Session.ChangedSystem = $true
                    $Session.ItemsProcessed = 1
                    Write-Host '[OK] Visual effects set to best performance.' -ForegroundColor Green
                    Write-KnouxLog -Session $Session 'Visual effects set to best performance and verified'
                } else {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = 'Visual effects change could not be verified.'
                    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                }
            } else {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
            }
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
