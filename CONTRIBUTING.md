# Contributing to KNOUX Repair

Thanks for helping improve KNOUX Repair. This guide covers the workflow, the
quality gate, and the product rules that every change must respect.

**Read `ARCHITECTURE.md` first** — it explains the processes, the tool-execution
pipeline, and the contracts a change can break.

---

## 1. Before you start

- **Windows is the only supported platform.** The product repairs a Windows
  machine; most tools shell out to Windows-only commands. Do not introduce
  cross-platform abstractions that dilute a Windows-specific requirement.
- **The product is local-first.** Anything that sends user data off the machine is
  opt-in, explicit, and auditable. If a change adds a network call, it must be
  disabled by default and must never carry local secrets.
- **Truthfulness outranks convenience.** A tool that fails must report the
  failure. Never paper over an error, invent a value, or present partial work as
  complete.

---

## 2. Getting set up

```bash
git clone https://github.com/daynightae-cmyk/knoux-Repair.git
cd knoux-Repair

npm --prefix web-frontend ci          # install web-frontend dependencies
npm --prefix web-frontend run build    # build the renderer + server bundle
```

Run the app:

```bash
npm --prefix web-frontend run desktop:dev   # Electron, dev mode
npm --prefix web-frontend run bridge        # the bridge alone, on 127.0.0.1:8787
```

> The Electron binary is fetched by the `electron` package's postinstall. If your
> install policy blocks postinstall scripts, run `node install.js` inside
> `web-frontend/node_modules/electron` — the package declares
> `allowScripts: { "electron@42.11.15": true }` for exactly this case.

---

## 3. The quality gate

Every change must pass all five gates locally **and** in CI before it is merged:

```bash
npm --prefix web-frontend test        # all suites must pass
npm --prefix web-frontend run typecheck
npm --prefix web-frontend run build
npm --prefix web-frontend audit
git push origin <branch> && gh pr create
```

CI runs a Windows quality gate, the installer build, CodeQL, and the dependency
review. **A green local run is not a substitute for green CI** — CI is what runs
on a clean Windows runner with a real install.

---

## 4. Branching and commits

- Branch from `main`: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- One logical change per pull request. A refactor and a behaviour change do not
  belong in the same PR.
- Write commit messages in the imperative mood, e.g.
  `fix(workbench): reject archives that escape the extraction root`.
- Never force-push a shared branch, and never rewrite `main` history.

---

## 5. Writing a tool

A tool is a PowerShell script under its category folder
(`NN-Category/XX-ToolName.ps1`). The contract is strict:

```powershell
#Requires -Version 5.1
[CmdletBinding()]
param([switch]$AnalyzeOnly, [switch]$WhatIf)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\Core\KnouxRepair.Core.psm1') -Force

$Session = Start-KnouxSession -ToolId 'XX00' -ToolName 'Human Name' `
    -Category 'NN-Category' -RiskLevel 'READ_ONLY' `
    -Mode $(if ($AnalyzeOnly) { 'analyze' } elseif ($WhatIf) { 'preview' } else { 'run' })

Write-KnouxHeader -Session $Session -AnalyzeOnly:$AnalyzeOnly -WhatIf:$WhatIf

# ... measure the system, set $Session.Status, $Session.ItemsFound, etc.

$Session.ExitCode = 0
$result = Stop-KnouxSession -Session $Session
Write-KnouxResult -Session $Session
return $result
```

Rules:

1. **Always use the Core session API.** Do not hand-roll report files — the seven
   entry schema is enforced by `Test-KnouxReportSchema`.
2. **Do not pass `-RunId`.** The Core module derives the run id from the validated
   execution context so the report stays correlatable with its run.
3. **Write auxiliary data into `$Session.RawDir` only.** Anything else in the
   session folder breaks the schema.
4. **Set the status honestly.** `Success`, `Warning`, `Failed`, `Cancelled`,
   `Skipped`, `Inconclusive` — and let `Stop-KnouxSession` fix the exit code.
5. **Declare your capabilities.** `-AnalyzeOnly` / `-WhatIf` switches, plus the
   `AnalyzeOnlySupported` / `WhatIfSupported` manifest flags, must agree.
6. **Register in two places:** `Docs/TOOLS-MANIFEST.json` **and**
   `Config/menus.json`. The bridge refuses a script that is missing from the menu
   index.
7. **Respect the risk model.** `READ_ONLY` tools must not change anything.
   `SYSTEM_REPAIR` and above need explicit confirmation evidence; `WINRE_ONLY` is
   never authorized online.
8. **Use the safety helpers** from `Core/KnouxRepair.Safety.psm1`:
   `Test-KnouxProtectedPath`, `Move-KnouxItemToQuarantine`, `New-KnouxBackup`.
   Never delete directly — quarantine first, so the action stays reversible.

---

## 6. Writing tests

Suites live in `web-frontend/tests/` and use `node:test`.

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

test('Feature: the thing that must be true', () => {
  assert.equal(actual, expected);
});
```

Guidance:

- **Test behaviour, not source text.** Several existing suites read source files
  to lock structural invariants; that is acceptable for *architecture* rules, but a
  behavioural assertion is always stronger. Where a PowerShell contract is
  involved, execute PowerShell (see `reportRunCorrelation.test.mjs`).
- **One concern per file.** The filename should say what breaks without it.
- **Guard tests are valuable.** A test that fails if a forbidden capability
  reappears (a secret reaching the AI, an archive being extracted, a write
  capability returning) protects a promise the product makes to the user.
- **Name tests as the invariant**, e.g. `Invariant: Manifest contains exactly 158
  tools across 18 numbered categories`.

---

## 7. Visual and UI changes

The product has a committed visual contract:

- Screenshots live in `web-frontend/visual-evidence/`.
- Capture scripts live in `web-frontend/scripts/capture-*.mjs`.
- A visual change must come with updated evidence at the supported viewports
  (1366×768, 1440×900, 1920×1080) and in **both** LTR and RTL.
- Layout suites (`*WorkspaceLayout`, `*VisualPolish`, `*VisualLock`) encode the
  contract in code so a regression fails CI rather than a human's eye.

---

## 8. Internationalization

The UI is Arabic and English. Both directions are first-class:

- The `dir` attribute flips the whole shell; verify RTL explicitly.
- Arabic literals in the source tree must be real UTF-8. Verify the bytes, not
  your console's rendering.
- `Core/KnouxRepair.Reporting.psm1` emits both `summary-en.txt` and
  `summary-ar.txt` for every run.

---

## 9. Security and privacy

- **Never** log, persist, or transmit a secret, a token, or local file content.
- New bridge routes that mutate state must go through `checkMutationGuard` (origin
  + JSON content type + bridge token).
- New process spawns must validate their arguments and their target path.
- The renderer must stay sandboxed with no `nodeIntegration`.
- If you add a network call, it is opt-in, disabled by default, documented, and
  covered by a test that proves it stays off.

---

## 10. Pull request checklist

- [ ] `npm --prefix web-frontend test` passes
- [ ] `npm --prefix web-frontend run typecheck` is clean
- [ ] `npm --prefix web-frontend run build` is clean
- [ ] `npm --prefix web-frontend audit` reports 0 vulnerabilities
- [ ] New behaviour has a test
- [ ] Visual changes ship with updated evidence (both directions, all viewports)
- [ ] The catalog invariants (158 / 18 / 6) still hold
- [ ] Reports still contain exactly seven entries
- [ ] The PR description states what changed, what was proven, and what was not

---

## 11. Reporting a security issue

Please do not open a public issue for a security vulnerability. Follow
`SECURITY.md`.

---

## 12. Code of conduct

Be respectful and constructive. Assume good faith, critique the code and never the
person, and prefer a concrete proposal over a complaint.
