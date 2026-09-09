#Requires -Version 5.1
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServerPath = Join-Path $ProjectRoot 'web-frontend\dist\server.cjs'
if (-not (Test-Path -LiteralPath $ServerPath)) {
    throw "Built web gateway not found: $ServerPath"
}

$Node = (Get-Command node -ErrorAction Stop).Source
$GatewayPort = 3099
$BridgePort = 8799
$GatewayOrigin = "http://127.0.0.1:$GatewayPort"
$stdout = Join-Path $env:TEMP 'knoux-web-gateway-smoke.stdout.log'
$stderr = Join-Path $env:TEMP 'knoux-web-gateway-smoke.stderr.log'
Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue

$previous = @{
    PORT = $env:PORT
    KNOUX_BRIDGE_PORT = $env:KNOUX_BRIDGE_PORT
    KNOUX_PROJECT_ROOT = $env:KNOUX_PROJECT_ROOT
    KNOUX_DATA_ROOT = $env:KNOUX_DATA_ROOT
    KNOUX_AUTH_REQUIRED = $env:KNOUX_AUTH_REQUIRED
}

$process = $null
try {
    $env:PORT = [string]$GatewayPort
    $env:KNOUX_BRIDGE_PORT = [string]$BridgePort
    $env:KNOUX_PROJECT_ROOT = $ProjectRoot
    $env:KNOUX_DATA_ROOT = $ProjectRoot
    $env:KNOUX_AUTH_REQUIRED = 'false'

    $process = Start-Process -FilePath $Node -ArgumentList @($ServerPath) -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr

    $health = $null
    $lastError = $null
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($process.HasExited) {
            $outText = if (Test-Path $stdout) { Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue } else { '' }
            $errText = if (Test-Path $stderr) { Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue } else { '' }
            throw "Web gateway exited early with code $($process.ExitCode). stdout=$outText stderr=$errText"
        }
        try {
            $health = Invoke-RestMethod -Uri "$GatewayOrigin/api/health" -Method Get -TimeoutSec 2
            if ($null -ne $health -and $health.ok -eq $true) { break }
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 500
    }

    if ($null -eq $health -or $health.ok -ne $true) {
        throw "Gateway health endpoint did not become ready. Last error: $lastError"
    }
    if ([string]$health.bridge -ne 'knoux-bridge') {
        throw "Health response did not originate from the real bridge. bridge=$($health.bridge)"
    }
    if ([int]$health.tools -le 0) {
        throw "Real bridge reported no registered tools. tools=$($health.tools)"
    }

    $apiResponse = Invoke-WebRequest -Uri "$GatewayOrigin/api/health" -Method Get -TimeoutSec 5 -UseBasicParsing
    if ([string]$apiResponse.Headers['X-Content-Type-Options'] -ne 'nosniff') {
        throw 'Gateway API response is missing X-Content-Type-Options: nosniff.'
    }

    $page = Invoke-WebRequest -Uri "$GatewayOrigin/" -Method Get -TimeoutSec 5 -UseBasicParsing
    $csp = [string]$page.Headers['Content-Security-Policy']
    if ([string]::IsNullOrWhiteSpace($csp) -or $csp -notmatch "default-src 'self'") {
        throw 'Production gateway page is missing the expected Content-Security-Policy.'
    }

    Write-Host ("[PASS] Web gateway -> real bridge smoke verified. tools={0}; gateway={1}; bridgePort={2}" -f $health.tools, $GatewayOrigin, $BridgePort) -ForegroundColor Green
}
finally {
    if ($null -ne $process -and -not $process.HasExited) {
        & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
    }

    foreach ($key in $previous.Keys) {
        $value = $previous[$key]
        if ($null -eq $value) {
            Remove-Item "Env:$key" -ErrorAction SilentlyContinue
        } else {
            Set-Item "Env:$key" -Value $value
        }
    }
}
