[CmdletBinding()]
param([string]$Selection, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT10' -ToolName 'Release Development Servers' -Category '12-Developer-Tools' -RiskLevel 'SYSTEM_REPAIR'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $allowed = @('node','node.exe','bun','bun.exe','deno','deno.exe','python','python.exe','pythonw','pythonw.exe','dotnet','dotnet.exe','java','java.exe','php','php.exe','ruby','ruby.exe')
  $entries = @()
  foreach ($listener in @(Get-NetTCPConnection -State Listen -ErrorAction Stop)) {
    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if (-not $process -or $allowed -notcontains $process.ProcessName.ToLowerInvariant()) { continue }
    if ($entries | Where-Object { $_.ProcessId -eq $listener.OwningProcess }) { continue }
    $entries += [pscustomobject]@{ Index=($entries.Count+1); ProcessId=$listener.OwningProcess; Process=$process.ProcessName; Port=[int]$listener.LocalPort; Address=$listener.LocalAddress; Started=if($process.StartTime){$process.StartTime.ToString('o')}else{''} }
  }
  $entries | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'development-server-candidates.json') -Encoding UTF8
  $Session.ItemsFound = $entries.Count
  foreach ($entry in $entries) { Write-Host ('[{0}] {1} PID {2} listening on {3}' -f $entry.Index,$entry.Process,$entry.ProcessId,$entry.Port) }
  if ($AnalyzeOnly -or $WhatIf) {
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = ('Listed {0} releasable development servers.' -f $entries.Count)
    Write-Host ('[ANALYZE] {0} developer servers are listed; nothing was stopped.' -f $entries.Count) -ForegroundColor Green
  } else {
    if ([string]::IsNullOrWhiteSpace($Selection)) { throw 'Run Analyze first, then enter the exact server item numbers to stop.' }
    if (-not (Confirm-KnouxAction -Prompt 'Confirm selected development-server release.')) { throw 'Action was not confirmed.' }
    $selectedIndexes = @($Selection -split ',' | ForEach-Object { [int]$_.Trim() })
    $selected = @($entries | Where-Object { $selectedIndexes -contains $_.Index })
    if ($selected.Count -ne $selectedIndexes.Count) { throw 'One or more selected server numbers are not available.' }
    foreach ($entry in $selected) {
      Stop-Process -Id $entry.ProcessId -Force -ErrorAction Stop
      $Session.ItemsProcessed++
      Write-Host ('[OK] Stopped {0} (PID {1}) on port {2}.' -f $entry.Process,$entry.ProcessId,$entry.Port) -ForegroundColor Green
    }
    $Session.ChangedSystem = $true
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = ('Stopped {0} selected development server processes.' -f $Session.ItemsProcessed)
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
