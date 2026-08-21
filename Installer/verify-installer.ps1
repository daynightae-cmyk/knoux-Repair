[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Assert-True {
    param([Parameter(Mandatory)][bool]$Condition, [Parameter(Mandatory)][string]$Message)
    if (-not $Condition) { throw $Message }
}

function Get-PeMachine {
    param([Parameter(Mandatory)][string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $reader = [System.IO.BinaryReader]::new($stream)
        $stream.Position = 0x3c
        $offset = $reader.ReadInt32()
        $stream.Position = $offset + 4
        return $reader.ReadUInt16()
    }
    finally { $stream.Dispose() }
}

$principal = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
Assert-True $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) 'Run verify-installer.ps1 from an elevated PowerShell session.'

$InstallerRoot = Split-Path -Parent $PSCommandPath
$ReleaseRoot = Split-Path -Parent $InstallerRoot
$Installer = Join-Path $InstallerRoot 'Release\KnouxRepair-v2.0.2-Setup-x64.exe'
$SourceDistribution = Join-Path $ReleaseRoot 'Release\KnouxRepair-v2.0.2-win-x64-distribution'
$TestInstall = Join-Path $env:ProgramFiles 'KnouxRepair-InstallerValidation'
$UninstallKey = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\KnouxRepair'
$DesktopShortcut = Join-Path $env:Public 'Desktop\KNOUX Repair.lnk'
$StartMenuDirectory = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\KNOUX Repair'
$SourceSettings = Join-Path $SourceDistribution 'Config\gui-settings.json'
$Results = [ordered]@{}

Assert-True (Test-Path -LiteralPath $Installer) "Installer not found: $Installer"
Assert-True ((Get-Item $Installer).Length -gt 0) 'Installer has zero length.'
$installerMachine = Get-PeMachine $Installer
Assert-True ($installerMachine -eq 0x14c -or $installerMachine -eq 0x8664) ('Installer PE machine is invalid: 0x{0:X4}' -f $installerMachine)
$Results.InstallerExists = $true
$Results.InstallerMachine = ('0x{0:X4}' -f $installerMachine)
$Results.InstallerSizeBytes = (Get-Item $Installer).Length
$Results.InstallerSHA256 = (Get-FileHash $Installer -Algorithm SHA256).Hash.ToLowerInvariant()

# The only directory removed by this test is an explicitly named validation directory.
if (Test-Path -LiteralPath $TestInstall) { Remove-Item -LiteralPath $TestInstall -Recurse -Force }
if (Test-Path $UninstallKey) { $existingUninstaller = Join-Path $TestInstall 'Uninstall.exe'; if (Test-Path -LiteralPath $existingUninstaller) { & $existingUninstaller /S 2>$null }; Remove-Item -Path $UninstallKey -Recurse -Force -ErrorAction SilentlyContinue }
Remove-Item -LiteralPath $DesktopShortcut -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $StartMenuDirectory -Recurse -Force -ErrorAction SilentlyContinue

$sourceSettingsHash = (Get-FileHash $SourceSettings -Algorithm SHA256).Hash
$installProcess = Start-Process -FilePath $Installer -ArgumentList @('/S', "/D=$TestInstall") -PassThru -Wait
Assert-True ($installProcess.ExitCode -eq 0) "Silent installation failed with exit code $($installProcess.ExitCode)."
$installedExe = Join-Path $TestInstall 'KnouxRepair.exe'
Assert-True (Test-Path -LiteralPath $installedExe) 'Application executable was not installed.'
Assert-True ((Get-PeMachine $installedExe) -eq 0x8664) 'Installed application is not x64.'
Assert-True (Test-Path -LiteralPath (Join-Path $TestInstall 'coreclr.dll')) 'Self-contained .NET runtime was not installed.'
$manifestTools = @(); foreach ($manifestTool in (Get-Content (Join-Path $TestInstall 'Docs\TOOLS-MANIFEST.json') -Raw | ConvertFrom-Json)) { $manifestTools += $manifestTool }
$missingScripts = @(foreach ($tool in $manifestTools) { $relativePath = [string]$tool.ScriptPath; $candidate = Join-Path -Path $TestInstall -ChildPath $relativePath; if (-not (Test-Path -LiteralPath $candidate)) { $relativePath } })
Assert-True ($manifestTools.Count -eq 158) "Expected 158 manifest tools; found $($manifestTools.Count)."
Assert-True ($missingScripts.Count -eq 0) "$($missingScripts.Count) manifest scripts are missing after installation."
$Results.SilentInstall = 'PASS'
$Results.InstalledApplicationMachine = '0x8664'
$Results.ManifestTools = $manifestTools.Count
$Results.MissingManifestScripts = $missingScripts.Count

$launchProcess = Start-Process -FilePath $installedExe -PassThru
Start-Sleep -Seconds 5
Assert-True (-not $launchProcess.HasExited) "Application exited immediately after launch with exit code $($launchProcess.ExitCode)."
$launchProcess | Stop-Process -Force
$Results.ApplicationLaunch = 'PASS'

Assert-True (Test-Path -LiteralPath $DesktopShortcut) 'Desktop shortcut was not created.'
Assert-True (Test-Path -LiteralPath (Join-Path $StartMenuDirectory 'KNOUX Repair.lnk')) 'Start Menu application shortcut was not created.'
Assert-True (Test-Path -LiteralPath (Join-Path $StartMenuDirectory 'Uninstall KNOUX Repair.lnk')) 'Start Menu uninstaller shortcut was not created.'
$Results.Shortcuts = 'PASS'

$registry = Get-ItemProperty -Path $UninstallKey
Assert-True ($registry.DisplayName -eq 'KNOUX Repair') 'Uninstall registration has an invalid DisplayName.'
Assert-True ($registry.DisplayVersion -eq '2.0.2') 'Uninstall registration has an invalid DisplayVersion.'
Assert-True ($registry.Publisher -eq 'Knoux') 'Uninstall registration has an invalid Publisher.'
$Results.WindowsRegistration = 'PASS'

$uninstallProcess = Start-Process -FilePath (Join-Path $TestInstall 'Uninstall.exe') -ArgumentList '/S' -PassThru -Wait
Assert-True ($uninstallProcess.ExitCode -eq 0) "Silent uninstall failed with exit code $($uninstallProcess.ExitCode)."
Assert-True (-not (Test-Path -LiteralPath $installedExe)) 'Application executable remained after uninstall.'
Assert-True (-not (Test-Path $UninstallKey)) 'Uninstall registry key remained after uninstall.'
Assert-True (-not (Test-Path -LiteralPath $DesktopShortcut)) 'Desktop shortcut remained after uninstall.'
Assert-True (-not (Test-Path -LiteralPath $StartMenuDirectory)) 'Start Menu shortcuts remained after uninstall.'
$residualSettings = Join-Path $TestInstall 'Config\gui-settings.json'
Assert-True (Test-Path -LiteralPath $residualSettings) 'Expected preserved settings were not retained after uninstall.'
Assert-True ((Get-FileHash $residualSettings -Algorithm SHA256).Hash -eq $sourceSettingsHash) 'Uninstall retained unexpected modified settings.'
$Results.Uninstall = 'PASS'
$Results.UserSettingsPreserved = 'PASS'

# Remove the known test-only residual settings before running the reinstall test.
Remove-Item -LiteralPath $TestInstall -Recurse -Force
$reinstallProcess = Start-Process -FilePath $Installer -ArgumentList @('/S', "/D=$TestInstall") -PassThru -Wait
Assert-True ($reinstallProcess.ExitCode -eq 0) "Silent reinstall failed with exit code $($reinstallProcess.ExitCode)."
Assert-True (Test-Path -LiteralPath (Join-Path $TestInstall 'KnouxRepair.exe')) 'Application executable was not restored after reinstall.'
$Results.Reinstall = 'PASS'

$finalUninstall = Start-Process -FilePath (Join-Path $TestInstall 'Uninstall.exe') -ArgumentList '/S' -PassThru -Wait
Assert-True ($finalUninstall.ExitCode -eq 0) "Final silent uninstall failed with exit code $($finalUninstall.ExitCode)."
Remove-Item -LiteralPath $TestInstall -Recurse -Force -ErrorAction SilentlyContinue
$Results.FinalCleanup = 'PASS'
$Results.CompletedUtc = (Get-Date).ToUniversalTime().ToString('o')

$Results | ConvertTo-Json | Set-Content (Join-Path $InstallerRoot 'Release\INSTALLER-VALIDATION.json') -Encoding utf8
$Results.GetEnumerator() | ForEach-Object { Write-Host ("{0}: {1}" -f $_.Key, $_.Value) }
