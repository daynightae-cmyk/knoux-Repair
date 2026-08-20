# knoux Repair v2.0.2 | 13-Privacy | PR02 - Clear Run Dialog History
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PR02' -ToolName 'Clear Run Dialog History' -Category '13-Privacy' -RiskLevel 'DESTRUCTIVE'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$path = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU'
  $backup = Join-Path $Session.RawDir 'runmru-backup.json'
  $Session.BackupPath = $backup
  $valueNames = @()
  if (Test-Path $path) { $item = Get-ItemProperty -Path $path; $valueNames = @($item.PSObject.Properties | Where-Object { $_.Name -match '^[a-z]$' } | Select-Object -ExpandProperty Name); $item | ConvertTo-Json -Depth 3 | Set-Content $backup -Encoding UTF8 }
  $Session.ItemsFound = $valueNames.Count
  if ($AnalyzeOnly -or $WhatIf) { Write-Host ('[ANALYZE] {0} RunMRU values would be cleared after export.' -f $valueNames.Count) -ForegroundColor Green; $Session.Status = 'Success' }
  else { foreach ($name in $valueNames) { Remove-ItemProperty -Path $path -Name $name -ErrorAction Stop; $Session.ItemsProcessed++ }; $Session.ChangedSystem = $true; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Run dialog history values removed'; Write-Host ('[OK] Cleared {0} RunMRU values.' -f $Session.ItemsProcessed) -ForegroundColor Green }
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
