#Requires -Version 5.1
# Knoux Repair v2.0.2 | 16-Software-Environment | SW08 - Advanced Software Environment Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

function Get-KnouxDirectoryBytes([string]$Path) {
  try { return [int64](@(Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum) } catch { return 0 }
}
function Get-KnouxCommandEvidence([string]$Command) {
  try {
    $resolved = Get-Command $Command -ErrorAction Stop | Select-Object -First 1
    $version = (& $resolved.Source --version 2>$null | Select-Object -First 1)
    return [pscustomobject]@{ Command = $Command; Available = $true; Source = [string]$resolved.Source; Version = [string]$version }
  } catch { return [pscustomobject]@{ Command = $Command; Available = $false; Source = $null; Version = $null } }
}

$Session = Start-KnouxSession -ToolId 'SW08' -ToolName 'Advanced Software Environment Preview' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
try {
  $devTools = @('winget','git','node','npm','pnpm','yarn','python','pip','dotnet','java','go','rustc','code') | ForEach-Object { Get-KnouxCommandEvidence $_ }
  $extensions = @()
  try {
    $chromeRoot = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
    if (Test-Path -LiteralPath $chromeRoot) {
      Get-ChildItem -LiteralPath $chromeRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $profile = $_.Name; $extensionsRoot = Join-Path $_.FullName 'Extensions'
        if (Test-Path -LiteralPath $extensionsRoot) {
          Get-ChildItem -LiteralPath $extensionsRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $extensionId = $_.Name
            Get-ChildItem -LiteralPath $_.FullName -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1 | ForEach-Object {
              $manifestPath = Join-Path $_.FullName 'manifest.json'
              if (Test-Path -LiteralPath $manifestPath) {
                try { $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json; $extensions += [pscustomobject]@{ Profile = $profile; ExtensionId = $extensionId; Version = [string]$manifest.version; Name = [string]$manifest.name; Description = [string]$manifest.description } } catch { }
              }
            }
          }
        }
      }
    }
  } catch { }
  $cacheCandidates = @(
    [pscustomobject]@{ Name='npm cache'; Path=(Join-Path $env:LOCALAPPDATA 'npm-cache') },
    [pscustomobject]@{ Name='Yarn cache'; Path=(Join-Path $env:LOCALAPPDATA 'Yarn\Cache') },
    [pscustomobject]@{ Name='pip cache'; Path=(Join-Path $env:LOCALAPPDATA 'pip\Cache') },
    [pscustomobject]@{ Name='Chrome Default cache'; Path=(Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Cache') }
  )
  $cacheEvidence = @($cacheCandidates | ForEach-Object { [pscustomobject]@{ Name=$_.Name; Path=$_.Path; Exists=(Test-Path -LiteralPath $_.Path); SizeBytes=if(Test-Path -LiteralPath $_.Path){Get-KnouxDirectoryBytes $_.Path}else{0} } })
  $winget = [ordered]@{ Available = $false; Version = $null; UpgradeLines = @(); Error = $null }
  try {
    $wingetEvidence = $devTools | Where-Object Command -eq 'winget' | Select-Object -First 1
    if ($wingetEvidence.Available) {
      $winget.Available = $true; $winget.Version = $wingetEvidence.Version
      $lines = @(& winget.exe upgrade --disable-interactivity 2>&1)
      $winget.UpgradeLines = @($lines | Select-Object -First 45 | ForEach-Object { [string]$_ })
    }
  } catch { $winget.Error = $_.Exception.Message }
  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    DeveloperTools = $devTools
    ChromeExtensions = @($extensions | Sort-Object Profile, Name | Select-Object -First 80)
    ChromeExtensionsTruncated = ($extensions.Count -gt 80)
    CacheEvidence = $cacheEvidence
    Winget = [pscustomobject]$winget
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Resolved local executables', 'Chrome extension manifest files', 'Existing cache folder metadata and sizes', 'winget upgrade listing')
      Notice = 'Read-only software-environment inventory. No browser data, browsing history, credentials, extension content, package source, cache folder, application, environment setting, or update is modified by this preview.'
    }
  }
  $preview | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'advanced-software-environment-preview.json') -Encoding UTF8
  $Session.ItemsFound = $devTools.Count + $preview.ChromeExtensions.Count + $cacheEvidence.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Developer tools, extension manifests, cache metadata, and Winget listing were read only; no software or browser data was changed.'
  if ($EmitJson) {
    Write-Output '---KNOUX_SOFTWARE_ADVANCED_JSON_START---'
    $preview | ConvertTo-Json -Depth 7 -Compress
    Write-Output '---KNOUX_SOFTWARE_ADVANCED_JSON_END---'
  } else { Write-Host '[OK] Read advanced software and environment evidence; no changes made.' -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
