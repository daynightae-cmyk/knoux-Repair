[CmdletBinding()]
param(
    [string]$ProjectRoot = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$webFrontend = Join-Path $ProjectRoot 'web-frontend'
$versionFile = Join-Path $ProjectRoot 'VERSION'
$packageJsonPath = Join-Path $webFrontend 'package.json'

foreach ($required in @($webFrontend, $versionFile, $packageJsonPath)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Required packaging input was not found: $required"
    }
}

$version = (Get-Content -LiteralPath $versionFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($version)) { throw 'VERSION is empty.' }

$package = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
if ([string]$package.version -ne $version) {
    throw "Version mismatch: VERSION=$version but web-frontend/package.json=$($package.version)."
}

$outputSetting = [string]$package.build.directories.output
$artifactPattern = [string]$package.build.artifactName
if ([string]::IsNullOrWhiteSpace($outputSetting) -or [string]::IsNullOrWhiteSpace($artifactPattern)) {
    throw 'electron-builder output/artifactName is not configured in web-frontend/package.json.'
}

$releaseDir = [System.IO.Path]::GetFullPath((Join-Path $webFrontend $outputSetting))
$artifactName = $artifactPattern.Replace('${version}', $version).Replace('${ext}', 'exe')
$expectedInstaller = Join-Path $releaseDir $artifactName

Write-Host '===================================================' -ForegroundColor Cyan
Write-Host '  KNOUX Repair — Building Windows Desktop Installer' -ForegroundColor Cyan
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host ("Version:  {0}" -f $version)
Write-Host ("Output:   {0}" -f $releaseDir)
Write-Host ("Artifact: {0}" -f $artifactName)

$npm = (Get-Command npm -ErrorAction Stop).Source

if (Test-Path -LiteralPath $releaseDir) {
    Remove-Item -LiteralPath $releaseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

Write-Host '[1/3] Building frontend/server and packaging Electron + NSIS...' -ForegroundColor Cyan
& $npm --prefix $webFrontend run desktop:package
if ($LASTEXITCODE -ne 0) { throw "npm run desktop:package failed with exit code $LASTEXITCODE." }

Write-Host '[2/3] Validating installer path, size and SHA256...' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $expectedInstaller -PathType Leaf)) {
    $found = @(Get-ChildItem -LiteralPath $releaseDir -Filter '*.exe' -File -ErrorAction SilentlyContinue)
    $names = if ($found.Count) { ($found.Name -join ', ') } else { '<none>' }
    throw "Expected installer was not found: $expectedInstaller. EXE files present: $names"
}

$installerInfo = Get-Item -LiteralPath $expectedInstaller
if ($installerInfo.Length -le 0) { throw 'Installer has zero length.' }

$hash = (Get-FileHash -LiteralPath $expectedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
$hashFile = $expectedInstaller + '.sha256'
[System.IO.File]::WriteAllText(
    $hashFile,
    "$hash  $($installerInfo.Name)`r`n",
    [System.Text.UTF8Encoding]::new($false)
)
$hashRoundTrip = ((Get-Content -LiteralPath $hashFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
if ($hashRoundTrip -ne $hash) { throw 'SHA256 sidecar verification failed.' }

Write-Host '[3/3] Writing release manifest...' -ForegroundColor Cyan
$commit = if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_SHA)) {
    $env:GITHUB_SHA
} else {
    try { ((& git -C $ProjectRoot rev-parse HEAD 2>$null) | Select-Object -First 1).Trim() } catch { 'unknown' }
}

$signature = Get-AuthenticodeSignature -FilePath $expectedInstaller
$versionInfo = $installerInfo.VersionInfo
$manifest = [ordered]@{
    Product          = 'KNOUX Repair'
    Version          = $version
    Architecture     = 'x64 Windows'
    PackageRuntime   = 'Electron'
    Installer        = $installerInfo.Name
    InstallerPath    = $expectedInstaller
    InstallerSize    = $installerInfo.Length
    SHA256           = $hash
    SourceCommit     = $commit
    FileVersion      = $versionInfo.FileVersion
    ProductVersion   = $versionInfo.ProductVersion
    SigningStatus    = [string]$signature.Status
    BuildUtc         = (Get-Date).ToUniversalTime().ToString('o')
}
$manifestPath = Join-Path $releaseDir 'RELEASE-MANIFEST.json'
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host ''
Write-Host 'KNOUX Repair Windows Desktop Installer successfully built.' -ForegroundColor Green
Write-Host ('ARTIFACT=' + $expectedInstaller)
Write-Host ('BYTES=' + $installerInfo.Length)
Write-Host ('SHA256=' + $hash)
Write-Host ('SHA256_FILE=' + $hashFile)
Write-Host ('MANIFEST=' + $manifestPath)
