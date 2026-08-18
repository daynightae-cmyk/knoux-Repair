#Requires -Version 5.1
# ============================================================
#  knoux Repair v2.0.2 | Tests\Run-Tests.ps1
#  Self-contained validation suite (51 tests). No external
#  dependencies. Writes Tests\TEST-RESULTS.txt and sets the
#  process exit code to the number of failed tests.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$results = @()
$failCount = 0

function Test-Knoux {
    param([string]$Name, [scriptblock]$Body)
    try {
        $ok = & $Body
        if ($ok) {
            $script:results += [pscustomobject]@{ Test = $Name; Status = 'PASS'; Detail = '' }
            Write-Host ("  [PASS] {0}" -f $Name) -ForegroundColor Green
        } else {
            $script:results += [pscustomobject]@{ Test = $Name; Status = 'FAIL'; Detail = 'condition not met' }
            $script:failCount++
            Write-Host ("  [FAIL] {0}" -f $Name) -ForegroundColor Red
        }
    } catch {
        $script:results += [pscustomobject]@{ Test = $Name; Status = 'ERROR'; Detail = $_.Exception.Message }
        $script:failCount++
        Write-Host ("  [ERROR] {0}: {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
    }
}

function Has-Utf8Bom {
    param([string]$Path)
    $b = [System.IO.File]::ReadAllBytes($Path)
    return ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
}

function Get-ToolFiles {
    @(Get-ChildItem -LiteralPath $ProjectRoot -Directory | Where-Object { $_.Name -match '^\d\d-[A-Z]' } | ForEach-Object { Get-ChildItem -LiteralPath $_.FullName -Filter *.ps1 })
}

# PS 5.1 ConvertFrom-Json returns a top-level JSON array as a single
# object; unroll it so the manifest tests see 100 rows on every runtime.
function Get-ManifestJson {
    $jsonPath = Join-Path $ProjectRoot 'Docs\TOOLS-MANIFEST.json'
    $rows = @(Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    if ($rows.Count -eq 1 -and $rows[0] -is [System.Array]) { $rows = @($rows[0]) }
    return ,$rows
}

function Invoke-KnouxBoundedChild {
    param([Parameter(Mandatory = $true)][string]$ScriptPath,[string]$Arguments = '',[int]$TimeoutSeconds = 180)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptPath + '"' + $Arguments
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::Start($psi)
    $process.StandardInput.WriteLine()
    $process.StandardInput.Close()
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $finished = $process.WaitForExit([Math]::Max(1000, $TimeoutSeconds * 1000))
    if (-not $finished) { try { & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null } catch { }; $process.WaitForExit() }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    return [pscustomobject]@{ TimedOut = (-not $finished); ExitCode = if ($finished) { $process.ExitCode } else { $null }; Stdout = $stdout; Stderr = $stderr; ProcessId = $process.Id }
}

Write-Host 'knoux Repair v2.0.2 | Test suite' -ForegroundColor Cyan
Write-Host '================================' -ForegroundColor Cyan

$toolFiles = Get-ToolFiles
$coreFiles = @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'Core') -Filter *.psm1)

# --- 1. Core imports cleanly ---
Test-Knoux -Name '01 Core module imports without error' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force -ErrorAction Stop
    return $true
}

# --- 2. Core exports the required functions ---
Test-Knoux -Name '02 Core exports required functions' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $required = @('Start-KnouxSession', 'Stop-KnouxSession', 'Write-KnouxLog', 'Write-KnouxHeader', 'Write-KnouxResult',
        'Confirm-KnouxAction', 'Confirm-KnouxDestructiveAction', 'Get-KnouxOperatingSystemInfo', 'Format-KnouxSize',
        'Export-KnouxReport', 'Invoke-KnouxNativeCommand', 'Join-KnouxArguments', 'Test-KnouxProtectedPath',
        'Test-KnouxProtectedProcess', 'New-KnouxBackup', 'New-KnouxRestorePoint', 'Move-KnouxItemToQuarantine',
        'Restore-KnouxQuarantinedItem', 'Resolve-KnouxSafePath', 'Invoke-KnouxCleanup', 'Get-KnouxFolderSize',
        'Get-KnouxScanFiles', 'Find-KnouxDuplicateGroups', 'Get-KnouxPowerPlans', 'Get-KnouxFirewallStatus',
        'Set-KnouxFirewallState', 'Test-KnouxAdministrator', 'Restart-KnouxAsAdministrator')
    $missing = @($required | Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) })
    return ($missing.Count -eq 0)
}

# --- 3. Core modules have UTF-8 BOM ---
Test-Knoux -Name '03 Core modules are UTF-8 BOM' -Body {
    return @($coreFiles | Where-Object { -not (Has-Utf8Bom $_.FullName) }).Count -eq 0
}

# --- 4. All tool files are UTF-8 BOM ---
Test-Knoux -Name '04 All tool files are UTF-8 BOM' -Body {
    return $toolFiles.Count -eq 100 -and @($toolFiles | Where-Object { -not (Has-Utf8Bom $_.FullName) }).Count -eq 0
}

# --- 5. All tool files parse ---
Test-Knoux -Name '05 All tool files parse without errors' -Body {
    $bad = 0
    foreach ($f in $toolFiles) {
        $tokens = $null; $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count -gt 0) { $bad++ }
    }
    return $bad -eq 0
}

# --- 6. Ten categories, ten tools each ---
Test-Knoux -Name '06 Ten categories with exactly ten tools each' -Body {
    $cats = @(Get-ChildItem -LiteralPath $ProjectRoot -Directory | Where-Object { $_.Name -match '^\d\d-[A-Z]' })
    $ok = $cats.Count -eq 10
    foreach ($c in $cats) { if (@(Get-ChildItem -LiteralPath $c.FullName -Filter *.ps1).Count -ne 10) { $ok = $false } }
    return $ok
}

# --- 7. ToolId scheme is consistent ---
Test-Knoux -Name '07 ToolId prefix matches file and folder' -Body {
    $ok = $true
    foreach ($f in $toolFiles) {
        if ($f.BaseName -notmatch '^([A-Z]{2})(\d{2})-') { $ok = $false; continue }
        $prefix = $matches[1]; $num = [int]$matches[2]
        if ($num -lt 1 -or $num -gt 10) { $ok = $false }
        $catName = $f.Directory.Name
        $expected = switch ($prefix) { 'SM' { '01-System-Maintenance' } 'SC' { '02-System-Cleanup' } 'NI' { '03-Network-Internet' } 'PA' { '04-Programs-Applications' } 'DF' { '05-Duplicate-Files' } 'DS' { '06-Disk-Space' } 'SP' { '07-Services-Processes' } 'PF' { '08-Performance' } 'SE' { '09-Security' } 'DR' { '10-Diagnostics-Reports' } default { '' } }
        if ($catName -ne $expected) { $ok = $false }
    }
    return $ok
}

# --- 8. Every tool declares a Risk level ---
Test-Knoux -Name '08 Every tool declares a Risk level' -Body {
    $bad = @($toolFiles | Where-Object { ((Get-Content -LiteralPath $_.FullName -TotalCount 4 -Encoding UTF8) -join "`n") -notmatch 'Risk:\s*[A-Z_]+' })
    return $bad.Count -eq 0
}

# --- 9. Every tool imports the Core module ---
Test-Knoux -Name '09 Every tool imports the Core module' -Body {
    $bad = @($toolFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -notmatch 'Import-Module[^\r\n]*KnouxRepair\.Core\.psm1' })
    return $bad.Count -eq 0
}

# --- 10. Every tool closes the session with Write-KnouxResult ---
Test-Knoux -Name '10 Every tool ends with Write-KnouxResult' -Body {
    $bad = @($toolFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -notmatch 'Write-KnouxResult' })
    return $bad.Count -eq 0
}

# --- 11. menus.json matches on-disk tools ---
Test-Knoux -Name '11 Config menus.json matches on-disk tools' -Body {
    $menu = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Config\menus.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $menuIds = @($menu | ForEach-Object { $_.Tools } | ForEach-Object { $_.Id })
    $diskIds = @($toolFiles | ForEach-Object { $_.BaseName.Substring(0, 4) })
    $miss = @($diskIds | Where-Object { $_ -notin $menuIds })
    $extra = @($menuIds | Where-Object { $_ -notin $diskIds })
    return $menu.Count -eq 10 -and $menuIds.Count -eq 100 -and $miss.Count -eq 0 -and $extra.Count -eq 0
}

# --- 12. settings.json exists and is valid JSON ---
Test-Knoux -Name '12 settings.json is valid' -Body {
    $s = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Config\settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    return ($null -ne $s.version)
}

# --- 13. Protected lists exist and are valid ---
Test-Knoux -Name '13 Protected lists are present and valid JSON' -Body {
    $pp = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Config\protected-processes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $paths = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Config\protected-paths.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    return ($pp -is [array] -and $pp.Count -gt 10) -and ($paths -is [array] -and $paths.Count -gt 5)
}

# --- 14. Destructive tools require a typed confirmation ---
Test-Knoux -Name '14 Destructive tools use typed confirmation' -Body {
    $dx = @($toolFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -TotalCount 4 -Encoding UTF8) -match 'Risk:\s*DESTRUCTIVE' })
    if ($dx.Count -eq 0) { return $true }
    $bad = @($dx | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -notmatch 'Confirm-KnouxDestructiveAction' })
    return $bad.Count -eq 0
}

# --- 15. No tool deletes protected system paths directly ---
Test-Knoux -Name '15 No tool removes protected system paths' -Body {
    $dangerous = @('C:\Windows\System32\Config', 'C:\Windows\WinSxS', 'C:\Windows\Prefetch', 'C:\Windows\Boot', 'C:\Windows\System32\drivers\etc')
    $bad = @()
    foreach ($f in $toolFiles) {
        $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
        foreach ($d in $dangerous) {
            if ($content -match [regex]::Escape($d)) { $bad += ($f.Name + ' -> ' + $d) }
        }
    }
    return $bad.Count -eq 0
}

# --- 16. Menu and launcher exist and parse ---
Test-Knoux -Name '16 Menu.ps1 and launcher exist' -Body {
    $menuOk = Test-Path -LiteralPath (Join-Path $ProjectRoot 'Menu.ps1')
    $cmdOk = Test-Path -LiteralPath (Join-Path $ProjectRoot 'START-KNOUX-REPAIR.cmd')
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $ProjectRoot 'Menu.ps1'), [ref]$tokens, [ref]$errors) | Out-Null
    return $menuOk -and $cmdOk -and $errors.Count -eq 0
}

# --- 17. Tool IDs are unique ---
Test-Knoux -Name '17 Tool IDs are unique' -Body {
    $ids = @($toolFiles | ForEach-Object { $_.BaseName.Substring(0, 4) })
    return $ids.Count -eq 100 -and ($ids | Select-Object -Unique).Count -eq 100
}

# --- 18. No legacy API references ---
Test-Knoux -Name '18 No legacy KR API references in tools' -Body {
    $bad = @()
    foreach ($f in $toolFiles) {
        $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
        if ($content -match 'New-KRRunContext|Write-KRLog|Export-KRData|Complete-KRRun|ScriptId') { $bad += $f.Name }
    }
    return $bad.Count -eq 0
}

# --- 19. Risk levels use the valid set ---
Test-Knoux -Name '19 Risk levels use the valid set' -Body {
    $valid = @('READ_ONLY', 'SAFE_CLEANUP', 'SYSTEM_REPAIR', 'DESTRUCTIVE', 'REBOOT_REQUIRED', 'WINRE_ONLY')
    $bad = @($toolFiles | Where-Object {
        $m = [regex]::Match((Get-Content -LiteralPath $_.FullName -TotalCount 4 -Encoding UTF8) -join "`n", 'Risk:\s*([A-Z_]+)')
        $m.Success -eq $false -or $m.Groups[1].Value -notin $valid
    })
    return $bad.Count -eq 0
}

# --- 20. Read-only tool runs and produces a report ---
Test-Knoux -Name '20 Read-only sample tool produces a report' -Body {
    $reportsDir = Join-Path $ProjectRoot 'Reports'
    $before = @(Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $run = Invoke-KnouxBoundedChild -ScriptPath (Join-Path $ProjectRoot '10-Diagnostics-Reports\DR10-FullDiagnosticReport.ps1') -TimeoutSeconds 180
    if ($run.TimedOut) { throw ('TIMEOUT after 180s. stdout: ' + $run.Stdout + ' stderr: ' + $run.Stderr) }
    if ($run.ExitCode -ne 0) { throw ('DR10 exited with code ' + $run.ExitCode + '. stdout: ' + $run.Stdout + ' stderr: ' + $run.Stderr) }
    $after = @(Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $new = @($after | Where-Object { $_ -notin $before })
    if ($new.Count -ne 1) { return $false }
    $reportPath = Join-Path (Join-Path $reportsDir $new[0]) 'results.json'
    if (-not (Test-Path -LiteralPath $reportPath)) { return $false }
    $report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
    return $report.ToolId -eq 'DR10' -and $report.Status -eq 'Success' -and $report.ExitCode -eq 0
}

# --- 21. Admin tool runs in analyze mode without changes ---
Test-Knoux -Name '21 Admin tool runs analyze-only cleanly' -Body {
    $reportsDir = Join-Path $ProjectRoot 'Reports'
    $before = @(Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $run = Invoke-KnouxBoundedChild -ScriptPath (Join-Path $ProjectRoot '09-Security\SE05-EnableFirewall.ps1') -Arguments ' -AnalyzeOnly' -TimeoutSeconds 120
    if ($run.TimedOut) { throw ('TIMEOUT after 120s. stdout: ' + $run.Stdout + ' stderr: ' + $run.Stderr) }
    if ($run.ExitCode -ne 0) { throw ('SE05 analyze-only exited with code ' + $run.ExitCode + '. stdout: ' + $run.Stdout + ' stderr: ' + $run.Stderr) }
    $after = @(Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
    $new = @($after | Where-Object { $_ -notin $before })
    return $new.Count -eq 1
}

# --- 22. Report schema files are generated ---
Test-Knoux -Name '22 Report schema is generated' -Body {
    $latest = Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'Reports') -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $needed = @('summary-en.txt', 'summary-ar.txt', 'results.json', 'results.csv', 'operation.log')
    return @($needed | Where-Object { -not (Test-Path -LiteralPath (Join-Path $latest.FullName $_)) }).Count -eq 0
}

# --- 23. Every tool accepts -AnalyzeOnly and -WhatIf ---
Test-Knoux -Name '23 Every tool declares AnalyzeOnly/WhatIf switches' -Body {
    $bad = @($toolFiles | Where-Object {
        $head = (Get-Content -LiteralPath $_.FullName -TotalCount 15 -Encoding UTF8) -join "`n"
        # Check for [CmdletBinding()] and both [switch] parameters
        $hasCmdletBinding = $head -match '\[CmdletBinding\(\)\]'
        $hasAnalyzeOnly = $head -match '\[switch\]\s*\$AnalyzeOnly'
        $hasWhatIf = $head -match '\[switch\]\s*\$WhatIf'
        # Tool passes if it has CmdletBinding AND both switches
        -not ($hasCmdletBinding -and $hasAnalyzeOnly -and $hasWhatIf)
    })
    return $bad.Count -eq 0
}

# --- 24. No ProcessStartInfo.ArgumentList usage ---
Test-Knoux -Name '24 No PS 5.1-incompatible ArgumentList usage' -Body {
    $bad = @($toolFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -match '\.ArgumentList\s*=' })
    return $bad.Count -eq 0
}

# --- 25. Quarantine helper is available ---
Test-Knoux -Name '25 Quarantine helper is available' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    return $null -ne (Get-Command Move-KnouxItemToQuarantine -ErrorAction SilentlyContinue)
}

# --- 26. Version and change log exist ---
Test-Knoux -Name '26 Version and change log exist' -Body {
    return (Test-Path -LiteralPath (Join-Path $ProjectRoot 'VERSION')) -and (Test-Path -LiteralPath (Join-Path $ProjectRoot 'CHANGELOG.md'))
}

# --- 27. No tool can disable the Windows Firewall ---
Test-Knoux -Name '27 No firewall-disable capability' -Body {
    $p1 = 'advfirewall' + ' state off'
    $p2 = 'Set-Net' + 'FirewallProfile'
    $p3 = 'Disable-Net' + 'FirewallRule'
    $p4 = 'Enabled\s*[:=]\s*' + '$false'
    $bad = @($toolFiles | Where-Object {
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $c -match [regex]::Escape($p1) -or $c -match [regex]::Escape($p2) -or
        $c -match [regex]::Escape($p3) -or $c -match $p4
    })
    return $bad.Count -eq 0
}

# --- 28. No tool can stop or disable Windows Defender ---
Test-Knoux -Name '28 No Defender stop/disable capability' -Body {
    $rt = 'DisableRealtime' + 'Monitoring $true'
    $svc = 'Stop-' + 'Service'
    $wd = 'Win' + 'Defend'
    $mp = 'Ms' + 'MpEng'
    $bad = @($toolFiles | Where-Object {
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $c -match [regex]::Escape($rt) -or
        ($c -match [regex]::Escape($svc) -and $c -match [regex]::Escape($wd)) -or
        ($c -match [regex]::Escape($svc) -and $c -match [regex]::Escape($mp)) -or
        $c -match 'Disable' + 'AntiSpyware'
    })
    return $bad.Count -eq 0
}

# --- 29. No tool can disable UAC ---
Test-Knoux -Name '29 No UAC-disable capability' -Body {
    $lua = 'Enable' + 'LUA'
    $cons = 'Consent' + 'PromptBehaviorAdmin'
    $rx1 = [regex]::Escape($lua) + '[^\r\n]*Value\s*0'
    $rx2 = [regex]::Escape($cons) + '[^\r\n]*Value\s*0'
    $bad = @($toolFiles | Where-Object {
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $c -match $rx1 -or $c -match $rx2
    })
    return $bad.Count -eq 0
}

# --- 30. Data-destructive tools quarantine instead of Remove-Item ---
Test-Knoux -Name '30 Data-destructive tools quarantine by default' -Body {
    $ri = 'Remove-' + 'Item'
    $dataTools = @($toolFiles | Where-Object { $_.BaseName -match '^(DF02|DF03|DF04|DF05|DF06|DF08)-' })
    $bad = @($dataTools | Where-Object {
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $c -notmatch 'Move-KnouxItemToQuarantine' -or $c -match [regex]::Escape($ri)
    })
    return $dataTools.Count -eq 6 -and $bad.Count -eq 0
}

# --- 31. Quarantine move preserves the item and writes metadata ---
Test-Knoux -Name '31 Quarantine move preserves item and metadata' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = Join-Path $env:TEMP ('knoux-test-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.bin'
    Set-Content -LiteralPath $file -Value 'quarantine-roundtrip-payload' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $metaFile = Join-Path $qDir 'quarantine-meta.json'
        return ((-not (Test-Path -LiteralPath $file)) -and
            (Test-Path -LiteralPath $meta.QuarantinePath) -and
            (Test-Path -LiteralPath $metaFile) -and
            -not [string]::IsNullOrEmpty($meta.OriginalHash))
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 32. Quarantine restore is SHA-256 verified ---
Test-Knoux -Name '32 Quarantine restore verifies SHA-256' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = Join-Path $env:TEMP ('knoux-test-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.bin'
    Set-Content -LiteralPath $file -Value 'quarantine-restore-payload' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        $hash = if (Test-Path -LiteralPath $file) { (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash } else { '' }
        return ($restored -eq $true -and (Test-Path -LiteralPath $file) -and $hash -eq $meta.OriginalHash)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 33. Quarantine restore rejects tampered items ---
Test-Knoux -Name '33 Quarantine restore rejects tampered item' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = Join-Path $env:TEMP ('knoux-test-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.bin'
    Set-Content -LiteralPath $file -Value 'quarantine-tamper-payload' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        Set-Content -LiteralPath $meta.QuarantinePath -Value 'TAMPERED' -Encoding UTF8
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        return ($restored -eq $false -and -not (Test-Path -LiteralPath $file))
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 34. SM09 restores WU service start mode AND running state ---
Test-Knoux -Name '34 SM09 restores start mode and running state' -Body {
    $f = @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot '01-System-Maintenance') -Filter 'SM09-*.ps1')
    if ($f.Count -ne 1) { return $false }
    $c = Get-Content -LiteralPath $f[0].FullName -Raw -Encoding UTF8
    return ($c -match 'Set-Service' -and $c -match 'Start-Service' -and $c -match '\$allRestored' -and $c -match 'allRestored\s*-and')
}

# --- 35. Unified result object on every tool ---
Test-Knoux -Name '35 Unified result object everywhere' -Body {
    $bad = @($toolFiles | Where-Object {
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $c -notmatch '\$result = Stop-KnouxSession' -or
        $c -notmatch 'Write-KnouxResult' -or
        $c -notmatch 'return \$result' -or
        $c -match '\$null = Stop-KnouxSession'
    })
    return $bad.Count -eq 0
}

# --- 36. RiskLevel parameter matches header declaration ---
Test-Knoux -Name '36 RiskLevel param matches header' -Body {
    $bad = @()
    foreach ($f in $toolFiles) {
        $head = (Get-Content -LiteralPath $f.FullName -TotalCount 4 -Encoding UTF8) -join "`n"
        $m = [regex]::Match($head, 'Risk:\s*([A-Z_]+)')
        $p = [regex]::Match((Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8), "-RiskLevel '([A-Z_]+)'")
        if ($m.Success -and $p.Success -and $m.Groups[1].Value -ne $p.Groups[1].Value) { $bad += $f.Name }
    }
    return $bad.Count -eq 0
}

# --- 37. Invoke-KnouxCleanup quarantines by default ---
Test-Knoux -Name '37 Cleanup helper quarantines by default' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = Join-Path $env:TEMP ('knoux-test-' + [guid]::NewGuid().ToString('N'))
    $dir = Join-Path $tmpRoot 'dirty'
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    1..3 | ForEach-Object { Set-Content -LiteralPath (Join-Path $dir ("f{0}.tmp" -f $_)) -Value ('data' * 10) -Encoding UTF8 }
    try {
        $r = Invoke-KnouxCleanup -Path $dir -SkipConfirm -ToolId 'test' -ProjectRoot $tmpRoot
        $remaining = @(Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue).Count
        $metaCount = @(Get-ChildItem -LiteralPath (Join-Path $tmpRoot 'Quarantine') -Filter 'quarantine-meta.json' -Recurse -File -ErrorAction SilentlyContinue).Count
        return ($r.Status -eq 'Done' -and $r.Removed -eq 3 -and $remaining -eq 0 -and $metaCount -eq 3)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 38. No tool reports Success without post-operation evidence ---
Test-Knoux -Name '38 No Success-without-evidence' -Body {
    $markers = @('verified', 'restoreVerified', 'Get-Service', 'Get-ItemProperty', 'Get-CimInstance',
        'Get-FileHash', 'Get-NetIPAddress', 'Get-MpComputerStatus', 'Get-AppxPackage',
        'Get-NetFirewallProfile', 'Get-Process', 'stillThere', 'remaining', 'scanDone',
        'Check-', 'ExitCode', '.Success', '$ok', '-eq $', '-ne $')
    $flagged = @()
    foreach ($f in $toolFiles) {
        $c = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
        if ($c -match 'ChangedSystem') {
            $has = $false
            foreach ($m in $markers) {
                if ($c.IndexOf($m, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $has = $true; break }
            }
            if (-not $has) { $flagged += $f.Name }
        }
    }
    return $flagged.Count -eq 0
}

# --- 39. Manifest files exist with the exact 15-field header ---
Test-Knoux -Name '39 Manifest files exist with exact 15-field header' -Body {
    $csvPath = Join-Path $ProjectRoot 'Docs\TOOLS-MANIFEST.csv'
    $jsonPath = Join-Path $ProjectRoot 'Docs\TOOLS-MANIFEST.json'
    if (-not (Test-Path -LiteralPath $csvPath) -or -not (Test-Path -LiteralPath $jsonPath)) { return $false }
    $header = (Get-Content -LiteralPath $csvPath -TotalCount 1 -Encoding UTF8).Trim()
    $expected = 'ToolId,Category,ScriptPath,EnglishName,ArabicName,Purpose,RiskLevel,RequiresAdmin,RequiresRestart,OfflineCapability,BackupMethod,RollbackMethod,AnalyzeOnlySupported,WhatIfSupported,TestResult'
    return $header -eq $expected
}

# --- 40. Manifest has exactly 100 rows in CSV and JSON ---
Test-Knoux -Name '40 Manifest has exactly 100 rows (CSV + JSON)' -Body {
    $csvPath = Join-Path $ProjectRoot 'Docs\TOOLS-MANIFEST.csv'
    $csvRows = @(Import-Csv -LiteralPath $csvPath -Encoding UTF8)
    $jsonRows = Get-ManifestJson
    return $csvRows.Count -eq 100 -and $jsonRows.Count -eq 100
}

# --- 41. Manifest rows have exactly 15 fields, none blank ---
Test-Knoux -Name '41 Manifest rows have 15 fields, none blank' -Body {
    $jsonRows = Get-ManifestJson
    $expected = @('ToolId','Category','ScriptPath','EnglishName','ArabicName','Purpose','RiskLevel','RequiresAdmin','RequiresRestart','OfflineCapability','BackupMethod','RollbackMethod','AnalyzeOnlySupported','WhatIfSupported','TestResult')
    $bad = @()
    foreach ($r in $jsonRows) {
        $names = @($r.PSObject.Properties.Name)
        if ($names.Count -ne 15) { $bad += "$($r.ToolId):fieldCount=$($names.Count)"; continue }
        foreach ($f in $expected) {
            if ($f -notin $names) { $bad += "$($r.ToolId):missing=$f"; continue }
            if ($null -eq $r.$f -or ([string]$r.$f).Trim() -eq '') { $bad += "$($r.ToolId):blank=$f" }
        }
    }
    return $bad.Count -eq 0
}

# --- 42. Manifest RiskLevel uses the valid enum ---
Test-Knoux -Name '42 Manifest RiskLevel uses valid enum' -Body {
    $jsonRows = Get-ManifestJson
    $valid = @('READ_ONLY', 'SAFE_CLEANUP', 'SYSTEM_REPAIR', 'DESTRUCTIVE', 'REBOOT_REQUIRED', 'WINRE_ONLY')
    return @($jsonRows | Where-Object { $_.RiskLevel -notin $valid }).Count -eq 0
}

# --- 43. Manifest OfflineCapability uses the valid enum ---
Test-Knoux -Name '43 Manifest OfflineCapability uses valid enum' -Body {
    $jsonRows = Get-ManifestJson
    return @($jsonRows | Where-Object { $_.OfflineCapability -notin @('FULL', 'PARTIAL', 'NO') }).Count -eq 0
}

# --- 44. Manifest booleans are real booleans in JSON ---
Test-Knoux -Name '44 Manifest booleans are typed true/false' -Body {
    $jsonRows = Get-ManifestJson
    $bad = @($jsonRows | Where-Object {
        $_.RequiresAdmin.GetType().Name -ne 'Boolean' -or
        $_.RequiresRestart.GetType().Name -ne 'Boolean' -or
        $_.AnalyzeOnlySupported.GetType().Name -ne 'Boolean' -or
        $_.WhatIfSupported.GetType().Name -ne 'Boolean'
    })
    return $bad.Count -eq 0
}

# --- 45. Manifest TestResult uses the valid enum ---
Test-Knoux -Name '45 Manifest TestResult uses valid enum' -Body {
    $jsonRows = Get-ManifestJson
    return @($jsonRows | Where-Object { $_.TestResult -notin @('PASS', 'FAIL', 'NOT_TESTED', 'NOT_APPLICABLE') }).Count -eq 0
}

# --- 46. Manifest ToolId and ScriptPath are unique ---
Test-Knoux -Name '46 Manifest ToolId and ScriptPath are unique' -Body {
    $jsonRows = Get-ManifestJson
    $dupIds = @($jsonRows | Group-Object ToolId | Where-Object { $_.Count -gt 1 })
    $dupPaths = @($jsonRows | Group-Object ScriptPath | Where-Object { $_.Count -gt 1 })
    return $dupIds.Count -eq 0 -and $dupPaths.Count -eq 0
}

# --- 47. Manifest ScriptPaths use forward slashes and files exist ---
Test-Knoux -Name '47 Manifest ScriptPaths are valid and exist' -Body {
    $jsonRows = Get-ManifestJson
    $bad = @($jsonRows | Where-Object {
        $_.ScriptPath -notmatch '/' -or -not (Test-Path -LiteralPath (Join-Path $ProjectRoot ($_.ScriptPath -replace '/', '\')))
    })
    return $bad.Count -eq 0
}

# --- 48. Manifest CSV and JSON are equivalent ---
Test-Knoux -Name '48 Manifest CSV matches JSON' -Body {
    $csvPath = Join-Path $ProjectRoot 'Docs\TOOLS-MANIFEST.csv'
    $csvRows = @(Import-Csv -LiteralPath $csvPath -Encoding UTF8)
    $jsonRows = Get-ManifestJson
    $fields = @('ToolId','Category','ScriptPath','EnglishName','ArabicName','Purpose','RiskLevel','RequiresAdmin','RequiresRestart','OfflineCapability','BackupMethod','RollbackMethod','AnalyzeOnlySupported','WhatIfSupported','TestResult')
    $mismatch = 0
    foreach ($cr in $csvRows) {
        $jr = $jsonRows | Where-Object { $_.ToolId -eq $cr.ToolId } | Select-Object -First 1
        if (-not $jr) { $mismatch++; continue }
        foreach ($fld in $fields) {
            $cv = [string]$cr.$fld
            $jv = [string]$jr.$fld
            if ($cv -ne $jv) { $mismatch++ }
        }
    }
    return $mismatch -eq 0
}

# --- 49. ArabicName is metadata-only: no Arabic chars in tool scripts ---
Test-Knoux -Name '49 No Arabic characters in tool scripts' -Body {
    $bad = @($toolFiles | Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8) -match '[\u0600-\u06FF]' })
    return $bad.Count -eq 0
}

# --- 50. Every manifest tool is referenced by menus.json ---
Test-Knoux -Name '50 Manifest aligns with menus.json' -Body {
    $jsonRows = Get-ManifestJson
    $menu = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Config\menus.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $menuPaths = @($menu | ForEach-Object { $cat = $_; @($cat.Tools | ForEach-Object { "$($cat.Folder)/$($_.File)" }) })
    $manifestPaths = @($jsonRows | ForEach-Object { $_.ScriptPath })
    $missing = @($manifestPaths | Where-Object { $_ -notin $menuPaths })
    $extra = @($menuPaths | Where-Object { $_ -notin $manifestPaths })
    return $missing.Count -eq 0 -and $extra.Count -eq 0
}

# --- 51. Manifest risk/admin matches script headers ---
Test-Knoux -Name '51 Manifest matches script risk/admin headers' -Body {
    $jsonRows = Get-ManifestJson
    $bad = @($jsonRows | Where-Object {
        $full = Join-Path $ProjectRoot ($_.ScriptPath -replace '/', '\')
        $head = (Get-Content -LiteralPath $full -TotalCount 4 -Encoding UTF8) -join "`n"
        $m = [regex]::Match($head, 'Risk:\s*([A-Z_]+)')
        $setsAdmin = (Get-Content -LiteralPath $full -Raw -Encoding UTF8) -match '\$Session\.RequiresAdmin = \$true'
        ($m.Success -and $m.Groups[1].Value -ne $_.RiskLevel) -or $setsAdmin -ne $_.RequiresAdmin
    })
    return $bad.Count -eq 0
}


# ============================================================================
#  Behavioral tests (52+) added during the v2.0.2 release audit.
#  They exercise the exit-code contract, quarantine round-trips, the
#  interactive R/B/A/C restore prompts, and the audit-blocker fixes.
# ============================================================================

function Invoke-KnouxTestChild {
    param([string]$ScriptPath, [string]$Stdin = '')
    $exe = if ($PSVersionTable.PSEdition -eq 'Core') { Join-Path $PSHOME 'pwsh.exe' } else { Join-Path $PSHOME 'powershell.exe' }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptPath + '"'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    if ($Stdin) { $p.StandardInput.Write($Stdin) }
    $p.StandardInput.Close()
    $out = $p.StandardOutput.ReadToEnd()
    $p.WaitForExit()
    return [pscustomobject]@{ ExitCode = $p.ExitCode; Stdout = $out }
}

$script:RestoreChildTemplate = @'
param([string]$AltPath = '')
$ErrorActionPreference = 'Stop'
Import-Module '__COREMODULE__' -Force
$tmpRoot = Join-Path $env:TEMP ('knoux-int-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
$file = Join-Path $tmpRoot 'sample.txt'
Set-Content -LiteralPath $file -Value 'ORIGINAL-PAYLOAD' -Encoding UTF8
$meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
if (-not $meta) { Write-Host '[TESTCHILD] RESULT=NO-META'; exit 3 }
$qDir = Split-Path $meta.QuarantinePath -Parent
Set-Content -LiteralPath $file -Value 'DIFFERENT-CONTENT' -Encoding UTF8
$result = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
$stillExists = Test-Path -LiteralPath $file
$qStill = Test-Path -LiteralPath $qDir
$fileContent = ''
if ($stillExists) { $fileContent = (Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue) }
$backups = @(Get-ChildItem -LiteralPath $tmpRoot -Filter 'knoux-backup-*' -Force -File -ErrorAction SilentlyContinue)
Write-Host ('[TESTCHILD] RESULT=' + $result)
Write-Host ('[TESTCHILD] DEST_EXISTS=' + $stillExists)
Write-Host ('[TESTCHILD] Q_STILL=' + $qStill)
Write-Host ('[TESTCHILD] DEST_CONTENT=' + [string]$fileContent)
Write-Host ('[TESTCHILD] BACKUP_COUNT=' + $backups.Count)
exit 0
'@

function Get-KnouxChildMarkers {
    param([string]$Stdout)
    return @($Stdout -split "`r?`n" | Where-Object { $_ -match '^\[TESTCHILD\]' })
}

function Get-KnouxChildValue {
    param([string[]]$Markers, [string]$Key)
    $line = $Markers | Where-Object { $_ -match ('^\[TESTCHILD\] ' + [regex]::Escape($Key) + '=') } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -split '=', 2)[1]
}

function New-KnouxTempRoot {
    return (Join-Path $env:TEMP ('knoux-test-' + [guid]::NewGuid().ToString('N')))
}

# --- 52. Version consistency across the package ---
Test-Knoux -Name '52 Version is consistently 2.0.2' -Body {
    $v = (Get-Content -LiteralPath (Join-Path $ProjectRoot 'VERSION') -Raw).Trim()
    $settings = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Config\settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $menuTxt = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Menu.ps1') -Raw -Encoding UTF8
    $startTxt = Get-Content -LiteralPath (Join-Path $ProjectRoot 'START-KNOUX-REPAIR.cmd') -Raw -Encoding UTF8
    $changeTxt = Get-Content -LiteralPath (Join-Path $ProjectRoot 'CHANGELOG.md') -Raw -Encoding UTF8
    return ($v -eq '2.0.2' -and $settings.version -eq '2.0.2' -and
        $menuTxt -match '2\.0\.2' -and $startTxt -match '2\.0\.2' -and
        $changeTxt -match '2\.0\.2')
}

# --- 53. Line-ending contract: CRLF everywhere ---
Test-Knoux -Name '53 All scripts use CRLF line endings' -Body {
    $all = @($coreFiles) + @($toolFiles) +
        @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'Tests') -Filter '*.ps1') +
        @(Get-ChildItem -LiteralPath $ProjectRoot -Filter 'Menu.ps1')
    $badLf = 0
    foreach ($f in $all) {
        $raw = [System.IO.File]::ReadAllText($f.FullName)
        if ($raw -match '(?<!\r)\n') { $badLf++ }
    }
    return $badLf -eq 0
}

# --- 54. Stop-KnouxSession rejects a null session ---
Test-Knoux -Name '54 Stop-KnouxSession rejects a null session' -Body {
    $threw = $false
    try { $null = Stop-KnouxSession -Session $null } catch { $threw = $true }
    return $threw
}

# --- 55. Exit-code contract: Success -> 0 ---
Test-Knoux -Name '55 Exit-code contract maps Success to 0' -Body {
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    try {
        $s = Start-KnouxSession -ToolId 'TEST' -ToolName 'Test' -Category 'test' -RiskLevel 'SAFE_CLEANUP' -ProjectRoot $tmpRoot
        $s.Status = 'Success'
        $r = Stop-KnouxSession -Session $s
        return ($r.ExitCode -eq 0)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 56. Exit-code contract: Warning -> 1 ---
Test-Knoux -Name '56 Exit-code contract maps Warning to 1' -Body {
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    try {
        $s = Start-KnouxSession -ToolId 'TEST' -ToolName 'Test' -Category 'test' -RiskLevel 'SAFE_CLEANUP' -ProjectRoot $tmpRoot
        $s.Status = 'Warning'
        $r = Stop-KnouxSession -Session $s
        return ($r.ExitCode -eq 1)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 57. Exit-code contract: Failed -> 2 ---
Test-Knoux -Name '57 Exit-code contract maps Failed to 2' -Body {
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    try {
        $s = Start-KnouxSession -ToolId 'TEST' -ToolName 'Test' -Category 'test' -RiskLevel 'SAFE_CLEANUP' -ProjectRoot $tmpRoot
        $s.Status = 'Failed'
        $r = Stop-KnouxSession -Session $s
        return ($r.ExitCode -eq 2)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 58. Exit-code contract: Cancelled -> 3 ---
Test-Knoux -Name '58 Exit-code contract maps Cancelled to 3' -Body {
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    try {
        $s = Start-KnouxSession -ToolId 'TEST' -ToolName 'Test' -Category 'test' -RiskLevel 'SAFE_CLEANUP' -ProjectRoot $tmpRoot
        $s.Status = 'Cancelled'
        $r = Stop-KnouxSession -Session $s
        return ($r.ExitCode -eq 3)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 59. Exit-code contract: Skipped -> 4 ---
Test-Knoux -Name '59 Exit-code contract maps Skipped to 4' -Body {
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    try {
        $s = Start-KnouxSession -ToolId 'TEST' -ToolName 'Test' -Category 'test' -RiskLevel 'SAFE_CLEANUP' -ProjectRoot $tmpRoot
        $s.Status = 'Skipped'
        $r = Stop-KnouxSession -Session $s
        return ($r.ExitCode -eq 4)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 60. Exit-code contract: Inconclusive -> 5 ---
Test-Knoux -Name '60 Exit-code contract maps Inconclusive to 5' -Body {
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    try {
        $s = Start-KnouxSession -ToolId 'TEST' -ToolName 'Test' -Category 'test' -RiskLevel 'SAFE_CLEANUP' -ProjectRoot $tmpRoot
        $s.Status = 'Inconclusive'
        $r = Stop-KnouxSession -Session $s
        return ($r.ExitCode -eq 5)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 61. Quarantine file round-trip restores to the original path and removes quarantine ---
Test-Knoux -Name '61 Quarantine file round-trip restores the original path' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.bin'
    Set-Content -LiteralPath $file -Value 'roundtrip-content' -Encoding UTF8
    $expectedHash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        $exists = Test-Path -LiteralPath $file
        $hash = if ($exists) { (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash } else { '' }
        return ($restored -eq $true -and $exists -and $hash -eq $expectedHash -and -not (Test-Path -LiteralPath $qDir))
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 62. Quarantine directory round-trip verifies nested files via the manifest ---
Test-Knoux -Name '62 Quarantine directory round-trip restores nested files' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $dir = Join-Path $tmpRoot 'mydir'
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $dir 'sub') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dir 'a.txt') -Value 'AAA' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $dir 'b.txt') -Value 'BBB' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $dir 'sub\c.txt') -Value 'CCC' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $dir -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        $files = @(Get-ChildItem -LiteralPath $dir -File -Recurse -Force -ErrorAction SilentlyContinue)
        $c1 = if (Test-Path -LiteralPath (Join-Path $dir 'a.txt')) { (Get-Content -LiteralPath (Join-Path $dir 'a.txt') -Raw -Encoding UTF8).Trim() } else { '' }
        $c2 = if (Test-Path -LiteralPath (Join-Path $dir 'b.txt')) { (Get-Content -LiteralPath (Join-Path $dir 'b.txt') -Raw -Encoding UTF8).Trim() } else { '' }
        $c3 = if (Test-Path -LiteralPath (Join-Path $dir 'sub\c.txt')) { (Get-Content -LiteralPath (Join-Path $dir 'sub\c.txt') -Raw -Encoding UTF8).Trim() } else { '' }
        return ($restored -eq $true -and $files.Count -eq 3 -and $c1 -eq 'AAA' -and $c2 -eq 'BBB' -and $c3 -eq 'CCC' -and -not (Test-Path -LiteralPath $qDir))
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 63. Quarantine empty directory round-trip ---
Test-Knoux -Name '63 Quarantine empty directory round-trip restores an empty dir' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $dir = Join-Path $tmpRoot 'emptydir'
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    try {
        $meta = Move-KnouxItemToQuarantine -Path $dir -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        $files = @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)
        return ($restored -eq $true -and (Test-Path -LiteralPath $dir) -and $files.Count -eq 0 -and -not (Test-Path -LiteralPath $qDir))
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 64. Restore rejects an OriginalPath outside the approved root ---
Test-Knoux -Name '64 Restore rejects a destination outside the approved root' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.txt'
    Set-Content -LiteralPath $file -Value 'payload' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $metaFile = Join-Path $qDir 'quarantine-meta.json'
        $m = Get-Content -LiteralPath $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $m.OriginalPath = 'C:\Windows\System32\knoux-evil.txt'
        $m | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metaFile -Encoding UTF8
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        return ($restored -eq $false -and -not (Test-Path -LiteralPath 'C:\Windows\System32\knoux-evil.txt'))
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 65. Restore rejects a missing metadata file ---
Test-Knoux -Name '65 Restore rejects a missing metadata file' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.txt'
    Set-Content -LiteralPath $file -Value 'payload' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        Remove-Item -LiteralPath (Join-Path $qDir 'quarantine-meta.json') -Force
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        return ($restored -eq $false)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 66. Restore rejects an unsupported schema version ---
Test-Knoux -Name '66 Restore rejects an unsupported schema version' -Body {
    $null = Import-Module (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Force
    $tmpRoot = New-KnouxTempRoot
    New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
    $file = Join-Path $tmpRoot 'sample.txt'
    Set-Content -LiteralPath $file -Value 'payload' -Encoding UTF8
    try {
        $meta = Move-KnouxItemToQuarantine -Path $file -ToolId 'test' -ProjectRoot $tmpRoot
        if (-not $meta) { return $false }
        $qDir = Split-Path $meta.QuarantinePath -Parent
        $metaFile = Join-Path $qDir 'quarantine-meta.json'
        $m = Get-Content -LiteralPath $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $m.SchemaVersion = '9.9.9'
        $m | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $metaFile -Encoding UTF8
        $restored = Restore-KnouxQuarantinedItem -QuarantinePath $qDir
        return ($restored -eq $false)
    } finally { Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

# --- 67. Restore with existing destination: Cancel keeps both sides ---
Test-Knoux -Name '67 Restore Cancel keeps destination and quarantine' -Body {
    $child = $script:RestoreChildTemplate.Replace('__COREMODULE__', (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1'))
    $childPath = Join-Path $env:TEMP ('knoux-child-' + [guid]::NewGuid().ToString('N') + '.ps1')
    Set-Content -LiteralPath $childPath -Value $child -Encoding UTF8
    try {
        $r = Invoke-KnouxTestChild -ScriptPath $childPath -Stdin "C`n"
        $m = Get-KnouxChildMarkers $r.Stdout
        $res = (Get-KnouxChildValue $m 'RESULT')
        $qStill = (Get-KnouxChildValue $m 'Q_STILL')
        $dest = (Get-KnouxChildValue $m 'DEST_CONTENT')
        return ($r.ExitCode -eq 0 -and $res -eq 'False' -and $qStill -eq 'True' -and $dest.Trim() -eq 'DIFFERENT-CONTENT')
    } finally { Remove-Item -LiteralPath $childPath -Force -ErrorAction SilentlyContinue }
}

# --- 68. Restore with existing destination: Replace overwrites ---
Test-Knoux -Name '68 Restore Replace overwrites the destination' -Body {
    $child = $script:RestoreChildTemplate.Replace('__COREMODULE__', (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1'))
    $childPath = Join-Path $env:TEMP ('knoux-child-' + [guid]::NewGuid().ToString('N') + '.ps1')
    Set-Content -LiteralPath $childPath -Value $child -Encoding UTF8
    try {
        $r = Invoke-KnouxTestChild -ScriptPath $childPath -Stdin "R`n"
        $m = Get-KnouxChildMarkers $r.Stdout
        $res = (Get-KnouxChildValue $m 'RESULT')
        $qStill = (Get-KnouxChildValue $m 'Q_STILL')
        $dest = (Get-KnouxChildValue $m 'DEST_CONTENT')
        return ($r.ExitCode -eq 0 -and $res -eq 'True' -and $qStill -eq 'False' -and $dest.Trim() -eq 'ORIGINAL-PAYLOAD')
    } finally { Remove-Item -LiteralPath $childPath -Force -ErrorAction SilentlyContinue }
}

# --- 69. Restore with existing destination: Alternate path ---
Test-Knoux -Name '69 Restore Alternate writes to a user-supplied path' -Body {
    $child = $script:RestoreChildTemplate.Replace('__COREMODULE__', (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1'))
    $childPath = Join-Path $env:TEMP ('knoux-child-' + [guid]::NewGuid().ToString('N') + '.ps1')
    $altFile = Join-Path $env:TEMP ('knoux-alt-' + [guid]::NewGuid().ToString('N') + '.txt')
    Set-Content -LiteralPath $childPath -Value $child -Encoding UTF8
    try {
        $r = Invoke-KnouxTestChild -ScriptPath $childPath -Stdin ("A`n" + $altFile + "`n")
        $m = Get-KnouxChildMarkers $r.Stdout
        $res = (Get-KnouxChildValue $m 'RESULT')
        $dest = (Get-KnouxChildValue $m 'DEST_CONTENT')
        $altOk = Test-Path -LiteralPath $altFile
        $altContent = if ($altOk) { (Get-Content -LiteralPath $altFile -Raw -ErrorAction SilentlyContinue) } else { '' }
        return ($r.ExitCode -eq 0 -and $res -eq 'True' -and $altOk -and $altContent.Trim() -eq 'ORIGINAL-PAYLOAD' -and $dest.Trim() -eq 'DIFFERENT-CONTENT')
    } finally { Remove-Item -LiteralPath $childPath -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $altFile -Force -ErrorAction SilentlyContinue }
}

# --- 70. Restore with existing destination: Backup & Replace ---
Test-Knoux -Name '70 Restore Backup keeps a backup of the existing destination' -Body {
    $child = $script:RestoreChildTemplate.Replace('__COREMODULE__', (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1'))
    $childPath = Join-Path $env:TEMP ('knoux-child-' + [guid]::NewGuid().ToString('N') + '.ps1')
    Set-Content -LiteralPath $childPath -Value $child -Encoding UTF8
    try {
        $r = Invoke-KnouxTestChild -ScriptPath $childPath -Stdin "B`n"
        $m = Get-KnouxChildMarkers $r.Stdout
        $res = (Get-KnouxChildValue $m 'RESULT')
        $qStill = (Get-KnouxChildValue $m 'Q_STILL')
        $dest = (Get-KnouxChildValue $m 'DEST_CONTENT')
        $backups = [int](Get-KnouxChildValue $m 'BACKUP_COUNT')
        return ($r.ExitCode -eq 0 -and $res -eq 'True' -and $qStill -eq 'False' -and $dest.Trim() -eq 'ORIGINAL-PAYLOAD' -and $backups -ge 1)
    } finally { Remove-Item -LiteralPath $childPath -Force -ErrorAction SilentlyContinue }
}

# --- 71. SC06 aborts cleanup when a required service cannot be stopped ---
Test-Knoux -Name '71 SC06 aborts when a required service cannot be stopped' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot '02-System-Cleanup\SC06-CleanUpdateDownloadCache.ps1') -Raw -Encoding UTF8
    return ($c -match 'ABORTING' -and $c -match '\$allServicesStopped' -and $c -match 'Stopped = \$true' -and $c -match 'emergency')
}

# --- 72. SM09 never assigns the removed Partial status ---
Test-Knoux -Name '72 SM09 never emits a Partial session status' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot '01-System-Maintenance\SM09-ResetWindowsUpdate.ps1') -Raw -Encoding UTF8
    return ($c -notmatch "'Partial'" -and $c -notmatch '"Partial"')
}

# --- 73. SM05 builds an offline DISM source with /LimitAccess and a restore point ---
Test-Knoux -Name '73 SM05 builds offline DISM source args with /LimitAccess' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot '01-System-Maintenance\SM05-RepairSystemImage.ps1') -Raw -Encoding UTF8
    return ($c -match '/Source:' -and $c -match '/LimitAccess' -and $c -match 'New-KnouxRestorePoint' -and $c -match 'Post-repair' -and $c -match 'useOffline')
}

# --- 74. SM01 uses sfc /verifyonly with CBS evidence and an Inconclusive fallback ---
Test-Knoux -Name '74 SM01 verifies with sfc /verifyonly and CBS evidence' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot '01-System-Maintenance\SM01-VerifySystemFiles.ps1') -Raw -Encoding UTF8
    return ($c -match '/verifyonly' -and $c -match 'CBS' -and $c -match 'NO_CBS_EVIDENCE' -and $c -match 'Inconclusive')
}

# --- 75. SM02 runs a post-repair sfc /verifyonly ---
Test-Knoux -Name '75 SM02 runs a post-repair sfc /verifyonly' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot '01-System-Maintenance\SM02-RepairSystemFiles.ps1') -Raw -Encoding UTF8
    return ($c -match '/scannow' -and $c -match 'Post-repair sfc /verifyonly' -and $c -match 'New-KnouxRestorePoint' -and $c -match 'REPAIRED_VERIFIED')
}

# --- 76. Menu navigation and single-operation lock ---
Test-Knoux -Name '76 Menu offers B/H/Q/R/A navigation and an operation lock' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Menu.ps1') -Raw -Encoding UTF8
    return ($c -match 'B\. Back' -and $c -match 'H\. Home' -and $c -match 'Q\. Quit' -and
        $c -match 'R\. View recent reports' -and $c -match 'A\. Analyze-only mode' -and
        $c -match '\$script:OperationLock')
}

# --- 77. Write-KnouxResult colour-maps all six statuses ---
Test-Knoux -Name '77 Write-KnouxResult colour-maps all six statuses' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1') -Raw -Encoding UTF8
    $ok = $true
    foreach ($pair in @('Success=Green', 'Warning=Yellow', 'Failed=Red', 'Cancelled=DarkYellow', 'Skipped=Gray', 'Inconclusive=Yellow')) {
        $parts = $pair -split '='
        $pattern = [regex]::Escape("'$($parts[0])'") + '\s*=\s*' + [regex]::Escape("'$($parts[1])'")
        if ($c -notmatch $pattern) { $ok = $false }
    }
    return $ok
}

# --- 78. Arabic status map covers all six statuses ---
Test-Knoux -Name '78 Arabic status map covers all six statuses' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot 'Core\KnouxRepair.Reporting.psm1') -Raw -Encoding UTF8
    $ok = $true
    foreach ($k in @('Success', 'Warning', 'Failed', 'Cancelled', 'Skipped', 'Inconclusive')) {
        if ($c -notmatch [regex]::Escape("'$k'")) { $ok = $false }
    }
    return $ok
}

# --- 79. No tool assigns the removed Partial status to a session ---
Test-Knoux -Name '79 No tool assigns the removed Partial status' -Body {
    $bad = @($toolFiles | Where-Object {
        $c = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
        $c -match '\$Session\.Status\s*=\s*''Partial'''
    })
    return $bad.Count -eq 0
}

# --- 80. SC06 targets only SoftwareDistribution\Download ---
Test-Knoux -Name '80 SC06 cleanup target is restricted to the Download cache' -Body {
    $c = Get-Content -LiteralPath (Join-Path $ProjectRoot '02-System-Cleanup\SC06-CleanUpdateDownloadCache.ps1') -Raw -Encoding UTF8
    return ($c -match 'SoftwareDistribution\\Download' -and $c -match 'DataStore is never touched' -and $c -notmatch 'SoftwareDistribution[\\/]DataStore[\\/]')
}

# --- 81. FILE-INVENTORY.json covers every on-disk tool file ---
Test-Knoux -Name '81 FILE-INVENTORY.json covers every on-disk tool file' -Body {
    $inv = @(Get-Content -LiteralPath (Join-Path $ProjectRoot 'Docs\FILE-INVENTORY.json') -Raw -Encoding UTF8 | ConvertFrom-Json)
    if ($inv.Count -eq 1 -and $inv[0] -is [System.Array]) { $inv = @($inv[0]) }
    $invPaths = @($inv | ForEach-Object { $_.Path -replace '\\', '/' })
    $missing = @($toolFiles | ForEach-Object {
        $rel = $_.FullName.Substring($ProjectRoot.Length + 1) -replace '\\', '/'
        if ($rel -notin $invPaths) { $rel }
    })
    return $missing.Count -eq 0
}
# --- 82. NI01 degrades gracefully and honours the exit-code contract ---
Test-Knoux -Name '82 NI01 degrades gracefully without CIM data' -Body {
    $child = @'
param()
$ErrorActionPreference = 'Stop'
Import-Module '__COREMODULE__' -Force
& '__SCRIPT__'
'@
    $child = $child.Replace('__COREMODULE__', (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1'))
    $child = $child.Replace('__SCRIPT__', (Join-Path $ProjectRoot '03-Network-Internet\NI01-TestNetworkConnectivity.ps1'))
    $childPath = Join-Path $env:TEMP ('knoux-ni01-' + [guid]::NewGuid().ToString('N') + '.ps1')
    Set-Content -LiteralPath $childPath -Value $child -Encoding UTF8
    try {
        $r = Invoke-KnouxTestChild -ScriptPath $childPath
        $reportsDir = Join-Path $ProjectRoot 'Reports'
        $latest = Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like '*-NI01' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $latest) { return $false }
        $j = Get-Content -LiteralPath (Join-Path $latest.FullName 'results.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $codeMap = @{ 'Success' = 0; 'Warning' = 1; 'Failed' = 2; 'Cancelled' = 3; 'Skipped' = 4; 'Inconclusive' = 5 }
        return ($codeMap[$j.Status] -eq $j.ExitCode -and $j.Status -in @('Success', 'Warning'))
    } finally { Remove-Item -LiteralPath $childPath -Force -ErrorAction SilentlyContinue }
}

# --- 83. NI10 runs without CIM data and reports Success or Warning ---
Test-Knoux -Name '83 NI10 degrades gracefully without CIM data' -Body {
    $child = @'
param()
$ErrorActionPreference = 'Stop'
Import-Module '__COREMODULE__' -Force
& '__SCRIPT__'
'@
    $child = $child.Replace('__COREMODULE__', (Join-Path $ProjectRoot 'Core\KnouxRepair.Core.psm1'))
    $child = $child.Replace('__SCRIPT__', (Join-Path $ProjectRoot '03-Network-Internet\NI10-NetworkReport.ps1'))
    $childPath = Join-Path $env:TEMP ('knoux-ni10-' + [guid]::NewGuid().ToString('N') + '.ps1')
    Set-Content -LiteralPath $childPath -Value $child -Encoding UTF8
    try {
        $r = Invoke-KnouxTestChild -ScriptPath $childPath
        $reportsDir = Join-Path $ProjectRoot 'Reports'
        $latest = Get-ChildItem -LiteralPath $reportsDir -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like '*-NI10' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $latest) { return $false }
        $j = Get-Content -LiteralPath (Join-Path $latest.FullName 'results.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $codeMap = @{ 'Success' = 0; 'Warning' = 1; 'Failed' = 2; 'Cancelled' = 3; 'Skipped' = 4; 'Inconclusive' = 5 }
        return ($codeMap[$j.Status] -eq $j.ExitCode -and $j.Status -in @('Success', 'Warning'))
    } finally { Remove-Item -LiteralPath $childPath -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host ("Result: {0} tests, {1} failures" -f $results.Count, $failCount) -ForegroundColor $(if ($failCount -eq 0) { 'Green' } else { 'Red' })

$outFile = Join-Path $PSScriptRoot 'TEST-RESULTS.txt'
$results | Format-Table -AutoSize | Out-String | Set-Content -LiteralPath $outFile -Encoding UTF8
$summary = "knoux Repair v2.0 - Test results`nExecuted: $(Get-Date)`nTotal: $($results.Count)  Passed: $($results.Count - $failCount)  Failed: $failCount`n"
(Get-Content -LiteralPath $outFile -Raw -Encoding UTF8) | Set-Content -LiteralPath $outFile -NoNewline -Encoding UTF8
[System.IO.File]::WriteAllText($outFile, $summary + (Get-Content -LiteralPath $outFile -Raw -Encoding UTF8), [System.Text.UTF8Encoding]::new($true))
exit $failCount
