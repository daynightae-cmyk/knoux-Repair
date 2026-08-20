#Requires -Version 5.1
# Knoux Repair v2.0.2 | 17-PostInstall-Setup | PI06 - Interactive Post-Install Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

function Get-KnouxInstalledPrograms {
  $paths = @(
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $programs = foreach ($path in $paths) {
    Get-ItemProperty -Path $path -ErrorAction SilentlyContinue | ForEach-Object {
      $displayName = $_.PSObject.Properties['DisplayName']
      if ($null -ne $displayName -and -not [string]::IsNullOrWhiteSpace([string]$displayName.Value)) {
        $displayVersion = $_.PSObject.Properties['DisplayVersion']
        $publisher = $_.PSObject.Properties['Publisher']
        [pscustomobject]@{
          Name = [string]$displayName.Value
          Version = if ($null -ne $displayVersion) { [string]$displayVersion.Value } else { '' }
          Publisher = if ($null -ne $publisher) { [string]$publisher.Value } else { '' }
        }
      }
    }
  }
  return @($programs | Sort-Object Name -Unique)
}

$Session = Start-KnouxSession -ToolId 'PI06' -ToolName 'Interactive Post-Install Preview' -Category '17-PostInstall-Setup' -RiskLevel 'READ_ONLY'
try {
  $catalog = @(
    [pscustomobject]@{ Selection = 1; Name = 'Google Chrome'; PackageId = 'Google.Chrome'; Category = 'Browser'; Pattern = '(^|\s)Google Chrome($|\s)' },
    [pscustomobject]@{ Selection = 2; Name = '7-Zip'; PackageId = '7zip.7zip'; Category = 'Utilities'; Pattern = '(^|\s)7-Zip($|\s)' },
    [pscustomobject]@{ Selection = 3; Name = 'VLC media player'; PackageId = 'VideoLAN.VLC'; Category = 'Media'; Pattern = 'VLC media player|VideoLAN VLC' },
    [pscustomobject]@{ Selection = 4; Name = 'Visual Studio Code'; PackageId = 'Microsoft.VisualStudioCode'; Category = 'Developer'; Pattern = 'Visual Studio Code' },
    [pscustomobject]@{ Selection = 5; Name = 'PowerToys'; PackageId = 'Microsoft.PowerToys'; Category = 'Productivity'; Pattern = 'PowerToys' },
    [pscustomobject]@{ Selection = 6; Name = 'Notepad++'; PackageId = 'Notepad++.Notepad++'; Category = 'Utilities'; Pattern = 'Notepad\+\+' },
    [pscustomobject]@{ Selection = 7; Name = 'Everything'; PackageId = 'voidtools.Everything'; Category = 'Search'; Pattern = '^Everything(\s|$)' },
    [pscustomobject]@{ Selection = 8; Name = 'WinDirStat'; PackageId = 'WinDirStat.WinDirStat'; Category = 'Storage'; Pattern = 'WinDirStat' }
  )
  $installedPrograms = Get-KnouxInstalledPrograms
  $catalogState = @($catalog | ForEach-Object {
    $catalogItem = $_
    $match = @($installedPrograms | Where-Object { $_.Name -match $catalogItem.Pattern } | Select-Object -First 1)
    [pscustomobject]@{
      Selection = $catalogItem.Selection; Name = $catalogItem.Name; PackageId = $catalogItem.PackageId; Category = $catalogItem.Category
      Detected = ($match.Count -gt 0)
      MatchedDisplayName = if ($match.Count) { $match[0].Name } else { $null }
      MatchedVersion = if ($match.Count) { $match[0].Version } else { $null }
      Evidence = 'Local installed-program registry match only; absence is not an installation recommendation.'
    }
  })

  $winget = [ordered]@{ Available = $false; SourceCount = $null; Version = $null; Error = $null }
  try {
    $wingetVersion = & winget.exe --version 2>$null | Select-Object -First 1
    if ($LASTEXITCODE -eq 0 -and $wingetVersion) {
      $winget.Available = $true; $winget.Version = [string]$wingetVersion
      $sourceLines = @(& winget.exe source list --disable-interactivity 2>$null)
      if ($LASTEXITCODE -eq 0) { $winget.SourceCount = @($sourceLines | Where-Object { $_ -match '^\s*\S+\s+https?://' }).Count }
    }
  } catch { $winget.Error = $_.Exception.Message }

  $updateServices = @('wuauserv', 'BITS') | ForEach-Object {
    try { $service = Get-Service -Name $_ -ErrorAction Stop; [pscustomobject]@{ Name = $service.Name; Status = [string]$service.Status; StartType = [string]$service.StartType } } catch { [pscustomobject]@{ Name = $_; Status = 'Unavailable'; StartType = 'Unavailable' } }
  }
  $driverOffers = [ordered]@{ Available = $false; Count = $null; Offers = @(); Error = $null }
  try {
    $updateSession = New-Object -ComObject Microsoft.Update.Session
    $searcher = $updateSession.CreateUpdateSearcher()
    $result = $searcher.Search("IsInstalled=0 and Type='Driver'")
    $driverOffers.Available = $true
    $driverOffers.Count = [int]$result.Updates.Count
    $driverOffers.Offers = @(for ($index = 0; $index -lt $result.Updates.Count; $index++) {
      $offer = $result.Updates.Item($index)
      [pscustomobject]@{ Selection = $index + 1; Title = [string]$offer.Title; DriverClass = [string]$offer.DriverClass; DriverModel = [string]$offer.DriverModel; DriverVerDate = [string]$offer.DriverVerDate }
    })
  } catch { $driverOffers.Error = $_.Exception.Message }

  $pendingRestart = @()
  if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $pendingRestart += 'WindowsUpdate' }
  if (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\PendingFileRenameOperations') { $pendingRestart += 'PendingFileRenameOperations' }
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    System = [pscustomobject]@{
      Caption = [string]$os.Caption; Build = [string]$os.BuildNumber; LastBoot = if ($os.LastBootUpTime) { ([datetime]$os.LastBootUpTime).ToString('o') } else { $null }
      InstalledProgramCount = $installedPrograms.Count; PendingRestartSignals = $pendingRestart
    }
    Winget = [pscustomobject]$winget
    UpdateServices = $updateServices
    DriverOffers = [pscustomobject]$driverOffers
    Catalog = $catalogState
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Installed-program registry', 'winget --version and source list', 'Windows Update driver search', 'Windows Update and BITS services', 'reboot evidence registry keys')
      Notice = 'Read-only post-install inventory. Catalog rows are optional exact Winget identifiers, not recommendations. No source is refreshed, no update is downloaded, and no app or driver is installed by this preview.'
    }
  }
  $preview | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-postinstall-preview.json') -Encoding UTF8
  $Session.ItemsFound = $catalogState.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Post-install inventory and update availability were read only; no package source, application, driver, service, or system setting was changed.'
  if ($EmitJson) {
    Write-Output '---KNOUX_POST_INSTALL_JSON_START---'
    $preview | ConvertTo-Json -Depth 7 -Compress
    Write-Output '---KNOUX_POST_INSTALL_JSON_END---'
  } else {
    Write-Host ('[OK] Read post-install inventory for {0} catalog item(s); no changes made.' -f $catalogState.Count) -ForegroundColor Green
  }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}

$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
