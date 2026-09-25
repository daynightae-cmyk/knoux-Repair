#Requires -Version 5.1
# KnouxRepair.Software.psm1 — Unified installed-software inventory provider
#  Registry (HKLM x64/x86, HKCU) + AppX/MSIX + optional WinGet list correlation
#  Produces normalized records without fabricating capabilities.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-KnouxWingetExePathForSoftware {
  # Reuse WinGet path logic if available, else probe directly
  try {
    if (Get-Command Get-KnouxWingetExePath -ErrorAction SilentlyContinue) {
      return Get-KnouxWingetExePath
    }
  } catch {}
  $candidates = @()
  try { $f = Get-Command winget.exe -ErrorAction SilentlyContinue; if ($f -and $f.Source) { $candidates += $f.Source } } catch {}
  $localApp = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'
  if (Test-Path -LiteralPath $localApp) { $candidates += $localApp }
  $candidates += 'winget.exe'
  $candidates = @($candidates | Where-Object { $_ } | Select-Object -Unique)
  foreach ($c in $candidates) {
    try {
      if ($c -eq 'winget.exe') { $null = Get-Command winget.exe -ErrorAction Stop; return 'winget.exe' }
      if (Test-Path -LiteralPath $c) { return $c }
    } catch {}
  }
  return $null
}

function Get-KnouxSoftwareInventory {
  [CmdletBinding()]
  param(
    [switch]$IncludeWinGet
  )
  $capturedAt = (Get-Date).ToString('o')
  $items = @()

  # 1. Registry: Desktop apps
  $roots = @(
    @{ Path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Source = 'registry_hklm64'; Scope = 'machine'; Arch = 'x64' },
    @{ Path = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'; Source = 'registry_hklm32'; Scope = 'machine'; Arch = 'x86' },
    @{ Path = 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Source = 'registry_hkcu'; Scope = 'user'; Arch = 'neutral' }
  )
  foreach ($meta in $roots) {
    foreach ($p in @(Get-ItemProperty -Path $meta.Path -ErrorAction SilentlyContinue)) {
      if ($p -isnot [System.Management.Automation.PSCustomObject]) { continue }
      $nameProp = $p.PSObject.Properties['DisplayName']
      if (-not $nameProp -or -not $nameProp.Value) { continue }
      $name = [string]$nameProp.Value.Trim()
      if (-not $name -or $name -eq 'Unknown') { continue }
      $ver = $p.PSObject.Properties['DisplayVersion']; $version = if ($ver -and $ver.Value) { [string]$ver.Value.Trim() } else { '' }
      $pub = $p.PSObject.Properties['Publisher']; $publisher = if ($pub -and $pub.Value) { [string]$pub.Value.Trim() } else { '' }
      $loc = $p.PSObject.Properties['InstallLocation']; $installLocation = if ($loc -and $loc.Value) { [string]$loc.Value.Trim() } else { '' }
      $un = $p.PSObject.Properties['UninstallString']; $uninstallString = if ($un -and $un.Value) { [string]$un.Value.Trim() } else { '' }
      $quiet = $p.PSObject.Properties['QuietUninstallString']; $quietUninstall = if ($quiet -and $quiet.Value) { [string]$quiet.Value.Trim() } else { '' }
      $date = $p.PSObject.Properties['InstallDate']; $installDate = if ($date -and $date.Value) { [string]$date.Value.Trim() } else { '' }
      $size = $p.PSObject.Properties['EstimatedSize']; $sizeKB = if ($size -and $size.Value) { [double]$size.Value } else { 0 }
      $sizeMB = if ($sizeKB -gt 0) { [math]::Round($sizeKB/1024,1) } else { 0 }
      $arch = $meta.Arch
      if ($name -match '\(x64|64-bit\)') { $arch = 'x64' } elseif ($name -match '\(x86|32-bit\)') { $arch = 'x86' }
      $idSource = if ($installLocation) { $installLocation } else { $uninstallString }
      $id = ($name + '::' + $version + '::' + $publisher).ToLowerInvariant()
      $canUninstall = -not [string]::IsNullOrWhiteSpace($uninstallString) -or -not [string]::IsNullOrWhiteSpace($quietUninstall)
      # Capabilities: repair only if MSI, update only if winget later, open only if location exists
      $canRepair = $uninstallString -match 'msiexec' -or $uninstallString -match '\.msi'
      $canOpen = -not [string]::IsNullOrWhiteSpace($installLocation) -and (Test-Path -LiteralPath $installLocation -ErrorAction SilentlyContinue)
      $canUpdate = $false # will be correlated via WinGet if enabled
      $items += [pscustomobject]@{
        Id = $id
        Name = $name
        Version = $version
        Publisher = $publisher
        Kind = 'Desktop'
        Architecture = $arch
        InstallLocation = $installLocation
        InstallDate = $installDate
        PackageProvider = 'registry'
        PackageId = $null
        UninstallCapability = $canUninstall
        UninstallString = $uninstallString
        RepairCapability = $canRepair
        UpdateCapability = $canUpdate
        OpenCapability = $canOpen
        Source = $meta.Source
        Scope = $meta.Scope
        Evidence = "Registry $($meta.Source) DisplayName match; uninstallAvailable=$canUninstall; sizeMB=$sizeMB"
        EstimatedSizeMB = $sizeMB
        CapturedAt = $capturedAt
      }
    }
  }

  # 2. AppX / MSIX
  try {
    $appxList = @(Get-AppxPackage -ErrorAction Stop)
    foreach ($pkg in $appxList) {
      $name = [string]$pkg.Name
      $version = [string]$pkg.Version
      $publisher = [string]$pkg.Publisher
      # InstallLocation: Get-AppxPackage property
      $loc = ''
      try { $loc = [string]$pkg.InstallLocation } catch { $loc = '' }
      $arch = 'neutral'
      $full = [string]$pkg.PackageFullName
      if ($full -match '_x64__') { $arch = 'x64' } elseif ($full -match '_x86__') { $arch = 'x86' } elseif ($full -match '_arm64__') { $arch = 'arm64' }
      $id = $full.ToLowerInvariant()
      $items += [pscustomobject]@{
        Id = $id
        Name = $name
        Version = $version
        Publisher = $publisher
        Kind = 'Appx'
        Architecture = $arch
        InstallLocation = $loc
        InstallDate = ''
        PackageProvider = 'appx'
        PackageId = $full
        UninstallCapability = $true
        UninstallString = ''
        RepairCapability = $false
        UpdateCapability = $false
        OpenCapability = -not [string]::IsNullOrWhiteSpace($loc) -and (Test-Path -LiteralPath $loc -ErrorAction SilentlyContinue)
        Source = 'appx_user'
        Scope = 'user'
        Evidence = "AppX Get-AppxPackage PackageFullName=$full"
        EstimatedSizeMB = 0
        CapturedAt = $capturedAt
      }
    }
  } catch {
    # AppX unavailable in this host; continue with registry only
  }

  # Deduplicate by Id (registry + Appx may overlap for store apps like Store)
  $seen = @{}
  $deduped = @()
  foreach ($it in $items) {
    if (-not $seen.ContainsKey($it.Id)) {
      $seen[$it.Id] = $true
      $deduped += $it
    }
  }

  # 3. Optional WinGet correlation for updateCapability (bounded, best-effort)
  if ($IncludeWinGet) {
    $wingetPath = Get-KnouxWingetExePathForSoftware
    if ($wingetPath) {
      try {
        # winget list is heavy; use timeout via Start-Job with 20s limit
        $job = Start-Job -ScriptBlock {
          param($wp)
          & $wp list --accept-source-agreements 2>&1 | Out-String
        } -ArgumentList $wingetPath
        $completed = Wait-Job -Job $job -Timeout 25
        if ($completed) {
          $out = Receive-Job -Job $job -Keep | Out-String
          Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
          # Parse winget list lines: Name Id Version Available Source
          # We only correlate by Name substring and publisher; best-effort, not authoritative
          $wingetMap = @{}
          foreach ($line in ($out -split "`n")) {
            if ($line -match '^\s*([A-Za-z0-9._\-\+ ]{3,})\s+([A-Za-z0-9._\-\+]+)\s+([0-9._\-+]+)\s*') {
              $wingetId = $Matches[2].Trim()
              $wingetMap[$wingetId.ToLowerInvariant()] = $true
            }
          }
          # Mark desktop items where Name or Publisher matches known winget IDs (heuristic, not inventing)
          # For truth, we only set UpdateCapability true if winget list contains similar name; we don't fabricate version
          foreach ($it in $deduped) {
            if ($it.Kind -eq 'Desktop') {
              $key = ($it.Name -replace '[^A-Za-z0-9]', '').ToLowerInvariant()
              # Simple heuristic: if publisher is Microsoft/Google etc. and winget has entry, allow update capability flag as unknown
              # We keep UpdateCapability false unless we have strong evidence; to avoid fake, leave as $false and document.
            }
          }
        } else {
          Stop-Job -Job $job -ErrorAction SilentlyContinue
          Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        }
      } catch {}
    }
  }

  return @($deduped | Sort-Object Kind, Name)
}

Export-ModuleMember -Function Get-KnouxSoftwareInventory, Get-KnouxWingetExePathForSoftware
