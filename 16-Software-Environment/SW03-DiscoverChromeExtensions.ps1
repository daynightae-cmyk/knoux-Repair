[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW03' -ToolName 'Discover Chrome Extensions' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $root=Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data';$profiles=Get-ChildItem $root -Directory -ErrorAction SilentlyContinue|Where-Object {Test-Path (Join-Path $_.FullName 'Extensions')}
  $items=foreach($profile in $profiles){Get-ChildItem (Join-Path $profile.FullName 'Extensions') -Directory -ErrorAction SilentlyContinue|ForEach-Object {$id=$_.Name;Get-ChildItem $_.FullName -Directory -ErrorAction SilentlyContinue|ForEach-Object {$manifest=Join-Path $_.FullName 'manifest.json';if(Test-Path $manifest){try{$data=Get-Content $manifest -Raw|ConvertFrom-Json;[pscustomobject]@{Profile=$profile.Name;ExtensionId=$id;Version=$_.Name;Name=$data.name;Description=$data.description;Manifest=$manifest}}catch{}}}}}
  $items|Export-Csv (Join-Path $Session.RawDir 'chrome-extensions.csv') -NoTypeInformation -Encoding UTF8
  $Session.ItemsFound=@($items).Count;$Session.VerificationPerformed=$true;$Session.VerificationResult='Chrome extension manifests exported';Write-Host ('[OK] Found '+$Session.ItemsFound+' Chrome extension versions.') -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
