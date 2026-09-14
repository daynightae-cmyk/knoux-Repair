# Engineering Workbench — Command Deck (local-only, no push/merge)

Branch (local only): `recovery/knoux-visual-closure-20260914`
Base: `main@24f87a7`. Nothing was pushed; delivery is a full ZIP.

## What changed (4 source files + 1 asset + 1 test)

- `web-frontend/src/components/premium/workbench/EngineeringWorkbenchStation.tsx`
  Converted into a Command Deck: Hero banner, 2 clickable service cards, 7-chip
  quick-action strip, honest context strip, live preview workspace (unchanged
  `ServiceApps` screens). All reconciliation markers preserved
  (`knoux-workspace-stage`, `data-mode="service"`, `data-execution="idle"`,
  `knoux-stage-service-app`, both service ids, `activeSection`, no web storage).
- `web-frontend/src/components/premium/FamilyPage.tsx` — one additive prop:
  `familyTools={familyTools}` so per-service counts are live, not guessed.
- `web-frontend/src/workbench-command-deck.css` (new, wired in `main.tsx`) —
  namespaced `knoux-deck-*`, responsive, `prefers-reduced-motion` support.
- `web-frontend/public/brand/workbench-hero.svg` (new) — standalone transparent
  hero asset: glass code-stack in cyan/violet, vector strokes only, **no embedded
  text**. The Hero tries `/brand/workbench-hero.png` first and falls back to the
  SVG, so a production PNG can be dropped in without code changes.
- `web-frontend/tests/workbenchCommandDeck.test.mjs` (new, 6 tests) — locks the
  contract, the 1:1 chip→manifest mapping, and bans fabricated content.

## Reference mapping (mock → reality)

| Reference element | Implementation | Data source |
|---|---|---|
| Hero "Build Smarter. Ship Safer." + art | Static copy + SVG/PNG asset (decorative, `aria-hidden`) | — (presentation only) |
| Bridge pill in Hero | Live | `bridgeOnline` prop |
| "20 Workbench tools" | Live count 13+7 | bridge `tools` |
| Developer Tools / Project Sonar cards | Live counts, click = `onSelectService` | bridge `tools` per category |
| 7 tool chips | 1:1 real ToolIds DT05/DT06/DT01/SN01/SN02/SN04/SN06; status dots live; click = confirm dialog → `onRunTool` | bridge `tools` + `toolStatuses` |
| Context strip | Bridge, Privilege, live action count, Sonar AI via `GET /api/sonar/ai-status` | bridge + API |
| Preview / Active Workspace | Unchanged `DeveloperStation` / `ProjectSonarStation` screens | existing stations |
| AI entry | Unchanged `KnouxAiContextButton` (real overlay) | existing |
| Repo status / Latest scan / AI recommendation / % rings | **Omitted** — no backend API exists; would be fabricated | — |

## Verification

- `npm run typecheck` PASS · `npm test` **384/384 PASS** · `npm run build` PASS
- Live preview `:3000` + bridge `:8787`: hero/cards/chips/context render with real
  numbers (13/7/20, Sonar AI Configured); chip DT06 → confirm dialog → real run →
  honest FAILED from the script (see below); chip-equivalent DT01 → **Success**;
  Sonar card switch verified (`data-service-id=18-Project-Sonar`, 7 actions);
  layout check: no horizontal overflow, 0 zero-size controls.
- Screenshots via automation time out in this environment; evidence is DOM-structural
  (rects/states/contract attributes captured during the session).

## Known pre-existing host failures (NOT introduced here, scripts untouched)

- DT06 fails on this machine: `[ERROR] Invalid class` (WMI class absent) — honest FAILED.
- DT05 fails on this machine: `The property 'version' cannot be found` — honest FAILED.
- Both surface real errors + reports under `Reports/`; the deck reports them truthfully.
