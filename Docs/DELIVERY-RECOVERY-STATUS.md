# KNOUX Repair Delivery Recovery Status — 2026-09-14

## Authority

- Canonical repository: `daynightae-cmyk/knoux-Repair`
- Delivery branch: `delivery/recover-visual-work-20260914`
- Delivery base: `main@24f87a73ba3647e0b088c2f9851e1830a2d75a34`
- Main is intentionally untouched by this delivery lane until verification is complete.

## Preserved on delivery branch

- `web-frontend/src/components/BrandLogo.tsx`
  - source: recovered implementation/handoff
  - purpose: canonical reusable KNOUX wide + compact brand lockup
  - restored by commit `36cb5068db88a376b90da57554645434814c5ea6`

## Known implementation work that is not present on current remote main

The following recovered implementation was proven to exist in the local/handoff work but is not yet present on `main@24f87a7`:

### Entry / brand assets

- `web-frontend/public/brand/knoux-entry-cinematic.png`
- `web-frontend/public/brand/knoux-home-core.png`
- `web-frontend/public/brand/knoux-mark-crystal.png`
- `web-frontend/public/brand/knoux-repair-wordmark-wide.png`
- `web-frontend/public/brand/knoux-software-library-hero.png`

### Home

- `web-frontend/src/components/pages/HomePage.tsx`
- `web-frontend/src/components/pages/HomePage.css`
- `web-frontend/src/components/pages/HomeContextPanel.tsx`
- `web-frontend/tests/homePage.test.mjs`

### Software Library

- `web-frontend/src/components/pages/SoftwareLibraryPage.tsx`
- `web-frontend/src/software-library-command-deck.css`

### Reconciliation-required files

These must NOT be copied wholesale because current main contains newer runtime/auth/workbench behavior:

- `web-frontend/src/App.tsx`
- `web-frontend/src/main.tsx`
- `web-frontend/src/components/premium/FamilyPage.tsx`
- `web-frontend/src/components/premium/TopBar.tsx`
- `web-frontend/src/components/premium/LeftRail.tsx`
- `web-frontend/src/components/NexusSplash.tsx`
- `web-frontend/src/components/NexusSplash.css`
- `web-frontend/src/components/splashModel.ts`
- `web-frontend/src/premium-shell.css`

## Programs & Applications

A later local Work implementation reported the Programs station as:

- six primary modes
- secondary expert drawer
- real search
- four real filters
- 120-application display cap
- selection separated from execution
- no fabricated inventory

That implementation is not present on the current remote `main`; current remote Programs still reflects the older multi-tab architecture. The exact final local/handoff source must be delivered before merging.

## Delivery rules

1. Preserve 6 Families / 18 Services / 158 canonical ToolIds.
2. Preserve current bridge, auth, MCP, KNOUX AI, Workbench, Sonar and Sentinel runtime contracts.
3. No blind overwrite from Full-dash or historical branches.
4. No fake telemetry, fake application inventory or decorative capability exposure.
5. Binary assets must be delivered before wiring `BrandLogo` or cinematic entry references into live UI.
6. Enhanced cinematic `NexusSplash` must be reconciled with the newer lifecycle/readiness behavior on current main, not copied wholesale.
7. Delivery is not complete until typecheck, tests, build and rendered route evidence pass on the final branch.

## Current remote delivery state

- Main: `24f87a73ba3647e0b088c2f9851e1830a2d75a34`
- Delivery HEAD after first preserved source: `36cb5068db88a376b90da57554645434814c5ea6`
- Main modified: **NO**
- Full delivery complete: **NO**
- Reason: remaining handoff text files and binary assets must be transferred/reconciled before a truthful merge.
