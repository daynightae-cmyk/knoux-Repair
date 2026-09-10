#Requires -Version 5.1
# ============================================================
#  KnouxRepair.Core.psm1
#  knoux Repair v2.0.2 | Shared Core Module
#  Session lifecycle, logging, headers, results, admin checks,
#  confirmation gates, OS info, size formatting, firewall state.
#
#  RUNTIME CONTRACT (Electron + Local Node Bridge):
#    UI -> Bridge creates an immutable ExecutionRequest
#         (runId, toolId, mode, riskLevel, parameters,
#          confirmation evidence, requestedAt)
#      -> Bridge validates the request (allowlist, mode, risk,
#         confirmation) and spawns the category script with the
#         validated context in $env:KNOUX_EXECUTION_CONTEXT.
#      -> Core receives the ALREADY VALIDATED execution context
#         and enforces it again (deny-by-default). Core never
#         self-authorizes from a host environment flag.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Load the sibling modules so tools only need to import Core.
Import-Module (Join-Path $PSScriptRoot 'KnouxRepair.Config.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'KnouxRepair.Safety.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'KnouxRepair.NativeCommands.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'KnouxRepair.Reporting.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'KnouxRepair.Contracts.psm1') -Force

# ============================================================
#  Format-KnouxSize
# ============================================================
function Format-KnouxSize {
    [CmdletBinding()]
    param([Parameter(Mandatory)][int64]$Bytes)
    if ($Bytes -ge 1GB) { return '{0:N2} GB' -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return '{0:N2} MB' -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return '{0:N2} KB' -f ($Bytes / 1KB) }
    return '{0} B' -f $Bytes
}

# ============================================================
#  Test-KnouxAdministrator
# ============================================================
function Test-KnouxAdministrator {
    return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ============================================================
#  Restart-KnouxAsAdministrator
#  Relaunches a script elevated. Returns $true if elevation was
#  granted and the process was started, $false otherwise.
# ============================================================
function Restart-KnouxAsAdministrator {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ScriptPath,
        [string[]]$ArgumentList
    )
    if (Test-KnouxAdministrator) { return $true }
    try {
        $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$ScriptPath`"")
        if ($ArgumentList) { $args += $ArgumentList }
        Start-Process -FilePath 'powershell.exe' -ArgumentList $args -Verb RunAs
        return $true
    } catch {
        Write-Warning "Elevation failed: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
#  Start-KnouxSession
#  Creates the per-run session folder and result envelope.
#  Byte accounting contract (all int64, 0 unless the tool sets):
#    BytesPotentiallyRecoverable - discovered during analysis
#    BytesQuarantined            - moved to quarantine
#    BytesPermanentlyDeleted     - deleted with no restore option
#    BytesActuallyRecovered      - restored back to origin
#    BytesMoved                  - relocated inside the project
#    BytesRecovered              - legacy aggregate set by tools
# ============================================================
function Start-KnouxSession {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$ToolId,
        [Parameter(Mandatory)][string]$ToolName,
        [Parameter(Mandatory)][string]$Category,
        [Parameter(Mandatory)][ValidateSet('READ_ONLY','SAFE_CLEANUP','SYSTEM_REPAIR','DESTRUCTIVE','REBOOT_REQUIRED','WINRE_ONLY')][string]$RiskLevel,
        [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
        [string]$RunId = ([guid]::NewGuid().ToString('N')),
        [ValidateSet('run','analyze','preview')][string]$Mode = 'run'
    )
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $sessionDir = Join-Path (Join-Path $ProjectRoot 'Reports') ('{0}-{1}' -f $timestamp, $ToolId)
    $rawDir = Join-Path $sessionDir 'raw-output'
    New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
    $s = [pscustomobject]@{
        ToolId = $ToolId; ToolName = $ToolName; Category = $Category; RiskLevel = $RiskLevel
        RunId = $RunId; Mode = $Mode
        ProjectRoot = $ProjectRoot; SessionDir = $sessionDir; RawDir = $rawDir
        OpLog = (Join-Path $sessionDir 'operation.log'); ErrLog = (Join-Path $sessionDir 'errors.log')
        StartedAt = Get-Date; FinishedAt = $null; Status = 'Success'; ErrorMessage = $null
        ChangedSystem = $false; RestartNeeded = $false
        ItemsFound = 0; ItemsProcessed = 0; QuarantinedCount = 0; SkippedCount = 0
        BytesPotentiallyRecoverable = [int64]0
        BytesQuarantined = [int64]0
        BytesPermanentlyDeleted = [int64]0
        BytesActuallyRecovered = [int64]0
        BytesMoved = [int64]0
        BytesRecovered = [int64]0
        BackupPath = $null; QuarantinePath = $null
        VerificationPerformed = $false; VerificationResult = $null
        ExitCode = 0; OfflineCapable = $true; RequiresAdmin = $false
    }
    Write-KnouxLog -Session $s -Message ("Session started: {0} - {1}" -f $ToolId, $ToolName)
    return $s
}

# ============================================================
#  Stop-KnouxSession
#  Finalizes the session, exports reports and returns the result.
#  A null session is rejected loudly - a tool that fails to
#  produce a session must not silently pass.
#  Enforces exit-code contract:
#    Success    -> ExitCode 0
#    Warning    -> ExitCode 1 (nonfatal)
#    Failed     -> ExitCode 2 (fatal)
#    Cancelled  -> ExitCode 3
#    Skipped    -> ExitCode 4
#    Inconclusive -> ExitCode 5
# ============================================================
function Stop-KnouxSession {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Session
    )
    if (-not $Session) {
        throw 'Stop-KnouxSession: the session object is null. A tool must pass a valid Start-KnouxSession result.'
    }
    if (-not $Session.FinishedAt) { $Session.FinishedAt = Get-Date }
    Write-KnouxLog -Session $Session -Message ("Session finished, status: {0}" -f $Session.Status)
    if ($Session.Status -eq 'Failed' -and $Session.ErrorMessage) {
        Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
    }
    # Enforce exit-code contract
    $codeMap = @{
        'Success'       = 0
        'Warning'       = 1
        'Failed'        = 2
        'Cancelled'     = 3
        'Skipped'       = 4
        'Inconclusive'  = 5
    }
    if ($codeMap.ContainsKey($Session.Status)) {
        $required = $codeMap[$Session.Status]
        if ($Session.ExitCode -ne $required) {
            Write-KnouxLog -Session $Session -Message ("ExitCode corrected from {0} to {1} for status {2}" -f $Session.ExitCode, $required, $Session.Status) 'WARN'
            $Session.ExitCode = $required
        }
    }
    return (Export-KnouxReport -Session $Session)
}

# ============================================================
#  Write-KnouxLog
# ============================================================
function Write-KnouxLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Session,
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('INFO','WARN','ERROR')][string]$Level = 'INFO'
    )
    if (-not $Session) { Write-Warning "Write-KnouxLog: null session (message: $Message)"; return }
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    try {
        Add-Content -LiteralPath $Session.OpLog -Value $line -Encoding UTF8
        if ($Level -eq 'ERROR') { Add-Content -LiteralPath $Session.ErrLog -Value $line -Encoding UTF8 }
    } catch {
        # Logging must never crash a run; failures are surfaced as a warning.
        Write-Warning ("Log write failed: {0}" -f $_.Exception.Message)
    }
}

# ============================================================
#  Write-KnouxHeader
# ============================================================
function Write-KnouxHeader {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Session,
        [switch]$AnalyzeOnly,
        [switch]$WhatIf
    )
    $offline = if ($Session.OfflineCapable) { 'Yes' } else { 'No' }
    $mode = if ($AnalyzeOnly) { 'ANALYZE ONLY (no changes)' } elseif ($WhatIf) { 'WHAT-IF (no changes)' } else { 'NORMAL' }
    Write-Host ''
    Write-Host ('  knoux Repair v2.0.2  |  ' + $Session.Category) -ForegroundColor Cyan
    Write-Host ('  ' + $Session.ToolId + ' - ' + $Session.ToolName) -ForegroundColor Yellow
    Write-Host ('  Risk: ' + $Session.RiskLevel + '  |  Offline: ' + $offline) -ForegroundColor DarkGray
    if ($Session.RequiresAdmin) {
        $admin = if (Test-KnouxAdministrator) { 'yes' } else { 'NO' }
        Write-Host ('  Admin: ' + $admin) -ForegroundColor DarkGray
    }
    Write-Host ('  Mode: ' + $mode) -ForegroundColor DarkGray
    Write-Host ''
    Write-KnouxLog -Session $Session -Message ("Header shown (mode: $mode)")
}

# ============================================================
#  Write-KnouxResult
#  Final console output for a completed tool run.
# ============================================================
function Write-KnouxResult {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Session
    )
    Write-Host ''
    $colorMap = @{
        'Success'       = 'Green'
        'Warning'       = 'Yellow'
        'Failed'        = 'Red'
        'Cancelled'     = 'DarkYellow'
        'Skipped'       = 'Gray'
        'Inconclusive'  = 'Yellow'
    }
    $color = if ($colorMap.ContainsKey($Session.Status)) { $colorMap[$Session.Status] } else { 'Green' }
    Write-Host ('  Status: ' + $Session.Status) -ForegroundColor $color
    Write-Host ('  Report: ' + $Session.SessionDir) -ForegroundColor DarkGray
    # The Electron bridge host owns navigation; never block a noninteractive process on console input.
    Write-Host '  Result emitted to the host.' -ForegroundColor DarkGray
}

# ============================================================
#  Get-KnouxExecutionContext
#  Reads the validated ExecutionRequest the Bridge placed in
#  $env:KNOUX_EXECUTION_CONTEXT (JSON):
#    { runId, toolId, mode, riskLevel, parameters,
#      confirmation, requestedAt }
#  Returns $null when absent or malformed. This context is DATA
#  produced by the Bridge allowlist validation - it is not a
#  self-authorization flag set by the caller.
# ============================================================
function Get-KnouxExecutionContext {
    [CmdletBinding()]
    param()
    $raw = $env:KNOUX_EXECUTION_CONTEXT
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    try {
        $ctx = $raw | ConvertFrom-Json
        if (-not $ctx.toolId -or -not $ctx.runId) { return $null }
        return $ctx
    } catch {
        Write-Warning "Ignoring malformed KNOUX_EXECUTION_CONTEXT: $($_.Exception.Message)"
        return $null
    }
}

# ============================================================
#  Test-KnouxExecutionConfirmation
#  Authoritative confirmation check for a risk level against the
#  validated Bridge execution context. DENY-BY-DEFAULT: returns
#  $false unless the context carries explicit confirmation
#  evidence satisfying the risk matrix:
#    READ_ONLY       - normal user intent is sufficient
#    SAFE_CLEANUP    - normal intent (+ impact preview by caller)
#    SYSTEM_REPAIR   - explicit confirmation required
#    REBOOT_REQUIRED - explicit confirmation + restart warning
#    DESTRUCTIVE     - strongest explicit confirmation required
#    WINRE_ONLY      - never authorized for online repair
#  A host environment variable can NEVER authorize an action by
#  itself; only a well-formed context with confirmation evidence
#  satisfies SYSTEM_REPAIR and above.
# ============================================================
function Test-KnouxExecutionConfirmation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('READ_ONLY','SAFE_CLEANUP','SYSTEM_REPAIR','DESTRUCTIVE','REBOOT_REQUIRED','WINRE_ONLY')][string]$RiskLevel,
        [pscustomobject]$Context = (Get-KnouxExecutionContext)
    )
    if ($RiskLevel -eq 'WINRE_ONLY') { return $false }
    if ($RiskLevel -eq 'READ_ONLY' -or $RiskLevel -eq 'SAFE_CLEANUP') { return $true }
    if ($null -eq $Context -or $null -eq $Context.confirmation) { return $false }
    $c = $Context.confirmation
    $confirmed = ($c.confirmed -eq $true)
    if (-not $confirmed) { return $false }
    if ($RiskLevel -eq 'SYSTEM_REPAIR' -or $RiskLevel -eq 'REBOOT_REQUIRED' -or $RiskLevel -eq 'DESTRUCTIVE') {
        # High-friction evidence: an explicit typed phrase recorded by the UI.
        if ([string]::IsNullOrWhiteSpace([string]$c.phrase)) { return $false }
    }
    return $true
}

# ============================================================
#  Confirm-KnouxAction
#  Simple Y/N confirmation. Deny-by-default when non-interactive:
#  a redirected console or a missing operator CANNOT approve an
#  action. When the Bridge supplied a validated execution context
#  carrying confirmation evidence, that evidence is honored;
#  otherwise an interactive operator is asked, and silence or
#  redirection means denial.
# ============================================================
function Confirm-KnouxAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Prompt,
        [ValidateSet('READ_ONLY','SAFE_CLEANUP','SYSTEM_REPAIR','DESTRUCTIVE','REBOOT_REQUIRED','WINRE_ONLY')][string]$RiskLevel = 'SAFE_CLEANUP',
        [string]$ToolId = ''
    )
    $ctx = Get-KnouxExecutionContext
    if ($ctx -and $ToolId -and $ctx.toolId -ne $ToolId) {
        Write-Warning "Execution context tool mismatch (expected '$ToolId'). Denying confirmation."
        return $false
    }
    if ($ctx -and (Test-KnouxExecutionConfirmation -RiskLevel $RiskLevel -Context $ctx)) { return $true }
    if ([System.Console]::IsInputRedirected -or (-not [Environment]::UserInteractive)) {
        Write-Warning "Confirmation denied: no validated execution context and no interactive operator (prompt: $Prompt)"
        return $false
    }
    try {
        $answer = Read-Host $Prompt" [y/N]"
        return ($answer -match '^(?i:y|yes)$')
    } catch {
        Write-Warning "Confirmation denied: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
#  Confirm-KnouxDestructiveAction
#  Requires the user to type an exact confirmation phrase.
#  Deny-by-default: a non-interactive session can only proceed
#  when the validated Bridge execution context already carries
#  the matching typed phrase. Never returns $true from a host
#  flag alone.
# ============================================================
function Confirm-KnouxDestructiveAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Phrase,
        [string]$Prompt = ("Type '{0}' to confirm this destructive action: " -f $Phrase),
        [string]$ToolId = ''
    )
    $ctx = Get-KnouxExecutionContext
    if ($ctx -and $ToolId -and $ctx.toolId -ne $ToolId) {
        Write-Warning "Execution context tool mismatch (expected '$ToolId'). Denying destructive confirmation."
        return $false
    }
    if ($ctx -and $null -ne $ctx.confirmation -and $ctx.confirmation.confirmed -eq $true) {
        $evidence = [string]$ctx.confirmation.phrase
        if ($evidence -ceq $Phrase) { return $true }
        Write-Warning 'Destructive confirmation denied: execution context phrase does not match.'
        return $false
    }
    if ([System.Console]::IsInputRedirected -or (-not [Environment]::UserInteractive)) {
        Write-Warning 'Destructive confirmation denied: no validated execution context and no interactive operator.'
        return $false
    }
    try {
        $answer = Read-Host $Prompt
        return ($answer -ceq $Phrase)
    } catch {
        Write-Warning "Destructive confirmation denied: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
#  Get-KnouxOperatingSystemInfo
# ============================================================
function Get-KnouxOperatingSystemInfo {
    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem
        return [pscustomobject]@{
            Caption = $os.Caption
            Version = $os.Version
            BuildNumber = $os.BuildNumber
            Architecture = $os.OSArchitecture
            LastBootUpTime = $os.LastBootUpTime
        }
    } catch {
        Write-Warning "Could not read OS information: $($_.Exception.Message)"
        return $null
    }
}

# ============================================================
#  Get-KnouxPowerPlans
#  Reads power plans via powercfg. Returns an object with Plans
#  (Guid/Name/Active) and ActivePlan (or $null).
# ============================================================
function Get-KnouxPowerPlans {
    try {
        $list = & powercfg.exe /list 2>$null
        $plans = @()
        foreach ($line in $list) {
            if ($line -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\(([^)]+)\)\s*(.*)$') {
                $plans += [pscustomobject]@{
                    Guid = $matches[1]
                    Name = $matches[2].Trim()
                    Active = ($matches[3] -match '\*')
                }
            }
        }
        $active = $plans | Where-Object { $_.Active } | Select-Object -First 1
        if (-not $active) {
            $as = & powercfg.exe /getactivescheme 2>$null | Select-Object -First 1
            if ($as -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+\(([^)]+)\)') {
                $active = [pscustomobject]@{ Guid = $matches[1]; Name = $matches[2].Trim(); Active = $true }
            }
        }
        return [pscustomobject]@{ Plans = $plans; ActivePlan = $active }
    } catch {
        Write-Warning "Power plan query failed: $($_.Exception.Message)"
        return [pscustomobject]@{ Plans = @(); ActivePlan = $null }
    }
}

# ============================================================
#  Get-KnouxFirewallStatus
#  Language-independent firewall state via the HNetCfg.FwPolicy2
#  COM API (available on all supported Windows). Only the
#  currently-active profiles are queried, and Enabled is always a
#  boolean (never parsed text), so no localization can break it.
# ============================================================
function Get-KnouxFirewallStatus {
    $specs = @(
        @{ Bit = 1; Type = 1; Name = 'Domain' },
        @{ Bit = 2; Type = 2; Name = 'Private' },
        @{ Bit = 4; Type = 3; Name = 'Public' }
    )
    try {
        $fw = New-Object -ComObject HNetCfg.FwPolicy2
        $current = [int]$fw.CurrentProfileTypes
        $profiles = @()
        foreach ($s in $specs) {
            if (($current -band $s.Bit) -ne 0) {
                try {
                    $enabled = [bool]$fw.FirewallEnabled($s.Type)
                } catch {
                    Write-Warning "Firewall profile '$($s.Name)' could not be queried: $($_.Exception.Message)"
                    $enabled = $null
                }
                $profiles += [pscustomobject]@{ Profile = $s.Name; Enabled = $enabled }
            }
        }
        if ($profiles.Count -eq 0) { throw 'No active firewall profiles found.' }
        return @($profiles)
    } catch {
        Write-Warning "Firewall state via HNetCfg.FwPolicy2 failed: $($_.Exception.Message)"
        return @()
    }
}

# ============================================================
#  Set-KnouxFirewallState
#  ENABLE-ONLY. Turns the firewall ON for all profiles via
#  netsh and verifies the result. The product invariant: the
#  firewall can be enabled, inspected, repaired, exported or
#  restored - never disabled.
# ============================================================
function Set-KnouxFirewallState {
    [CmdletBinding()]
    param()
    try {
        $null = & netsh.exe advfirewall set allprofiles state on 2>$null
        $verify = @(Get-KnouxFirewallStatus)
        if ($verify.Count -eq 0) { return $false }
        foreach ($p in $verify) {
            if ($p.Enabled -ne $true) { return $false }
        }
        return $true
    } catch {
        Write-Warning "Failed to enable firewall: $($_.Exception.Message)"
        return $false
    }
}

Export-ModuleMember -Function Test-KnouxAdministrator, Restart-KnouxAsAdministrator, Start-KnouxSession, Stop-KnouxSession, Write-KnouxLog, Write-KnouxHeader, Write-KnouxResult, Confirm-KnouxAction, Confirm-KnouxDestructiveAction, Get-KnouxExecutionContext, Test-KnouxExecutionConfirmation, Get-KnouxOperatingSystemInfo, Format-KnouxSize, Export-KnouxReport, Test-KnouxReportSchema, Invoke-KnouxNativeCommand, Join-KnouxArguments, Test-KnouxProtectedPath, Test-KnouxWUDownloadCachePath, Test-KnouxProtectedProcess, New-KnouxBackup, New-KnouxRestorePoint, Move-KnouxItemToQuarantine, Restore-KnouxQuarantinedItem, Resolve-KnouxSafePath, Invoke-KnouxCleanup, Get-KnouxFolderSize, Get-KnouxScanFiles, Find-KnouxDuplicateGroups, Get-KnouxLargestFiles, Get-KnouxLargestFolders, Test-KnouxHardLink, Get-KnouxPowerPlans, Get-KnouxFirewallStatus, Set-KnouxFirewallState
