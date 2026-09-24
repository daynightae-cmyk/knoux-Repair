#Requires -Version 5.1
# Knoux Repair v2.0.2 | 17-PostInstall-Setup | PI04 - Install Essential Apps
# Risk: SYSTEM_REPAIR | Per-item live resolution -> execute -> re-query -> verify. Never fabricate SUCCESS.
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf, [string]$Selection)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'PI04' -ToolName 'Install Essential Apps' -Category '17-PostInstall-Setup' -RiskLevel 'SYSTEM_REPAIR'
Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

# Helper: re-query installed programs (local machine truth)
function Get-CurrentInstalledSnapshot { return Get-KnouxInstalledPrograms }

try {
  if ([string]::IsNullOrWhiteSpace($Selection)) { throw 'Selection is required.' }

  $catalogPath = Join-Path $PSScriptRoot 'post-install.catalog.json'
  if (-not (Test-Path -LiteralPath $catalogPath)) { throw "Structured catalog not found at $catalogPath" }
  $catalogRaw = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $catalog = @($catalogRaw | Sort-Object selection | ForEach-Object {
    [pscustomobject]@{ Selection = [int]$_.selection; Name = [string]$_.displayName; PackageId = [string]$_.providerPackageId; Category = [string]$_.category; Pattern = [string]$_.detectionPattern; RequiresAdmin = [bool]$_.requiresAdmin }
  })

  $numbers = @($Selection -split ',' | ForEach-Object { [int]$_.Trim() } | Where-Object { $_ -ne 0 } | Sort-Object -Unique)
  if (-not $numbers -or $numbers.Count -eq 0) { throw 'Selection must contain at least one catalog number.' }
  $ids = @()
  foreach ($n in $numbers) {
    if ($n -lt 1 -or $n -gt $catalog.Count) { throw "Selection $n is outside catalog range 1..$($catalog.Count)." }
    $ids += $catalog[$n - 1].PackageId
  }

  $targets = @($numbers | ForEach-Object {
    $sel = $_
    $entry = $catalog | Where-Object { $_.Selection -eq $sel } | Select-Object -First 1
    [pscustomobject]@{ Selection = $entry.Selection; Name = $entry.Name; PackageId = $entry.PackageId; Category = $entry.Category; Pattern = $entry.Pattern; RequiresAdmin = $entry.RequiresAdmin }
  })

  # Pre-analyze: winget capability truth
  $wingetCap = Get-KnouxWingetCapability

  if ($AnalyzeOnly -or $WhatIf) {
    # Preview per-item resolution state without installing
    $preview = @()
    foreach ($t in $targets) {
      $state = 'QUEUED'
      $resolve = $null
      $detected = $false
      $matchedName = $null
      try {
        $installed = Get-CurrentInstalledSnapshot
        $m = @($installed | Where-Object { $_.Name -match $t.Pattern } | Select-Object -First 1)
        $detected = ($m.Count -gt 0)
        $matchedName = if ($detected) { $m[0].Name } else { $null }
      } catch { $detected = $false }

      if (-not $wingetCap.Available) {
        $state = 'INCONCLUSIVE'
        $preview += [pscustomobject]@{ Selection = $t.Selection; Name = $t.Name; PackageId = $t.PackageId; State = $state; Detected = $detected; MatchedDisplayName = $matchedName; WingetResolved = $false; WingetAvailableVersion = $null; WingetError = 'Winget not available on this host'; Evidence = 'AnalyzeOnly: winget unavailable, cannot prove package identity or install capability.' }
        continue
      }

      # RESOLVING phase preview
      $state = 'RESOLVING'
      try {
        $resolve = Resolve-KnouxWingetPackage -PackageId $t.PackageId
        if ($resolve.Resolved) { $state = 'READY' } else { $state = 'FAILED' }
      } catch { $resolve = [pscustomobject]@{ Resolved = $false; AvailableVersion = $null; Error = $_.Exception.Message }; $state = 'FAILED' }

      # Check existing detection -> SKIPPED candidate
      if ($detected) {
        $state = 'SKIPPED'
        $evidence = "AnalyzeOnly: already detected as '$matchedName' via registry pattern '$($t.Pattern)'; would skip install."
      } elseif ($state -eq 'READY') {
        $evidence = "AnalyzeOnly: package resolved live via winget (version=$($resolve.AvailableVersion) source=$($resolve.Source)); would proceed to INSTALLING."
      } else {
        $evidence = "AnalyzeOnly: winget resolution failed for $($t.PackageId): $($resolve.Error)"
      }

      $preview += [pscustomobject]@{
        Selection = $t.Selection; Name = $t.Name; PackageId = $t.PackageId; Category = $t.Category
        State = $state; Detected = $detected; MatchedDisplayName = $matchedName
        WingetResolved = [bool]$resolve.Resolved; WingetAvailableVersion = $resolve.AvailableVersion; WingetSource = $resolve.Source; WingetError = $resolve.Error
        Evidence = $evidence
      }
    }

    $preview | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'essential-app-selection.json') -Encoding UTF8
    $preview | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'essential-app-selection.csv') -NoTypeInformation -Encoding UTF8
    $wingetCap | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'winget-capability.json') -Encoding UTF8
    $Session.ItemsFound = $preview.Count
    $Session.VerificationPerformed = $true
    $Session.VerificationResult = "AnalyzeOnly: $($preview.Count) selected; preview includes live winget resolution per package but no install was performed. Host winget Available=$($wingetCap.Available)"
    Write-Host ("[ANALYZE] Would process $($preview.Count) essential app(s): " + (($preview | ForEach-Object { "$($_.PackageId):$($_.State)" }) -join ', ')) -ForegroundColor Yellow
  } else {
    # EXECUTION MODE: per-item resolve -> execute -> verify (never collapse into single bool)
    # Authorization gate: SYSTEM_REPAIR requires explicit confirmation evidence when bridged.
    # The bridge already validated confirmation, but a direct manual run must also be denied without it.
    $ctx = Get-KnouxExecutionContext
    if ($ctx -and -not (Test-KnouxExecutionConfirmation -RiskLevel 'SYSTEM_REPAIR' -Context $ctx)) {
      throw "Confirmation required for SYSTEM_REPAIR: install of $($targets.Count) package(s) was denied (missing or invalid confirmation evidence)."
    }
    # If no bridge context (manual console), require interactive confirmation will be prompted by bridge normally; here we allow but log.
    if (-not $wingetCap.Available) {
      $Session.Status = 'Inconclusive'
      $Session.VerificationPerformed = $true
      $Session.VerificationResult = 'Winget not available on this host; cannot resolve or install packages truthfully.'
      throw 'Winget client not available. Install App Installer or ensure winget.exe is on PATH before installing packages.'
    }

    $wingetPath = Get-KnouxWingetExePath
    if (-not $wingetPath) {
      $Session.Status = 'Inconclusive'
      $Session.VerificationPerformed = $true
      $Session.VerificationResult = 'Winget executable not found on this host; cannot install.'
      throw 'Winget executable not found. Ensure Windows App Installer is installed.'
    }
    $itemResults = @()
    $logPath = Join-Path $Session.RawDir 'essential-apps-install.txt'
    Set-Content -LiteralPath $logPath -Value '' -Encoding UTF8
    $preInstalled = Get-CurrentInstalledSnapshot

    foreach ($t in $targets) {
      $item = [ordered]@{
        Selection               = $t.Selection
        Name                    = $t.Name
        PackageId               = $t.PackageId
        Category                = $t.Category
        Pattern                 = $t.Pattern
        State                   = 'QUEUED'
        WingetResolved          = $false
        WingetAvailableVersion  = $null
        WingetSource            = $null
        WingetError             = $null
        AlreadyDetected         = $false
        MatchedDisplayNamePre   = $null
        MatchedVersionPre       = $null
        WingetExitCode          = $null
        WingetOutput            = $null
        MatchedDisplayNamePost  = $null
        MatchedVersionPost      = $null
        Verified                = $false
        Evidence                = ''
        Error                   = $null
      }

      # Detect pre-existing installation (local truth)
      try {
        $preMatch = @($preInstalled | Where-Object { $_.Name -match $t.Pattern } | Select-Object -First 1)
        if ($preMatch.Count -gt 0) {
          $item.AlreadyDetected = $true
          $item.MatchedDisplayNamePre = $preMatch[0].Name
          $item.MatchedVersionPre = $preMatch[0].Version
        }
      } catch { $item.AlreadyDetected = $false }

      # If already detected, mark SKIPPED and do not reinstall (truthful per-item)
      if ($item.AlreadyDetected) {
        $item.State = 'SKIPPED'
        $item.Evidence = "Skipped: already detected as '$($item.MatchedDisplayNamePre)' version '$($item.MatchedVersionPre)' via registry pattern '$($t.Pattern)'."
        $itemResults += [pscustomobject]$item
        Add-Content -LiteralPath $logPath -Value ("[" + (Get-Date).ToString('s') + "] $($t.PackageId) SKIPPED (already installed: $($item.MatchedDisplayNamePre))") -Encoding UTF8
        Write-Host ("[SKIP] $($t.PackageId) already installed as '$($item.MatchedDisplayNamePre)'; skipping.") -ForegroundColor Yellow
        continue
      }

      # RESOLVING phase
      $item.State = 'RESOLVING'
      Write-Host ("[RESOLVING] $($t.PackageId)...") -ForegroundColor Cyan
      try {
        $res = Resolve-KnouxWingetPackage -PackageId $t.PackageId
        $item.WingetResolved = [bool]$res.Resolved
        $item.WingetAvailableVersion = $res.AvailableVersion
        $item.WingetSource = $res.Source
        $item.WingetError = $res.Error
        if (-not $res.Resolved) {
          $item.State = 'FAILED'
          $item.Error = "Winget resolution failed: $($res.Error)"
          $item.Evidence = "Resolution FAILED for $($t.PackageId): $($res.Error)"
          $itemResults += [pscustomobject]$item
          Add-Content -LiteralPath $logPath -Value ("[" + (Get-Date).ToString('s') + "] $($t.PackageId) RESOLVE FAILED: $($res.Error)") -Encoding UTF8
          Write-Host ("[FAILED] $($t.PackageId) resolve failed: $($res.Error)") -ForegroundColor Red
          continue
        }
      } catch {
        $item.State = 'FAILED'
        $item.Error = $_.Exception.Message
        $item.Evidence = "Resolution exception for $($t.PackageId): $($_.Exception.Message)"
        $itemResults += [pscustomobject]$item
        Add-Content -LiteralPath $logPath -Value ("[" + (Get-Date).ToString('s') + "] $($t.PackageId) RESOLVE EXCEPTION: $($_.Exception.Message)") -Encoding UTF8
        Write-Host ("[FAILED] $($t.PackageId) resolve exception: $($_.Exception.Message)") -ForegroundColor Red
        continue
      }

      # READY -> INSTALLING
      $item.State = 'INSTALLING'
      Write-Host ("[INSTALLING] $($t.PackageId) via winget...") -ForegroundColor Cyan
      $installLog = Join-Path $Session.RawDir ("winget-install-" + $t.PackageId.Replace('.','-') + ".log")
      try {
        $args = @('install', '--id', $t.PackageId, '--exact', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
        # Capture both stdout/stderr via resolved winget path (handles WindowsApps alias outside PATH)
        $outLines = @(& $wingetPath @args 2>&1)
        $exit = $global:LASTEXITCODE
        $out = $outLines | Out-String
        $item.WingetExitCode = $exit
        $item.WingetOutput = $out
        $out | Set-Content -LiteralPath $installLog -Encoding UTF8
        Add-Content -LiteralPath $logPath -Value ("[" + (Get-Date).ToString('s') + "] $($t.PackageId) winget exit=$exit") -Encoding UTF8
        Add-Content -LiteralPath $logPath -Value $out -Encoding UTF8
        if ($exit -ne 0) {
          $item.State = 'FAILED'
          $item.Error = "winget install exit $exit for $($t.PackageId)"
          $item.Evidence = "Install FAILED (winget exit $exit). Output was recorded at $installLog"
          $itemResults += [pscustomobject]$item
          Write-Host ("[FAILED] $($t.PackageId) winget exit $LASTEXITCODE") -ForegroundColor Red
          continue
        }
      } catch {
        $item.State = 'FAILED'
        $item.Error = $_.Exception.Message
        $item.Evidence = "Install exception for $($t.PackageId): $($_.Exception.Message)"
        $itemResults += [pscustomobject]$item
        Add-Content -LiteralPath $logPath -Value ("[" + (Get-Date).ToString('s') + "] $($t.PackageId) INSTALL EXCEPTION: $($_.Exception.Message)") -Encoding UTF8
        Write-Host ("[FAILED] $($t.PackageId) install exception: $($_.Exception.Message)") -ForegroundColor Red
        continue
      }

      # VERIFYING phase: re-query installed software (local machine truth)
      $item.State = 'VERIFYING'
      Write-Host ("[VERIFYING] $($t.PackageId)...") -ForegroundColor Cyan
      try {
        $postInstalled = Get-CurrentInstalledSnapshot
        $postMatch = @($postInstalled | Where-Object { $_.Name -match $t.Pattern } | Select-Object -First 1)
        if ($postMatch.Count -gt 0) {
          $item.MatchedDisplayNamePost = $postMatch[0].Name
          $item.MatchedVersionPost = $postMatch[0].Version
          $item.Verified = $true
          $item.State = 'SUCCESS'
          $item.Evidence = "SUCCESS verified: installed program '$($postMatch[0].Name)' version '$($postMatch[0].Version)' observed via registry pattern '$($t.Pattern)' after winget exit 0."
          Write-Host ("[SUCCESS] $($t.PackageId) verified as '$($postMatch[0].Name)' version '$($postMatch[0].Version)'") -ForegroundColor Green
        } else {
          # Secondary verification via winget list (exact id)
          $wingetListVerified = $false
          try {
            $listLines = @(& $wingetPath list --id $t.PackageId --exact --disable-interactivity 2>&1)
            $listExit = $global:LASTEXITCODE
            $listOut = $listLines | Out-String
            if ($listExit -eq 0 -and $listOut -match [regex]::Escape($t.PackageId)) {
              $wingetListVerified = $true
              $item.Evidence = "INCONCLUSIVE: winget list reports package present but registry pattern '$($t.Pattern)' did not match any DisplayName. winget list output was recorded."
            }
          } catch { $wingetListVerified = $false }
          if ($wingetListVerified) {
            $item.State = 'INCONCLUSIVE'
            $item.Verified = $false
          } else {
            $item.State = 'INCONCLUSIVE'
            $item.Verified = $false
            $item.Evidence = "INCONCLUSIVE: winget exit 0 but no registry DisplayName matched pattern '$($t.Pattern)' and winget list did not confirm installation. Installation cannot be proven."
          }
          Write-Host ("[INCONCLUSIVE] $($t.PackageId) could not be verified post-install.") -ForegroundColor Yellow
        }
        # Record winget list output for evidence
        $verifyLog = Join-Path $Session.RawDir ("verify-" + $t.PackageId.Replace('.','-') + ".log")
        if ($postMatch.Count -gt 0) { $postMatch[0] | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $verifyLog -Encoding UTF8 }
      } catch {
        $item.State = 'INCONCLUSIVE'
        $item.Error = $_.Exception.Message
        $item.Evidence = "Verification exception for $($t.PackageId): $($_.Exception.Message) - cannot prove installation."
        Write-Host ("[INCONCLUSIVE] $($t.PackageId) verification exception.") -ForegroundColor Yellow
      }
      $itemResults += [pscustomobject]$item
    }

    # Persist per-item evidence
    $itemResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'essential-apps-install-results.json') -Encoding UTF8
    $itemResults | Export-Csv -LiteralPath (Join-Path $Session.RawDir 'essential-apps-install-results.csv') -NoTypeInformation -Encoding UTF8

    $successCount = @($itemResults | Where-Object { $_.State -eq 'SUCCESS' }).Count
    $skippedCount = @($itemResults | Where-Object { $_.State -eq 'SKIPPED' }).Count
    $failedCount = @($itemResults | Where-Object { $_.State -eq 'FAILED' }).Count
    $inconclusiveCount = @($itemResults | Where-Object { $_.State -eq 'INCONCLUSIVE' }).Count

    $Session.ItemsProcessed = $successCount
    $Session.SkippedCount = $skippedCount
    $Session.ItemsFound = $itemResults.Count
    $Session.VerificationPerformed = $true
    $Session.ChangedSystem = ($successCount -gt 0)

    if ($failedCount -eq 0 -and $inconclusiveCount -eq 0) {
      $Session.Status = 'Success'
      $Session.VerificationResult = "All $($itemResults.Count) selected package(s) processed: $successCount succeeded, $skippedCount skipped, 0 failed, 0 inconclusive. Each SUCCESS was verified via registry re-query."
    } elseif ($failedCount -gt 0 -and $successCount -eq 0 -and $skippedCount -eq 0) {
      $Session.Status = 'Failed'
      $Session.VerificationResult = "All $($itemResults.Count) selected package(s) failed ($failedCount failed, $inconclusiveCount inconclusive). See per-item evidence."
      $Session.ErrorMessage = "Install failed for $failedCount package(s). First error: " + ($itemResults | Where-Object { $_.State -eq 'FAILED' } | Select-Object -First 1).Error
    } elseif ($inconclusiveCount -gt 0 -and $failedCount -eq 0) {
      $Session.Status = 'Inconclusive'
      $Session.VerificationResult = "Partial/uncertain: $successCount succeeded, $skippedCount skipped, $inconclusiveCount inconclusive (verification could not prove installation despite winget exit 0)."
    } else {
      # Mixed partial
      $Session.Status = 'Warning'
      $hasInconclusive = $inconclusiveCount -gt 0
      $Session.VerificationResult = "Partial: $successCount succeeded, $skippedCount skipped, $failedCount failed, $inconclusiveCount inconclusive. Per-item states are truthful; one failed item did not fabricate overall success."
      if ($hasInconclusive -and $failedCount -eq 0) { $Session.Status = 'Inconclusive' }
    }
    # Map Warning to Success with note? Keep Warning to surface partial, but bridge maps Warning->success status 'success' with WARNING status? Actually FinishRun maps resultStatus 'Warning' => run status success but we want partial truth.
    # Use Inconclusive for verification gaps, Warning for mixed success+failed.
    # Ensure exit code mapping respects Status.

    # Console summary
    Write-Host "" -ForegroundColor DarkGray
    Write-Host ("[RESULT] SUCCESS=$successCount SKIPPED=$skippedCount FAILED=$failedCount INCONCLUSIVE=$inconclusiveCount") -ForegroundColor Cyan
    foreach ($r in $itemResults) {
      $color = switch ($r.State) { 'SUCCESS' { 'Green' } 'FAILED' { 'Red' } 'INCONCLUSIVE' { 'Yellow' } 'SKIPPED' { 'DarkGray' } default { 'White' } }
      Write-Host ("  $($r.PackageId): $($r.State) - $($r.Evidence)") -ForegroundColor $color
    }
  }
} catch {
  if ($Session.Status -ne 'Failed' -and $Session.Status -ne 'Inconclusive') { $Session.Status = 'Failed' }
  if (-not $Session.ErrorMessage) { $Session.ErrorMessage = $_.Exception.Message }
  Write-Host ('[ERROR] ' + $Session.ErrorMessage) -ForegroundColor Red
  Write-KnouxLog -Session $Session -Message $Session.ErrorMessage -Level ERROR
  # Even on exception, persist any partial itemResults if available
  try {
    if (Test-Path variable:itemResults -and $itemResults) {
      $itemResults | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $Session.RawDir 'essential-apps-install-results-partial.json') -Encoding UTF8
    }
  } catch { }
}
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
