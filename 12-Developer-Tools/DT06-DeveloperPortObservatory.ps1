# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT06' -ToolName 'Developer Port Observatory' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $allowed = @('node','node.exe','bun','bun.exe','deno','deno.exe','python','python.exe','pythonw','pythonw.exe','dotnet','dotnet.exe','java','java.exe','php','php.exe','ruby','ruby.exe')
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop)
  $rows = foreach ($listener in $listeners) {
    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if (-not $process -or $allowed -notcontains $process.ProcessName.ToLowerInvariant()) { continue }
    [pscustomobject]@{ Port=[int]$listener.LocalPort; Address=$listener.LocalAddress; Process=$process.ProcessName; ProcessId=$listener.OwningProcess; Started=if($process.StartTime){$process.StartTime.ToString('o')}else{''}; Path=if($process.Path){$process.Path}else{''} }
  }
  $rows = @($rows | Sort-Object Port,Process,ProcessId)
  $rows | Export-Csv (Join-Path $Session.RawDir 'developer-ports.csv') -NoTypeInformation -Encoding UTF8
  $rows | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'developer-ports.json') -Encoding UTF8
  $Session.ItemsFound = $rows.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Found {0} active developer-process listeners.' -f $rows.Count)
  Write-Host ('[OK] Found {0} active developer-process listeners.' -f $rows.Count) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
