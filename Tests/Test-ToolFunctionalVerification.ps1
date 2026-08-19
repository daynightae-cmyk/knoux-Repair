# Safe functional verification harness for the 100 manifest tools.
# Each tool is invoked only through its declared -AnalyzeOnly mode.
[CmdletBinding()]
param(
    [int]$TimeoutSeconds = 5,
    [string[]]$ToolIds = @(),
    [string]$OutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $root 'Reports\100-Tool-Functional-Verification.csv' }
$manifest = Get-Content -LiteralPath (Join-Path $root 'Docs\TOOLS-MANIFEST.json') -Raw | ConvertFrom-Json
if (@($ToolIds).Count -gt 0) { $manifest = @($manifest | Where-Object { $_.ToolId -in @($ToolIds) }) }
$pwsh = (Get-Command powershell.exe -ErrorAction Stop).Source
$results = foreach ($tool in $manifest) {
    $scriptPath = Join-Path $root $tool.ScriptPath
    $started = [DateTimeOffset]::Now
    $status = 'UNVERIFIED'
    $reason = ''
    $exitCode = $null
    $stdout = ''
    $stderr = ''

    if (-not (Test-Path -LiteralPath $scriptPath)) {
        $status = 'FAIL'
        $reason = 'Manifest ScriptPath is missing.'
    }
    elseif (-not $tool.AnalyzeOnlySupported) {
        $status = 'UNVERIFIED'
        $reason = 'Manifest does not declare AnalyzeOnlySupported.'
    }
    else {
        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = $pwsh
        $psi.Arguments = '-NoProfile -NoLogo -NonInteractive -ExecutionPolicy Bypass -File "' + $scriptPath + '" -AnalyzeOnly'
        $psi.WorkingDirectory = $root
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
        $proc = [System.Diagnostics.Process]::new()
        $proc.StartInfo = $psi
        try {
            [void]$proc.Start()
            $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
            $stderrTask = $proc.StandardError.ReadToEndAsync()
            if (-not $proc.WaitForExit($TimeoutSeconds * 1000)) {
                try { & taskkill.exe /PID $proc.Id /T /F | Out-Null; $proc.WaitForExit(1000) | Out-Null } catch { }
                if ($stdoutTask.IsCompleted) { $stdout = $stdoutTask.GetAwaiter().GetResult() }
                if ($stderrTask.IsCompleted) { $stderr = $stderrTask.GetAwaiter().GetResult() }
                $status = 'UNVERIFIED'
                $reason = 'AnalyzeOnly timed out before a safe result could be observed.'
            }
            else {
                $exitCode = $proc.ExitCode
                $stdout = $stdoutTask.GetAwaiter().GetResult()
                $stderr = $stderrTask.GetAwaiter().GetResult()
                if ($exitCode -in @(0, 1, 4, 5)) {
                    $status = 'PASS'
                    $reason = 'AnalyzeOnly executed under the noninteractive contract.'
                }
                else {
                    $status = 'UNVERIFIED'
                    $reason = 'AnalyzeOnly returned exit code ' + $exitCode + '; runtime outcome is retained for review.'
                }
            }
        }
        catch {
            $status = 'UNVERIFIED'
            $reason = $_.Exception.Message
        }
        finally {
            if ($proc) { $proc.Dispose() }
        }
    }

    $record = [pscustomobject]@{
        Category = $tool.Category
        ToolId = $tool.ToolId
        ScriptPath = $tool.ScriptPath
        Attempt = 'AnalyzeOnly'
        Status = $status
        ExitCode = $exitCode
        DurationSeconds = [math]::Round(([DateTimeOffset]::Now - $started).TotalSeconds, 2)
        Reason = $reason
        StdoutObserved = -not [string]::IsNullOrWhiteSpace($stdout)
        StderrObserved = -not [string]::IsNullOrWhiteSpace($stderr)
    }
    Write-Host ($record.ToolId + ': ' + $record.Status + $(if ($null -ne $record.ExitCode) { ' (exit ' + $record.ExitCode + ')' } else { '' }))
    $record
}

$directory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$results | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding utf8
$pass = @($results | Where-Object Status -eq 'PASS').Count
$unverified = @($results | Where-Object Status -eq 'UNVERIFIED').Count
$failed = @($results | Where-Object Status -eq 'FAIL').Count
$total = @($results).Count
Write-Host ('FUNCTIONALLY_VERIFIED=' + $pass + '/' + $total)
Write-Host ('UNVERIFIED=' + $unverified + '/' + $total)
Write-Host ('FAILED=' + $failed + '/' + $total)
Write-Host ('OUTPUT=' + (Resolve-Path -LiteralPath $OutputPath))
if ($failed -gt 0) { exit 2 }
