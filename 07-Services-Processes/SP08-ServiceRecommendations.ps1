#Requires -Version 5.1
#  knoux Repair v2.0.2 | 07-Services-Processes | SP08 - Service Configuration Audit
#  Risk: SYSTEM_REPAIR | Requires admin
#  Read-only audit of service configuration with controlled change capability.
#  Changes are permitted ONLY from an explicit Config allowlist supplied by
#  the administrator. No generic disable recommendations.
[CmdletBinding()]
param(
    [switch]$AnalyzeOnly,
    [switch]$WhatIf,
    [string]$Selection = ""   # Comma-separated numbers or "all"
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'SP08' -ToolName 'Service Configuration Audit' -Category '07-Services-Processes' -RiskLevel 'SYSTEM_REPAIR'
$Session.RequiresAdmin = $true
$rc = 0

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

# Load allowlist from Config if present
$allowlistPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'Config\service-allowlist.json'
$allowlist = @{}
if (Test-Path -LiteralPath $allowlistPath) {
    try { $allowlist = Get-Content -LiteralPath $allowlistPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { Write-Warning "Invalid allowlist JSON: $($_.Exception.Message)" }
}

try {
    $allServices = Get-Service -ErrorAction SilentlyContinue | Sort-Object Name
    $rows = @()
    foreach ($svc in $allServices) {
        $cim = $null
        try { $cim = Get-CimInstance -ClassName Win32_Service -Filter ("Name = '{0}'" -f $svc.Name) -ErrorAction SilentlyContinue } catch { }
        $depends = @()
        $dependedBy = @()
        try {
            $d = Get-Service -Name $svc.Name -ErrorAction SilentlyContinue -DependentServices -RequiredServices
            $depends = $d.RequiredServices.Name
            $dependedBy = $d.DependentServices.Name
        } catch { }
        $publisher = $null
        $isMicrosoft = $false
        if ($cim -and $cim.PathName) {
            try {
                $sig = Get-AuthenticodeSignature -FilePath $cim.PathName -ErrorAction SilentlyContinue
                if ($sig -and $sig.SignerCertificate) {
                    $publisher = $sig.SignerCertificate.Subject
                    $isMicrosoft = ($publisher -match 'Microsoft|Windows')
                }
            } catch { }
        }
        $allowed = $allowlist.ContainsKey($svc.Name)
        $rows += [pscustomobject]@{
            ServiceName = $svc.Name
            DisplayName = $svc.DisplayName
            Status = $svc.Status
            StartupType = $svc.StartType
            BinaryPath = $cim.PathName
            ServiceAccount = $cim.StartName
            Dependencies = ($depends -join ', ')
            Dependents = ($dependedBy -join ', ')
            IsMicrosoft = $isMicrosoft
            Publisher = $publisher
            AllowedForChange = $allowed
            AllowlistAction = if ($allowed) { $allowlist[$svc.Name].Action } else { $null }
        }
    }

    Write-Host ('Service Configuration Audit: {0} services total' -f $rows.Count) -ForegroundColor Cyan
    Write-Host ''

    $microsoft = @($rows | Where-Object { $_.IsMicrosoft })
    $nonMicrosoft = @($rows | Where-Object { -not $_.IsMicrosoft })
    $allowed = @($rows | Where-Object { $_.AllowedForChange })

    Write-Host ('Microsoft services: {0}' -f $microsoft.Count) -ForegroundColor Gray
    Write-Host ('Non-Microsoft services: {0}' -f $nonMicrosoft.Count) -ForegroundColor Gray
    Write-Host ('Services allowed for change (per Config): {0}' -f $allowed.Count) -ForegroundColor Cyan
    Write-Host ''

    # Detailed table
    Write-Host ('{0,-30} {1,-40} {2,-12} {3,-14} {4,-10} {5}' -f 'ServiceName', 'DisplayName', 'Status', 'StartupType', 'IsMicrosoft', 'Allowed')
    foreach ($r in $rows | Sort-Object @{Expression = 'IsMicrosoft'; Descending = $true}, 'ServiceName') {
        $m = if ($r.IsMicrosoft) { 'YES' } else { 'no' }
        $a = if ($r.AllowedForChange) { 'ALLOWED' } else { '' }
        $dn = $r.DisplayName
        if ($dn.Length -gt 40) { $dn = $dn.Substring(0, 40) }
        Write-Host ('{0,-30} {1,-40} {2,-12} {3,-14} {4,-10} {5}' -f $r.ServiceName, $dn, $r.Status, $r.StartupType, $m, $a) -ForegroundColor $(if ($r.IsMicrosoft) { 'Gray' } elseif ($r.AllowedForChange) { 'Cyan' } else { 'DarkGray' })
    }

    $rows | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'service-audit.csv') -NoTypeInformation -Encoding UTF8
    $rows | ConvertTo-Json -Depth 3 | Out-File -LiteralPath (Join-Path $Session.RawDir 'service-audit.json') -Encoding UTF8

    $Session.ItemsFound = $rows.Count
    $Session.ItemsProcessed = 1

    if ($WhatIf) {
        Write-Host "WhatIf: Would apply recommendations for selection: $Selection" -ForegroundColor Cyan
        Write-KnouxLog -Session $Session "WhatIf: Would apply service recommendations"
        exit 0
    }
    
    if ($AnalyzeOnly) {
        Write-Host '[ANALYZE] Displaying service recommendations only, no changes.' -ForegroundColor Green
        Write-KnouxLog -Session $Session ("Analyze: {0} services audited, {1} allowed for change" -f $rows.Count, $allowed.Count)
        exit 0
    }
    
    # Check for allowed changes
    $changeable = @($allowed | Where-Object { $_.StartupType -ne 'Disabled' })
    if ($changeable.Count -eq 0) {
        Write-Host '[OK] No allowed services are eligible for startup type change.' -ForegroundColor Green
        $Session.Status = 'Success'
    } elseif (-not (Test-KnouxAdministrator)) {
        $Session.Status = 'Failed'
        $Session.ErrorMessage = 'Administrator privileges are required.'
        Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
    } else {
        # Non-interactive execution: use Selection parameter
        if ([string]::IsNullOrWhiteSpace($Selection)) {
            Write-Error "Selection parameter is required for non-interactive execution. Provide comma-separated numbers or 'all'."
            $Session.Status = 'Failed'
            $Session.ErrorMessage = 'Missing Selection parameter'
            exit 1
        }
        
        Write-Host ''
        Write-Host 'Allowed services eligible for startup type change:' -ForegroundColor Cyan
        $i = 0
        foreach ($s in $changeable) {
            $i++
            Write-Host ('  {0,2}. {1,-30} [{2}] -> Allowed Action: {3}' -f $i, $s.ServiceName, $s.StartupType, $s.AllowlistAction)
        }

        Write-Host ''
        Write-Host 'Enter numbers to change (comma separated) or 0 to cancel:' -ForegroundColor Yellow
        $input = $Selection
        $chosen = @($input -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
        if ($chosen -contains 0 -or $chosen.Count -eq 0) {
            Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
            $Session.Status = 'Cancelled'
        } else {
            $toChange = @()
            foreach ($idx in $chosen) {
                if ($idx -ge 1 -and $idx -le $changeable.Count) { $toChange += $changeable[$idx - 1] }
            }
            if ($toChange.Count -eq 0) {
                $Session.Status = 'Cancelled'
                Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow
            } else {
                # Backup current state
                $backup = @($toChange | ForEach-Object {
                    [pscustomobject]@{
                        ServiceName = $_.ServiceName
                        DisplayName = $_.DisplayName
                        OriginalStartupType = $_.StartupType
                        OriginalRunningState = $_.Status
                        BinaryPath = $_.BinaryPath
                        BackedUpAt = (Get-Date).ToString('s')
                    }
                })
                $backupPath = Join-Path $Session.RawDir 'service-config-backup.json'
                try {
                    $backup | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $backupPath -Encoding UTF8
                    Write-KnouxLog -Session $Session ("Backed up {0} service configurations to {1}" -f $backup.Count, $backupPath)
                } catch {
                    throw "Could not write service config backup: $($_.Exception.Message)"
                }

                $changed = 0
                foreach ($s in $toChange) {
                    $target = $allowlist[$s.ServiceName]
                    $newType = if ($target.DesiredStartupType) { $target.DesiredStartupType } else { 'Disabled' }
                    try {
                        # Backup original state
                        Write-KnouxLog -Session $Session ("Changing {0}: {1} -> {2}" -f $s.ServiceName, $s.StartupType, $newType)
                        Set-Service -Name $s.ServiceName -StartupType $newType -ErrorAction Stop
                        # Verify
                        $verified = Get-Service -Name $s.ServiceName -ErrorAction SilentlyContinue
                        if ($verified -and $verified.StartType -eq $newType) {
                            $changed++
                            Write-Host ('  [OK] {0}: {1} -> {2}' -f $s.ServiceName, $s.StartupType, $newType) -ForegroundColor Green
                            Write-KnouxLog -Session $Session ("Changed {0}: {1} -> {2}" -f $s.ServiceName, $s.StartupType, $newType)
                        } else {
                            Write-KnouxLog -Session $Session ("Verification failed for {0}: expected {1}, got {2}" -f $s.ServiceName, $newType, $($verified.StartType)) 'ERROR'
                            Write-Host ('  [ERROR] Verification failed for {0}' -f $s.ServiceName) -ForegroundColor Red
                        }
                    } catch {
                        Write-KnouxLog -Session $Session ("FAIL change {0}: {1}" -f $s.ServiceName, $_.Exception.Message)
                        Write-Host ('  [ERROR] could not change {0}: {1}' -f $s.ServiceName, $_.Exception.Message) -ForegroundColor Red
                    }
                }

                if ($changed -gt 0) {
                    $Session.Status = 'Success'
                    $Session.ChangedSystem = $true
                    $Session.ItemsProcessed = $changed
                    Write-Host ('[OK] Changed {0} service(s). Restore with SP09.' -f $changed) -ForegroundColor Green
                } else {
                    $Session.Status = 'Warning'
                    $Session.ErrorMessage = 'No service could be changed.'
                }
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