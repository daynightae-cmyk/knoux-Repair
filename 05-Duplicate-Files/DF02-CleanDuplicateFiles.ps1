#Requires -Version 5.1
# Knoux Repair v2.0.2 | 05-Duplicate-Files | DF02 - Clean Duplicate Files
# Risk: DESTRUCTIVE | Quarantine-backed
[CmdletBinding()]
param(
  [string]$LocalSourcePath,
  [ValidateSet('all','images','video','documents','audio','archives','other')][string[]]$FileTypes = @('all'),
  [ValidateSet('OldestThenAlphabetical','Newest')][string]$KeeperPolicy = 'OldestThenAlphabetical',
  [string]$PlanPath,
  [switch]$AnalyzeOnly,
  [switch]$WhatIf
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$TypeMap = @{
  images    = @('.jpg','.jpeg','.png','.gif','.webp','.bmp','.tif','.tiff','.heic','.raw','.svg')
  video     = @('.mp4','.mkv','.avi','.mov','.wmv','.webm','.m4v','.flv')
  documents = @('.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.rtf','.odt','.ods','.csv')
  audio     = @('.mp3','.wav','.flac','.aac','.m4a','.ogg','.wma')
  archives  = @('.zip','.rar','.7z','.tar','.gz','.bz2','.iso')
  other     = @('.exe','.msi','.json','.xml','.log','.sql','.ps1','.bat','.cmd')
}
function Test-KnouxPathInsideRoot {
  param([Parameter(Mandatory)][string]$Path,[Parameter(Mandatory)][string]$Root)
  $full = [IO.Path]::GetFullPath($Path)
  $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  return $full.Equals($rootFull,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($rootFull + '\',[StringComparison]::OrdinalIgnoreCase)
}
function Get-KnouxBase64Sha256 {
  param([Parameter(Mandatory)][string]$Path)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $stream = [System.IO.File]::OpenRead($Path)
  try { return [Convert]::ToBase64String($sha.ComputeHash($stream)) }
  finally { $stream.Dispose(); $sha.Dispose() }
}

$Session = Start-KnouxSession -ToolId 'DF02' -ToolName 'Clean Duplicate Files' -Category '05-Duplicate-Files' -RiskLevel 'DESTRUCTIVE'
$rc = 0
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $roots = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) {
    @([Environment]::GetFolderPath('MyDocuments'),(Join-Path $env:USERPROFILE 'Downloads'),[Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('MyPictures'),[Environment]::GetFolderPath('MyMusic'),[Environment]::GetFolderPath('MyVideos')) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  } else {
    if (-not [IO.Path]::IsPathRooted($LocalSourcePath) -or -not (Test-Path -LiteralPath $LocalSourcePath -PathType Container)) { throw 'The selected local folder is unavailable.' }
    @((Resolve-Path -LiteralPath $LocalSourcePath).Path)
  }
  if (@($roots).Count -ne 1 -and $PlanPath) { throw 'A custom duplicate plan requires one selected folder.' }

  $toQuarantine = @()
  $planLabel = 'policy scan'
  if ($PlanPath) {
    if (-not (Test-Path -LiteralPath $PlanPath -PathType Leaf)) { throw 'The selected duplicate plan is unavailable.' }
    $plan = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $plan -or -not $plan.Folder -or -not $plan.Groups) { throw 'The duplicate plan is malformed.' }
    $root = @($roots)[0]
    if (-not ([IO.Path]::GetFullPath([string]$plan.Folder).TrimEnd('\')).Equals([IO.Path]::GetFullPath($root).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)) { throw 'The duplicate plan does not belong to the selected folder.' }
    $planned = @($plan.Groups)
    if ($planned.Count -eq 0 -or $planned.Count -gt 200) { throw 'The duplicate plan has no eligible groups.' }
    foreach ($group in $planned) {
      $paths = @($group.Paths | ForEach-Object { [string]$_ } | Select-Object -Unique)
      $keep = [string]$group.KeepPath
      $expectedHash = [string]$group.Hash
      if ($paths.Count -lt 2 -or -not $paths.Contains($keep) -or -not $expectedHash) { throw 'The duplicate plan contains an invalid group.' }
      foreach ($candidate in $paths) {
        if (-not (Test-KnouxPathInsideRoot -Path $candidate -Root $root)) { throw 'The duplicate plan contains a path outside the selected folder.' }
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { throw "A planned file no longer exists: $candidate" }
        if ((Get-KnouxBase64Sha256 -Path $candidate) -ne $expectedHash) { throw "A planned file changed since preview: $candidate" }
      }
      $toQuarantine += @($paths | Where-Object { -not $_.Equals($keep,[StringComparison]::OrdinalIgnoreCase) })
    }
    $planLabel = 'user-selected plan'
  } else {
    $requestedTypes = @($FileTypes | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique)
    $extensions = @()
    if ($requestedTypes -notcontains 'all') { foreach ($type in $requestedTypes) { if ($TypeMap.ContainsKey($type)) { $extensions += $TypeMap[$type] } }; $extensions = @($extensions | Select-Object -Unique) }
    Write-Host 'Scanning user folders (bounded)...' -ForegroundColor Cyan
    $files = Get-KnouxScanFiles -Roots $roots -IncludeExtensions $extensions -MinBytes 1024
    $groups = Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB -KeeperPolicy $KeeperPolicy -ExcludeSubstrings @('\.git\','\node_modules\','\Quarantine\')
    foreach ($g in $groups) { foreach ($d in @($g.Duplicates)) { $toQuarantine += $d.FullName } }
  }

  $toQuarantine = @($toQuarantine | Select-Object -Unique)
  $Session.ItemsFound = $toQuarantine.Count
  if ($toQuarantine.Count -eq 0) {
    Write-Host '[OK] No duplicate copies matched the selected controls.' -ForegroundColor Green
    $Session.Status = 'Success'
    Write-KnouxLog -Session $Session 'No duplicate copies matched the selected controls.'
  } else {
    Write-Host ('{0} duplicate copy(ies) in {1}:' -f $toQuarantine.Count,$planLabel) -ForegroundColor Cyan
    $toQuarantine | Select-Object -First 20 | ForEach-Object { Write-Host ('  ' + $_) }
    if ($toQuarantine.Count -gt 20) { Write-Host ('  ... and ' + ($toQuarantine.Count - 20) + ' more.') }
    if ($AnalyzeOnly -or $WhatIf) {
      Write-Host '[ANALYZE] No changes made. Run without -AnalyzeOnly to quarantine the listed copies.' -ForegroundColor Green
      $Session.Status = 'Success'
      Write-KnouxLog -Session $Session ("Analyze: {0} selected duplicates, no changes" -f $toQuarantine.Count)
    } elseif (Confirm-KnouxDestructiveAction -Phrase 'QUARANTINE DUPLICATES' -Prompt 'Quarantine only the selected duplicate copies? (type QUARANTINE DUPLICATES to confirm): ') {
      $moved = 0; $quarantinedBytes = [int64]0; $verified = 0; $quarantinePaths = @()
      foreach ($p in $toQuarantine) {
        $dest = Move-KnouxItemToQuarantine -Path $p -ToolId 'DF02' -ProjectRoot (Split-Path $PSScriptRoot -Parent) -Session $Session
        if ($dest) { $moved++; $quarantinedBytes += [int64]$dest.SizeBytes; $quarantinePaths += $dest.QuarantinePath; if ($dest.TransactionState -eq 'COMPLETE') { $verified++ }; Write-KnouxLog -Session $Session ("Quarantined $p") }
      }
      $Session.BytesQuarantined = $quarantinedBytes
      $Session.QuarantinedCount = $moved
      $Session.QuarantinePath = (Join-Path (Join-Path (Split-Path $PSScriptRoot -Parent) 'Quarantine') 'DF02')
      $Session.VerificationPerformed = $true
      $Session.VerificationResult = "$verified of $moved quarantine transactions completed and can be restored from the Quarantine panel."
      if ($moved -eq $toQuarantine.Count) { $Session.Status = 'Success' } elseif ($moved -gt 0) { $Session.Status = 'Warning'; $Session.ErrorMessage = "$($toQuarantine.Count - $moved) selected duplicate(s) could not be quarantined." } else { $Session.Status = 'Failed'; $Session.ErrorMessage = 'No selected duplicate could be quarantined.' }
      $Session.ChangedSystem = ($moved -gt 0)
      $Session.ItemsProcessed = $moved
      Write-Host ('[OK] Quarantined {0} selected duplicate(s). Restore is available from the duplicate station.' -f $moved) -ForegroundColor $(if ($moved -eq $toQuarantine.Count) { 'Green' } elseif ($moved -gt 0) { 'Yellow' } else { 'Red' })
    } else { $Session.Status = 'Cancelled'; Write-Host '[CANCELLED] No changes made.' -ForegroundColor Yellow }
  }
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage 'ERROR'
  if ($_.ScriptStackTrace) { Write-KnouxLog -Session $Session -Message $_.ScriptStackTrace 'ERROR' }
}
$Session.ExitCode = $rc
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
