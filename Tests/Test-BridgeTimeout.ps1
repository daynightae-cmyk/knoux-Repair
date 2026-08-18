#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WebRoot = Join-Path $ProjectRoot 'web-frontend'
$Port = 8792
$BaseUrl = "http://127.0.0.1:$Port/api"
$node = $null
try {
    $env:KNOUX_BRIDGE_TEST_MODE = '1'
    $env:KNOUX_BRIDGE_TEST_TIMEOUT_MS = '750'
    $env:KNOUX_BRIDGE_PORT = [string]$Port
    $node = Start-Process -FilePath (Get-Command node.exe -ErrorAction Stop).Source -ArgumentList 'server/bridge.mjs' -WorkingDirectory $WebRoot -PassThru -WindowStyle Hidden
    $health = $null
    for ($i = 0; $i -lt 40; $i++) { try { $health = Invoke-RestMethod "$BaseUrl/health" -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 250 } }
    if ($null -eq $health) { throw 'Bridge test mode did not become healthy.' }
    $start = Invoke-RestMethod "$BaseUrl/runs" -Method Post -ContentType 'application/json' -Body '{"toolId":"__KNOUX_TEST_TIMEOUT__"}' -TimeoutSec 8
    $run = $null
    for ($i = 0; $i -lt 40; $i++) { $state = Invoke-RestMethod "$BaseUrl/runs/$($start.runId)" -TimeoutSec 5; if ($state.run.status -ne 'running') { $run = $state.run; break }; Start-Sleep -Milliseconds 250 }
    if ($null -eq $run) { throw 'Timeout probe did not reach a terminal state.' }
    $orphanCount = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match ('knoux-bridge-timeout-' + $node.Id + '\.ps1') }).Count
    $diagnostic = @($run.lines | Where-Object { $_.s -eq 'err' -and $_.text -match 'Execution timed out after 750ms' }).Count
    if ($run.status -ne 'error' -or $run.exitCode -ne -1 -or $run.error -notmatch '750ms' -or $diagnostic -lt 1 -or $orphanCount -ne 0) { throw ('Timeout contract failed. status=' + $run.status + ' exit=' + $run.exitCode + ' error=' + $run.error + ' diagnostic=' + $diagnostic + ' orphans=' + $orphanCount) }
    Write-Host ('[PASS] Bridge timeout probe: ' + $start.runId)
    exit 0
} finally {
    if ($node) { try { & taskkill.exe /PID $node.Id /T /F 2>&1 | Out-Null } catch { } }
    Remove-Item Env:KNOUX_BRIDGE_TEST_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:KNOUX_BRIDGE_TEST_TIMEOUT_MS -ErrorAction SilentlyContinue
    Remove-Item Env:KNOUX_BRIDGE_PORT -ErrorAction SilentlyContinue
}
