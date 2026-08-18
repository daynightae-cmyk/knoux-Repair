#Requires -Version 5.1
#  knoux Repair v2.0.2 | 07-Services-Processes | SP05 - Reset Service Start Types
#  Risk: SYSTEM_REPAIR | Requires admin
#  Resets the start type of a set of well-known Windows services to
#  Microsoft defaults. Current start modes are backed up to Backups\
#  before any change and every change is verified afterwards.
#  Includes a read-only UAC/DEP audit; UAC and DEP are never
#  disabled by this tool.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP05' -ToolName 'Reset Service Start Types' -Category '07-Services-Processes' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0

$defaults = @{
    'Wuauserv' = 'Automatic'
    'BITS' = 'Manual'
    'CryptSvc' = 'Automatic'
    'DcomLaunch' = 'Automatic'
    'RpcSs' = 'Automatic'
    'Schedule' = 'Automatic'
    'Spooler' = 'Automatic'
    'Themes' = 'Automatic'
    'WSearch' = 'Automatic'
    'TrustedInstaller' = 'Manual'
    'dhcp' = 'Automatic'
    'NlaSvc' = 'Automatic'
    'gpsvc' = 'Automatic'
    'EventLog' = 'Automatic'
    'Audiosrv' = 'Automatic'
    'LanmanWorkstation' = 'Automatic'
    'LanmanServer' = 'Automatic'
}

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

$uacPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$enableLua = (Get-ItemProperty -Path $uacPath -Name EnableLUA -ErrorAction SilentlyContinue).EnableLUA
$depState = 'unknown'
$bcd = @(& bcdedit.exe /enum '{current}' 2>$null)
foreach ($line in $bcd) { if ($line -match '^\s*nx\s+(\S+)') { $depState = $matches[1]; break } }
Write-Host ('[AUDIT] UAC (EnableLUA): {0}   (read-only; never changed here)' -f $(if ($enableLua -eq 1) { 'Enabled' } else { 'Disabled' })) -ForegroundColor DarkGray
Write-Host ('[AUDIT] DEP policy: {0}   (read-only; never changed here)' -f $depState) -ForegroundColor DarkGray

if (-not ($AnalyzeOnly -or $WhatIf) -and $Session.RequiresAdmin -and -not (Test-KnouxAdministrator)) {
    $Session.Status = 'Failed'
    $Session.ErrorMessage = 'Administrator privileges are required.'
    Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
} else {
    Write-Host ('Would reset {0} well-known services to default start types.' -f $defaults.Count) -ForegroundColor Cyan
    $changed = 0
    $verified = 0
    $backupPath = $null
    if (-not ($AnalyzeOnly -or $WhatIf)) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backupPath = Join-Path (Join-Path $Session.ProjectRoot 'Backups') ('SP05-' + $stamp)
        New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
        $Session.BackupPath = $backupPath
    }
    foreach ($name in $defaults.Keys) {
        $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (-not $svc) { continue }
        $current = (Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $name) -ErrorAction SilentlyContinue).StartMode
        $desired = $defaults[$name]
        if ($current -ne $desired) {
            Write-Host ('  {0,-20} {1,-12} -> {2}' -f $name, $current, $desired) -ForegroundColor Yellow
            $changed++
            if (-not ($AnalyzeOnly -or $WhatIf)) {
                $row = [pscustomobject]@{ Service = $name; PreviousStartMode = $current; DesiredStartMode = $desired; ChangedAt = (Get-Date).ToString('s') }
                $row | Export-Csv -LiteralPath (Join-Path $backupPath 'startmode-backup.csv') -Append -NoTypeInformation -Encoding UTF8
                try {
                    Set-Service -Name $name -StartupType $desired -ErrorAction Stop
                    $afterMode = (Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $name) -ErrorAction SilentlyContinue).StartMode
                    if ($afterMode -eq $desired) { $verified++ }
                    Write-KnouxLog -Session $Session ("Set {0} start type {1} -> {2}" -f $name, $current, $desired)
                } catch {
                    Write-KnouxLog -Session $Session ("FAIL set {0}: {1}" -f $name, $_.Exception.Message)
                }
            }
        }
    }
    if ($changed -eq 0) {
        Write-Host '[OK] All listed services already use default start types.' -ForegroundColor Green
    } elseif ($AnalyzeOnly -or $WhatIf) {
        Write-Host ('[ANALYZE] {0} service(s) would change. No changes made.' -f $changed) -ForegroundColor Green
    }
    if (-not ($AnalyzeOnly -or $WhatIf)) {
        if ($changed -gt 0) {
            if ($verified -eq $changed) {
                $Session.Status = 'Success'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = $changed
                Write-Host ('[OK] Reset {0} service(s); all verified.' -f $changed) -ForegroundColor Green
                Write-KnouxLog -Session $Session ("Reset $changed service(s), $verified verified")
            } else {
                $Session.Status = 'Warning'
                $Session.ChangedSystem = $true
                $Session.ItemsProcessed = $changed
                $Session.ErrorMessage = "$($changed - $verified) service change(s) could not be verified."
                Write-Host ('[WARN] ' + $Session.ErrorMessage) -ForegroundColor Yellow
                Write-KnouxLog -Session $Session $Session.ErrorMessage 'WARN'
            }
        } else {
            $Session.Status = 'Success'
        }
    } else {
        $Session.Status = 'Success'
    }
    Write-KnouxLog -Session $Session ("Service start-type check: {0} to change" -f $changed)
}

$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
