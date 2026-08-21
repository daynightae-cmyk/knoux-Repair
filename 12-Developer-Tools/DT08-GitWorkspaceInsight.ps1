# Risk: READ_ONLY
[CmdletBinding()]
param([string]$LocalSourcePath, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT08' -ToolName 'Git Workspace Insight' -Category '12-Developer-Tools' -RiskLevel 'READ_ONLY'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) { (Get-Location).Path } else { $LocalSourcePath }
  if (-not (Test-Path -LiteralPath $workspace -PathType Container)) { throw 'The supplied workspace path is not an existing directory.' }
  $workspace = (Resolve-Path -LiteralPath $workspace).Path
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { throw 'Git is not available on this computer.' }
  $inside = (& $git.Source -C $workspace rev-parse --is-inside-work-tree 2>$null | Select-Object -First 1).Trim()
  if ($inside -ne 'true') { throw 'The supplied path is not inside a Git work tree.' }
  $branch = (& $git.Source -C $workspace branch --show-current 2>$null | Select-Object -First 1).Trim()
  $head = (& $git.Source -C $workspace log -1 --pretty=format:%H 2>$null | Select-Object -First 1).Trim()
  $status = @(& $git.Source -C $workspace status --short 2>$null | Select-Object -First 300)
  $remotes = @(& $git.Source -C $workspace remote -v 2>$null | Select-Object -First 50)
  $recent = @(& $git.Source -C $workspace log -8 --date=iso --pretty=format:'%h|%ad|%an|%s' 2>$null)
  $ignored = Test-Path -LiteralPath (Join-Path $workspace '.gitignore')
  [pscustomobject]@{ Workspace=$workspace; Branch=$branch; Head=$head; Status=$status; RemoteLines=$remotes; RecentCommits=$recent; HasGitIgnore=$ignored; CapturedAt=(Get-Date).ToString('o') } | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $Session.RawDir 'git-workspace-insight.json') -Encoding UTF8
  $Session.ItemsFound = $status.Count + $recent.Count
  $Session.VerificationPerformed = $true
  $Session.VerificationResult = ('Git insight collected for branch {0}; {1} pending status lines.' -f $branch,$status.Count)
  Write-Host ('[OK] Git workspace insight collected for branch: ' + $branch) -ForegroundColor Green

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
