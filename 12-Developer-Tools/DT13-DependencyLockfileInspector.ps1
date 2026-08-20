[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT13' -ToolName 'Dependency and Lockfile Inspector' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) { (Get-Location).Path } else { $LocalSourcePath }
  if (-not (Test-Path -LiteralPath $workspace -PathType Container)) { throw 'The supplied workspace path is not an existing directory.' }
  $workspace = (Resolve-Path -LiteralPath $workspace).Path
  $lockNames = @('pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lockb','Pipfile.lock','poetry.lock','Cargo.lock','go.sum','composer.lock','Gemfile.lock','packages.lock.json')
  $locks = foreach ($name in $lockNames) { $target=Join-Path $workspace $name; [pscustomobject]@{ Name=$name; Present=(Test-Path -LiteralPath $target); LastWriteTime=if(Test-Path -LiteralPath $target){(Get-Item -LiteralPath $target).LastWriteTime.ToString('o')}else{''}; Bytes=if(Test-Path -LiteralPath $target){(Get-Item -LiteralPath $target).Length}else{0} } }
  $packageInfo = [ordered]@{ Name=''; Version=''; Dependencies=@(); DevDependencies=@(); Scripts=@(); ParseError='' }
  $packagePath = Join-Path $workspace 'package.json'
  if (Test-Path -LiteralPath $packagePath) {
    try {
      $package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json
      $packageInfo.Name = [string]$package.name; $packageInfo.Version=[string]$package.version
      $packageInfo.Dependencies = if($package.dependencies){@($package.dependencies.PSObject.Properties | ForEach-Object { $_.Name })}else{@()}
      $packageInfo.DevDependencies = if($package.devDependencies){@($package.devDependencies.PSObject.Properties | ForEach-Object { $_.Name })}else{@()}
      $packageInfo.Scripts = if($package.scripts){@($package.scripts.PSObject.Properties | ForEach-Object { $_.Name })}else{@()}
    } catch { $packageInfo.ParseError=$_.Exception.Message }
  }
  $requirements = @()
  $requirementsPath = Join-Path $workspace 'requirements.txt'
  if (Test-Path -LiteralPath $requirementsPath) { $requirements = @(Get-Content -LiteralPath $requirementsPath | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith('#') }) }
  [pscustomobject]@{ Workspace=$workspace; Lockfiles=$locks; Package=$packageInfo; PythonRequirements=$requirements; CapturedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Depth 7 | Set-Content (Join-Path $Session.RawDir 'dependency-lockfile-inspection.json') -Encoding UTF8
  $Session.ItemsFound = $locks.Count + $packageInfo.Dependencies.Count + $packageInfo.DevDependencies.Count + $requirements.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Inspected dependency markers and {0} lockfile types.' -f $locks.Count)
  Write-Host '[OK] Dependency and lockfile inspection completed.' -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
