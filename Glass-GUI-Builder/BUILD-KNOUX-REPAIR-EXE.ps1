#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$ProjectRoot,
    [switch]$KeepBuildFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$BuilderRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectFile = Join-Path $BuilderRoot 'src\KnouxRepair\KnouxRepair.csproj'

function Write-Step([string]$Text) {
    Write-Host ('[>] ' + $Text) -ForegroundColor Cyan
}

function Write-Ok([string]$Text) {
    Write-Host ('[OK] ' + $Text) -ForegroundColor Green
}

function Find-ProjectRoot {
    param([string]$Explicit)

    if ($Explicit) {
        $resolved = [System.IO.Path]::GetFullPath(
            [Environment]::ExpandEnvironmentVariables($Explicit)
        )

        if (Test-Path -LiteralPath (Join-Path $resolved 'Docs\TOOLS-MANIFEST.json')) {
            return $resolved
        }

        throw "Invalid project root: $resolved"
    }

    $candidates = @(
        (Split-Path -Parent $BuilderRoot),
        $BuilderRoot,
        (Get-Location).Path
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate 'Docs\TOOLS-MANIFEST.json')) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }

    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = 'Select the KNOUX Repair project folder'
    $dialog.ShowNewFolderButton = $false

    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        if (Test-Path -LiteralPath (Join-Path $dialog.SelectedPath 'Docs\TOOLS-MANIFEST.json')) {
            return $dialog.SelectedPath
        }
    }

    throw 'KNOUX Repair project root was not selected.'
}

function Find-DotNet {
    # Preference: KNOUX_DOTNET env override, then dotnet on PATH, then local .NET 8 SDK install
    $override = $env:KNOUX_DOTNET
    if ($override -and (Test-Path -LiteralPath $override -PathType Leaf)) {
        return $override
    }

    $cmd = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $sdk = Join-Path $env:USERPROFILE '.dotnet8\dotnet.exe'
    if (Test-Path -LiteralPath $sdk -PathType Leaf) {
        return $sdk
    }

    throw 'dotnet CLI was not found. Install the .NET 8 SDK or set KNOUX_DOTNET to dotnet.exe.'
}

Add-Type -AssemblyName System.Windows.Forms

$ProjectRoot = Find-ProjectRoot -Explicit $ProjectRoot
$OutputExe = Join-Path $ProjectRoot 'KnouxRepair.exe'
$PublishDir = Join-Path $BuilderRoot 'publish'
$DotNet = Find-DotNet

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' KNOUX REPAIR v2 - PREMIUM WPF EXE BUILDER' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host ('Project : ' + $ProjectRoot)
Write-Host ('Output  : ' + $OutputExe)
Write-Host ('dotnet  : ' + $DotNet)
Write-Host ''

if (-not (Test-Path -LiteralPath $ProjectFile -PathType Leaf)) {
    throw "Required project file not found: $ProjectFile"
}

# Make dotnet's own root available on PATH (self-contained SDK extraction)
$env:DOTNET_ROOT = Split-Path -Parent $DotNet
$env:PATH = ($env:DOTNET_ROOT + ';' + $env:PATH)

Write-Step 'Restoring packages (offline, zero NuGet)...'
& $DotNet restore $ProjectFile
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed with exit code $LASTEXITCODE." }

Write-Step 'Publishing self-contained single-file EXE...'
& $DotNet publish $ProjectFile `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -o $PublishDir `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -p:DebugType=none `
    -p:DebugSymbols=false

if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE." }

$BuildExe = Join-Path $PublishDir 'KnouxRepair.exe'
if (-not (Test-Path -LiteralPath $BuildExe -PathType Leaf)) {
    throw "publish did not produce $BuildExe"
}

Write-Ok "Published: $BuildExe"

Write-Step 'Deploying to project root...'
Copy-Item -LiteralPath $BuildExe -Destination $OutputExe -Force

$Launcher = Join-Path $ProjectRoot 'START-KNOUX-REPAIR-GUI.cmd'
@'
@echo off
setlocal
cd /d "%~dp0"
start "" "%~dp0KnouxRepair.exe"
exit /b 0
'@ | Set-Content -LiteralPath $Launcher -Encoding Ascii

$Hash = (Get-FileHash -LiteralPath $OutputExe -Algorithm SHA256).Hash
$Info = Get-Item -LiteralPath $OutputExe

Write-Host ''
Write-Ok 'Build completed.'
Write-Host ('EXE     : ' + $OutputExe) -ForegroundColor Cyan
Write-Host ('Size    : ' + $Info.Length + ' bytes')
Write-Host ('SHA-256 : ' + $Hash)
Write-Host ('Launcher: ' + $Launcher)
Write-Host ''

if (-not $KeepBuildFiles) {
    Remove-Item -LiteralPath $PublishDir -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Host ('Publish files kept in: ' + $PublishDir) -ForegroundColor Cyan
}

Start-Process explorer.exe -ArgumentList @('/select,', $OutputExe)