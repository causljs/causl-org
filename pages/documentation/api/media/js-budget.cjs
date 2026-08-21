// Single source of truth for the @causl/causl-wasm-ts JS bundle-budget ceilings
// (issue #161, acceptance criterion 1: the JS bundle budget must GATE, not
// TRAIL).
//
// Background. The `.size-limit.cjs` JS cells drifted to 30 KB / 28.5 KB / 30 KB
// through six serial per-re-vendor bumps while the actual bundle leaned back to
// ~16.9 / ~14.8 / ~17.7 KB (the §18A rust-ssot cutover moved the marshaler /
// decoder payload onto the externalised `@causl/causl-wasm-ts/wasm` subpath, off the main
// bundle). With ~13-14 KB of slack the caps became a trailing indicator: a real
// 1.6x main-bundle regression would sail under them. That is the exact failure
// the issue names.
//
// This module restores the LEADING ceilings the SPEC already ratified so the
// caps cannot silently drift above the written-consensus band again. Both the
// CI gate (`.size-limit.cjs`, consumed by `pnpm size` / bundle-budget.yml) and
// the contract test (`__tests__/js-budget-contract.test.mjs`) import these — one
// source of truth, mirroring how `tools/wasm-build/build.mjs` is the SSOT for
// the raw-wasm caps (criterion 2, PR #229).
//
// The numbers are SPEC.md §14.2.2 verbatim ("The four `size-limit` ceilings"),
// which are themselves the §14.2.1 written team consensus — restoring them is
// re-aligning the config with the consensus the SPEC records, NOT minting a new
// budget decision. §14.2 fixed the working target at 18 KB and the full-import
// ceiling at 18 KB target + ~2 KB headroom = 20 KB; the 2026-08-03 amendment
// below raises that whole band by 10 KB, to a 28 KB target and a 30 KB cap, and
// §14.2's shipping band with it, 15-30 -> 25-40 KB.
// The DISCIPLINE is unchanged — cap = target + 2 KB — and that is the point of
// moving the target rather than the headroom.
//
// size-limit parses `limit` strings via `bytes-iec` (IEC): `KB` is DECIMAL
// (1000^n), `KiB` is BINARY (1024^n). These caps are authored in `KB`
// deliberately, so `'20 KB'` = 20 000 B; the test replicates that parse.

// -----------------------------------------------------------------------------
// AMENDMENT 2026-08-03 (#352) — the whole band raised by 10 KB.
//
// A §14.2.1 written-team-consensus decision. It is recorded here, once, rather
// than re-derived per cell, because all five numbers below moved together and a
// reader who finds only one of them changed will assume drift.
//
//   WORKING_TARGET_BYTES         18 -> 28 KB
//   WASM_LOADER_TARGET_BYTES     20 -> 30 KB
//   full import                  20 -> 30 KB
//   createCausl-only             16 -> 26 KB
//   wasm loader                  22 -> 32 KB
//
// What it was raised OVER, measured with `pnpm size` on an idle host:
//
//   67f66a2 (campaign start)  createCausl-only  16.05 KB against a 16 KB cap
//   eb2215e (main, today)     createCausl-only  17.56 KB against a 16 KB cap
//   eb2215e                   full import       19.58 KB against a 20 KB cap
//   eb2215e                   wasm loader       20.54 KB against a 22 KB cap
//
// So `createCausl-only` had been over its cap since BEFORE the #255/#275
// campaign began — by 46 B, small enough to read as rounding — and the campaign
// then added ~1.5 KB on top of it. Nothing went red, because bundle-budget.yml
// runs only on `release` and the campaign pushes with --no-verify, so neither
// the CI gate nor the pre-commit hook ever evaluated a commit on `main`. See
// #352 for that analysis; it is the reason this is an amendment and not a
// mechanical re-baseline.
//
// MAX_HEADROOM_BYTES deliberately stays at 2 KB. Raising the headroom instead
// of the target was the other available knob and it was rejected: 12 KB of
// slack is exactly the trailing-indicator state #161 fixed, and the note on
// that constant already names a re-bump to it as the thing the contract test
// exists to trip. Moving the target keeps every cap leading by the same bound;
// only the band moves.
//
// The band moved with the caps, in the same decision. Raising the ceilings alone
// would have put `full import` at exactly 30 KB — the outer edge of the 15-30 KB
// band §14.2 declared — which is a band with no room left in it rather than a
// budget. So §14.2 was amended in step: the shipping band is now 25-40 KB with a
// 28 KB working target, keeping its original shape (floor = target - 3 KB, outer
// ceiling = target + 12 KB). `full import`'s 30 KB cap is therefore a cap INSIDE
// a band, with the 40 KB outer ceiling bounding the cycle after this one.
// -----------------------------------------------------------------------------

// SPEC §14.2 working target for `@causl/causl-wasm-ts (full import)`, in bytes (decimal
// KB, matching size-limit's bytes-iec `KB`). The ceilings must sit within a
// bounded headroom of this so the gate LEADS the target rather than trailing far
// above it.
const WORKING_TARGET_BYTES = 28 * 1000

// Maximum headroom a JS ceiling may carry above the §14.2 working target and
// still count as a leading gate. §14.2.2 sets the full-import ceiling at
// target + ~2 KB; this bounds every JS cap to that discipline. A re-bump back to
// the old 30 KB trailing cap (12 KB of headroom) trips the contract test.
const MAX_HEADROOM_BYTES = 2 * 1000

// SPEC §18A working target for the lazy `@causl/causl-wasm-ts/wasm` loader
// subpath, in the same decimal KB.
//
// ADDED 2026-08-02 as a §14.2.1 written-consensus decision, replacing an
// borrowed number. The loader chunk is explicitly NOT one of the four
// §14.2.2-named cells — it is the §18A chunk, externalised from the main bundle
// precisely so its payload does not sit in `@causl/core`. It was nonetheless
// capped against `WORKING_TARGET_BYTES`, the MAIN BUNDLE's target, because it
// had none of its own. That is the defect: a chunk whose whole purpose is to be
// somewhere else was being measured against the thing it was moved out of.
//
// The borrowed number had also stopped leading. The cell measured ~17.7 KB when
// the 20 KB cap was set (11.5% headroom) and 19.85 KB on 2026-08-02 (0.75%) —
// a band that fires on the next change of any size is a tripwire, not a leading
// indicator. Raising `WORKING_TARGET_BYTES` instead would have loosened the two
// main-bundle cells by the same amount, and those are what §14.2 defends
// hardest; the minimal-import cell deliberately rides tight at 15.4/16 KB.
//
// Its own target (20 KB when this cell was introduced, 30 KB since the
// 2026-08-03 +10 KB amendment), so the loader carries the SAME leading
// discipline as the main bundle — cap = target + MAX_HEADROOM_BYTES, no special
// case, no wider slack. When this chunk reaches the cap the band is working and
// the conversation is about the payload.
const WASM_LOADER_TARGET_BYTES = 30 * 1000

// CELL KEYS (EPIC #275 W7, issue #282). The two main-bundle keys below read
// `@causl/core …` until #282 — the specifier `9e6d669` retired. The cell `name`
// in `.size-limit.cjs` IS this key, so the two moved together. SPEC.md §14.2.2
// had recorded the retired-specifier mismatch and deferred the rename; #282
// owns it and requires it in the same change as the first committed bundle
// capture, because a before/after table whose rows are labelled with a package
// that no longer resolves is unreadable at the moment it matters.
// `@causl/core-rs` (the engine crate) and `@causl/core-ts` (the fork) are LIVE
// names and are deliberately untouched.

module.exports = {
  WORKING_TARGET_BYTES,
  WASM_LOADER_TARGET_BYTES,
  MAX_HEADROOM_BYTES,
  // Which working target each cell leads. Absent = the §14.2 main-bundle target.
  cellTargets: {
    '@causl/causl-wasm-ts/wasm (Phase-1 loader + WasmBackend wrapper)':
      WASM_LOADER_TARGET_BYTES,
  },
  // The size-limit `limit` strings for the three main JS cells, keyed by
  // cell `name` so the config and the test bind to the same cell unambiguously.
  jsCeilings: {
    // SPEC §14.2.2: `@causl/core (full import)`. Was 20 KB (18 KB target + ~2 KB);
    // 30 KB since the 2026-08-03 +10 KB amendment (28 KB target + ~2 KB). That is
    // the outer edge of §14.2's 15-30 KB band — see the amendment note.
    '@causl/causl-wasm-ts (full import)': '30 KB',
    // SPEC §14.2.2: `@causl/core (createCausl-only)` = 16 KB (minimal-import
    // floor; §14.2.2 amendment 2026-07, issue #129 write-SSOT cutover:
    // raised 15 → 16 KB for the ~0.4 KB of gated Phase A-C-deletion arms
    // inside `commitInternal` — the one shared §5 pipeline, so the arms
    // cannot live off the main bundle; the heavy reroute bodies sit on the
    // `@causl/causl-wasm-ts/wasm` subpath). Rides tight to the ~15.4 KB measurement
    // by design — the minimal path is the one the budget defends hardest,
    // and it still LEADS the working target (18 KB then, 28 KB since the
    // 2026-08-03 +10 KB amendment). Measured 17.56 KB on `main` @ eb2215e, which
    // is what the old 16 KB cap was failing on — see #352.
    '@causl/causl-wasm-ts (createCausl-only)': '26 KB',
    // The lazy `@causl/causl-wasm-ts/wasm` loader subpath is NOT one of the four
    // §14.2.2-named cells (it is the §18A loader chunk, externalised from the
    // main bundle), so as of 2026-08-02 it leads its OWN target —
    // `WASM_LOADER_TARGET_BYTES` (20 KB then, 30 KB since the 2026-08-03 +10 KB
    // amendment) + the same 2 KB bound = 32 KB. It used to
    // borrow the main bundle's 18 KB target, which is the number it was
    // externalised to stay out of. See the note above that constant.
    '@causl/causl-wasm-ts/wasm (Phase-1 loader + WasmBackend wrapper)': '32 KB',
  },
}
