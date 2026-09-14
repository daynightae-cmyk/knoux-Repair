# KNOUX Repair — Grok UI Visual Integration QA

## Authority

- Canonical product baseline: `main` at `c6e73326bf983f3c49434b0d9db5bb25125c1ab8` when this integration phase started.
- UI integration branch: `ui/grok-integration-20260914`.
- Golden-master station for the first visual pass: **04 — Programs & Applications**.
- Product logic remains authoritative in the existing station, bridge, execution-controller, tool registry, and evidence models.

## Scope of this pass

This pass changes presentation only. It does **not** change registered PA tool IDs, execution modes, confirmation rules, bridge calls, parsing, verification, history, or safety semantics.

### Family / shell behavior

- Programs service gets a wider canonical live-workspace while `ProgramsStation` is mounted.
- The outer service rail stays available on desktop.
- The duplicated outer action rail is hidden only while the full Programs service application is mounted, so the station does not become `rail -> rail -> rail`.
- When a concrete tool workspace replaces the service application, the normal action/tool shell remains available.
- The Programs family preview is compressed vertically to give the real station more working area without removing the family context.
- Narrow layouts collapse the external service rail to avoid horizontal starvation.

### Programs visual DNA

- Deep black/navy glass canvas.
- Violet primary atmosphere with cyan precision accents.
- Warm orange is no longer the dominant shell color; semantic warning/error amber/red states remain untouched.
- Wide holographic Application Command Deck using the existing `ProgramsHeroVisual` implementation.
- Compact glass mini-navigation with an illuminated active state.
- Scan state uses a subtle moving scanline and keeps the real station execution state as its trigger.
- Tables, search, panels and inventory cards share the same low-noise glass treatment.
- Existing offline, elevation, error and confirmation states remain visible and semantically distinct.
- `prefers-reduced-motion` disables the new decorative motion.

## Truth / evidence guard

No machine metric, application count, startup count, bridge state, result state, repair result, risk level, or admin state is introduced by this stylesheet. The visual layer only renders state already exposed by the existing station.

The current repository already contains `noFabricatedProgramsEvidence.test.mjs`; this pass intentionally leaves the Programs evidence and execution code unchanged.

## Static review status

| Check | Status | Evidence |
| --- | --- | --- |
| No PA execution logic changed | PASS | Only stylesheet + CSS import changed in this pass |
| No Bridge/API contract changed | PASS | No server/API files changed |
| No station evidence model changed | PASS | `programsModel.ts` untouched |
| Outer rail duplication reduced for Programs | PASS (code review) | CSS targets mounted `.programs-station` only |
| Existing tool workspace path preserved | PASS (code review) | `FamilyPage`, `FamilyLiveStage`, `ProgramsStation` source untouched |
| Reduced motion supported | PASS (code review) | `prefers-reduced-motion` override included |
| Runtime visual comparison | PENDING | Requires launching the Windows/Electron/Vite runtime and capturing Programs at target sizes |
| TypeScript | NOT RUN FOR THIS CSS-ONLY COMMIT | No TS source logic changed, but release gate still requires the repository command |
| Production build | NOT RUN FOR THIS CSS-ONLY COMMIT | Must be verified by CI or local Windows worktree |

## Required runtime visual gate before merge

Capture Programs & Applications in at least:

1. 1366×768
2. 1440×900
3. 1920×1080
4. 1120×720

For each size verify:

- no horizontal overflow;
- service rail remains usable where shown;
- central Programs studio is the dominant surface;
- primary command deck is readable without scrolling at 1366×768;
- offline/elevation/error banners do not overlap navigation;
- mini-nav scroll is usable when all tabs are present;
- selecting a concrete PA tool restores the canonical tool workspace path;
- no fake counts appear before evidence exists;
- reduced-motion mode removes decorative scan animation.

## Merge gate

Do not merge this UI branch from appearance alone. Merge only after runtime screenshots plus repository typecheck/build/tests prove the presentation layer did not disturb the existing execution architecture.
