# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW02' -ToolName 'Audit Development Environments' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $names='winget','git','node','npm','pnpm','yarn','python','pip','dotnet','java','go','rustc','code'
  $items=foreach($name in $names){$cmd=Get-Command $name -ErrorAction SilentlyContinue;[pscustomobject]@{Command=$name;Available=[bool]$cmd;Source=if($cmd){$cmd.Source}else{''};Version=if($cmd){try{(& $cmd.Source '--version' 2>$null|Select-Object -First 1)}catch{''}}else{''}}}
  $items|Export-Csv (Join-Path $Session.RawDir 'development-environments.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound=$items.Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Developer environment audit exported';Write-Host ('[OK] Audited '+$items.Count+' developer tools.') -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
