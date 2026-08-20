#Requires -Version 5.1
# Knoux Repair v2.0.2 | 11-Backup-Recovery | BR04 - Interactive Backup & Recovery Preview
# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [switch]$EmitJson)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

function Convert-KnouxDate([object]$value) {
  if ($null -eq $value) { return $null }
  try { return [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$value).ToString('o') } catch { }
  try { return ([datetime]$value).ToString('o') } catch { return [string]$value }
}

$Session = Start-KnouxSession -ToolId 'BR04' -ToolName 'Interactive Backup & Recovery Preview' -Category '11-Backup-Recovery' -RiskLevel 'READ_ONLY'
try {
  $restoreQueryAvailable = $true
  $restorePoints = @()
  try {
    $restorePoints = @(Get-ComputerRestorePoint -ErrorAction Stop | Sort-Object SequenceNumber -Descending | Select-Object -First 12 | ForEach-Object {
      [pscustomobject]@{
        SequenceNumber = [int]$_.SequenceNumber
        Description = [string]$_.Description
        RestorePointType = [int]$_.RestorePointType
        CreatedAt = Convert-KnouxDate $_.CreationTime
      }
    })
  } catch { $restoreQueryAvailable = $false }

  $vssQueryAvailable = $true
  $shadows = @()
  try {
    $shadows = @(Get-CimInstance Win32_ShadowCopy -ErrorAction Stop | Sort-Object InstallDate -Descending | Select-Object -First 10 | ForEach-Object {
      [pscustomobject]@{
        Id = [string]$_.ID
        Volume = [string]$_.VolumeName
        CreatedAt = Convert-KnouxDate $_.InstallDate
        Persistent = [bool]$_.Persistent
        ClientAccessible = [bool]$_.ClientAccessible
      }
    })
  } catch { $vssQueryAvailable = $false }

  $backupRoot = Join-Path $Session.ProjectRoot 'Backups'
  $backupRootAvailable = Test-Path -LiteralPath $backupRoot
  $backups = @()
  if ($backupRootAvailable) {
    $backups = @(Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 12 | ForEach-Object {
      $files = @(Get-ChildItem -LiteralPath $_.FullName -File -Recurse -ErrorAction SilentlyContinue)
      $size = ($files | Measure-Object -Property Length -Sum).Sum
      [pscustomobject]@{
        Name = [string]$_.Name
        Path = [string]$_.FullName
        LastWriteAt = $_.LastWriteTime.ToString('o')
        FileCount = $files.Count
        SizeBytes = if ($null -eq $size) { 0 } else { [int64]$size }
      }
    })
  }

  $sourceFolders = @('Documents', 'Desktop', 'Pictures', 'Music', 'Videos') | ForEach-Object {
    $folderPath = Join-Path $env:USERPROFILE $_
    [pscustomobject]@{ Name = $_; Path = $folderPath; Exists = [bool](Test-Path -LiteralPath $folderPath) }
  }
  $projectDrive = [System.IO.Path]::GetPathRoot($Session.ProjectRoot).TrimEnd('\\')
  $drive = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue | Where-Object { $_.DeviceID -eq $projectDrive } | Select-Object -First 1
  $freeGb = if ($drive) { [math]::Round($drive.FreeSpace / 1GB, 1) } else { $null }
  $totalGb = if ($drive) { [math]::Round($drive.Size / 1GB, 1) } else { $null }

  $preview = [pscustomobject]@{
    CapturedAt = (Get-Date).ToString('o')
    RestorePoints = [pscustomobject]@{
      QueryAvailable = $restoreQueryAvailable
      Count = $restorePoints.Count
      Items = $restorePoints
    }
    ShadowCopies = [pscustomobject]@{
      QueryAvailable = $vssQueryAvailable
      Count = $shadows.Count
      Items = $shadows
    }
    LocalBackups = [pscustomobject]@{
      Root = $backupRoot
      RootAvailable = $backupRootAvailable
      Count = $backups.Count
      Latest = if ($backups.Count) { $backups[0] } else { $null }
      Items = $backups
    }
    BackupSources = $sourceFolders
    Storage = [pscustomobject]@{ ProjectDrive = $projectDrive; FreeGB = $freeGb; TotalGB = $totalGb }
    Safety = [pscustomobject]@{
      ChangesMade = $false
      Sources = @('Get-ComputerRestorePoint', 'Win32_ShadowCopy', 'Backups directory inventory', 'Win32_LogicalDisk')
      Notice = 'Read-only backup and recovery inventory. No restore point, shadow copy, backup folder, or user file is created, deleted, copied, or restored.'
    }
  }

  $preview | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'interactive-backup-recovery-preview.json') -Encoding UTF8
  $Session.ItemsFound = $restorePoints.Count + $shadows.Count + $backups.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = 'Restore points, VSS snapshots, and local backup folders were inventoried locally; no backup or restore operation was performed.'
  if ($EmitJson) {
    Write-Output '---KNOUX_BACKUP_RECOVERY_JSON_START---'
    $preview | ConvertTo-Json -Depth 8 -Compress
    Write-Output '---KNOUX_BACKUP_RECOVERY_JSON_END---'
  } else {
    Write-Host ('[OK] Read {0} restore point(s), {1} shadow copy item(s), and {2} local backup(s); no changes made.' -f $restorePoints.Count, $shadows.Count, $backups.Count) -ForegroundColor Green
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
