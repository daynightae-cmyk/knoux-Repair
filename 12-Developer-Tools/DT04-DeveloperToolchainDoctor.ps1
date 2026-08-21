# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT04' -ToolName 'Developer Toolchain Doctor' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $tools = @('git','node','npm','pnpm','corepack','yarn','bun','python','py','pip','dotnet','java','go','rustc','code','cursor','docker')
  $rows = foreach ($tool in $tools) {
    $resolved = @(Get-Command $tool -All -ErrorAction SilentlyContinue)
    $primary = $resolved | Select-Object -First 1
    $version = ''
    if ($primary) { try { $version = ((& $primary.Source --version 2>&1 | Select-Object -First 1) -join '').Trim() } catch { $version = '' } }
    [pscustomobject]@{ Tool=$tool; Available=[bool]$primary; Version=$version; PrimarySource=if($primary){$primary.Source}else{''}; CandidateCount=$resolved.Count; Candidates=($resolved | ForEach-Object { $_.Source }) -join '; ' }
  }
  $rows | Export-Csv (Join-Path $Session.RawDir 'toolchain-doctor.csv') -NoTypeInformation -Encoding UTF8
  $rows | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Session.RawDir 'toolchain-doctor.json') -Encoding UTF8
  $missing = @($rows | Where-Object { -not $_.Available } | ForEach-Object { $_.Tool })
  $duplicates = @($rows | Where-Object { $_.CandidateCount -gt 1 } | ForEach-Object { $_.Tool })
  [pscustomobject]@{ Missing=$missing; DuplicateCommands=$duplicates; Available=(@($rows | Where-Object Available).Count); Checked=$rows.Count } | ConvertTo-Json | Set-Content (Join-Path $Session.RawDir 'toolchain-summary.json') -Encoding UTF8
  $Session.ItemsFound = $rows.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Checked {0} tools; {1} available; {2} command collisions.' -f $rows.Count, (@($rows | Where-Object Available).Count), $duplicates.Count)
  Write-Host ('[OK] Toolchain doctor checked {0} developer commands.' -f $rows.Count) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
