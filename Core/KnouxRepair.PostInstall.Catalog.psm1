#Requires -Version 5.1
# Knoux Repair v2.0.2 | 17-PostInstall-Setup | KnouxRepair.PostInstall.Catalog.psm1
# WinGet Package Resolution Module
# Provides live WinGet package lookup, verification, and installation capabilities

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ============================================================
# Get-KnouxWingetPackageInfo
# Resolves a package identity against live WinGet repositories.
# Returns structured package metadata or null if not found.
# ============================================================
function Get-KnouxWingetPackageInfo {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageId,
        [string]$Source = '',
        [switch]$IncludeVersions
    )

    $result = @{
        PackageId = $PackageId
        Found = $false
        Name = $null
        Version = $null
        AvailableVersions = @()
        Source = $null
        Publisher = $null
        Description = $null
        License = $null
        InstallerType = $null
        Architecture = @()
        MinOSVersion = $null
        Error = $null
    }

    try {
        # Build winget show command
        $args = @('show', '--id', $PackageId, '--exact', '--disable-interactivity', '--accept-source-agreements')
        if ($Source) { $args += '--source', $Source }
        
        $output = & winget.exe @args 2>&1
        $exitCode = $LASTEXITCODE

        if ($exitCode -ne 0 -or -not $output) {
            $result.Error = "winget show failed for '$PackageId': $($output -join ' ')"
            return [pscustomobject]$result
        }

        # Parse winget show output
        $parsed = Parse-KnouxWingetShowOutput $output
        if ($null -eq $parsed) {
            $result.Error = "Failed to parse winget show output for '$PackageId'"
            return [pscustomobject]$result
        }

        $result.Found = $true
        $result.Name = $parsed.Name
        $result.Version = $parsed.Version
        $result.Source = $parsed.Source
        $result.Publisher = $parsed.Publisher
        $result.Description = $parsed.Description
        $result.License = $parsed.License
        $result.InstallerType = $parsed.InstallerType
        $result.Architecture = $parsed.Architecture
        $result.MinOSVersion = $parsed.MinOSVersion

        if ($IncludeVersions) {
            $versions = Get-KnouxWingetAvailableVersions -PackageId $PackageId -Source $Source
            $result.AvailableVersions = $versions
        }

    } catch {
        $result.Error = $_.Exception.Message
    }

    return [pscustomobject]$result
}

# ============================================================
# Parse-KnouxWingetShowOutput
# Internal helper to parse winget show output into structured data
# ============================================================
function Parse-KnouxWingetShowOutput {
    [CmdletBinding()]
    param([string[]]$Output)

    $data = @{
        Name = $null
        Version = $null
        Source = $null
        Publisher = $null
        Description = $null
        License = $null
        InstallerType = $null
        Architecture = @()
        MinOSVersion = $null
    }

    $currentField = ''
    foreach ($line in $Output) {
        $trimmed = $line.Trim()
        if (-not $trimmed) { continue }

        # Field: Value format
        if ($trimmed -match '^(\w[\w\s]*?):\s*(.+)$') {
            $field = $matches[1].Trim()
            $value = $matches[2].Trim()

            switch -Wildcard ($field) {
                'Name' { $data.Name = $value }
                'Version' { $data.Version = $value }
                'Source' { $data.Source = $value }
                'Publisher' { $data.Publisher = $value }
                'Description' { $data.Description = $value }
                'License' { $data.License = $value }
                'Installer Type' { $data.InstallerType = $value }
                'Architecture' { $data.Architecture = $value -split ',' | ForEach-Object { $_.Trim() } }
                'Minimum OS Version' { $data.MinOSVersion = $value }
                'Package ID' { } # Already known
                default { }
            }
        }
    }

    if (-not $data.Name) { return $null }
    return [pscustomobject]$data
}

# ============================================================
# Get-KnouxWingetAvailableVersions
# Lists all available versions for a package
# ============================================================
function Get-KnouxWingetAvailableVersions {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageId,
        [string]$Source = ''
    )

    $versions = @()
    try {
        $args = @('show', '--id', $PackageId, '--exact', '--versions', '--disable-interactivity', '--accept-source-agreements')
        if ($Source) { $args += '--source', $Source }

        $output = & winget.exe @args 2>&1
        if ($LASTEXITCODE -eq 0 -and $output) {
            foreach ($line in $output) {
                $trimmed = $line.Trim()
                if ($trimmed -match '^\d+\.\d+(\.\d+)?') {
                    $versions += $trimmed.Split()[0]
                }
            }
        }
    } catch {
        Write-Warning "Failed to get available versions for '$PackageId': $($_.Exception.Message)"
    }
    return $versions
}

# ============================================================
# Test-KnouxWingetAvailable
# Quick check if winget is available and functional
# ============================================================
function Test-KnouxWingetAvailable {
    [CmdletBinding()]
    param()

    try {
        $version = & winget.exe --version 2>$null | Select-Object -First 1
        if ($LASTEXITCODE -eq 0 -and $version) {
            return [pscustomobject]@{
                Available = $true
                Version = [string]$version
            }
        }
    } catch { }
    return [pscustomobject]@{ Available = $false; Version = $null; Error = 'winget not found or failed' }
}

# ============================================================
# Get-KnouxWingetSources
# Lists configured WinGet sources
# ============================================================
function Get-KnouxWingetSources {
    [CmdletBinding()]
    param()

    $sources = @()
    try {
        $output = & winget.exe source list --disable-interactivity 2>&1
        if ($LASTEXITCODE -eq 0 -and $output) {
            foreach ($line in $output) {
                $trimmed = $line.Trim()
                if ($trimmed -match '^\s*(\S+)\s+(https?://\S+)') {
                    $sources += [pscustomobject]@{
                        Name = $matches[1]
                        Url = $matches[2]
                        Enabled = $true
                    }
                }
            }
        }
    } catch {
        Write-Warning "Failed to list WinGet sources: $($_.Exception.Message)"
    }
    return $sources
}

# ============================================================
# Install-KnouxWingetPackage
# Installs a package via WinGet with detailed result tracking
# ============================================================
function Install-KnouxWingetPackage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageId,
        [string]$Source = '',
        [string]$Version = '',
        [switch]$Silent,
        [switch]$AcceptAgreements
    )

    $result = @{
        PackageId = $PackageId
        Success = $false
        ExitCode = -1
        Output = @()
        Error = $null
        InstalledVersion = $null
        DurationMs = 0
    }

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        $args = @('install', '--id', $PackageId, '--exact', '--disable-interactivity')
        if ($Source) { $args += '--source', $Source }
        if ($Version) { $args += '--version', $Version }
        if ($Silent) { $args += '--silent' }
        if ($AcceptAgreements) { $args += '--accept-package-agreements', '--accept-source-agreements' }

        $output = & winget.exe @args 2>&1
        $result.ExitCode = $LASTEXITCODE
        $result.Output = $output

        if ($LASTEXITCODE -eq 0) {
            $result.Success = $true
            # Try to extract installed version from output
            foreach ($line in $output) {
                if ($line -match 'Successfully installed|Installed.*version') {
                    $result.InstalledVersion = ($line -split '\s+')[-1]
                    break
                }
            }
        } else {
            $result.Error = $output -join ' '
        }
    } catch {
        $result.Error = $_.Exception.Message
        $result.ExitCode = -1
    } finally {
        $stopwatch.Stop()
        $result.DurationMs = $stopwatch.ElapsedMilliseconds
    }

    return [pscustomobject]$result
}

# ============================================================
# Verify-KnouxWingetPackageInstalled
# Verifies a package is installed by checking WinGet list and registry
# ============================================================
function Verify-KnouxWingetPackageInstalled {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageId,
        [string]$ExpectedVersion = ''
    )

    $result = @{
        PackageId = $PackageId
        Installed = $false
        InstalledVersion = $null
        MatchedExpectedVersion = $false
        DetectionMethod = 'WinGet'
        RegistryMatch = $false
        Error = $null
    }

    try {
        # Method 1: winget list
        $output = & winget.exe list --id $PackageId --exact --disable-interactivity 2>&1
        if ($LASTEXITCODE -eq 0 -and $output) {
            foreach ($line in $output) {
                if ($line -match '\S+\s+(\S+)\s+') {
                    $version = $matches[1]
                    if ($version -notmatch '^(Version|Available|Source|$)') {
                        $result.Installed = $true
                        $result.InstalledVersion = $version
                        if ($ExpectedVersion -and $version -eq $ExpectedVersion) {
                            $result.MatchedExpectedVersion = $true
                        }
                        break
                    }
                }
            }
        }

        # Method 2: Registry check (fallback/corroboration)
        $registryPaths = @(
            "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )

        foreach ($path in $registryPaths) {
            $items = Get-ItemProperty -Path $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                if ($item.DisplayName -and $item.DisplayName -like "*$PackageId*" -or $item.PSChildName -like "*$PackageId*") {
                    $result.RegistryMatch = $true
                    if (-not $result.Installed -and $item.DisplayVersion) {
                        $result.InstalledVersion = $item.DisplayVersion
                        $result.Installed = $true
                    }
                    break
                }
            }
            if ($result.RegistryMatch) { break }
        }

    } catch {
        $result.Error = $_.Exception.Message
    }

    return [pscustomobject]$result
}

# ============================================================
# Resolve-KnouxCatalogItem
# Resolves a catalog item against live WinGet, returns enriched data
# ============================================================
function Resolve-KnouxCatalogItem {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][pscustomobject]$CatalogItem,
        [switch]$IncludeVersions
    )

    $base = $CatalogItem | Select-Object *
    $base.Selection = $CatalogItem.Selection
    $base.Name = $CatalogItem.Name
    $base.PackageId = $CatalogItem.PackageId
    $base.Category = $CatalogItem.Category

    # Check winget availability first
    $wingetCheck = Test-KnouxWingetAvailable
    if (-not $wingetCheck.Available) {
        $base.Detected = $false
        $base.WingetAvailable = $false
        $base.WingetError = $wingetCheck.Error
        $base.ResolvedVersion = $null
        $base.ResolvedSource = $null
        $base.InstallCapable = $false
        $base.ResolutionError = 'WinGet client not available'
        return $base
    }

    $base.WingetAvailable = $true
    $base.WingetVersion = $wingetCheck.Version

    # Resolve package info from WinGet
    $pkgInfo = Get-KnouxWingetPackageInfo -PackageId $CatalogItem.PackageId -IncludeVersions:$IncludeVersions
    $base.ResolvedVersion = $pkgInfo.Version
    $base.ResolvedSource = $pkgInfo.Source
    $base.Publisher = $pkgInfo.Publisher
    $base.Description = $pkgInfo.Description
    $base.License = $pkgInfo.License
    $base.InstallerType = $pkgInfo.InstallerType
    $base.Architecture = $pkgInfo.Architecture -join ', '
    $base.MinOSVersion = $pkgInfo.MinOSVersion
    $base.AvailableVersions = $pkgInfo.AvailableVersions
    $base.InstallCapable = $pkgInfo.Found

    # Check local installation (registry-based)
    $installed = Verify-KnouxWingetPackageInstalled -PackageId $CatalogItem.PackageId -ExpectedVersion $pkgInfo.Version
    $base.Detected = $installed.Installed
    $base.MatchedDisplayName = if ($installed.Installed) { $CatalogItem.Name } else { $null }
    $base.MatchedVersion = $installed.InstalledVersion
    $base.RegistryMatch = $installed.RegistryMatch
    $base.Evidence = if ($installed.Installed) {
        "WinGet list + Registry confirmed v$($installed.InstalledVersion)"
    } elseif ($pkgInfo.Found) {
        "Not installed. WinGet: Available v$($pkgInfo.Version)"
    } else {
        "Not installed. WinGet: Not found"
    }

    return $base
}

Export-ModuleMember -Function Get-KnouxWingetPackageInfo, Get-KnouxWingetAvailableVersions, Test-KnouxWingetAvailable, Get-KnouxWingetSources, Install-KnouxWingetPackage, Verify-KnouxWingetPackageInstalled, Resolve-KnouxCatalogItem