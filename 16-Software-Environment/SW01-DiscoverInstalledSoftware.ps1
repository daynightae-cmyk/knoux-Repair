# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW01' -ToolName 'Discover Installed Software' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $keys=@('HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')
  # StrictMode-safe registry reads: entries without DisplayName are skipped,
  # missing optional values become empty evidence instead of errors.
  function Get-RegValue($object, $name) {
    if ($null -ne $object -and $null -ne $object.PSObject -and $object.PSObject.Properties[$name]) { return [string]$object.$name }
    return ''
  }
  $desktop=foreach($key in $keys){Get-ItemProperty $key -ErrorAction SilentlyContinue|Where-Object { Get-RegValue $_ 'DisplayName' }|ForEach-Object {[pscustomobject]@{Type='Desktop';Name=(Get-RegValue $_ 'DisplayName');Version=(Get-RegValue $_ 'DisplayVersion');Publisher=(Get-RegValue $_ 'Publisher');UninstallString=(Get-RegValue $_ 'UninstallString')}}}
  $appx=@()
  $appxNote='Appx inventory unavailable on this runtime.'
  try {
    $appx=@(Get-AppxPackage -ErrorAction Stop|ForEach-Object {[pscustomobject]@{Type='Appx';Name=$_.Name;Version=$_.Version;Publisher=$_.Publisher;UninstallString=('Remove-AppxPackage -Package '+$_.PackageFullName)}})
    $appxNote=''
  } catch { Write-KnouxLog -Session $Session -Message ('Appx inventory skipped: ' + $_.Exception.Message) -Level WARN }
  $items=@($desktop)+@($appx);$items|Sort-Object Type,Name -Unique|Export-Csv (Join-Path $Session.RawDir 'installed-software.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound=$items.Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Software inventory exported'+$(if($appxNote){' (desktop registry only)'}else{''});Write-Host ('[OK] Inventoried '+$items.Count+' software records.') -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
