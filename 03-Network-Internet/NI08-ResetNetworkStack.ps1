#Requires -Version 5.1
#  knoux Repair v2.0.2 | 03-Network-Internet | NI08 - Reset Network Stack
#  Risk: SYSTEM_REPAIR | Offline: Yes | Admin: Required
#  netsh winsock reset + netsh int ip reset. Restart required.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'NI08' -ToolName 'Reset Network Stack' -Category '03-Network-Internet' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$Session.OfflineCapable = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} elseif ($AnalyzeOnly -or $WhatIf) {
    Write-Host '[ANALYZE] Would run: netsh winsock reset + netsh int ip reset.' -ForegroundColor Green
    Write-Host '[ANALYZE] Restart required afterwards. No changes in analyze mode.' -ForegroundColor Green
    Write-KnouxLog -Session $Session 'Analyze mode: would reset the network stack'
} else {
    Write-Host '[ACTION] This resets the TCP/IP stack (Winsock + IP).' -ForegroundColor Yellow
    Write-Host '[WARN] A restart is required. Static IPs may need to be re-set.' -ForegroundColor Yellow
    if (Confirm-KnouxAction 'Reset the network stack now?') {
        $null = New-KnouxRestorePoint -Description 'Knoux Repair NI08 before network stack reset'
        $steps = @(
            @{ Name = 'Winsock reset'; Exe = "$env:SystemRoot\System32\netsh.exe"; Args = @('winsock', 'reset') },
            @{ Name = 'IP reset'; Exe = "$env:SystemRoot\System32\netsh.exe"; Args = @('int', 'ip', 'reset') }
        )
        foreach ($step in $steps) {
            Write-Host ('  [RUN] ' + $step.Name + ' ...') -ForegroundColor Green
            $r = Invoke-KnouxNativeCommand -FilePath $step.Exe -ArgumentList $step.Args -TimeoutSeconds 120
            if ($r) {
                Write-KnouxLog -Session $Session ("{0} exit {1}" -f $step.Name, $r.ExitCode)
                $rc = $r.ExitCode
                if (-not $r.Success) {
                    $Session.Status = 'Failed'
                    $Session.ErrorMessage = ($step.Name + ' failed with exit code ' + $r.ExitCode)
                    Write-Host ('    [ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
                    break
                }
            }
        }
        if ($Session.Status -ne 'Failed') {
            $Session.Status = 'Warning'
            $Session.RestartNeeded = $true
            $Session.ChangedSystem = $true
            $Session.ItemsProcessed = $steps.Count
            Write-Host '[OK] Network stack reset. Please restart the PC.' -ForegroundColor Green
        }
    } else {
        $Session.Status = 'Cancelled'
        Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
    }
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
