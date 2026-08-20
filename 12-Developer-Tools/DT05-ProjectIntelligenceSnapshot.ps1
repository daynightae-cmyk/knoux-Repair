# Risk: READ_ONLY
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT05' -ToolName 'Project Intelligence Snapshot' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) { (Get-Location).Path } else { $LocalSourcePath }
  if (-not (Test-Path -LiteralPath $workspace -PathType Container)) { throw 'The supplied workspace path is not an existing directory.' }
  $workspace = (Resolve-Path -LiteralPath $workspace).Path
  $markers = @('package.json','pnpm-lock.yaml','package-lock.json','yarn.lock','bun.lockb','requirements.txt','pyproject.toml','Pipfile','go.mod','Cargo.toml','composer.json','Gemfile','Dockerfile','.gitignore')
  $markerRows = foreach ($marker in $markers) { [pscustomobject]@{ Marker=$marker; Present=(Test-Path -LiteralPath (Join-Path $workspace $marker)) } }
  $package = $null
  $packagePath = Join-Path $workspace 'package.json'
  if (Test-Path -LiteralPath $packagePath) { try { $package = Get-Content -Raw -LiteralPath $packagePath | ConvertFrom-Json } catch { Write-KnouxLog -Session $Session -Message 'package.json could not be parsed.' -Level WARN } }
  $git = Get-Command git -ErrorAction SilentlyContinue
  $gitState = [ordered]@{ Available=[bool]$git; Repository=$false; Branch=''; Status=@(); Remotes=@() }
  if ($git) {
    try {
      $inside = (& $git.Source -C $workspace rev-parse --is-inside-work-tree 2>$null | Select-Object -First 1).Trim()
      if ($inside -eq 'true') {
        $gitState.Repository = $true
        $gitState.Branch = (& $git.Source -C $workspace branch --show-current 2>$null | Select-Object -First 1).Trim()
        $gitState.Status = @(& $git.Source -C $workspace status --short 2>$null | Select-Object -First 150)
        $gitState.Remotes = @(& $git.Source -C $workspace remote -v 2>$null | Select-Object -First 30)
      }
    } catch { Write-KnouxLog -Session $Session -Message 'Git metadata could not be collected.' -Level WARN }
  }
  $topDirectories = @(Get-ChildItem -LiteralPath $workspace -Directory -Force -ErrorAction SilentlyContinue | Select-Object -First 80 | ForEach-Object { [pscustomobject]@{ Name=$_.Name; LastWriteTime=$_.LastWriteTime.ToString('o') } })
  $snapshot = [pscustomobject]@{ Workspace=$workspace; CapturedAt=(Get-Date).ToString('o'); Markers=$markerRows; PackageName=if($package){$package.name}else{''}; PackageVersion=if($package){$package.version}else{''}; PackageScripts=if($package -and $package.scripts){$package.scripts.PSObject.Properties | ForEach-Object { $_.Name }}else{@()}; Git=$gitState; TopDirectories=$topDirectories }
  $snapshot | ConvertTo-Json -Depth 7 | Set-Content (Join-Path $Session.RawDir 'project-intelligence.json') -Encoding UTF8
  $Session.ItemsFound = $markerRows.Count + $topDirectories.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Project snapshot created for {0}.' -f $workspace)
  Write-Host ('[OK] Project intelligence snapshot created for: ' + $workspace) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
