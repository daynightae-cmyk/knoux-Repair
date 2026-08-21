[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$InstallerRoot = Split-Path -Parent $PSCommandPath
$ReleaseRoot = Split-Path -Parent $InstallerRoot
$DistributionRoot = Join-Path $ReleaseRoot 'Release\KnouxRepair-v2.0.2-win-x64-distribution'
$NsiScript = Join-Path $InstallerRoot 'KnouxRepairInstaller.nsi'
$OutputDirectory = Join-Path $InstallerRoot 'Release'
$OutputFile = Join-Path $OutputDirectory 'KnouxRepair-v2.0.2-Setup-x64.exe'
$ApplicationFile = Join-Path $DistributionRoot 'KnouxRepair.exe'

function Get-PeMachine {
    param([Parameter(Mandatory)][string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $reader = [System.IO.BinaryReader]::new($stream)
        $stream.Position = 0x3c
        $peOffset = $reader.ReadInt32()
        $stream.Position = $peOffset + 4
        return $reader.ReadUInt16()
    }
    finally { $stream.Dispose() }
}

foreach ($requiredPath in @($DistributionRoot, $NsiScript, $ApplicationFile)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required packaging input was not found: $requiredPath"
    }
}

$machine = Get-PeMachine -Path $ApplicationFile
if ($machine -ne 0x8664) {
    throw ('Expected an x64 PE application (0x8664); found 0x{0:X4}.' -f $machine)
}

$makensisCandidates = @()
$bundledTools = Join-Path $InstallerRoot 'tools'
if (Test-Path -LiteralPath $bundledTools) {
    $makensisCandidates += @(Get-ChildItem $bundledTools -Recurse -Filter 'makensis.exe' -File -ErrorAction SilentlyContinue | ForEach-Object FullName)
}
$pathCompiler = Get-Command 'makensis.exe' -ErrorAction SilentlyContinue
if ($pathCompiler) {
    $makensisCandidates += [string]$pathCompiler.Source
}
foreach ($programFilesRoot in @(${env:ProgramFiles(x86)}, $env:ProgramFiles)) {
    if (-not [string]::IsNullOrWhiteSpace($programFilesRoot)) {
        $makensisCandidates += (Join-Path $programFilesRoot 'NSIS\makensis.exe')
    }
}
$makensis = @($makensisCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1)
if ($makensis.Count -ne 1) {
    throw 'NSIS compiler was not found. Install NSIS 3.12, add makensis.exe to PATH, or provide it under installer\tools.'
}
$makensis = [string]$makensis[0]

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Get-ChildItem $OutputDirectory -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'KnouxRepair-v2.0.2-Setup-x64.exe*' -or $_.Name -eq 'RELEASE-MANIFEST.json' } |
    Remove-Item -Force

& $makensis /V3 $NsiScript
if ($LASTEXITCODE -ne 0) { throw "NSIS compilation failed with exit code $LASTEXITCODE." }
if (-not (Test-Path -LiteralPath $OutputFile)) { throw "NSIS returned success but did not create $OutputFile" }

# Signing-ready insertion point. Use an approved Authenticode certificate and timestamp service only.
# & signtool sign /fd SHA256 /tr https://<approved-timestamp-url> /td SHA256 $OutputFile

$hash = (Get-FileHash -LiteralPath $OutputFile -Algorithm SHA256).Hash.ToLowerInvariant()
$hashFile = "$OutputFile.sha256"
[System.IO.File]::WriteAllText($hashFile, "$hash  *$(Split-Path $OutputFile -Leaf)$`r`n", [System.Text.UTF8Encoding]::new($false))

$versionInfo = (Get-Item $OutputFile).VersionInfo
$manifest = [ordered]@{
    Product             = 'KNOUX Repair'
    Version             = '2.0.2'
    Architecture        = 'x64'
    InstallerTechnology = 'NSIS 3.12'
    Installer           = (Split-Path $OutputFile -Leaf)
    SourceDistribution  = $DistributionRoot
    Application         = 'KnouxRepair.exe'
    ApplicationMachine  = '0x8664'
    InstallerSizeBytes  = (Get-Item $OutputFile).Length
    SHA256              = $hash
    FileVersion         = $versionInfo.FileVersion
    ProductVersion      = $versionInfo.ProductVersion
    SigningStatus       = 'Unsigned - ready for approved Authenticode signing'
    BuildUtc            = (Get-Date).ToUniversalTime().ToString('o')
}
$manifest | ConvertTo-Json | Set-Content (Join-Path $OutputDirectory 'RELEASE-MANIFEST.json') -Encoding utf8

Write-Host "Installer: $OutputFile"
Write-Host "SHA256:   $hash"
Write-Host "Manifest: $(Join-Path $OutputDirectory 'RELEASE-MANIFEST.json')"
