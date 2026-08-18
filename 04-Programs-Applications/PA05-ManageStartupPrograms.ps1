#Requires -Version 5.1
#  knoux Repair v2.0.2 | 04-Programs-Applications | PA05 - Manage Startup Programs
#  Risk: SYSTEM_REPAIR
#  Lists startup entries (Run/RunOnce for HKLM + HKCU). Enables the
#  user to disable selected startup programs by moving the registry
#  value to a parallel backup key (registry backup, not deletion).
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PA05' -ToolName 'Manage Startup Programs' -Category '04-Programs-Applications' -RiskLevel 'SYSTEM_REPAIR'
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$runKeys = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run'
)

try {
    $rows = @()
    foreach ($k in $runKeys) {
        if (-not (Test-Path -LiteralPath $k)) { continue }
        foreach ($p in @(Get-ItemProperty -LiteralPath $k -ErrorAction SilentlyContinue)) {
            if ($p -isnot [System.Management.Automation.PSCustomObject]) { continue }
            foreach ($prop in $p.PSObject.Properties) {
                if ($prop.Name -match '^(PSPath|PSParentPath|PSChildName|PSDrive|PSProvider)$') { continue }
                $rows += [pscustomobject]@{ Name = $prop.Name; Command = [string]$prop.Value; Key = $k }
            }
        }
    }

    if ($rows.Count -eq 0) {
        Write-Host '[OK] No startup entries found in the Run keys.' -ForegroundColor Green
        $Session.Status = 'Success'
        Write-KnouxLog -Session $Session 'No startup Run entries'
    } else {
        $i = 0
        Write-Host 'Startup programs:' -ForegroundColor Cyan
        foreach ($r in $rows) {
            $i++
            Write-Host ('  {0,2}. {1,-30} {2}' -f $i, $r.Name, $r.Command)
        }
        if ($AnalyzeOnly -or $WhatIf) {
            Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to disable entries.' -ForegroundColor Green
            Write-KnouxLog -Session $Session ("Analyze: {0} startup entries, no changes" -f $rows.Count)
        } else {
            Write-Host ''
            Write-Host 'Enter the numbers to disable (comma separated) or 0 to cancel:' -ForegroundColor Yellow
            $input = Read-Host 'Selection'
            $chosen = @($input -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
            $disabled = 0
            foreach ($idx in $chosen) {
                if ($idx -lt 1 -or $idx -gt $rows.Count) { continue }
                $r = $rows[$idx - 1]
                $backupKey = $r.Key -replace 'CurrentVersion\\Run$', 'CurrentVersion\RunKnouxBackup'
                New-Item -Path $backupKey -Force | Out-Null
                Set-ItemProperty -LiteralPath $backupKey -Name $r.Name -Value $r.Command
                Remove-ItemProperty -LiteralPath $r.Key -Name $r.Name -ErrorAction SilentlyContinue
                $disabled++
                Write-Host ('  [DISABLED] ' + $r.Name) -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Backed up Run value {0} to {1} and removed from Run" -f $r.Name, $backupKey)
            }
            if ($disabled -gt 0) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = $disabled
                Write-Host ('[OK] Disabled {0} startup entry(ies).' -f $disabled) -ForegroundColor Green
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
