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
  $listeners = @()
  $listenerSource = 'Get-NetTCPConnection'
  try {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | ForEach-Object {
      [pscustomobject]@{ LocalPort = [int]$_.LocalPort; LocalAddress = [string]$_.LocalAddress; OwningProcess = [int]$_.OwningProcess }
    })
  } catch {
    # Fallback for hosts where the NetTCPIP CIM class is unavailable
    # ("Invalid class"): parse netstat -ano TCP LISTENING rows instead.
    # Same evidence, no new capability.
    $listenerSource = 'netstat'
    $listeners = @(netstat -ano -p TCP 2>$null | ForEach-Object {
      if ($_ -match '^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
        [pscustomobject]@{ LocalPort = [int]$Matches[2]; LocalAddress = $Matches[1]; OwningProcess = [int]$Matches[3] }
      }
    })
    if (-not $listeners.Count) { throw 'No TCP listeners could be enumerated on this host.' }
  }
  $rows = foreach ($listener in $listeners) {
    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if (-not $process -or $allowed -notcontains $process.ProcessName.ToLowerInvariant()) { continue }
    $started = ''
    try { if ($process.StartTime) { $started = $process.StartTime.ToString('o') } } catch { $started = '' }
    [pscustomobject]@{ Port=[int]$listener.LocalPort; Address=$listener.LocalAddress; Process=$process.ProcessName; ProcessId=$listener.OwningProcess; Started=$started; Path=if($process.Path){$process.Path}else{''} }
  }
  $rows = @($rows | Sort-Object Port,Process,ProcessId)
  $rows | Export-Csv (Join-Path $Session.RawDir 'developer-ports.csv') -NoTypeInformation -Encoding UTF8
  $rows | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'developer-ports.json') -Encoding UTF8
  $Session.ItemsFound = $rows.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Found {0} active developer-process listeners (via {1}).' -f $rows.Count, $listenerSource)
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
