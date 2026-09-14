# KNOUX TOTAL RECOVERY REPORT — 2026-09-14

Mission start `origin/main`: `c404e77` — `fix(workbench): preserve canonical action rail in engineering shell`
Recovery branch: `recovery/knoux-total-reconcile-20260914`
Safety vault: `D:\KNOUX-RECOVERY-20260914-095915\` (bundle + matrices + manifests)

## Verdict

`origin/main` at `c404e77` was already the integrated superset. No valid unique work was
left unmerged. One genuine gap was found and ported (TopBar real-PNG brand, `903df15`).
Everything else on divergent branches, stashes, donors and sessions classifies as
ALREADY_ON_MAIN, PATCH_EQUIVALENT (squash), SUPERSEDED (stale base), UNSAFE (contract-banned)
or OBSOLETE_ARCHITECTURE (legacy WPF generation). Nothing was deleted anywhere.

## Sources inspected

- Canonical repo `D:\Knoux-repair`: refs, reflogs, 8 stashes, 3 unreachable commits, bundle captured.
- Remote: all 18 `origin/*` refs + PRs #1–#33 (intent + merged content, esp. #31/#32/#33).
- Traycer worktrees: 7 orphan dirs (git host `D:\Knoux-Repair-v2.0.2` deleted → file donors only)
  + live `traycer-knoux-repair-merry-raccoon` worktree. 2378 files scanned; 77 unique basenames,
  ALL legacy WPF/C# (`*.xaml`, `*.cs`, `*.csproj`) → OBSOLETE for the React/Electron product.
- Sessions: Grok (4 KNOUX dirs, newest 2026-09-12), Kimi (6 dirs, Aug), OMP (4 dirs) — all predate
  the 2026-09-13/14 integration wave; design evidence already consumed (Programs Golden Master on main).
- Backups/releases (`Knoux-Repair-v2.0.x-Release`, `.knoux\backups`, thumbnail backup): old donors only.
- Full-dash donor (`D:\Knoux-Repair-Full-dash`, LAB-ONLY head): 1 unique file, `Operations3dDeck.tsx`
  (512-line rAF gimbal ornament) → DEFERRED per §13 (decorative, no new real capability).
- Quarantine (`D:\Knoux-repair\Quarantine`): live cleanup-tool store (node-compile-cache etc.),
  NOT a source. Untouched.

## Commit classification (detail: vault `COMMIT-RECOVERY-MATRIX.md`)

- 12/17 remote branches: ahead=0 → ALREADY_ON_MAIN.
- `ui/grok-integration-20260914` (5): tree-identical to squash `875ebb4` (PR #33 merged).
  Tip additionally deletes the `reference-workbench.css` import → merging now would REGRESS main. NOT MERGED.
- `closure/work-resume-20260913` (7): stale base `67f2384`; main +6949 lines ahead with newer
  capture scripts, station rewrites, executionSemantics. SUPERSEDED.
- `ci/fix-artifact-upload` + `ci/resilient-wait-inventory` (`d1ce71b`): PRs #29/#30 closed unmerged;
  resilience present on main (`961ef2a`, retry/fallback in capture scripts). SUPERSEDED.
- Cockpit line (24af893/e19b419/e04d929/530c0b9/7a70e77): core ported (`8805b68`, `1272bf4`,
  `1d379a9`, `58b3c86`); leftovers banned by `workbenchReconciliation.test.mjs`. Remainder UNSAFE.
- Unreachable `e7686b7` (workbenchUtils + utility routes): DEFERRED — no UI consumer on main
  (dead API surface), `/api/runs` body fix NOT_APPLICABLE (main delegates to bridge-auth handler).
- Unreachable `903df15` (TopBar PNG brand): PORTED (cherry-pick `4f75bbb` on recovery branch).
- Stashes: @{0} ALREADY_ON_MAIN (PR #24); @{1}/@{2} EVIDENCE_ONLY (manifests in vault, binaries not merged);
  @{3} UNSAFE (drops canonical selectors); @{4-6} INFRA_DUPLICATE; @{7} SUPERSEDED (cinematic layer on main).

## UI reconciliation (detail: vault `UI-RECOVERY-MATRIX.md`)

One canonical implementation per component, all on main: premium splash, TopBar (+PNG brand port),
LeftRail, FamilyPage+HeroSection+FamilyLiveStage+ToolCard coexistence (locked by reconciliation test),
CommandCenter + RuntimeVisualizer, EngineeringWorkbenchStation (truth-preserving shell),
Project Sonar, Developer Tools, Sentinel lightweight mesh, Programs Golden Master + QA gate,
reference-workbench skin + action-rail guard. No competing shells active. No KNOUX Core/Reactor/Wheel
mappable to real capabilities exists anywhere → center stage stays real (CommandCenter/RuntimeVisualizer/Sentinel).

## Verification (recovery branch, `4f75bbb`)

- `npm ci` / `npm run typecheck` → PASS (exit 0)
- `npm test` → **378/378 PASS**, incl. new `topbarBrand` (3), 6/18/158 contract, reconciliation,
  Sentinel lightweight + heavy-probe-explicit guards
- `npm run build` → PASS (one pre-existing `import.meta`/cjs esbuild warning in `server.ts`, untouched)
- Live preview (`tsx server.ts`, gateway :3000 + bridge :8787, manifest 158 tools / 18 categories):
  Home, 6 families, navigator (6/18/158), Workbench (DevTools 13 + Sonar 7 actions, no synthetic
  telemetry), Programs Studio + capability matrix, Diagnostics real system data, tool action drawer
  expands with real clickable actions, Sentinel mesh (latency + per-service counts + explicit deep probe).
  Cold-start note (pre-existing, not a regression): first paint before gateway readiness shows
  Offline; in-app Retry reconnects, reload shows `Bridge Online • 158 tools ready`.
- 18/18 service routes: covered by `capture-18-services-evidence.mjs` + `station18`/`workResumeClosure` tests.
- 158 ToolId contract: locked by product-contract test (PASS).
- Windows CI: main HEAD `c404e77` runs SUCCESS (34808130692/34808130565); recovery-branch run linked in PR.

## Push / merge

- Recovery branch pushed; merged to `main` (or via PR if protected — see below).
- No force-push. No cleanup performed (branches/worktrees/backups/quarantine/sessions retained).
