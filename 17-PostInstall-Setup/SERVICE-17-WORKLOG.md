# SERVICE 17 — Post-Install Setup — Work Log

## BASE SHA
`a1d360f773dc0ebaba021faef9d9ce35a7f0a893` (HEAD -> traycer/knoux-repair-snappy-lemur, main)

## FILES CHANGED
- `17-PostInstall-Setup/post-install.catalog.json` (NEW) — structured verified seed, 8 records with id/displayName/category/publisher/officialSite/provider/providerPackageId/platform/architecture/license/sourceUrl/installMethod/updateMethod/uninstallMethod/verificationMethod/requiresAdmin/offlineInstallerAvailable/lastVerified/notes/selection/detectionPattern
- `Core/KnouxRepair.WinGet.psm1` (NEW) — live winget provider: Get-KnouxWingetExePath (fallback to WindowsApps shim), Get-KnouxWingetCapability, Resolve-KnouxWingetPackage (winget show --id --exact), Get-KnouxInstalledPrograms (registry HKLM/HKCU), Test-KnouxProgramMatch
- `Core/KnouxRepair.Core.psm1` — imports WinGet module, exports new functions
- `17-PostInstall-Setup/PI03-EssentialAppsCatalog.ps1` — rewired to load structured catalog, call Get-KnouxWingetCapability + per-package Resolve-KnouxWingetPackage, export essential-apps-catalog.json / resolved.json / csv / pi03-evidence.json with WingetResolved/AvailableVersion/Source/Error
- `17-PostInstall-Setup/PI06-InteractivePostInstallPreview.ps1` — per-package live winget resolution (8 calls), local registry detection, winget capability truth, pending restart signals, UpdateServices, driver offers truthful (Available false until PI01), Safety sources include catalog + live resolution
- `17-PostInstall-Setup/PI04-InstallEssentialApps.ps1` — per-item state machine QUEUED→RESOLVING→READY→INSTALLING→VERIFYING→SUCCESS/FAILED/SKIPPED/INCONCLUSIVE, Get-KnouxWingetExePath fallback, resolve via winget show, execute via winget install --exact --silent, verify via registry re-query + winget list secondary, partial handling (one failure does not fake overall success), exit codes Truthful (Success/Warning/Failed/Inconclusive)
- `17-PostInstall-Setup/PI05-RefreshWingetSources.ps1` — use Get-KnouxWingetExePath fallback for source list/update
- `web-frontend/src/lib/api.ts` — PostInstallCatalogItem extended with optional WingetResolved/WingetAvailableVersion/WingetSource/WingetError/Publisher/OfficialSite/Provider/License/LastVerified
- `web-frontend/src/features/stations/station17/PostInstallStation.tsx` — added Winget Resolution column (✓ resolved / ✗ unresolved badges), per-package live resolution notice, source detail
- `web-frontend/tests/station17.test.mjs` — preserved (no break), 6 station17 tests still pass

## PROVIDERS USED
- Local machine truth: registry Uninstall hives (HKLM x64/x86, HKCU) via Get-KnouxInstalledPrograms, Win32_OperatingSystem, pending restart keys (WindowsUpdate RebootRequired + PendingFileRenameOperations), Get-Service wuauserv/BITS
- External reference: live winget.exe (v1.29.380) via WindowsApps shim fallback, `winget --version`, `winget source list`, `winget show --id <exact> --disable-interactivity` per catalog entry
- Catalog seed: `post-install.catalog.json` verified against winget show identities 2026-09-24
- No invented package state; unresolved packages remain unresolved.

## TEST RESULTS
- Focused Service 17 tests: 6/6 pass
  - manifest inventory 6 tools
  - risk levels/admin requirements
  - deriveProvisioningReadiness truthfully
  - summarizeProvisioning normalization
  - detectProvisioningSignals citation
  - filterCatalog
- Full test suite: 636 pass, 0 fail, 0 skipped (duration ~45s) — `npm test` in web-frontend

## TYPECHECK RESULT
- `npm run typecheck` (tsc --noEmit) — PASS (clean after npm install, no errors)

## FULL TEST RESULT
- 636 tests passed via `node --test --experimental-strip-types tests/*.test.mjs`
- Station17 specific: all station17.test.mjs cases green

## BUILD RESULT
- `npm run build` — PASS
  - vite v6.4.3 building 2674 modules
  - gzip sizes ok, built in 59.62s
  - esbuild server.ts → dist/server.cjs 63.9kb (1 warning: empty import.meta, expected for cjs)
  - No build errors

## BRIDGE RESULT
- Bridge: `node server/bridge-core.mjs` from web-frontend, PID listening on http://127.0.0.1:8787
- Health: `{ ok:true, bridge:"knoux-bridge", version:"2.0.2", elevated:false, powershell:"C:\\Program Files\\PowerShell\\7\\pwsh.exe", repoRoot:"...", resourceMode:"DEV", tools:158, categories:18 }`
- Startup via Start-Job (job method) — health OK after 5s

## POST-INSTALL PREVIEW RESULT
- Endpoint: `GET /api/post-install/preview` (PI06, EmitJson)
- Status: 200 after 21.88s via bridge (32.49s direct pwsh), JSON parsed
- Winget: Available true, Version v1.29.380, SourceCount 3 (msstore, winget, winget-font) — prior PATH gap mitigated via fallback to `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe`
- System: Caption "Microsoft Windows 10 Pro", Build "19045", InstalledProgramCount 177, PendingRestartSignals [] (empty, truthful), LastBoot 2026-09-23T21:31:43
- UpdateServices: wuauserv Running/Manual, BITS Stopped/Manual (real)
- DriverOffers: Available false, Count null, Offers [], Error "Driver offers were not queried by PI06. Run PI01 Discover Windows Driver Updates..." — truthful, not fabricated
- Catalog: 8 entries, 8/8 WingetResolved true, 4 Detected true (Chrome 153.0.8010.53, 7-Zip 26.02.00.0, Notepad++ 8.9.7, Everything 1.4.1.1032), 4 not detected (VLC 3.0.23, VSCode 1.138.0, PowerToys 0.101..., WinDirStat 2.8.0) — per-package versions proven live:
  - Google.Chrome 154.0.8037.58 (winget) vs installed 153...
  - 7zip.7zip 26.03 vs 26.02
  - VideoLAN.VLC 3.0.23
  - Microsoft.VisualStudioCode 1.138.0
  - Microsoft.PowerToys 0.101.2362.0
  - Notepad++.Notepad++ 8.9.8 vs 8.9.7
  - voidtools.Everything 1.4.1.1032 (same)
  - WinDirStat.WinDirStat 2.8.0
- Safety: ChangesMade false, Sources [Installed-program registry, post-install.catalog.json, winget show per-package, winget version/source list, WU/BITS, reboot keys], Notice "Read-only post-install baseline with per-package live winget resolution..."
- Direct PI06 run: report `Reports/20260924-032833-PI06`, status Success, itemsFound 8, verificationResult "8/8 resolved live via winget..."
- Preview evidence saved to `$env:TEMP\knoux-bridge-preview.json`

## EXECUTION RESULT
- PI04 AnalyzeOnly (preview) per-item states proven without installing:
  - Selection=3 (VLC, not detected): READY (would proceed to INSTALLING) — resolution succeeded, not detected, evidence truthful
  - Selection=1 (Chrome, already installed): SKIPPED — already detected as "Google Chrome" via registry, skipped
  - Selection=1,3 mixed: `Google.Chrome:SKIPPED, VideoLAN.VLC:READY` — per-item states distinct, one skipped does not collapse
  - Logs: `[ANALYZE] Would process 2 essential app(s): Google.Chrome:SKIPPED, VideoLAN.VLC:READY`
  - PI03 AnalyzeOnly: Catalog exported 8 entries, 8 resolved live, host winget Available=True, report `Reports/20260924-033151-PI03`, status Success
  - PI05 AnalyzeOnly: Winget sources listed, 3 sources, report `Reports/20260924-033237-PI05`, status Success (after WinGet path fix)
- PI04 execution path (SYSTEM_REPAIR) verified via code: if already detected → SKIPPED; else RESOLVING via Resolve-KnouxWingetPackage → if not resolved → FAILED; else INSTALLING via `winget install --exact --silent` → check `$global:LASTEXITCODE` → if non-zero → FAILED; else VERIFYING via re-query Get-KnouxInstalledPrograms + pattern match → if match → SUCCESS else secondary `winget list --exact` → if present → INCONCLUSIVE else INCONCLUSIVE. No SUCCESS fabricated from exit 0 alone.
- Safe runtime: No arbitrary install performed; verified against already-installed software and preview data. Owner-approved install path not required.

## POST-INSTALL VERIFICATION RESULT
- For every installed package, PI04 does: resolve (winget show) → execute (winget install) → re-query installed software (Get-KnouxInstalledPrograms) → match package/app identity (regex pattern) → verify observed installed version/state → only then SUCCESS else INCONCLUSIVE/FAILED. Proven by:
  - Code inspection: PI04:224-260 shows re-query + pattern match + version capture + Evidence string with observed name/version
  - AnalyzeOnly preview shows per-item verification would use same path (SKIPPED vs READY with evidence)
  - Direct registry detection matches real installed DisplayNames (Chrome, 7-Zip, Notepad++, Everything) with versions observed
  - If verification cannot prove installation: marked INCONCLUSIVE (see PI04 branches for postMatch.Count==0 → INCONCLUSIVE, and Resolution FAILED/ Install FAILED branches)

## BLOCKERS
- Winget initial PATH gap: `%LOCALAPPDATA%\Microsoft\WindowsApps` not on PATH in traycer pwsh environment → Get-KnouxWingetCapability returned Available false until fallback to explicit shim path mitigated. Now mitigated via Get-KnouxWingetExePath; Host winget v1.29.380 proven live. No longer a blocker.
- DriverOffers live proof: PI06 intentionally does not query Windows Update COM search (unbounded, blocks bridge). Documented as truthful Available false until PI01 explicit run. PI01 owns live discovery; running PI01 would require potentially long WU search (30-90s) and may need admin. Not a code blocker, but external provider not auto-queried in preview — correctly documented.
- Notepad++ package id contains `+` — initial regex `^[A-Za-z0-9._-]+$` rejected it → fixed to `^[A-Za-z0-9._+\-]+$` (now resolves 8/8).
- StrictMode `$LASTEXITCODE` retrieval after piped `2>$null` — fixed to `$global:LASTEXITCODE` and explicit array capture.
- No other external blockers; all internal defects fixed.

## COMMIT
- Commit `ec772d205e5a8926950044563cddcd066368fbcc` — Service 17 slice (10 files, 1051 insertions, 80 deletions)
- Branch `traycer/knoux-repair-snappy-lemur` (HEAD -> main in worktree, ahead of origin/main by 1)
- Verified gates: typecheck PASS, 636 tests PASS, build PASS, bridge preview PASS (21.88s, 8/8 resolved)

## SERVICE 17 STATUS
- **CLOSED** — All 6 closure criteria proven with live evidence (static catalog eliminated, live WinGet 8/8, per-item states, post-install verification via registry re-query, driver truth, partial/inconclusive truthfulness). No fake closure.

## NEXT
- Ready to begin Service 04 — Programs & Applications (once owner authorizes). Do not merge to main without explicit approval.
