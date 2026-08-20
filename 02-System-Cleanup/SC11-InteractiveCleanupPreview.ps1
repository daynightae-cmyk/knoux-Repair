#Requires -Version 5.1
# Knoux Repair v2.0.2 | 02-System-Cleanup | SC11 - Interactive Cleanup Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

function Get-KnouxFolderEvidence([string]$Category, [string]$ToolId, [string]$Path, [bool]$UserDataExcluded = $true) {
  $exists = Test-Path -LiteralPath $Path
  $bytes = [int64]0
  $files = 0
  if ($exists) {
    $items = @(Get-ChildItem -LiteralPath $Path -File -Recurse -Force -ErrorAction SilentlyContinue)
    $files = $items.Count
    if ($items.Count -gt 0) { $bytes = [int64](($items | Measure-Object -Property Length -Sum).Sum) }
  }
  [pscustomobject]@{ Category=$Category; ToolId=$ToolId; Path=$Path; Exists=$exists; FileCount=$files; SizeBytes=$bytes; UserDataExcluded=$UserDataExcluded; Evidence='Path metadata and file sizes only; no file contents read.' }
}

$Session = Start-KnouxSession -ToolId 'SC11' -ToolName 'Interactive Cleanup Preview' -Category '02-System-Cleanup' -RiskLevel 'READ_ONLY'
try {
  $targets = @(
    [pscustomobject]@{ Category='User temp'; ToolId='SC01'; Path=$env:TEMP },
    [pscustomobject]@{ Category='Internet cache'; ToolId='SC02'; Path=(Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\INetCache') },
    [pscustomobject]@{ Category='Chrome cache'; ToolId='SC03'; Path=(Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data\Default\Cache') },
    [pscustomobject]@{ Category='Edge cache'; ToolId='SC03'; Path=(Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data\Default\Cache') },
    [pscustomobject]@{ Category='Brave cache'; ToolId='SC03'; Path=(Join-Path $env:LOCALAPPDATA 'BraveSoftware\Brave-Browser\User Data\Default\Cache') },
    [pscustomobject]@{ Category='Explorer thumbnails'; ToolId='SC09'; Path=(Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer') },
    [pscustomobject]@{ Category='Windows temp'; ToolId='SC07'; Path=(Join-Path $env:SystemRoot 'Temp') },
    [pscustomobject]@{ Category='Update download cache'; ToolId='SC06'; Path=(Join-Path $env:SystemRoot 'SoftwareDistribution\Download') },
    [pscustomobject]@{ Category='Windows error reports'; ToolId='SC04'; Path=(Join-Path $env:ProgramData 'Microsoft\Windows\WER') },
    [pscustomobject]@{ Category='npm cache'; ToolId='SW04'; Path=(Join-Path $env:LOCALAPPDATA 'npm-cache') },
    [pscustomobject]@{ Category='Yarn cache'; ToolId='SW04'; Path=(Join-Path $env:LOCALAPPDATA 'Yarn\Cache') },
    [pscustomobject]@{ Category='pip cache'; ToolId='SW04'; Path=(Join-Path $env:LOCALAPPDATA 'pip\Cache') }
  )
  $firefoxProfilesRoot = Join-Path $env:LOCALAPPDATA 'Mozilla\Firefox\Profiles'
  if (Test-Path -LiteralPath $firefoxProfilesRoot) {
    Get-ChildItem -LiteralPath $firefoxProfilesRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      foreach ($cacheName in @('cache2', 'startupCache')) {
        $targets += [pscustomobject]@{ Category=('Firefox ' + $cacheName); ToolId='SC03'; Path=(Join-Path $_.FullName $cacheName) }
      }
    }
  }
  $evidence = @($targets | Where-Object { -not [string]::IsNullOrWhiteSpace($_.Path) } | ForEach-Object { Get-KnouxFolderEvidence -Category $_.Category -ToolId $_.ToolId -Path $_.Path })
  $drives = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Name=$_.DeviceID; TotalBytes=[int64]$_.Size; FreeBytes=[int64]$_.FreeSpace } })
  $quarantineRoot = Join-Path $Session.ProjectRoot 'Quarantine'
  $quarantine = Get-KnouxFolderEvidence -Category 'Knoux quarantine (restorable)' -ToolId 'QUARANTINE' -Path $quarantineRoot -UserDataExcluded $true
  $preview = [pscustomobject]@{
    CapturedAt=(Get-Date).ToString('o')
    Targets=$evidence
    Drives=$drives
    Quarantine=$quarantine
    Summary=[pscustomobject]@{ TargetCount=$evidence.Count; ExistingTargetCount=@($evidence|Where-Object Exists).Count; TotalFiles=([int64](($evidence|Measure-Object FileCount -Sum).Sum)); EstimatedReclaimableBytes=([int64](($evidence|Measure-Object SizeBytes -Sum).Sum)); QuarantineBytes=$quarantine.SizeBytes }
    Safety=[pscustomobject]@{
      ChangesMade=$false
      Sources=@('Local path existence and file metadata', 'Win32_LogicalDisk free-space metadata', 'Knoux Quarantine metadata')
      Excluded=@($env:USERPROFILE+'\Documents', $env:USERPROFILE+'\Downloads', $env:USERPROFILE+'\Desktop', 'Project source files', 'Browser history, cookies, credentials, and extension storage')
      Notice='Read-only cleanup inventory. No file contents are read, no user documents are scanned, no file is deleted or moved, and no service or setting is changed by this preview.'
    }
  }
  $preview | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-cleanup-preview.json') -Encoding UTF8
  $Session.ItemsFound=$evidence.Count; $Session.BytesRecovered=$preview.Summary.EstimatedReclaimableBytes; $Session.VerificationPerformed=$true; $Session.VerificationResult='Cleanup targets and free-space evidence measured read only; no changes made.'
  if ($EmitJson) { Write-Output '---KNOUX_CLEANUP_JSON_START---'; $preview|ConvertTo-Json -Depth 8 -Compress; Write-Output '---KNOUX_CLEANUP_JSON_END---' } else { Write-Host ('[OK] Read {0} cleanup target(s); no changes made.' -f $evidence.Count) -ForegroundColor Green }
} catch {
  $Session.Status='Failed'; $Session.ErrorMessage=$_.Exception.Message; Write-Host ('[ERROR] '+$Session.ErrorMessage) -ForegroundColor Red; Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result=Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
