#Requires -Version 5.1
# ============================================================
#  KnouxRepair.Contracts.psm1
#  knoux Repair v2.0.2 | Standard tool / execution / result contracts
#
#  The Core is SHARED. Categories must not duplicate Safety,
#  Reporting, or execution logic - they consume these contracts.
#
#  Execution states (never collapse Inconclusive into Success):
#    IDLE, PREPARING, WAITING_FOR_CONFIRMATION, WAITING_FOR_ELEVATION,
#    RUNNING, VERIFYING, SUCCESS, WARNING, FAILED, CANCELLED,
#    SKIPPED, INCONCLUSIVE
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ExecutionStates = @(
    'IDLE', 'PREPARING', 'WAITING_FOR_CONFIRMATION', 'WAITING_FOR_ELEVATION',
    'RUNNING', 'VERIFYING', 'SUCCESS', 'WARNING', 'FAILED', 'CANCELLED',
    'SKIPPED', 'INCONCLUSIVE'
)

$script:RiskLevels = @(
    'READ_ONLY', 'SAFE_CLEANUP', 'SYSTEM_REPAIR',
    'DESTRUCTIVE', 'REBOOT_REQUIRED', 'WINRE_ONLY'
)

$script:ExecutionModes = @('run', 'analyze', 'preview')

# ============================================================
#  New-KnouxExecutionRequest
#  Builds the immutable ExecutionRequest envelope. Unknown data
#  stays $null - values are never invented.
# ============================================================
function New-KnouxExecutionRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$RunId,
        [Parameter(Mandatory)][string]$ToolId,
        [ValidateSet('run', 'analyze', 'preview')][string]$Mode = 'run',
        [hashtable]$Parameters,
        [hashtable]$Confirmation
    )
    return [pscustomobject]@{
        runId        = $RunId
        toolId       = $ToolId
        mode         = $Mode
        parameters   = $Parameters
        confirmation = $Confirmation
        requestedAt  = (Get-Date).ToString('s')
    }
}

# ============================================================
#  Test-KnouxExecutionRequest
#  Validates an ExecutionRequest against the risk matrix.
#  Returns @{ Valid; ErrorCode; ErrorMessage }.
# ============================================================
function Test-KnouxExecutionRequest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$Request,
        [Parameter(Mandatory)][string]$RiskLevel
    )
    $fail = { param($code, $msg) return @{ Valid = $false; ErrorCode = $code; ErrorMessage = $msg } }
    if (-not $Request.runId) { return (& $fail 'INVALID_REQUEST' 'Execution request is missing runId.') }
    if (-not $Request.toolId) { return (& $fail 'INVALID_REQUEST' 'Execution request is missing toolId.') }
    if ($script:ExecutionModes -notcontains $Request.mode) {
        return (& $fail 'MODE_NOT_SUPPORTED' ("Unsupported execution mode '{0}'." -f $Request.mode))
    }
    if ($script:RiskLevels -notcontains $RiskLevel) {
        return (& $fail 'UNKNOWN_RISK' ("Unknown risk level '{0}'." -f $RiskLevel))
    }
    if ($RiskLevel -eq 'WINRE_ONLY') {
        return (& $fail 'WINRE_ONLY_ONLINE_BLOCKED' 'This tool requires WinRE and must not execute as a normal online repair.')
    }
    $c = $Request.confirmation
    $confirmed = ($null -ne $c -and $c.confirmed -eq $true)
    switch ($RiskLevel) {
        'READ_ONLY' { }
        'SAFE_CLEANUP' { }
        default {
            if (-not $confirmed) {
                return (& $fail 'CONFIRMATION_REQUIRED' ("Risk level '{0}' requires explicit confirmation." -f $RiskLevel))
            }
            if ([string]::IsNullOrWhiteSpace([string]$c.phrase)) {
                return (& $fail 'CONFIRMATION_PHRASE_REQUIRED' ("Risk level '{0}' requires a typed confirmation phrase." -f $RiskLevel))
            }
        }
    }
    return @{ Valid = $true; ErrorCode = $null; ErrorMessage = $null }
}

# ============================================================
#  New-KnouxResultObject
#  Normalized structured result consumed by the Electron UI.
#  Unknown data is $null - never invented.
# ============================================================
function New-KnouxResultObject {
    [CmdletBinding()]
    param(
        [string]$RunId = $null,
        [string]$ToolId = $null,
        [string]$Category = $null,
        [string]$Status = 'Inconclusive',
        [string]$Mode = $null
    )
    if ($script:ExecutionStates -notcontains $Status) { $Status = 'INCONCLUSIVE' }
    return [pscustomobject]@{
        runId                        = $RunId
        toolId                       = $ToolId
        category                     = $Category
        mode                         = $Mode
        status                       = $Status.ToUpperInvariant()
        startedAt                    = $null
        finishedAt                   = $null
        durationMs                   = $null
        changedSystem                = $null
        restartNeeded                = $null
        itemsFound                   = $null
        itemsProcessed               = $null
        skippedCount                 = $null
        quarantinedCount             = $null
        bytesPotentiallyRecoverable  = $null
        bytesQuarantined             = $null
        bytesPermanentlyDeleted      = $null
        bytesActuallyRecovered       = $null
        bytesMoved                   = $null
        backupPath                   = $null
        quarantinePath               = $null
        verificationPerformed        = $null
        verificationResult           = $null
        exitCode                     = $null
        errorCode                    = $null
        errorMessage                 = $null
        evidence                     = $null
        rawOutput                    = $null
        reportPath                   = $null
    }
}

# ============================================================
#  Test-KnouxExecutionState
#  $true only for the canonical execution states.
#  INCONCLUSIVE is a first-class terminal state.
# ============================================================
function Test-KnouxExecutionState {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$State)
    return ($script:ExecutionStates -contains $State.ToUpperInvariant())
}

Export-ModuleMember -Function New-KnouxExecutionRequest, Test-KnouxExecutionRequest, New-KnouxResultObject, Test-KnouxExecutionState
