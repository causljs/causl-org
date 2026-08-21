// size-limit configuration (moved out of package.json).
//
// CELL NAMES (EPIC #275 W7, issue #282). Four of the five cells W7 measures
// against were keyed by `@causl/core`, the specifier `9e6d669` retired in
// favour of `@causl/causl-wasm-ts`; only the loader cell carried the current
// one. SPEC.md §14.2.2 recorded the mismatch and deferred the rename, so prose
// bound to config on the label suffix rather than the whole name. #282 owns the
// rename and takes it here, in the same change as the first committed bundle
// capture, because a before/after table whose rows are labelled with a package
// that no longer resolves is unreadable at exactly the moment it matters. The
// cell `name` is the `jsCeilings` key, so the keys in
// `tools/size-budget/js-budget.cjs` moved with them.
// `@causl/core-rs` (the engine crate) and `@causl/core-ts` (the fork) are LIVE
// names and are deliberately untouched.
//
// Why a standalone .size-limit.cjs instead of the package.json `size-limit`
// key: the @causl/causl-wasm-ts/wasm cell needs a per-cell `modifyEsbuildConfig` hook
// (a FUNCTION) to set esbuild's platform to "node". In @size-limit/esbuild v12
// the cell-level `ignore` field does NOT map to esbuild `external` — it only
// nudges a require-polyfill size constant — and the only per-cell hook that can
// set esbuild platform/external is `modifyEsbuildConfig`, which cannot live in
// package.json JSON. size-limit resolves config from `searchPlaces` with
// package.json FIRST, so a sibling .size-limit.* file is ignored while the
// `size-limit` key still exists in package.json — hence the key was removed
// from package.json when this file was added.
//
// ---------------------------------------------------------------------------
// Doc-notes carried over verbatim from the former package.json `//size-limit*`
// keys (the governing rationale for the budgets below):
//
// //size-limit: Per SPEC.md §14.2 the bundle budget is the 15-30 KB band, with
// 18 KB as the working target on @causl/causl-wasm-ts (full import). The
// ceilings below
// are CI-gate caps — a PR that crosses one fails `size — bundle-size gate` and
// must include the §14.2.1 written team consensus or the size-limit bump is
// rejected. The 4.5 KB / 6 KB / 3 KB ceilings the previous spec defended were
// retired in PR #458 once the team accepted that the small-bundle promise was
// costing more in adopter glue (per closed PRs #266, #395, #420, #383, #455,
// #390, #454) than it was earning in elegance.
//
// //size-limit-wasm: The wasm-pkg artefact cell (gc-classic) gates the
// CONSOLIDATED `causl-engine-bridge` crate (issue #10), which replaced
// the stale split-crate `engine_rs` lineage. wasm-pack emits one
// `causl_engine_bridge_bg.wasm` per string-strategy feature variant
// (`classic-strings`) into `<bridge>-bundler/`;
// `pnpm wasm:build` (node tools/wasm-build/build.mjs, builds from the sibling
// causl-wasm checkout via CAUSL_WASM_PATH) regenerates them in-repo and also
// ENFORCES a 756 KB raw / 210 KB Brotli cap directly. Each cell here asserts
// the raw .wasm ceiling as a redundant CI gate against the committed artefact.
// The legacy `serde-json` cell was retired with the split-crate lineage — the
// consolidated crate produces no serde-json variant. The `gc-builtins` cell went
// the same way in causl/causl-core-rs#355: causl/causl-core-rs#210 measured that
// bridge's `wasm:js-string` imports as i32-typed where the W3C builtins are
// externref-typed, so it could not bind on any host, and the driver, the vendored
// tree and this cell all went with it. A ceiling over an artefact nobody can load
// measures nothing. The client currently ships
// the FULL export surface (~631 KB raw / ~185 KB Brotli) because its
// pre-cutover WasmBackend uses the marshaler / commit_batch (legacy-serde)
// path; the caps ratchet down when the client adopts the authoritative cutover
// and leans the artefact serde-free (as causl-ts-wasm-engine did).
//
// //size-limit-bench-fixtures: The 6 competitor-baseline cells (jotai full+min,
// redux-toolkit full+min, mobx full+min) were dropped in #19 because the
// `packages/bench/fixtures/*.ts` sources moved out of this slice into the
// sibling `causl/causl-bench` repo when the parent `iasbuilt/causl` monorepo
// was split. The cells are restored by an aggregator workflow that runs
// `pnpm size` across both repos — tracked separately from the per-slice budget
// gate enforced here. The deleted cells were: jotai full (≤20 KB), jotai
// atom-only (≤20 KB), @reduxjs/toolkit full (≤60 KB), @reduxjs/toolkit
// configureStore-only (≤60 KB), mobx full (≤30 KB), mobx observable+computed
// (≤30 KB).
// ---------------------------------------------------------------------------

// The auto-adapt wrapper lazy-imports the `@causl/causl-wasm-ts/wasm` subpath via a
// dynamic `import('@causl/causl-wasm-ts/wasm')`. That subpath is a SEPARATE chunk that
// must NOT count toward the main-bundle budget, and (since the #32 authoritative
// loader landed) it pulls in Node builtins (fs/promises/url/path — the build
// strips the `node:` prefix) that a browser-platform esbuild cannot resolve.
// Externalising both makes the main-bundle cells neither follow nor choke on the
// lazy wasm chunk. (`ignore` does not map to esbuild `external` in v12.)
function externalizeWasmSubpathAndNodeBuiltins(config) {
  config.external = [
    ...(config.external || []),
    '@causl/causl-wasm-ts/wasm',
    'node:fs', 'node:fs/promises', 'node:url', 'node:path',
    'fs', 'fs/promises', 'url', 'path',
  ]
  return config
}

// LEADING budget (issue #161, acceptance criterion 1). The three JS
// ceilings below are sourced from `tools/size-budget/js-budget.cjs`, which pins
// them to the SPEC §14.2.2 written-consensus band (20 KB full-import / 15 KB
// createCausl-only / 20 KB wasm-loader). They previously read 30 / 28.5 / 30 KB
// after six per-re-vendor bumps while the bundle leaned back to ~16.9 / ~14.8 /
// ~17.7 KB, leaving ~13-14 KB of slack — a trailing indicator that could not
// catch a 1.6x regression. Sharing the SSOT with the contract test
// (`tools/size-budget/__tests__/js-budget-contract.test.mjs`) stops the caps
// drifting back above the band without the gate going red. A bump here is a
// §14.2.1 written-team-consensus decision, not a mechanical re-baseline.
const { jsCeilings } = require('./tools/size-budget/js-budget.cjs')

module.exports = [
  {
    path: 'packages/core/dist/index.js',
    name: '@causl/causl-wasm-ts (full import)',
    // History (issue #161). This cell rode a chain of per-re-vendor bumps
    // (20→28→29→29.5→30 KB across #32, #53, #170, #72, cw#189/#190) that each
    // ratcheted the CAP to track a measurement wobble rather than gating a
    // budget. The §18A rust-ssot cutover then moved the marshaler / decoder
    // payload onto the externalised `@causl/causl-wasm-ts/wasm` subpath, so the main
    // bundle leaned back to ~16.9 KB while the cap stayed at 30 KB — ~13 KB of
    // slack, a trailing indicator. The cap now reads the SPEC §14.2.2 ceiling
    // from the js-budget SSOT: 20 KB (= the 18 KB §14.2 working target + ~2 KB
    // headroom), which LEADS the ~16.9 KB measurement. A future bump owes the
    // §14.2.1 band conversation, enforced by the contract test.
    // §14.2.2 leading ceiling, from the js-budget SSOT (was '30 KB' trailing).
    limit: jsCeilings['@causl/causl-wasm-ts (full import)'],
    ignore: ['@causl/causl-wasm-ts'],
    modifyEsbuildConfig: externalizeWasmSubpathAndNodeBuiltins
  },
  {
    path: 'packages/core/dist/index.js',
    import: '{ createCausl }',
    name: '@causl/causl-wasm-ts (createCausl-only)',
    // History (issue #161). Like the full-import cell, this rode a per-re-vendor
    // bump chain (16→25→26→27→28→28.5 KB) that tracked measurement rather than
    // gating. It now reads the SPEC §14.2.2 minimal-import ceiling from the
    // js-budget SSOT: 15 KB. This is the tightest JS cell by design — the
    // minimal path is the one the budget defends hardest — and it rides close to
    // the ~14.8 KB measurement so the gate genuinely leads.
    // §14.2.2 leading ceiling, from the js-budget SSOT (was '28.5 KB' trailing).
    limit: jsCeilings['@causl/causl-wasm-ts (createCausl-only)'],
    modifyEsbuildConfig: externalizeWasmSubpathAndNodeBuiltins
  },
  {
    path: 'packages/core/dist/wasm.js',
    name: '@causl/causl-wasm-ts/wasm (Phase-1 loader + WasmBackend wrapper)',
    // Bumped from 6 KB when the #32 authoritative loader (real WebAssembly
    // instantiate + the wire codecs cmd-buf/value-buf/diff-buf/tagged-types/
    // content-hash) replaced the stub. Measured 23.3 KB brotli (bundled+min);
    // this is the LAZY @causl/causl-wasm-ts/wasm chunk, not the main bundle.
    // Leading ceiling from the js-budget SSOT (was '30 KB' trailing). The lazy
    // wasm-loader subpath is not a §14.2.2-named cell; it is capped at the
    // full-import ceiling so it leads too (~17.7 KB measured under 20 KB).
    limit: jsCeilings['@causl/causl-wasm-ts/wasm (Phase-1 loader + WasmBackend wrapper)'],
    ignore: ['@causl/causl-wasm-ts', './chunk-*.js'],
    // The wasm entry's loader can pull in Node builtins (fs/promises, url, fs,
    // path) once the authoritative backend instantiation is un-stubbed; the
    // build strips the `node:` prefix, which size-limit's default browser-
    // platform esbuild cannot resolve ("Could not resolve fs/promises … use
    // platform: 'node'"), failing the WHOLE run before measuring. `ignore`
    // does NOT map to esbuild `external` in @size-limit/esbuild v12, so the
    // only per-cell hook that fixes resolution is modifyEsbuildConfig setting
    // platform: 'node'. Verified: esbuild --platform=node resolves wasm.js
    // cleanly (exit 0). This is a measurement-platform fix only — the cell
    // still measures the bundled+brotlied size (no disablePlugins, semantics
    // unchanged).
    modifyEsbuildConfig(config) {
      config.platform = 'node'
      return config
    }
  },
  {
    path: 'packages/core/wasm-pkg/gc-classic-bundler/causl_engine_bridge_bg.wasm',
    name: '@causl/causl-wasm-ts wasm bridge — gc-classic (raw)',
    // RAW-BYTES contract (issue #161). This is the redundant CI gate for the RAW
    // `.wasm` ceiling the build driver enforces (`tools/wasm-build/build.mjs` →
    // the `gc-classic` bridge's `rawBudgetBytes`). It MUST measure raw bytes:
    //   - `@size-limit/file` measures BROTLI by default (its `step60` brotli-
    //     compresses unless told otherwise), so a cell without `brotli: false`
    //     gates a brotli size against a raw-unit cap and could not catch even a
    //     2x RAW regression.
    //   - `brotli: false` switches `@size-limit/file` to the plain `stat` size
    //     (raw bytes on disk) — see @size-limit/file's `step60`.
    // Unit is KiB, not KB: size-limit parses limits with `bytes-iec`, where
    // `'756 KB'` = 756 000 B (IEC decimal) but `'756 KiB'` = 774 144 B, the exact
    // `756 * 1024` the driver enforces. Keep this in KiB so the two caps stay
    // byte-identical; `__tests__/size-limit-raw-contract.test.mjs` asserts it
    // against the driver's `bridges` table.
    //
    // The committed classic bridge is 738279 B RAW / 212621 B brotli-q11.
    // ASSERTED, not remembered: `__tests__/artefact-size-quotes-407.test.mjs`
    // re-derives both numbers from the bytes and refuses this comment once it
    // stops describing them. It was three re-vendors stale when #407 counted.
    limit: '756 KiB',
    brotli: false,
    disablePlugins: ['@size-limit/esbuild', '@size-limit/webpack']
  },
  {
    path: 'packages/react/dist/index.js',
    name: '@causl/react',
    limit: '8 KB',
    ignore: ['react', '@causl/causl-wasm-ts']
  },
  {
    path: 'packages/devtools-bridge/dist/index.js',
    name: '@causl/devtools-bridge (connectDevtools-only, absent-extension path)',
    import: '{ connectDevtools }',
    limit: '5 KB',
    ignore: ['@causl/causl-wasm-ts']
  },
  {
    path: 'packages/sync/dist/index.js',
    name: '@causl/sync (full import)',
    limit: '12 KB',
    ignore: ['@causl/causl-wasm-ts']
  },
  {
    path: 'packages/sync/dist/resource-entry.js',
    name: '@causl/sync/resource (resource-only)',
    limit: '8 KB',
    ignore: ['@causl/causl-wasm-ts']
  },
  {
    path: 'packages/sync/dist/conflict-entry.js',
    name: '@causl/sync/conflict (conflict-only)',
    limit: '8 KB',
    ignore: ['@causl/causl-wasm-ts']
  }
]
