[CmdletBinding()]
param(
    [string]$ProjectRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$webFrontend = Join-Path $ProjectRoot 'web-frontend'
$releaseDir = Join-Path $ProjectRoot 'Release\Glass-Nexus'

Write-Host '===================================================' -ForegroundColor Cyan
Write-Host '  KNOUX Repair — Building Windows Desktop Installer' -ForegroundColor Cyan
Write-Host '===================================================' -ForegroundColor Cyan

$npm = (Get-Command npm -ErrorAction Stop).Source

Write-Host '[1/3] Building web frontend and server bundle...' -ForegroundColor Cyan
& $npm --prefix $webFrontend run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE." }

Write-Host '[2/3] Packaging Electron Windows NSIS installer...' -ForegroundColor Cyan
& $npm --prefix $webFrontend run desktop:package
if ($LASTEXITCODE -ne 0) { throw "electron-builder packaging failed with exit code $LASTEXITCODE." }

Write-Host '[3/3] Validating installer metadata and SHA256...' -ForegroundColor Cyan
$expectedInstaller = Join-Path $releaseDir 'KNOUX-Repair-Glass-Nexus-Setup-2.0.2.exe'
if (-not (Test-Path -LiteralPath $expectedInstaller -PathType Leaf)) {
    $found = Get-ChildItem -Path $releaseDir -Filter *.exe | Select-Object -First 1
    if ($null -ne $found) {
        $expectedInstaller = $found.FullName
    } else {
        throw "Windows installer was not found in: $releaseDir"
    }
}

$installerInfo = Get-Item -LiteralPath $expectedInstaller
$hash = (Get-FileHash -LiteralPath $expectedInstaller -Algorithm SHA256).Hash
$hashFile = $expectedInstaller + '.sha256'
Set-Content -LiteralPath $hashFile -Value ($hash + '  ' + $installerInfo.Name) -Encoding Ascii

Write-Host ''
Write-Host 'KNOUX Repair Windows Desktop Installer successfully built.' -ForegroundColor Green
Write-Host ('ARTIFACT=' + $expectedInstaller)
Write-Host ('BYTES=' + $installerInfo.Length)
Write-Host ('SHA256=' + $hash)
Write-Host ('SHA256_FILE=' + $hashFile)

