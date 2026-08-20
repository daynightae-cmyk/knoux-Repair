[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [string]$Selection)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'PI04' -ToolName 'Install Essential Apps' -Category '17-PostInstall-Setup' -RiskLevel 'SYSTEM_REPAIR'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  if([string]::IsNullOrWhiteSpace($Selection)){throw 'Selection is required.'};$catalog=@('Google.Chrome','7zip.7zip','VideoLAN.VLC','Microsoft.VisualStudioCode','Microsoft.PowerToys','Notepad++.Notepad++','voidtools.Everything','WinDirStat.WinDirStat');$numbers=$Selection-split ','|ForEach-Object {[int]$_.Trim()};$ids=foreach($number in $numbers){if($number -lt 1 -or $number -gt $catalog.Count){throw 'Selection outside catalog range.'};$catalog[$number-1]}
  if($AnalyzeOnly -or $WhatIf){$ids|Set-Content (Join-Path $Session.RawDir 'essential-app-selection.txt') -Encoding UTF8;$Session.VerificationPerformed=$true;$Session.VerificationResult='Selected catalog identifiers exported';Write-Host ('[ANALYZE] Would install '+$ids.Count+' essential apps.') -ForegroundColor Green}else{foreach($id in $ids){& winget.exe install --id $id --exact --silent --accept-package-agreements --accept-source-agreements 2>&1|Add-Content (Join-Path $Session.RawDir 'essential-apps-install.txt');if($LASTEXITCODE -ne 0){throw ('winget install failed for '+$id)};$Session.ItemsProcessed++};$Session.ChangedSystem=$true;$Session.VerificationPerformed=$true;$Session.VerificationResult='Selected essential apps installed';Write-Host ('[OK] Installed '+$Session.ItemsProcessed+' apps.') -ForegroundColor Green}
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
