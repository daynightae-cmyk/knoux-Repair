#Requires -Version 5.1
# ============================================================
#  KnouxRepair.NativeCommands.psm1
#  knoux Repair v2.0.2 | Controlled native command execution
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ============================================================
#  Join-KnouxArguments
#  Quotes each argument for CommandLineToArgvW-style parsing.
#  Works on Windows PowerShell 5.1 and PowerShell 7+.
# ============================================================
function Join-KnouxArguments {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string[]]$Arguments)
    $sb = New-Object System.Text.StringBuilder
    foreach ($a in $Arguments) {
        if ($sb.Length -gt 0) { [void]$sb.Append(' ') }
        [void]$sb.Append('"')
        [void]$sb.Append($a.Replace('"', '""'))
        [void]$sb.Append('"')
    }
    return $sb.ToString()
}

# ============================================================
#  Invoke-KnouxNativeCommand
#  Runs a native executable with full capture:
#  executable, arguments, start/end time, exit code, stdout,
#  stderr, timeout state and optional post-condition check.
#  Never relies solely on $LASTEXITCODE.
# ============================================================
function Invoke-KnouxNativeCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$ArgumentList,
        [int]$TimeoutSeconds = 300,
        [string]$WorkingDirectory,
        [hashtable]$Environment,
        [scriptblock]$PostCondition,
        [switch]$ThrowOnError
    )
    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "Executable not found: $FilePath"
    }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    if ($ArgumentList) { $psi.Arguments = Join-KnouxArguments -Arguments $ArgumentList }
    if ($WorkingDirectory) { $psi.WorkingDirectory = $WorkingDirectory }
    if ($Environment) { foreach ($k in $Environment.Keys) { $psi.Environment[$k] = [string]$Environment[$k] } }

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi

    $started = Get-Date
    try {
        if (-not $proc.Start()) { throw "Failed to start process: $FilePath" }
        $outTask = $proc.StandardOutput.ReadToEndAsync()
        $errTask = $proc.StandardError.ReadToEndAsync()
        $timedOut = $false
        if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
            $timedOut = $true
            try { $proc.Kill() } catch { Write-Warning "Failed to kill timed-out process '$FilePath': $($_.Exception.Message)" }
            $proc.WaitForExit()
        }
        $outText = $outTask.Result
        $errText = $errTask.Result
    } catch {
        if ($ThrowOnError) { throw } else { return $null }
    }
    $finished = Get-Date

    $exitCode = $proc.ExitCode
    if (-not $outText) { $outText = '' }
    if (-not $errText) { $errText = '' }
    $outText = $outText.TrimEnd()
    $errText = $errText.TrimEnd()
    $postOk = $null
    if ($PostCondition) {
        try { $postOk = [bool](& $PostCondition) } catch { $postOk = $false }
    }

    $record = [pscustomobject]@{
        Executable = $FilePath
        Arguments = if ($ArgumentList) { $ArgumentList -join ' ' } else { '' }
        StartedAt = $started.ToString('s')
        FinishedAt = $finished.ToString('s')
        Duration = ($finished - $started).ToString('g')
        ExitCode = $exitCode
        Stdout = $outText
        Stderr = $errText
        TimedOut = $timedOut
        PostConditionSatisfied = $postOk
        Success = (($exitCode -eq 0) -and (-not $timedOut))
    }
    if ($ThrowOnError -and -not $record.Success) {
        throw "Command failed: $FilePath $($record.Arguments) (exit $exitCode)"
    }
    return $record
}

Export-ModuleMember -Function Invoke-KnouxNativeCommand, Join-KnouxArguments
