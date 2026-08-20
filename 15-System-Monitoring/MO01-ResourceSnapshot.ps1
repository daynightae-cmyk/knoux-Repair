# knoux Repair v2.0.2 | 15-System-Monitoring | MO01 - Resource Snapshot
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'MO01' -ToolName 'Resource Snapshot' -Category '15-System-Monitoring' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$os = Get-CimInstance Win32_OperatingSystem; $cpu = Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average; $disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,Size,FreeSpace
  [pscustomobject]@{ Timestamp=(Get-Date).ToString('o'); TotalMemory=$os.TotalVisibleMemorySize; FreeMemory=$os.FreePhysicalMemory; CpuLoad=$cpu.Average; Disks=$disk } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'resource-snapshot.json') -Encoding UTF8
  $Session.ItemsFound = @($disk).Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Resource snapshot exported'; Write-Host '[OK] Resource snapshot captured.' -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
