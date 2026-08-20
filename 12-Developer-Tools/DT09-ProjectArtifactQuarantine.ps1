# Risk: SAFE_CLEANUP
[CmdletBinding()]
param([string]$LocalSourcePath, [string]$Selection, [switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'DT09' -ToolName 'Project Artifact Quarantine' -Category '12-Developer-Tools' -RiskLevel 'SAFE_CLEANUP'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf
try {
  $workspace = if ([string]::IsNullOrWhiteSpace($LocalSourcePath)) { (Get-Location).Path } else { $LocalSourcePath }
  if (-not (Test-Path -LiteralPath $workspace -PathType Container)) { throw 'The supplied workspace path is not an existing directory.' }
  $workspace = (Resolve-Path -LiteralPath $workspace).Path
  if ($workspace.TrimEnd('\\') -eq [IO.Path]::GetPathRoot($workspace).TrimEnd('\\')) { throw 'A drive root cannot be used as a project workspace.' }
  $relativeCandidates = @('.next\\cache','.nuxt','.vite','.angular\\cache','.turbo','.parcel-cache','node_modules\\.cache','coverage','dist','build','out','.svelte-kit','.pytest_cache','__pycache__','bin','obj','target')
  $candidates = @()
  foreach ($relative in $relativeCandidates) {
    $full = Join-Path $workspace $relative
    if (Test-Path -LiteralPath $full -PathType Container) {
      $size = [int64]0
      try { $size = [int64](@(Get-ChildItem -LiteralPath $full -File -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum) } catch { $size = 0 }
      $candidates += [pscustomobject]@{ Index=($candidates.Count + 1); RelativePath=$relative; FullPath=$full; SizeBytes=$size }
    }
  }
  $candidates | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'project-artifact-candidates.json') -Encoding UTF8
  $Session.ItemsFound = $candidates.Count
  $Session.BytesPotentiallyRecoverable = [int64](@($candidates | Measure-Object -Property SizeBytes -Sum).Sum)
  foreach ($candidate in $candidates) { Write-Host ('[{0}] {1} ({2} bytes)' -f $candidate.Index,$candidate.RelativePath,$candidate.SizeBytes) }
  if ($AnalyzeOnly -or $WhatIf) {
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = ('Listed {0} recoverable project artifact folders.' -f $candidates.Count)
    Write-Host ('[ANALYZE] {0} artifact folders are eligible for quarantine.' -f $candidates.Count) -ForegroundColor Green
  } else {
    if ([string]::IsNullOrWhiteSpace($Selection)) { throw 'Run Analyze first, then enter the exact artifact item numbers to quarantine.' }
    if (-not (Confirm-KnouxAction -Prompt 'Confirm selected project artifact quarantine.')) { throw 'Action was not confirmed.' }
    $selectedIndexes = @($Selection -split ',' | ForEach-Object { [int]$_.Trim() })
    $selected = @($candidates | Where-Object { $selectedIndexes -contains $_.Index })
    if ($selected.Count -ne $selectedIndexes.Count) { throw 'One or more selected artifact numbers are not available.' }
    $quarantineRoot = Join-Path $Session.ProjectRoot ('Quarantine\\DT09\\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $quarantineRoot -Force | Out-Null
    $Session.QuarantinePath = $quarantineRoot
    $moves = @()
    foreach ($candidate in $selected) {
      $destination = Join-Path $quarantineRoot ('{0:D2}-{1}' -f $candidate.Index, (Split-Path $candidate.FullPath -Leaf))
      Move-Item -LiteralPath $candidate.FullPath -Destination $destination -Force
      $moves += [pscustomobject]@{ From=$candidate.FullPath; To=$destination; SizeBytes=$candidate.SizeBytes }
      $Session.ItemsProcessed++
      $Session.QuarantinedCount++
      $Session.BytesQuarantined += $candidate.SizeBytes
    }
    $moves | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Session.RawDir 'project-artifact-quarantine-map.json') -Encoding UTF8
    $Session.ChangedSystem = $true
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = ('Quarantined {0} selected artifact folders.' -f $Session.ItemsProcessed)
    Write-Host ('[OK] Quarantined {0} project artifact folders.' -f $Session.ItemsProcessed) -ForegroundColor Green
  }

} catch {
  $Session.Status = 'Failed'
  $Session.ErrorMessage = $_.Exception.Message
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
