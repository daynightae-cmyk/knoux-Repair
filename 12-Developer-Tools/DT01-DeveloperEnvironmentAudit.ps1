# knoux Repair v2.0.2 | 12-Developer-Tools | DT01 - Developer Environment Audit
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'DT01' -ToolName 'Developer Environment Audit' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
$commands = 'git','node','npm','pnpm','python','pip','dotnet','java','go','rustc','code'
  $rows = foreach ($command in $commands) { $item = Get-Command $command -ErrorAction SilentlyContinue; [pscustomobject]@{ Command=$command; Available=[bool]$item; Source=if($item){$item.Source}else{''}; Version=if($item){try { (& $item.Source '--version' 2>$null | Select-Object -First 1)} catch {''}}else{''} } }
  $rows | Export-Csv (Join-Path $Session.RawDir 'developer-environment.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound = $rows.Count; $Session.VerificationPerformed = $true; $Session.VerificationResult = 'Developer tool availability exported'; Write-Host ('[OK] Audited {0} developer commands.' -f $rows.Count) -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
