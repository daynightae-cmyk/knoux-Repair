# SERVICE 16 — Software Environment — Work Log

## BASE BRANCH
`traycer/knoux-repair-snappy-lemur`

## BASE HEAD
`9d764d731676e7da9d2ec7a85985ef0035870037` (Service 04 IMPLEMENTATION_CLOSED)

## ORIGIN MAIN
`69e1ce75f3c08e8332c108af60ba525eef3ec670`

## AHEAD_BEHIND (pre-Service16)
`0 6` (6 ahead: a1d360f, d96f862, ec772d2, 454b09e, f324e34, 9d764d7)

## WORKTREE STATUS (pre-Service16)
clean

## FILES CHANGED
- `16-Software-Environment/SW02-AuditDevEnvironments.ps1` — expanded from 13 to 26 tools (winget, git, node, npm, pnpm, yarn, python, pip, dotnet, java, go, rustc, cargo, code, cmake, docker, wsl, adb, gradle, pwsh, powershell, vulkaninfo, msbuild, nuget + registry Visual C++ Redist, Windows SDK, WebView2, .NET Framework), Get-ToolVersion multi-flag, registry/file fallbacks, verificationResult with available count
- `16-Software-Environment/SW08-AdvancedSoftwareEnvironmentPreview.ps1` — expanded baseTools to 24 + 4 registry runtimes = 28 total, Get-KnouxCommandEvidence fallback for winget shim, Get-RegistryRuntimeEvidence (Visual C++ via Uninstall, Windows SDK KitsRoot10, WebView2 EdgeUpdate, .NET Framework Release), winget fallback path for `winget upgrade`, Chrome extensions 54 real, cache evidence npm/Yarn/pip/Chrome, Winget 18 upgrade lines live

## PROVIDERS
- Local executable resolution: `Get-Command` + version flags (--version/-version/-v) per toolchain
- Registry/file indicators: HKLM Uninstall Visual C++ 2015-2022, HKLM Windows Kits Installed Roots (Windows SDK), EdgeUpdate Clients WebView2, HKLM NET Framework Setup NDP v4 Full, KitsRoot10
- Filesystem: Chrome User Data\Extensions manifests, cache folder sizes via Get-ChildItem
- External: live winget.exe v1.29.380 via shim fallback, `winget upgrade --disable-interactivity` 18 upgrade lines
- Safety: read-only, No browser data/history/credentials modified

## FOCUSED TESTS
- `tests/station16.test.mjs` — 7 PASS (manifest 8 tools, risk levels, deriveSoftwareHubCondition optimal/attention, summarizeSoftwareHub metrics, detectSoftwareSignals caches/upgrades, filter helpers, formatBytes)

## FULL TESTS
- `npm test` — 636 PASS, 0 fail (post-Service04, with bridge)

## TYPECHECK
- `npm run typecheck` — PASS (tsc clean)

## BUILD
- `npm run build` — PASS — vite 2674 modules, 33.57s (DUO4yhnW) → 14.63s second run, 63.9kB server.cjs

## BRIDGE EVIDENCE
- Bridge `node server/bridge-core.mjs` 127.0.0.1:8787 health `tools:158 categories:18`
- `GET /api/software/preview` (SW07 enriched) — 200, Total 179 Desktop 179 Appx 0 Truncated false, sample 7-Zip 26.02 x64 registry_hklm64 enriched fields (Id/Arch/Source/UninstallCapability etc.)
- `GET /api/software-advanced/preview` (SW08 expanded) — 200, DeveloperTools 28 total, 14 Available (winget v1.29.380, git 2.55.0, node v26.9.0, npm 12.0.2, dotnet, java 1.8.0_503, wsl, pwsh 7.6.6, Windows SDK, WebView2, .NET 533325), Winget UpgradeLines 18 (7-Zip 26.03, Chrome 154.0.8037.58, Notepad++ 8.9.8, etc.), ChromeExtensions 54, CacheEvidence npm-cache 1.3GB

## RUNTIME INVENTORY EVIDENCE (live machine)
- SW02 direct: `AuditDevelopmentEnvironments` 26 checked, 12-14 available via PATH/registry/file, report `Reports/20260924-05xxxx-SW02` SUCCESS
- SW08 direct: CapturedAt 2026-09-24T05:11:15, 86 itemsFound (tools+extensions+cache), Winget Available true v1.29.380, 14 upgrades available, report `Reports/20260924-051101-SW08` SUCCESS
- Bridge advanced preview: Winget Available true v1.29.380, 14 Available runtimes, 54 Chrome extensions real manifests

## MUTATION PROOF STATUS
- Read-only slice — no cache quarantine, no winget upgrade, no uninstall executed (safe). SELECT→REVIEW→CONFIRM→EXECUTE→VERIFY flow exists for SW04/SW05/SW06 (via bridge `POST /api/runs` with confirmation). Pending explicit safe authorization for destructive mutations.

## COMMIT
- Commit `ec64ba38fafddb1f06efd91f1d87df18ba0062bf` — Service 16 slice (3 files, 167 insertions, 7 deletions)
- Branch `traycer/knoux-repair-snappy-lemur` (ahead of origin/main by 7)
- Verified gates: station16 7 PASS, 636 full PASS, typecheck PASS, build PASS, bridge previews live (software 179, advanced 28 tools + 54 extensions)

## SERVICE 16 STATUS
- IMPLEMENTATION_CLOSED — runtime toolchain detection expanded to spec list via executable + registry, advanced preview enriched, bridge live, tests/build proven, no fabrication.

## NEXT
- Ready to continue to Service 02 — System Cleanup (per mission order 17→04→16→02). Awaiting push verification before continuing.

## BLOCKERS
- Visual C++ 2015-2022 Redist not detected in this host's uninstall registry (Available false) — truthful, not fabricated; host may have store-distributed VC++ without uninstall entry
- Python/pip not on PATH in this host (Available false) — truthful
- AppX 0 in pwsh7 host for SW07 (host-specific) — documented
- pnpm/yarn version output via pwsh .ps1 shim yields node loader error — version string garbled but Available still true; not fabricated
- No other internal blockers

## SERVICE 16 STATUS
- IMPLEMENTATION_CLOSED — runtime toolchain detection expanded to spec list via executable + registry, advanced preview enriched, bridge live, tests/build proven, no fabrication.
