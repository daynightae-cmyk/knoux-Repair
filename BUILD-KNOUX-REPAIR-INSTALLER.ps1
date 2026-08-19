[CmdletBinding()]
param(
    [string]$ProjectRoot = '',
    [switch]$SkipRestore
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = $PSScriptRoot }
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$projectFile = Join-Path $ProjectRoot 'Glass-GUI-Builder\src\KnouxRepair\KnouxRepair.csproj'
$installerRoot = Join-Path $ProjectRoot 'Installer'
$issFile = Join-Path $installerRoot 'KnouxRepair.iss'
$brandingScript = Join-Path $installerRoot 'New-KnouxInstallerBranding.ps1'
$staging = Join-Path $installerRoot 'Staging'
$output = Join-Path $installerRoot 'Output'
$expectedInstaller = Join-Path $output 'KNOUX-Repair-v2.0.2-Setup.exe'

function Require-File([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label was not found: $Path" }
}

function Find-Iscc {
    $command = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidates = @(
        'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
        'C:\Program Files\Inno Setup 6\ISCC.exe',
        (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    throw 'Inno Setup 6 compiler (ISCC.exe) was not found. Install JRSoftware.InnoSetup first.'
}

Require-File $projectFile 'WPF project'
Require-File $issFile 'Installer definition'
Require-File $brandingScript 'Installer branding script'
$dotnet = (Get-Command dotnet -ErrorAction Stop).Source
$iscc = Find-Iscc

Write-Host '[1/6] Validating official local branding...' -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File $brandingScript -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) { throw "Installer branding generation failed with exit code $LASTEXITCODE." }
Require-File (Join-Path $ProjectRoot 'Glass-GUI-Builder\src\KnouxRepair\Assets\KnouxOfficialLogo.png') 'Official local PNG logo'
Require-File (Join-Path $ProjectRoot 'Glass-GUI-Builder\src\KnouxRepair\Assets\KnouxOfficialLogo.ico') 'Official local ICO logo'

if (-not $SkipRestore) {
    Write-Host '[2/6] Restoring WPF project...' -ForegroundColor Cyan
    & $dotnet restore $projectFile
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed with exit code $LASTEXITCODE." }
}

Write-Host '[3/6] Building Release WPF project...' -ForegroundColor Cyan
& $dotnet build $projectFile --no-restore -c Release -v:minimal
if ($LASTEXITCODE -ne 0) { throw "Release build failed with exit code $LASTEXITCODE." }

Write-Host '[4/6] Publishing self-contained win-x64 application...' -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $staging | Out-Null
& $dotnet publish $projectFile --no-restore -c Release -r win-x64 --self-contained true -o $staging -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=none -p:DebugSymbols=false
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE." }
$publishedExe = Join-Path $staging 'KnouxRepair.exe'
Require-File $publishedExe 'Published KNOUX Repair executable'

Write-Host '[5/6] Compiling Inno Setup package...' -ForegroundColor Cyan
& $iscc $issFile
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed with exit code $LASTEXITCODE." }
Require-File $expectedInstaller 'Installer artifact'

Write-Host '[6/6] Validating installer metadata...' -ForegroundColor Cyan
$installerInfo = Get-Item -LiteralPath $expectedInstaller
$installerVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($expectedInstaller).ProductVersion
if (-not $installerVersion.StartsWith('2.0.2')) { throw "Unexpected installer product version: $installerVersion" }
$hash = (Get-FileHash -LiteralPath $expectedInstaller -Algorithm SHA256).Hash
$hashFile = $expectedInstaller + '.sha256'
Set-Content -LiteralPath $hashFile -Value ($hash + '  ' + $installerInfo.Name) -Encoding Ascii

Write-Host ''
Write-Host 'KNOUX Repair installer build completed.' -ForegroundColor Green
Write-Host ('ARTIFACT=' + $expectedInstaller)
Write-Host ('BYTES=' + $installerInfo.Length)
Write-Host ('VERSION=' + $installerVersion)
Write-Host ('ARCHITECTURE=win-x64')
Write-Host ('SHA256=' + $hash)
Write-Host ('SHA256_FILE=' + $hashFile)
