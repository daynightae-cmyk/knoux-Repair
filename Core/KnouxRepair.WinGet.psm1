#Requires -Version 5.1
# ============================================================
#  KnouxRepair.WinGet.psm1
#  Shared WinGet provider: live package resolution and host
#  capability truth. No hardcoded package state.
# ============================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-KnouxWingetExePath {
  [CmdletBinding()]
  param()
  # Direct path probe: Windows App Execution Alias lives outside normal PATH in some hosts.
  $candidates = @()
  try { $found = Get-Command winget.exe -ErrorAction SilentlyContinue; if ($found -and $found.Source) { $candidates += $found.Source } } catch {}
  $localApp = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'
  if (Test-Path -LiteralPath $localApp) { $candidates += $localApp }
  # System-wide alias for some configs
  $candidates += 'winget.exe'
  $candidates = @($candidates | Where-Object { $_ } | Select-Object -Unique)
  foreach ($c in $candidates) {
    try {
      if ($c -eq 'winget.exe') {
        $null = Get-Command winget.exe -ErrorAction Stop
        return 'winget.exe'
      }
      if (Test-Path -LiteralPath $c) { return $c }
    } catch {}
  }
  return $null
}

# -------------------------------------------------------------
#  Get-KnouxWingetCapability
#  Detects winget.exe, version, and source inventory.
#  Never throws; returns structured capability object.
# -------------------------------------------------------------
function Get-KnouxWingetCapability {
  [CmdletBinding()]
  param()
  $cap = [ordered]@{
    Available   = $false
    Version     = $null
    SourceCount = $null
    Error       = $null
    ResolvedAt  = (Get-Date).ToString('o')
  }
  $wingetPath = Get-KnouxWingetExePath
  if (-not $wingetPath) {
    $cap.Error = 'winget.exe not found on PATH or at known WindowsApps location.'
    return [pscustomobject]$cap
  }
  try {
    $verLines = @(& $wingetPath --version 2>&1)
    $exit = $global:LASTEXITCODE
    $ver = @($verLines | Where-Object { $_ -and $_.ToString().Trim() }) | Select-Object -First 1
    if ($exit -eq 0 -and $ver) {
      $cap.Available = $true
      $cap.Version = [string]$ver.ToString().Trim()
      try {
        $srcLines = @(& $wingetPath source list --disable-interactivity 2>&1)
        $srcExit = $global:LASTEXITCODE
        if ($srcExit -eq 0) {
          # Matches lines like "winget  https://cdn.winget.microsoft.com/cache"
          $cap.SourceCount = @($srcLines | Where-Object { $_ -match '^\s*\S+\s+https?://' }).Count
        }
      } catch { $cap.Error = $_.Exception.Message }
    } else {
      $cap.Error = "winget --version via '$wingetPath' returned no output or non-zero exit (exit=$exit)."
    }
  } catch {
    $cap.Error = $_.Exception.Message
  }
  return [pscustomobject]$cap
}

# -------------------------------------------------------------
#  Resolve-KnouxWingetPackage
#  Live resolves a single providerPackageId via `winget show`.
#  Returns: Resolved(bool), PackageId, AvailableVersion, Source,
#           Architecture, InstallerType, Publisher, Name,
#           RawLines, Error, ResolvedAt
#  Must be fast-enough: timeout 25s per package.
# -------------------------------------------------------------
function Resolve-KnouxWingetPackage {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$PackageId
  )
  $out = [ordered]@{
    Resolved         = $false
    PackageId        = $PackageId
    AvailableVersion = $null
    Source           = $null
    Architecture     = $null
    InstallerType    = $null
    Publisher        = $null
    Name             = $null
    RawLines         = @()
    Error            = $null
    ResolvedAt       = (Get-Date).ToString('o')
  }
  $trimmedId = $PackageId.Trim()
  if (-not $trimmedId -or $trimmedId.Length -gt 128 -or $trimmedId -notmatch '^[A-Za-z0-9._+\-]+$') {
    $out.Error = 'Invalid package identifier format.'
    return [pscustomobject]$out
  }
  $wingetPath = Get-KnouxWingetExePath
  if (-not $wingetPath) {
    $out.Error = 'winget.exe not found on this host.'
    return [pscustomobject]$out
  }
  try {
    # Use --disable-interactivity to avoid prompts; --exact to avoid substring matches.
    # winget show can take 5-25s per package depending on network/cache.
    $lines = @(& $wingetPath show --id $trimmedId --exact --disable-interactivity 2>&1)
    $exit = $global:LASTEXITCODE
    $out.RawLines = @($lines)
    if ($exit -ne 0) {
      # winget returns non-zero when package not found or source unavailable
      $joined = ($lines | Out-String)
      if ($joined -match 'No package found|not found|Failed.*source|0x8A15000') {
        $out.Error = "Package not found or source unavailable: $trimmedId"
      } else {
        $out.Error = "winget show failed (exit $exit) for $trimmedId"
      }
      return [pscustomobject]$out
    }
    # Parse common fields from winget show output.
    # Example keys: Found, Version [1.2.3], Publisher, Name, Source, Installer Type
    $text = ($lines | Out-String)
    # Try to extract Version line: "Version: 1.2.3" or "Version [1.2.3]"
    if ($text -match 'Version[:\s]+\[?([A-Za-z0-9._\-\+]+)\]?') { $out.AvailableVersion = $matches[1].Trim() }
    elseif ($text -match 'Version:\s*(\S+)') { $out.AvailableVersion = $matches[1].Trim() }
    if ($text -match 'Publisher:\s*(.+)') { $out.Publisher = $matches[1].Trim() }
    if ($text -match '(?m)^Name:\s*(.+)$') { $out.Name = $matches[1].Trim() }
    if ($text -match 'Source:\s*(\S+)') { $out.Source = $matches[1].Trim() }
    if ($text -match 'Architecture:\s*(\S+)') { $out.Architecture = $matches[1].Trim() }
    if ($text -match 'Installer Type:\s*(\S+)') { $out.InstallerType = $matches[1].Trim() }

    # If winget returned output without error, consider it resolved even if version not parsed.
    # Version may be absent for some packages but source identity is still proven.
    $out.Resolved = $true
    if (-not $out.Source) { $out.Source = 'winget' }
  } catch {
    $out.Error = $_.Exception.Message
  }
  return [pscustomobject]$out
}

# -------------------------------------------------------------
#  Get-KnouxInstalledPrograms
#  Registry-based installed software truth (HKLM/HKCU Uninstall).
#  Returns sorted unique objects {Name, Version, Publisher, Location}
# -------------------------------------------------------------
function Get-KnouxInstalledPrograms {
  [CmdletBinding()]
  param()
  $paths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $programs = foreach ($p in $paths) {
    Get-ItemProperty -Path $p -ErrorAction SilentlyContinue | ForEach-Object {
      $dn = $_.PSObject.Properties['DisplayName']
      if ($null -ne $dn -and -not [string]::IsNullOrWhiteSpace([string]$dn.Value)) {
        $dv = $_.PSObject.Properties['DisplayVersion']
        $pub = $_.PSObject.Properties['Publisher']
        $loc = $_.PSObject.Properties['InstallLocation']
        [pscustomobject]@{
          Name           = [string]$dn.Value
          Version        = if ($null -ne $dv) { [string]$dv.Value } else { '' }
          Publisher      = if ($null -ne $pub) { [string]$pub.Value } else { '' }
          InstallLocation= if ($null -ne $loc) { [string]$loc.Value } else { '' }
        }
      }
    }
  }
  return @($programs | Sort-Object Name -Unique)
}

# -------------------------------------------------------------
#  Test-KnouxProgramMatch
#  Matches a registry program against a catalog detection pattern.
# -------------------------------------------------------------
function Test-KnouxProgramMatch {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string]$DetectionPattern,
    [Parameter(Mandatory)][array]$InstalledPrograms
  )
  try {
    return @($InstalledPrograms | Where-Object { $_.Name -match $DetectionPattern } | Select-Object -First 1)
  } catch {
    return @()
  }
}

Export-ModuleMember -Function Get-KnouxWingetCapability, Get-KnouxWingetExePath, Resolve-KnouxWingetPackage, Get-KnouxInstalledPrograms, Test-KnouxProgramMatch
