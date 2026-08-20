[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW01' -ToolName 'Discover Installed Software' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $keys=@('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')
  $desktop=foreach($key in $keys){Get-ItemProperty $key -ErrorAction SilentlyContinue|Where-Object {$_.DisplayName}|ForEach-Object {[pscustomobject]@{Type='Desktop';Name=$_.DisplayName;Version=$_.DisplayVersion;Publisher=$_.Publisher;UninstallString=$_.UninstallString}}}
  $appx=Get-AppxPackage -ErrorAction SilentlyContinue|ForEach-Object {[pscustomobject]@{Type='Appx';Name=$_.Name;Version=$_.Version;Publisher=$_.Publisher;UninstallString=('Remove-AppxPackage -Package '+$_.PackageFullName)}}
  $items=@($desktop)+@($appx);$items|Sort-Object Type,Name -Unique|Export-Csv (Join-Path $Session.RawDir 'installed-software.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound=$items.Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Software inventory exported';Write-Host ('[OK] Inventoried '+$items.Count+' software records.') -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
