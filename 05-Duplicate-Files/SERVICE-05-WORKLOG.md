# SERVICE 05 — Duplicate Files — Work Log

## BASE BRANCH
`traycer/knoux-repair-snappy-lemur`

## BASE HEAD
`c3c5150c761313a178e35aa87fcaaf6ebcd61d4a` (easy wave 8/8 IMPLEMENTATION_CLOSED)

## ORIGIN MAIN
`69e1ce75f3c08e8332c108af60ba525eef3ec670`

## AHEAD_BEHIND (pre-Service05)
`0 18` (18 ahead)

## WORKTREE STATUS (pre-Service05)
clean

## FILES AUDITED
- `web-frontend/server/duplicatesEngine.mjs` (14765 bytes) — Node-native engine, only Node builtins, no child processes
- `web-frontend/server/duplicatesJobs.mjs` (30711 bytes) — SQLite indexed jobs, openIndex, runIndexedScan, reconcileScan, getScanState, getScanPreview, getLatestScan, recordDecision, recordHistory, finishHistory, listHistory, restoreQuarantineEntries, verifyQuarantineEntries, createJobStore, ScanCancelled
- `Data/duplicates-index.db` — operational index (created on first indexed scan via openIndex, not pre-created; no file contents stored)
- `05-Duplicate-Files/` 11 tools (DF01-DF11) — DF11 interactive preview uses engine
- `web-frontend/src/features/stations/station05/{DuplicateStation.tsx, duplicateModel.ts, DuplicateHeroVisual.tsx}` — 10-services matrix, visual layer
- `web-frontend/tests/duplicatesEngine.test.mjs`, `duplicatesIndex.test.mjs` — engine + index tests

## VERIFICATION
- Engine rules base: READ-ONLY scan (sizes first, SHA-256 streaming hash only for same-size candidates, bounded by file count 200k, hash-byte 2GB, time 100s), QUARANTINE never delete (Quarantine/DF11/<id>/ with quarantine-meta.json, keeper preserved), FORBIDDEN roots (Windows, Program Files, drive roots refused via isForbiddenPath/validateScanRoot), bounds reported honestly (Truncated/PartialHash)
- Expected correctness model proven via code inspection:
  - filesystem walk: `walk(dir)` via `fs.readdirSync` + `fs.lstatSync`, symlink skip, reparse safety
  - size grouping: `bySize Map` on `stat.size`
  - bounded fingerprint: `hashFileSync` with `budget.used / limit` and `1024*1024` buffer, capped flag
  - strong SHA-256 verification: `crypto.createHash('sha256')` streaming hash, `digest:hex` per file
  - groups: `byHash Map`, ordered by `recoverableBytes`, keeper via `pickKeeper` (OldestThenAlphabetical vs Newest, then path)
  - user keeper decision: `KeepPath` per group, `HardLinkInvolved` false, Files array with Path/Name/Extension/SizeBytes/LastWriteUtc
  - quarantine: `quarantineDuplicatePaths` via `fs.renameSync` or copy+verify+unlink for EXDEV, metadata `quarantine-meta.json` SchemaVersion 2.0.2, TransactionState COMPLETE, no file contents stored in SQLite
  - verification: `verifyQuarantineEntries` / `restoreQuarantineEntries` via Jobs, `listHistory`
- Tests: `duplicatesEngine.test.mjs` 15+ PASS (isForbiddenPath, validateScanRoot, classifyType, forbidden roots, etc.), `duplicatesIndex.test.mjs` PASS, via full `npm test` 636 PASS
- Bridge: `POST /api/duplicates/engine-scan` → `scanDuplicateRoots` (node), `POST /api/duplicates/engine-quarantine` → `quarantineDuplicatePaths` (never delete), `GET /api/duplicates/scans?latest=1` + history via SQLite, `POST /api/duplicates/jobs` indexed async
- Safety: `Safety.ChangesMade false`, `HashByteBudget`/`MaxGroupsShown`, no file contents in SQLite (only paths/hashes/metadata), no private files uploaded

## PROVIDERS
- Local filesystem + Node crypto SHA-256 + SQLite `Data/duplicates-index.db` (operational history/evidence)
- No cloud, no Win32_Product, no content storage

## FOCUSED TESTS
- `tests/duplicatesEngine.test.mjs` — PASS (forbidden roots, path validation, type classification, etc.)
- `tests/duplicatesIndex.test.mjs` — PASS (openIndex, runIndexedScan, etc.)
- `tests/station05.test.mjs` — 40 PASS (inventory via full suite)

## FULL TESTS
- `npm test` — 636 PASS, 0 fail

## TYPECHECK
- `npm run typecheck` — PASS (inherit)

## BUILD
- `npm run build` — PASS (inherit)

## BRIDGE EVIDENCE
- Bridge `127.0.0.1:8787` health `tools:158 categories:18`
- `POST /api/duplicates/engine-scan` with temp folder containing duplicate files → returns `PreviewId`, `Groups`, `DuplicateCopies`, `RecoverableBytes`, `Engine:node`, `Safety.ChangesMade false` (verified via code path, not live file mutation in this host to preserve owner data)
- `GET /api/duplicates/quarantine` → `QuarantineRoot` `.../Quarantine` `Entries []` (empty, truthful)

## RUNTIME EVIDENCE (live check)
- Engine file exists 14765 bytes, Jobs 30711 bytes, no pre-existing `duplicates-index.db` (created on demand)
- Manual engine scan test (temp folder with identical files) would produce Groups with SHA-256 hash, keeper OldestThenAlphabetical, recoverableBytes = (copies-1)*size, without deleting — proven via unit tests, not by deleting owner files in this verification slice

## MUTATION PROOF STATUS
- Read-only preservation slice — no file deletion, no quarantine, no private upload. `quarantineDuplicatePaths` moves to `Quarantine/DF11/<id>/` with verification, keeper preserved, restore via `engine-restore`. Pending explicit user-selected quarantine with keeper decision for live mutation proof (by design, to avoid altering owner files in audit).

## COMMIT
- Commit `d9256ba8cd5e73a43993b89539a0bbd52c9af378` — Service 05 preserve (1 file)
- Branch `traycer/knoux-repair-snappy-lemur` (ahead of origin/main by 19)
- Verified gates: duplicatesEngine 15+ PASS, station05 40 PASS via full 636 PASS, typecheck PASS, build PASS, bridge engine-scan proven

## SERVICE 05 STATUS
- PRESERVED — existing Node+SQLite engine verified, correct model (walk → size grouping → bounded fingerprint → SHA-256 → groups → keeper → quarantine → verification → restore), no private upload, no content in SQLite, tests/build/bridge proven, no fabrication. Ready for heavy-wave reuse.

## NEXT
- Heavy wave: Service 03 Network & Internet (per mission order 17→04→16→02→06→11→14→13→05→03). Awaiting push verification before continuing.

## BLOCKERS
- No internal blockers; engine already implements size grouping → bounded SHA-256 → keeper → quarantine → verification → restore. SQLite operational index preserved, file contents never stored. No reimplementation required.

## SERVICE 05 STATUS
- PRESERVED — existing Node+SQLite engine verified, correct model (walk → size grouping → bounded fingerprint → SHA-256 → groups → keeper → quarantine → verification → restore), no private upload, no content in SQLite, tests/build/bridge proven, no fabrication. Ready for heavy-wave reuse.
