#Requires -Version 5.1
# Knoux Repair v2.0.2 | 05-Duplicate-Files | DF11 - Interactive Duplicate Preview
# Risk: READ_ONLY
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$LocalSourcePath,
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

$Session = Start-KnouxSession -ToolId 'DF11' -ToolName 'Interactive Duplicate Preview' -Category '05-Duplicate-Files' -RiskLevel 'READ_ONLY'
try {
  if (-not [IO.Path]::IsPathRooted($LocalSourcePath)) { throw 'A rooted folder path is required.' }
  if (-not (Test-Path -LiteralPath $LocalSourcePath -PathType Container)) { throw 'The selected folder does not exist.' }
  $root = (Resolve-Path -LiteralPath $LocalSourcePath).Path
  $files = @(Get-KnouxScanFiles -Roots @($root) -MinBytes 1024)
  $groups = @(Find-KnouxDuplicateGroups -Files $files -HashByteBudget 500MB)
  $rows = @($groups | Sort-Object { ($_.Duplicates | Measure-Object Length -Sum).Sum } -Descending | Select-Object -First 200 | ForEach-Object {
    $members = @($_.Files | ForEach-Object { [pscustomobject]@{ Path=$_.FullName; Name=$_.Name; Extension=$_.Extension; SizeBytes=[int64]$_.Length; LastWriteUtc=$_.LastWriteTimeUtc.ToString('o') } })
    [pscustomobject]@{
      Id = $_.Hash
      Hash = $_.Hash
      Copies = $members.Count
      DuplicateCopies = @($_.Duplicates).Count
      RecoverableBytes = [int64](($_.Duplicates | Measure-Object Length -Sum).Sum)
      KeepPath = $_.Files[0].FullName
      Files = $members
    }
  })
  $payload = [pscustomobject]@{
    Folder = $root
    FilesObserved = $files.Count
    Groups = $rows
    GroupCount = $groups.Count
    DuplicateCopies = @($groups | ForEach-Object { @($_.Duplicates).Count } | Measure-Object -Sum).Sum
    RecoverableBytes = [int64](@($groups | ForEach-Object { ($_.Duplicates | Measure-Object Length -Sum).Sum } | Measure-Object -Sum).Sum)
    Truncated = $groups.Count -gt $rows.Count
    Safety = [pscustomobject]@{ ChangesMade=$false; HashByteBudget='500MB'; MaxGroupsShown=$rows.Count }
  }
  $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-duplicate-preview.json') -Encoding UTF8
  $Session.ItemsFound = $groups.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Duplicate groups calculated from the selected folder; no changes made.'
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
