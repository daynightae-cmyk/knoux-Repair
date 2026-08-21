#Requires -Version 5.1
# Knoux Repair v2.0.2 | 05-Duplicate-Files | DF11 - Interactive Duplicate Preview
# Risk: READ_ONLY
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$LocalSourcePath,
  [ValidateSet('all','images','video','documents','audio','archives','other')][string[]]$FileTypes = @('all'),
  [ValidateSet('OldestThenAlphabetical','Newest')][string]$KeeperPolicy = 'OldestThenAlphabetical',
  [switch]$AnalyzeOnly,
  [switch]$WhatIf,
  [switch]$EmitJson
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$TypeMap = @{
  images    = @('.jpg','.jpeg','.png','.gif','.webp','.bmp','.tif','.tiff','.heic','.raw','.svg')
  video     = @('.mp4','.mkv','.avi','.mov','.wmv','.webm','.m4v','.flv')
  documents = @('.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.rtf','.odt','.ods','.csv')
  audio     = @('.mp3','.wav','.flac','.aac','.m4a','.ogg','.wma')
  archives  = @('.zip','.rar','.7z','.tar','.gz','.bz2','.iso')
  other     = @('.exe','.msi','.json','.xml','.log','.sql','.ps1','.bat','.cmd')
}

$Session = Start-KnouxSession -ToolId 'DF11' -ToolName 'Interactive Duplicate Preview' -Category '05-Duplicate-Files' -RiskLevel 'READ_ONLY'
try {
  if (-not [IO.Path]::IsPathRooted($LocalSourcePath)) { throw 'A rooted folder path is required.' }
  if (-not (Test-Path -LiteralPath $LocalSourcePath -PathType Container)) { throw 'The selected folder does not exist.' }
  $root = (Resolve-Path -LiteralPath $LocalSourcePath).Path
  $requestedTypes = @($FileTypes | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique)
  $extensions = @()
  if ($requestedTypes -notcontains 'all') {
    foreach ($type in $requestedTypes) { if ($TypeMap.ContainsKey($type)) { $extensions += $TypeMap[$type] } }
    $extensions = @($extensions | Select-Object -Unique)
    if ($extensions.Count -eq 0) { throw 'No eligible file extensions were selected.' }
  }

  $files = @(Get-KnouxScanFiles -Roots @($root) -IncludeExtensions $extensions -MinBytes 1024)
  $groups = @(Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB -KeeperPolicy $KeeperPolicy -ExcludeSubstrings @('\.git\','\node_modules\','\Quarantine\'))
  $rows = @($groups | Sort-Object BytesPotentiallyRecoverable -Descending | Select-Object -First 200 | ForEach-Object {
    $members = @($_.Files | Sort-Object FullName | ForEach-Object { [pscustomobject]@{ Path=$_.FullName; Name=$_.Name; Extension=$_.Extension; SizeBytes=[int64]$_.Length; LastWriteUtc=$_.LastWriteTimeUtc.ToString('o') } })
    [pscustomobject]@{
      Id = $_.Hash
      Hash = $_.Hash
      Copies = $members.Count
      DuplicateCopies = @($_.Duplicates).Count
      RecoverableBytes = [int64]$_.BytesPotentiallyRecoverable
      KeepPath = $_.Keeper.FullName
      HardLinkInvolved = [bool]$_.HardLinkInvolved
      Files = $members
    }
  })
  $payload = [pscustomobject]@{
    Folder = $root
    FileTypes = $requestedTypes
    KeeperPolicy = $KeeperPolicy
    FilesObserved = $files.Count
    Groups = $rows
    GroupCount = $groups.Count
    DuplicateCopies = [int](@($groups | ForEach-Object { @($_.Duplicates).Count } | Measure-Object -Sum).Sum)
    RecoverableBytes = [int64](@($groups | ForEach-Object { $_.BytesPotentiallyRecoverable } | Measure-Object -Sum).Sum)
    Truncated = $groups.Count -gt $rows.Count
    Safety = [pscustomobject]@{ ChangesMade=$false; HashByteBudget='500MB'; MaxGroupsShown=$rows.Count; ExcludedPaths=@('.git','node_modules','Quarantine') }
  }
  $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-duplicate-preview.json') -Encoding UTF8
  $Session.ItemsFound = $groups.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Duplicate groups calculated from the selected folder and file types; no changes made.'
  if ($EmitJson) {
    Write-Output '---KNOUX_DUPLICATES_JSON_START---'
    $payload | ConvertTo-Json -Depth 8 -Compress
    Write-Output '---KNOUX_DUPLICATES_JSON_END---'
  } else {
    Write-Host ('[OK] {0} duplicate group(s) found in {1}.' -f $groups.Count, $root) -ForegroundColor Green
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
