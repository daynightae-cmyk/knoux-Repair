#Requires -Version 5.1
# Knoux Repair v2.0.2 | 11-Backup-Recovery | BR05 - Restore Missing Profile Files
# Risk: SYSTEM_REPAIR
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$LocalSourcePath,
  [switch]$AnalyzeOnly,
  [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'BR05' -ToolName 'Restore Missing Profile Files' -Category '11-Backup-Recovery' -RiskLevel 'SYSTEM_REPAIR'

try {
  if (-not $LocalSourcePath) { throw 'A local backup folder must be selected.' }
  $sourceRoot = [System.IO.Path]::GetFullPath($LocalSourcePath)
  if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) { throw 'The selected local backup folder is unavailable.' }

  $allowedNames = @('Documents', 'Desktop', 'Pictures', 'Music', 'Videos')
  $sourceFolders = @(Get-ChildItem -LiteralPath $sourceRoot -Directory -ErrorAction Stop | Where-Object { $_.Name -in $allowedNames })
  if (-not $sourceFolders.Count) { throw 'The selected folder does not contain a supported Knoux user-profile backup.' }

  $candidates = @()
  foreach ($sourceFolder in $sourceFolders) {
    $targetFolder = Join-Path $env:USERPROFILE $sourceFolder.Name
    if (-not (Test-Path -LiteralPath $targetFolder -PathType Container)) { continue }
    Get-ChildItem -LiteralPath $sourceFolder.FullName -File -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
      $relative = $_.FullName.Substring($sourceFolder.FullName.Length).TrimStart('\\')
      $target = Join-Path $targetFolder $relative
      if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        $candidates += [pscustomobject]@{
          Source = $_.FullName
          Target = $target
          RelativePath = (Join-Path $sourceFolder.Name $relative)
          SizeBytes = [int64]$_.Length
        }
      }
    }
  }

  $summary = [pscustomobject]@{
    Source = $sourceRoot
    Mode = if ($AnalyzeOnly -or $WhatIf) { 'AnalyzeOnly' } else { 'RestoreMissingOnly' }
    CandidateCount = $candidates.Count
    CandidateBytes = [int64](($candidates | Measure-Object -Property SizeBytes -Sum).Sum)
    RestoredCount = 0
    SkippedExistingFiles = $true
    Files = @($candidates | Select-Object -First 200)
  }
  $summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'restore-missing-profile-files-plan.json') -Encoding UTF8
  $Session.ItemsFound = $candidates.Count
  $Session.BackupPath = $sourceRoot

  if ($AnalyzeOnly -or $WhatIf) {
    $Session.Status = 'Success'
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = 'Restore plan generated only. Existing target files would be skipped and no file was copied.'
    Write-Host ('[ANALYZE] {0} missing file(s), totaling {1:N1} MB, could be restored. No files copied.' -f $candidates.Count, ($summary.CandidateBytes / 1MB)) -ForegroundColor Green
  } else {
    foreach ($item in $candidates) {
      $targetDirectory = Split-Path -Parent $item.Target
      if ($PSCmdlet.ShouldProcess($item.Target, 'Copy missing file from selected local backup')) {
        New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
        Copy-Item -LiteralPath $item.Source -Destination $item.Target -Force:$false -ErrorAction Stop
        if (-not (Test-Path -LiteralPath $item.Target -PathType Leaf)) { throw "Verification failed for restored file: $($item.RelativePath)" }
        $summary.RestoredCount++
        $Session.ItemsProcessed++
      }
    }
    $summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'restore-missing-profile-files-result.json') -Encoding UTF8
    $Session.ChangedSystem = $summary.RestoredCount -gt 0
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = "Copied and verified $($summary.RestoredCount) missing file(s); existing destination files were not overwritten."
    $Session.Status = 'Success'
    Write-Host ('[OK] Restored and verified {0} missing file(s). Existing files were not overwritten.' -f $summary.RestoredCount) -ForegroundColor Green
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
