# Risk: READ_ONLY
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force
$Session = Start-KnouxSession -ToolId 'SW02' -ToolName 'Audit Development Environments' -Category '16-Software-Environment' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  # Expanded toolchain per Service 16 spec: executable resolution + version + registry/file indicators
  $names=@(
    'winget','git','node','npm','pnpm','yarn','python','pip','dotnet','java','go','rustc','cargo','code',
    'cmake','docker','wsl','adb','gradle','pwsh','powershell','code','vulkaninfo','msbuild','nuget'
  ) | Select-Object -Unique
  function Get-ToolVersion($cmdPath, $name) {
    $flags = @('--version','-version','-v','version')
    # Special cases
    if ($name -eq 'java') { $flags = @('-version','--version') }
    if ($name -eq 'gradle') { $flags = @('-v','--version') }
    if ($name -eq 'docker') { $flags = @('--version','version') }
    foreach ($f in $flags) {
      try {
        $out = & $cmdPath $f 2>&1 | Select-Object -First 2 | Out-String
        if ($out -and $out.Trim()) { return ($out -split "`n")[0].Trim() }
      } catch {}
    }
    return ''
  }
  $items=foreach($name in $names){
    $cmd=Get-Command $name -ErrorAction SilentlyContinue
    $src=if($cmd){$cmd.Source}else{''}
    $ver=''
    if($cmd){ try{ $ver=Get-ToolVersion $cmd.Source $name }catch{ $ver='' } }
    # Registry/file fallbacks for .NET, VC++, SDK when not on PATH
    if(-not $cmd -and $name -eq 'dotnet'){
      try{ $reg=Get-ItemProperty 'HKLM:\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedhost' -ErrorAction SilentlyContinue; if($reg -and $reg.Version){ $ver=[string]$reg.Version; $src='HKLM\SOFTWARE\dotnet\Setup'; $cmd=$true } }catch{}
    }
    [pscustomobject]@{Command=$name;Available=[bool]$cmd;Source=$src;Version=$ver}
  }
  # Add registry-only runtimes not on PATH (Visual C++, Windows SDK, WebView2)
  $regChecks=@(
    @{ Name='Visual C++ 2015-2022 Redist'; Reg='HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Pattern='*Visual C++ 2015-2022*' },
    @{ Name='Windows SDK'; Reg='HKLM:\SOFTWARE\Microsoft\Windows Kits\Installed Roots'; Pattern='KitsRoot10' },
    @{ Name='WebView2 Runtime'; Reg='HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'; Pattern='*WebView2*' }
  )
  foreach($rc in $regChecks){
    try{
      $found=$false; $ver=''
      if($rc.Reg -like '*Uninstall*'){
        $found=@(Get-ItemProperty -Path $rc.Reg -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like $rc.Pattern }) | Measure-Object | Select-Object -ExpandProperty Count
        $found=$found -gt 0
      } else {
        $found=Test-Path -LiteralPath $rc.Reg -ErrorAction SilentlyContinue
        if($found){ try{ $r=Get-ItemProperty -LiteralPath $rc.Reg -ErrorAction SilentlyContinue; $ver=[string]$r.Version }catch{} }
      }
      $items+= [pscustomobject]@{Command=$rc.Name; Available=[bool]$found; Source=$rc.Reg; Version=$ver}
    }catch{}
  }
  $items|Export-Csv (Join-Path $Session.RawDir 'development-environments.csv') -NoTypeInformation -Encoding UTF8
  $items | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'development-environments.json') -Encoding UTF8
  $Session.ItemsFound=@($items | Where-Object Available).Count;$Session.VerificationPerformed=$true;$Session.VerificationResult="Developer environment audit: $($items.Count) tools checked, $(@($items | Where-Object Available).Count) available via PATH/registry/file indicators";Write-Host ("[OK] Audited $($items.Count) developer tools ($(@($items | Where-Object Available).Count) available).") -ForegroundColor Green
} catch {
  $Session.Status = 'Failed'; $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
