#!/usr/bin/env node
// `pnpm wasm:build` driver — wasm-engine fork (issue #6).
//
// Restores the build pipeline that republishes the consolidated
// `causl-engine-bridge` wasm artefacts this fork's `@causl/causl-wasm-ts/wasm`
// loader ships. Ported from the upstream `causl/causl-core-rs`
// `tools/wasm-build/build.mjs` driver, with the fork-specific
// divergences called out inline below.
//
// The fork carries ZERO Rust — the consolidated `causl-engine-bridge`
// crate lives in the sibling `causl/causl-core-rs` checkout. This driver
// resolves that sibling (via `CAUSL_WASM_PATH` or the conventional
// `../causl-core-rs` layout), invokes `wasm-pack build` once per cargo-
// feature variant of the crate, runs an external `wasm-opt -Oz` pass,
// enforces the per-bridge bundle budgets (raw + Brotli q11), and writes
// the optimised artefact trees into `packages/core/wasm-pkg/`.
//
// ---------------------------------------------------------------------
// FORK DIVERGENCES from the upstream driver
// ---------------------------------------------------------------------
//
//   1. Crate location. The fork has no Rust of its own. The crate is
//      resolved at `<CAUSL_WASM_PATH>/tools/engine-rs-bridge`, where
//      `CAUSL_WASM_PATH` defaults to the sibling `../causl-core-rs`
//      checkout. If the sibling is absent the driver REFUSES — it names
//      the path it searched and exits non-zero (issue #305). It used to
//      log `[skip]` per target and exit 0, on the reasoning that the
//      pipeline was wired even where the engine source was not checked
//      out alongside. That reading cost more than it saved: a developer
//      whose engine clone is directory-named `causl-wasm` (the
//      pre-rename name, which Gitea still 301-redirects, so `git fetch`
//      keeps working and nothing prompts a rename) got a green build
//      over an engine that was never built, and every wasm row in the
//      suite skipped underneath it. There is no state in which "built
//      nothing" is the right answer to "build the engine"; a caller who
//      wants to know whether the pipeline is wired asks `--check`.
//
//   2. No loader rename. The fork's loader fetches the artefact by its
//      wasm-pack-emitted name `causl_engine_bridge_bg.wasm` verbatim
//      (see `CONSOLIDATED_BRIDGE_ARTEFACT_FILENAME` /  `wasmUrlFor()` in
//      `packages/core/wasm/index.ts`). The upstream driver renamed the
//      artefact to the legacy `engine_rs_bg.wasm`; the fork DROPS that
//      rename and runs `wasm-opt` in-place on
//      `<outDir>/causl_engine_bridge_bg.wasm`.
//
//   3. Out-dirs. `packages/core/wasm-pkg/gc-classic-bundler/`.
//
//   4. Matrix = bundler-only, ONE variant. The `--target nodejs`
//      variants are dead — their only consumer
//      (`test/properties/bridge-roundtrip.property.test.ts`) imports
//      retired `serde-nodejs` shim paths and always skips. The matrix
//      stays declarative (a `targets` flat-map over `TARGET_VARIANTS`)
//      so re-adding `nodejs` is a one-line change.
//
//      The second variant, `gc-builtins`, was RETIRED by
//      causl/causl-core-rs#355. causl/causl-core-rs#210 measured its
//      `wasm:js-string` imports as i32-typed where the W3C builtins are
//      externref-typed, so the artefact is refused by
//      `WebAssembly.compile(bytes, { builtins: ['js-string'] })` on every
//      host, and no rebuild of the engine sources changes that: the
//      wasm-bindgen externref transform never rewrites a hand-written
//      `#[link(wasm_import_module = "wasm:js-string")]` block. The engine
//      dropped it from its own build matrix on that finding; this driver
//      kept emitting it, which is how ~712 KB of condemned artefact came
//      to be vendored here. The historical budget notes below still name
//      it, because they record measurements that were taken.
//
//   5. Features (load-bearing) — FULL EXPORT SURFACE, size waived until
//      functional (Phase 1). The variant builds with
//      `--no-default-features --features
//      classic-strings,snapshot-extern,dispatch-payload-pool,legacy-serde`.
//      The string-strategy feature selects the wasm:js-string vs
//      UTF-16-fallback read path; the rest are the FULL_SURFACE_FEATURES
//      union (see below) so a SINGLE artefact exports every operation the
//      authoritative `WasmBackend` needs:
//        - `snapshot-extern`       → `__snapshot` / `__hydrate` (#85).
//        - `dispatch-payload-pool` → `register_dispatch_payload`,
//                                    `register_value_buf` (#125),
//                                    `read_pool_value`, `__resetValuePool`.
//        - `legacy-serde`          → `commit` + `commit_batch` (#23 / #64) —
//                                    the batched-commit extern the old
//                                    585 KB blob shipped.
//      This pulls `serde_json` + `serde-wasm-bindgen` into the wasm32
//      graph (the data section gains serde strings), which blows the old
//      600 KB / 180 KB caps. Per Phase 1 the size budget is WAIVED — the
//      gate below is WARN-ONLY against a generous 2 MB sanity cap; we
//      optimise size in a later phase.
//
// ---------------------------------------------------------------------
// NAMING THE BUILD (issue #296)
// ---------------------------------------------------------------------
//
// Every artefact this driver emits is stamped with a `causl-build-info`
// custom section naming the `causl-core-rs` commit it was compiled from
// and the sha256 of its own code section — see `stampArtefactProvenance`
// below and `provenance.mjs` for the record shape. Before that step
// existed the driver produced bytes with ZERO custom sections, so a
// consumer holding only the `.wasm` (a CPU profile, a CDN cache entry, a
// bug report) could not answer "which engine is this".
//
// The revision is a PRECONDITION, resolved before wasm-pack runs — see
// `resolveEngineRevision`. There is no mode in which this driver emits an
// artefact it cannot name: a build it could only name falsely is the
// state #296 exists to end, so it refuses instead, and names
// `CAUSL_ENGINE_REVISION` as the deliberate override.
//
// Kept from upstream: the `ensureWasmPack` / `ensureWasmOpt` PATH
// guards, the `enforceBudget` raw + Brotli q11 gate, and `--check`
// mode (verify toolchain + crate layout without running the build).
//
// The script is dependency-free — it shells out to `wasm-pack` /
// `wasm-opt` and uses Node built-ins only — so it runs cleanly in the
// root workspace without a `tools/wasm-build` install step.

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib'
import {
  cleanupSnapshot,
  ensureSnippetPresent,
  sidecarSnippetImport,
  snapshotSnippets,
  SNIPPETS_DIRNAME,
} from './snippet-guard.mjs'
import {
  buildInfoRecord,
  ENGINE_REPO,
  REVISION_PATTERN,
  stampBuildInfo,
  withoutBuildInfo,
} from './provenance.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..', '..')

// ---------------------------------------------------------------------
// Sibling engine checkout (fork divergence #1).
// ---------------------------------------------------------------------
//
// The fork has no Rust. The consolidated `causl-engine-bridge` crate
// lives in the sibling `causl/causl-core-rs` checkout. Resolve it from
// `CAUSL_WASM_PATH` (CI sets this; a developer can point it at any
// checkout) or fall back to the conventional `../causl-core-rs` sibling
// layout. The crate directory is `<CAUSL_WASM_PATH>/tools/engine-rs-bridge`.
const CAUSL_WASM_PATH = process.env.CAUSL_WASM_PATH
  ? resolve(process.env.CAUSL_WASM_PATH)
  : resolve(repoRoot, '..', 'causl-core-rs')

// The crate path inside the sibling checkout. Package `causl-engine-bridge`,
// `[lib].name = causl_engine_bridge`, so wasm-pack emits the binary as
// `causl_engine_bridge_bg.wasm` (fork divergence #2 — no rename).
const CRATE_PATH = resolve(CAUSL_WASM_PATH, 'tools', 'engine-rs-bridge')

const KB = 1024

// The artefact filename wasm-pack emits AND the loader fetches by name
// (`CONSOLIDATED_BRIDGE_ARTEFACT_FILENAME` in
// `packages/core/wasm/index.ts`). No rename step in this fork.
const ARTEFACT_FILENAME = 'causl_engine_bridge_bg.wasm'

// The wasm-bindgen sidecar JS filename (`<artefact>` with `.wasm` →
// `.js`). The snippet guard reads it to discover which `snippets/<hash>/`
// path the freshly emitted glue imports, so the post-build verify checks
// the RIGHT hash dir. The `snippets/` dir name + the compute-imports
// snippet name live in `snippet-guard.mjs` (one source of truth).
const SIDECAR_FILENAME = ARTEFACT_FILENAME.replace(/\.wasm$/, '.js')

// Phase 1 — FULL EXPORT SURFACE. size waived until functional.
//
// The fork's WasmBackend needs EVERY bridge operation callable on real
// wasm from a SINGLE artefact. The cargo features below are the union
// of every gate that adds a production extern:
//
//   - `snapshot-extern`        → `__snapshot` / `__hydrate` (#85). Also
//                                co-activates `dispatch-payload-pool`
//                                (Cargo.toml), but we list it
//                                EXPLICITLY below for clarity / so a
//                                future Cargo.toml change can't silently
//                                drop the value-pool surface.
//   - `dispatch-payload-pool`  → `register_dispatch_payload`,
//                                `register_value_buf` (#125, serde-free
//                                ingest), `read_pool_value`,
//                                `__resetValuePool` (#71 / #93).
//   - `legacy-serde`           → `commit(state, action)` +
//                                `commit_batch(state, actions)` (#23 /
//                                #64) — the batched-commit extern the
//                                old 585 KB blob shipped, gated here.
//
// Always-on (wasm32 target, no feature needed): `apply_commands`,
// `bridge_id`, `intern_string`, `read_interned_string`, `read_input`,
// `read_derived`, the `__reset*` hooks, AND the P3 derived-compute /
// subscriber bridge (`__causl_compute` / `__causl_fire` imports via
// `JsComputeBridge` / `JsSubscriberBridge` — `compute_bridge` is an
// unconditional `pub mod`, only `#[cfg(target_arch = "wasm32")]`).
//
// The string-strategy feature (`classic-strings`) used to be the only
// per-variant difference; everything else is shared via
// `FULL_SURFACE_FEATURES`. Since causl/causl-core-rs#355 retired the
// `js-string-builtins` variant there is one variant left, and
// `classic-strings` is what it builds.
const FULL_SURFACE_FEATURES = [
  'snapshot-extern',
  'dispatch-payload-pool',
  'legacy-serde',
]

// causl-client ships the FULL export surface (issue #10).
//
// The client is PRE-CUTOVER: its `WasmBackend` drives the engine through
// the marshaler / `commit_batch` path (`legacy-serde`) plus the value
// pool, so the single consolidated artefact must export every bridge
// operation the client loader can call. Unlike `causl-ts-wasm-engine`
// (which leaned its artefact serde-free once the authoritative cutover
// landed and containers shipped as CONTENT_HASH markers), the client
// cannot drop `serde_json` / `serde-wasm-bindgen` until it adopts that
// cutover. The lean path is tracked as a client follow-up; for now the
// full surface is the shipped, rebuildable, size-gated artefact that
// replaces the hand-copied split-crate `engine_rs` blob.
const surfaceFeatures = FULL_SURFACE_FEATURES

/**
 * The two artefact lines produced by the consolidated
 * `causl-engine-bridge` crate. Both pass `--no-default-features` to
 * suppress the crate's `classic-strings` default (which exists so a
 * bare `cargo check` compiles) and re-select the string strategy
 * explicitly, plus the FULL_SURFACE_FEATURES union above so a single
 * artefact exports every operation the client's WasmBackend needs.
 *
 * `rawBudgetBytes` / `brotliBudgetBytes`: ENFORCED caps (issue #10),
 * sized above the current full-surface artefact (~631 KB raw / ~185 KB
 * brotli) with headroom. `checkBudget` fails the build past them.
 *
 * lift-export (causl/causl-core-rs#170) — raised raw 700 → 706 KB to seat
 * the §18A.3 DEEP `export_model` extern (the whole-CauslModel resolver +
 * its event/originatedAt encoders) and the minimal serde-skip state growth
 * (`subscriptions_in_order` log + the `originated_at` commit column). The
 * brotli cap is UNCHANGED (the new surface compresses well under the 200 KB
 * brotli budget — ~198 KB observed); raw grew ~4 KB on the builtins bridge.
 *
 * cw#188+#190 re-vendor (2026-07) — caps UNCHANGED, measured side-by-side:
 * the pre-fire crossing (causl-wasm#190, +~0.5 KB raw on the lean engine
 * build) is fully offset by the causl-wasm#188 readAt attribution rework on
 * the full-surface build — builtins 727 511 → 726 894 B raw / 204 797 →
 * 204 705 B brotli, classic 725 143 → 724 526 B raw / 204 246 → 204 109 B
 * brotli. The §14.2.1 written-consensus bump PR #81 pre-flagged is NOT owed
 * (no cell breached), but the builtins brotli headroom is still thin
 * (95 B): the next artefact growth almost certainly owes it.
 *
 * cw#187+#197 re-vendor (2026-07) — the growth the 95 B note anticipated
 * ARRIVED. cw#197 (serve structural/meta externs from the live state during a
 * dispatch frame — causl-client#83) + cw#187 (registration-seed retention)
 * grew builtins 726 894 → 727 847 B raw / 204 705 → 205 213 B brotli (+508 B),
 * breaching the 200 KB brotli cap; classic 724 526 → 725 477 B raw / 204 109 →
 * 204 518 B brotli (still under). The §14.2.1 written-consensus bump is OWED
 * and applied on the builtins brotli cap ONLY (200 → 201 KB); see the per-cell
 * note below. Raw stays well inside 716 KB on both bridges.
 *
 * cw#198 re-vendor (2026-07) — the committed-genesis-seed retention fix
 * (causl-wasm#198: readAt/snapshotAt of a COMMITTED input BELOW its first commit
 * now returns the retained genesis seed instead of evicting — TS-reference
 * parity). A serde-skipped `registration_seed` side map; NO wire/encoding/
 * __snapshot change, the 24-byte read_at_result layout is UNCHANGED — only the
 * previously-evicted pre-first-commit region now returns the seed record. Grew
 * builtins 727 847 → 729 165 B raw / 205 213 → 205 732 B brotli (+519 B); classic
 * 725 477 → 726 811 B raw / 204 518 → 204 855 B brotli (+337 B), breaching the
 * 200 KB (204 800 B) classic cap by 55 B. This time gc-CLASSIC owes the §14.2.1
 * written-consensus bump (200 → 201 KB, 205 824 B, ~969 B headroom) — see its
 * per-cell note below; both bridges now sit at 201 KB. gc-builtins did NOT
 * re-breach (205 732 B under 205 824 B) so its cap is UNCHANGED, but cw#198
 * consumed nearly all of its former ~611 B headroom down to 92 B — the next
 * artefact growth almost certainly owes it. Raw stays well inside 716 KB on both.
 *
 * #115/#221 INPUT_EPOCH inline-kind rebuild (re-pinned by causl-client#183) —
 * carrying the container-INPUT change token inline rather than interning it
 * grew both bridges past their caps: gc-builtins 745 831 B raw / 208 633 B
 * brotli, gc-classic 743 427 B raw / 207 936 B brotli. Raw crossed the 716 KB
 * (733 184 B) cap and brotli crossed the 201 KB (205 824 B) cap on both
 * bridges. Raised raw 716 → 740 KB (757 760 B, ~1.6% headroom over the larger
 * bridge) and brotli 201 → 210 KB (215 040 B) on BOTH bridges to reseat the
 * rebuilt artefact; see the per-cell notes below.
 *
 * cw#320+#321 re-vendor (2026-07, the causl-client#129 write-SSOT cutover) —
 * `simulate_commands` (cw#320: the engine-owned dry-run — the state clone +
 * local deferred queue + vocabulary gate) and the opt-in Phase F.6 derived-row
 * retention (cw#321: the widened retention delta + the RetainDerivedRows boot
 * op) grew both bridges past the 740 KB (757 760 B) raw cap: gc-builtins
 * 762 520 B, gc-classic 760 055 B. Raised raw 740 → 756 KB (774 144 B, ~1.5%
 * headroom over the larger bridge, same sizing rule as the #115/#221 bump).
 * Brotli caps UNCHANGED — 214 108 B / 213 427 B observed, both under the
 * 210 KB (215 040 B) cap (the new code compresses well; builtins headroom is
 * now ~932 B, so the next growth likely owes the brotli bump).
 *
 * R1 eager-seed (causl/causl-wasm-ts#59) — raised raw 706 → 716 KB to seat the
 * SeedInput/Materialize cmd-buf ops + `seed_input_inplace` + the non-committing
 * `recompute_affected` apply arm (the Materialize Phase-D + its per-step diff
 * emission). Builtins observed ~711.5 KB raw, classic ~709.2 KB. Brotli cap
 * UNCHANGED (~199.7 KB observed, under the 200 KB budget — the new code
 * compresses well). This deletes the deferred `__seed` commit's adopter-surface
 * leak; the raw growth is the cost of moving the seed materialisation into the
 * shared-memory primitives.
 */
const bridges = [
  // ONE row. `gc-builtins` was retired by causl/causl-core-rs#355 on the
  // measurement causl/causl-core-rs#210 recorded: its `wasm:js-string` imports
  // are i32-typed where the W3C builtins are externref-typed, so the artefact
  // cannot bind on any host and never could. The engine removed it from its own
  // build matrix; this driver went on emitting it, and the ~712 KB result was
  // vendored here on 2026-08-04. The per-cell budget history below is written
  // for two bridges because it was measured on two.
  {
    id: 'gc-classic',
    features: ['classic-strings', ...surfaceFeatures],
    noDefaultFeatures: true,
    // Raised 740 → 756 KB for the cw#320+#321 re-vendor (causl-client#129
    // write-SSOT cutover): 760 055 B raw, past the 740 KB cap — both bridges
    // held at the same 756 KB (774 144 B) raw cap. Prior — raised 716 → 740 KB
    // for the #115/#221 INPUT_EPOCH inline-kind rebuild (re-pinned by
    // causl-client#183): the inline container-INPUT change token grew this
    // bridge to 743 427 B raw, past the 716 KB (733 184 B) cap.
    rawBudgetBytes: 756 * KB,
    // Raised 201 → 210 KB for the same #115/#221 rebuild: brotli grew
    // 204 855 → 207 936 B, past the 201 KB (205 824 B) cap. 210 KB (215 040 B)
    // reseats it. Prior history — §14.2.1 written-consensus bump 200 -> 201 KB
    // (cw#198 re-vendor, 2026-07). The committed-genesis-seed retention fix
    // (causl-wasm#198) grew the classic brotli cell 204 518 -> 204 855 B
    // (+337 B), breaching the 200 KB (204 800 B) cap by 55 B. 201 KB
    // (205 824 B) reseated it with ~969 B headroom; gc-builtins owed its own
    // bump one re-vendor earlier (cw#187+#197), so both bridges sat at 201 KB.
    brotliBudgetBytes: 210 * KB,
  },
]

/**
 * wasm-pack targets emitted per bridge.
 *
 * Fork divergence #4: bundler-only today. The `--target nodejs`
 * variants are dead — their only consumer
 * (`test/properties/bridge-roundtrip.property.test.ts`) imports the
 * retired `serde-nodejs` shim and always skips. Keep this list as the
 * single declarative lever so re-adding `'nodejs'` is a one-line
 * change that flows through the `targets` derivation below.
 */
const TARGET_VARIANTS = ['bundler']

const targets = bridges.flatMap((b) =>
  TARGET_VARIANTS.map((target) => ({
    id: `${b.id}-${target}`,
    bridgeId: b.id,
    target,
    outDir: `packages/core/wasm-pkg/${b.id}-${target}`,
    features: b.features,
    noDefaultFeatures: b.noDefaultFeatures,
    rawBudgetBytes: b.rawBudgetBytes,
    brotliBudgetBytes: b.brotliBudgetBytes,
  })),
)

// wasm-opt feature-flag set. The consolidated bridge emits:
//   - `i64.trunc_sat_f64_s`         → --enable-nontrapping-float-to-int
//   - `memory.copy` / `memory.fill` → --enable-bulk-memory
//   - wasm-bindgen externref table  → --enable-mutable-globals + --enable-reference-types
//   - WasmGC opcodes                → --enable-gc
// `--strip-producers` removes the `producers` custom section and
// `--strip-debug` drops DWARF / name-section payload wasm-pack leaves
// in even at `--release`. `-Oz` is the binaryen size pass that gets the
// artefact under the per-bridge caps.
const WASM_OPT_ARGS = [
  '-Oz',
  '--enable-reference-types',
  '--enable-gc',
  '--enable-nontrapping-float-to-int',
  '--enable-bulk-memory',
  '--enable-mutable-globals',
  '--strip-producers',
  '--strip-debug',
]

const checkOnly = process.argv.includes('--check')

function fail(msg, code = 1) {
  process.stderr.write(`[wasm:build] ${msg}\n`)
  process.exit(code)
}

function info(msg) {
  process.stdout.write(`[wasm:build] ${msg}\n`)
}

// Issue #305 — the engine crate is a PRECONDITION, not a nice-to-have.
//
// This runs before the toolchain probes on purpose. On a machine with
// neither the sibling checkout nor wasm-pack, "install wasm-pack" is the
// wrong headline: installing it changes nothing while the crate is
// unresolvable. The path we searched is the diagnostic, so it leads.
//
// The failure this guards is quiet by construction. The engine repository
// was renamed `causl-wasm` -> `causl-core-rs`, and Gitea 301-redirects the
// old remote, so an existing clone in a directory still named `causl-wasm`
// keeps fetching normally and never announces itself as stale. The
// DIRECTORY name is what this resolver reads — see the `CAUSL_WASM_PATH`
// fallback above and `docs/repo-naming-decision.md:60-63`.
function ensureEngineCrate() {
  if (existsSync(CRATE_PATH)) {
    info(`crate: ${CRATE_PATH}`)
    return
  }
  const via = process.env.CAUSL_WASM_PATH
    ? `CAUSL_WASM_PATH=${process.env.CAUSL_WASM_PATH}`
    : 'the default sibling layout (no CAUSL_WASM_PATH set)'
  fail(
    [
      `the consolidated bridge crate is not at ${CRATE_PATH}.`,
      '',
      `  Resolved from:   ${via}`,
      `  Engine root:     ${CAUSL_WASM_PATH}`,
      '',
      'This repository carries no Rust — the `causl-engine-bridge` crate lives in',
      'the sibling causl/causl-core-rs checkout. Either:',
      '',
      '  clone it beside this repo, in a DIRECTORY NAMED `causl-core-rs`:',
      '      git clone https://git.opsite.ca/causl/causl-core-rs.git',
      '',
      '  or point the driver at an existing checkout:',
      '      CAUSL_WASM_PATH=/path/to/causl-core-rs pnpm wasm:build',
      '',
      'If you already have that checkout under its PRE-RENAME directory name',
      '`causl-wasm`, this is exactly the miss you are seeing: the remote still',
      'redirects, so nothing else complains. Rename the directory or set',
      'CAUSL_WASM_PATH.',
      '',
      'Building nothing is not success. Without the engine every `rust-ssot`',
      'path throws WasmEngineUnavailableError and the wasm rows of the suite',
      'skip — which reads identically to "no change".',
    ].join('\n'),
  )
}

// ---------------------------------------------------------------------
// The engine revision (issue #296) — a precondition, like the crate.
// ---------------------------------------------------------------------

/** The env var that names the revision when the checkout cannot. */
const ENGINE_REVISION_ENV = 'CAUSL_ENGINE_REVISION'

const REVISION_REMEDY = [
  '',
  '  Name the revision deliberately:',
  '',
  `      ${ENGINE_REVISION_ENV}=<40-char lowercase hex> pnpm wasm:build`,
  '',
  '  An artefact nobody can attribute to a `' + ENGINE_REPO + '` commit is',
  '  what a CPU profile, a CDN cache entry and a bug report are all left',
  '  holding. Emitting one is not success (issue #296).',
].join('\n')

function gitIn(dir, args) {
  return spawnSync('git', ['-C', dir, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  })
}

/** `realpathSync`, or the input when it cannot be resolved. Comparing two
 * paths that name the same directory through different symlinks is the
 * same failure the CLI-entry guard at the foot of this file was fixed for
 * (#305): `/tmp` -> `/private/tmp` on macOS, a checkout reached through a
 * symlinked parent. */
function realpathOrSelf(path) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/**
 * The `causl-core-rs` commit the bytes about to be compiled come from,
 * as `{ revision, via }`, or `{ fault }` naming why it cannot be had.
 *
 * Two sources, in order:
 *
 *   1. `CAUSL_ENGINE_REVISION`, for a build whose engine source did not
 *      arrive as a git checkout (a vendored tarball, a release runner
 *      that exported the tree). Validated, never trusted blindly.
 *   2. `git rev-parse HEAD` in the sibling engine checkout — the normal
 *      path, and the only one in this repository that yields a REAL
 *      revision rather than a value someone typed. Both `wasm.yml` and
 *      `differential-pr.yml` reach it via `actions/checkout`, so CI is
 *      always on this branch and always clean.
 *
 * A DIRTY checkout is refused. `HEAD` does not describe a build compiled
 * from a modified working tree, and a record naming it would be false —
 * `provenance.mjs` refuses everything it was not told for exactly this
 * reason, and a driver that fed it a plausible-looking lie would defeat
 * that from one layer up. Untracked files are not counted: they are not
 * compiled into a tracked crate unless a tracked file references them,
 * which shows up as a modification anyway, and `target/` noise would
 * make the check unusable.
 */
function resolveEngineRevision() {
  const override = process.env[ENGINE_REVISION_ENV]
  if (override !== undefined && override !== '') {
    if (!REVISION_PATTERN.test(override)) {
      return {
        fault: [
          `${ENGINE_REVISION_ENV} is not a 40-character lowercase hex commit:`,
          `  ${JSON.stringify(override)}`,
          '',
          'A tag or a short sha cannot be resolved by a consumer holding only',
          'the bytes, so the stamp would name something unfindable.',
        ].join('\n'),
      }
    }
    return { revision: override, via: ENGINE_REVISION_ENV }
  }

  // `--show-toplevel` FIRST, and not merely as an "is this a checkout"
  // probe. `git` walks UP from `-C`, so an engine root that is not itself
  // a clone but sits inside one answers with the ENCLOSING repository's
  // HEAD — and `wasm.yml` checks the engine out at
  // `${{ github.workspace }}/causl-wasm`, i.e. inside this repository's
  // own working tree. Without this the stamp would happily name a
  // `causl-wasm-ts` commit as the `causl-core-rs` revision that produced
  // the engine: a record that looks exactly as trustworthy as a true one.
  const top = gitIn(CAUSL_WASM_PATH, ['rev-parse', '--show-toplevel'])
  if (top.error || top.status !== 0) {
    const why = (top.stderr ?? top.error?.message ?? '').trim().split('\n')[0]
    return {
      fault: [
        `cannot name the build: no \`${ENGINE_REPO}\` revision.`,
        '',
        `  Engine root:  ${CAUSL_WASM_PATH}`,
        `  git said: ${why || `exit ${top.status}`}`,
        '',
        '  The engine source did not arrive as a git checkout, so there is no',
        '  commit to attribute the bytes to.',
        REVISION_REMEDY,
      ].join('\n'),
    }
  }
  const toplevel = realpathOrSelf((top.stdout ?? '').trim())
  if (toplevel !== realpathOrSelf(CAUSL_WASM_PATH)) {
    return {
      fault: [
        'cannot name the build: the engine root is not the root of a git',
        'checkout — git resolved an ENCLOSING repository instead, whose HEAD',
        `is not a \`${ENGINE_REPO}\` commit.`,
        '',
        `  Engine root:  ${CAUSL_WASM_PATH}`,
        `  git toplevel: ${toplevel}`,
        REVISION_REMEDY,
      ].join('\n'),
    }
  }

  const head = gitIn(CAUSL_WASM_PATH, ['rev-parse', 'HEAD'])
  if (head.error || head.status !== 0) {
    const why = (head.stderr ?? head.error?.message ?? '').trim().split('\n')[0]
    return {
      fault: [
        `cannot name the build: no \`${ENGINE_REPO}\` revision.`,
        '',
        `  Engine root:  ${CAUSL_WASM_PATH}`,
        `  git rev-parse HEAD said: ${why || `exit ${head.status}`}`,
        REVISION_REMEDY,
      ].join('\n'),
    }
  }
  const revision = (head.stdout ?? '').trim()
  if (!REVISION_PATTERN.test(revision)) {
    return {
      fault: [
        `cannot name the build: \`git rev-parse HEAD\` in ${CAUSL_WASM_PATH}`,
        `answered ${JSON.stringify(revision)}, which is not a 40-hex commit.`,
        REVISION_REMEDY,
      ].join('\n'),
    }
  }

  // `--untracked-files=no`: see the doc comment above.
  const status = gitIn(CAUSL_WASM_PATH, ['status', '--porcelain', '--untracked-files=no'])
  if (status.error || status.status !== 0) {
    const why = (status.stderr ?? status.error?.message ?? '').trim().split('\n')[0]
    return {
      fault: [
        'cannot name the build: the engine checkout could not be checked for',
        'uncommitted changes, so there is no way to know whether HEAD',
        'describes what is about to be compiled.',
        '',
        `  Engine root:  ${CAUSL_WASM_PATH}`,
        `  git status said: ${why || `exit ${status.status}`}`,
        REVISION_REMEDY,
      ].join('\n'),
    }
  }
  const changed = (status.stdout ?? '').trim()
  if (changed !== '') {
    const lines = changed.split('\n')
    const shown = lines.slice(0, 5).map((l) => `    ${l.trim()}`)
    if (lines.length > 5) shown.push(`    … and ${lines.length - 5} more`)
    return {
      fault: [
        'cannot name the build: the engine checkout has uncommitted changes.',
        '',
        `  Engine root:  ${CAUSL_WASM_PATH}`,
        `  HEAD:         ${revision}`,
        '  Modified:',
        ...shown,
        '',
        '  wasm-pack compiles the WORKING TREE, so a record naming HEAD would',
        '  be false. Commit or stash in the engine checkout first.',
        REVISION_REMEDY,
      ].join('\n'),
    }
  }

  return { revision, via: `git -C ${CAUSL_WASM_PATH} rev-parse HEAD` }
}

/**
 * Write the `causl-build-info` record into the artefact's own bytes
 * (issue #296). Returns false — with a `[fail]` line naming the bridge —
 * when the artefact cannot be named, so the caller fails the target
 * rather than shipping bytes that answer to nothing.
 *
 * `engine.package` is deliberately NOT recorded. This driver compiles
 * from SOURCE in the sibling checkout; `packages/core/package.json`
 * `causl.engine` names the `@causl/core-rs` release the PUBLISH job
 * vendors, which is a different artefact that may or may not be this
 * commit. `provenance.mjs` records that field "only when it is known",
 * and here it is not.
 *
 * Runs immediately after wasm-opt — the last step that moves these bytes
 * — so everything downstream (the snippet guard, the ignore-file drop
 * and, load-bearingly, `checkBudget`) sees the artefact as it will ship.
 * A budget measured before the stamp would be measuring a file nobody
 * gets.
 */
function stampArtefactProvenance(t, wasmAbsPath, revision) {
  // Measure the artefact AS BUILT. wasm-pack overwrites the `.wasm` so a
  // stale stamp should never survive a real build, but `withoutBuildInfo`
  // is what makes `artefact.bytes` describe the build rather than the
  // previous record — see its doc comment in `provenance.mjs`.
  const asBuilt = withoutBuildInfo(readFileSync(wasmAbsPath))
  let record
  let stamped
  try {
    record = buildInfoRecord({ bytes: asBuilt, file: ARTEFACT_FILENAME, revision })
    stamped = stampBuildInfo(asBuilt, record)
  } catch (err) {
    info(
      `[fail] ${t.id}: cannot name this build — ${err instanceof Error ? err.message : String(err)}`,
    )
    return false
  }

  // The stamp buys provenance; it must not cost the loader the module.
  // Checked against the as-built bytes so a module that was already
  // invalid is not blamed on the section appended to it.
  if (WebAssembly.validate(asBuilt) && !WebAssembly.validate(stamped)) {
    info(
      `[fail] ${t.id}: stamping the provenance record produced a module ` +
        'WebAssembly rejects. The artefact is left exactly as wasm-opt ' +
        'emitted it rather than replaced with one that cannot compile.',
    )
    return false
  }

  writeFileSync(wasmAbsPath, stamped)
  info(
    `[provenance] ${t.id}: ${ENGINE_REPO}@${revision} — code-section sha256 ` +
      `${record.artefact.codeSectionSha256}`,
  )
  return true
}

function ensureWasmPack() {
  const probe = spawnSync('wasm-pack', ['--version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  })
  if (probe.error || probe.status !== 0) {
    fail(
      [
        'wasm-pack is not installed (or not on PATH).',
        '',
        '  Install with:    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh',
        '  or via cargo:    cargo install wasm-pack',
        '  or via brew:     brew install wasm-pack',
        '',
        'Then re-run `pnpm wasm:build`.',
      ].join('\n'),
    )
  }
  info(`wasm-pack: ${probe.stdout.trim()}`)
}

function ensureWasmOpt() {
  const probe = spawnSync('wasm-opt', ['--version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  })
  if (probe.error || probe.status !== 0) {
    fail(
      [
        'wasm-opt (binaryen) is not installed (or not on PATH).',
        '',
        '  Install with:    brew install binaryen',
        '  or via apt:      apt-get install binaryen',
        '  or upstream:     https://github.com/WebAssembly/binaryen/releases',
        '',
        'The bundle-size enforcement gate drives wasm-opt directly from this',
        "script with `--enable-reference-types --enable-gc",
        "--enable-nontrapping-float-to-int` (wasm-pack 0.14.0's bundled wasm-opt",
        'rejects those flags). Binaryen >= 119 is required for full WasmGC',
        'opcode support.',
      ].join('\n'),
    )
  }
  info(`wasm-opt: ${probe.stdout.trim().split('\n')[0]}`)
}

function runWasmOpt(wasmAbsPath) {
  const tmpPath = `${wasmAbsPath}.opt.tmp`
  const args = [...WASM_OPT_ARGS, wasmAbsPath, '-o', tmpPath]
  info(`[wasm-opt] ${args.join(' ')}`)
  const proc = spawnSync('wasm-opt', args, { stdio: 'inherit' })
  if (proc.status !== 0) {
    return false
  }
  // A zero exit is wasm-opt's opinion, not evidence. If it reported success
  // without writing `-o`, the `renameSync` below throws an uncaught ENOENT
  // that escapes `main()` — so the driver dies on a `node:fs` stack trace
  // naming a `.opt.tmp` path nobody asked for, instead of the named refusal
  // every other failure here produces, and `[fail] <bridge>: wasm-opt failed`
  // never prints. That is the same shape as the exit-0-over-nothing family
  // this driver was hardened against in #305, one tool further down; found
  // while adding the first test to drive the build path end to end
  // (`__tests__/build-refuses-unbuildable.test.mjs`, issue #301).
  if (!existsSync(tmpPath)) {
    info(
      `[wasm-opt] exited 0 without writing ${tmpPath}. The artefact is left ` +
        'exactly as wasm-pack emitted it rather than half-replaced.',
    )
    return false
  }
  // Atomic rename — overwrite the wasm-pack output with the optimised
  // version IN PLACE. The fork loader + the wasm-bindgen-generated
  // `_bg.js` glue both reference the artefact by its wasm-pack-emitted
  // name (`causl_engine_bridge_bg.wasm`), so swapping in place keeps
  // the package contract intact (fork divergence #2 — no rename).
  renameSync(tmpPath, wasmAbsPath)
  return true
}

function fmtBytes(n) {
  return `${(n / KB).toFixed(1)} KB (${n} B)`
}

// Size budget gate (issue #10).
//
// causl-client ships the FULL-surface consolidated artefact, and this
// gate ENFORCES the per-bridge caps — replacing the manual hand-copy of
// the stale split-crate `engine_rs` blob with a rebuildable, size-gated
// artefact. The caps sit above the current full-surface size (~631 KB raw
// / ~185 KB brotli) with headroom; a build that blows them (e.g. a serde
// dependency bump, or a new always-on extern) FAILS with a clear
// diagnostic. When the client adopts the authoritative cutover it can
// lean the artefact serde-free and ratchet these caps down.
function checkBudget(t, wasmAbsPath) {
  if (!existsSync(wasmAbsPath)) {
    info(`[size] ${t.id}: artefact not produced (${wasmAbsPath}) — cannot measure`)
    // A genuinely missing artefact is a real build failure; surface it.
    // (wasm-opt success is checked separately in `buildOne`.)
    return false
  }
  const raw = readFileSync(wasmAbsPath)
  const rawBytes = raw.length
  // Brotli q11 matches the Cloudflare/Fastly edge default and is the
  // ceiling adopters actually pay for on the wire. zlib's
  // BROTLI_PARAM_QUALITY is 0-11; 11 is max compression.
  const brotli = brotliCompressSync(raw, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  })
  const brotliBytes = brotli.length

  const rawOk = rawBytes <= t.rawBudgetBytes
  const brotliOk = brotliBytes <= t.brotliBudgetBytes
  info(
    `[size] ${t.id}: raw=${fmtBytes(rawBytes)} / cap ${fmtBytes(t.rawBudgetBytes)} — ` +
      `brotli-q11=${fmtBytes(brotliBytes)} / cap ${fmtBytes(t.brotliBudgetBytes)} — ENFORCED`,
  )
  if (rawOk && brotliOk) return true

  const over = []
  if (!rawOk) over.push(`raw ${rawBytes} B > ${t.rawBudgetBytes} B`)
  if (!brotliOk) over.push(`brotli ${brotliBytes} B > ${t.brotliBudgetBytes} B`)
  info(
    `[fail] ${t.id}: over the consolidated-bridge budget — ${over.join('; ')}. ` +
      `If the growth is intentional, raise the cap in this file's ` +
      `\`bridges\` table; otherwise investigate what enlarged the wasm32 graph.`,
  )
  return false
}

// Issue #305 — a bridge out-dir the loader cannot boot.
//
// What the loader needs is a TRIPLE, and this repo has shipped one part
// of it:
//
//   - `causl_engine_bridge_bg.wasm`  — committed.
//   - `causl_engine_bridge_bg.js`    — the wasm-bindgen glue. Never
//     committed, and in no ref's history. `git ls-files
//     packages/core/wasm-pkg` returns a README, two `.npmignore`s and the
//     two binaries; that is the whole tree a fresh clone receives.
//   - `snippets/<hash>/causl-compute-imports.js` — the ESM module the
//     glue imports for the `__causl_compute` / `__causl_fire` bridge.
//     Also never committed. Missing it, the glue does not even link:
//     `Cannot find module './snippets/…/causl-compute-imports.js'`.
//
// Any proper subset is worth nothing — `@causl/causl-wasm-ts/wasm` throws
// where the build reported success. The hash dir rotates with
// wasm-bindgen, so the third member is read out of the glue's own import
// statement (`sidecarSnippetImport`) rather than guessed.
//
// This is deliberately a TAIL check, not a preflight. A partial tree is
// precisely what a real build REPAIRS — wasm-pack re-emits all three —
// so refusing before the build would block the remedy. Run afterwards it
// says the true thing: whatever just happened, the tree on disk is (or is
// not) something the loader can boot. In `--check` mode, where nothing is
// emitted, it reports on the tree exactly as committed.
//
// A bridge with NEITHER binary nor glue is not flagged. That is the state
// of a tree about to be built into existence, and it claims nothing. The
// lie is the fragment that looks like an engine.
function bridgeLoadFault(t) {
  const outDirAbs = resolve(repoRoot, t.outDir)
  const hasBinary = existsSync(join(outDirAbs, ARTEFACT_FILENAME))
  const gluePath = join(outDirAbs, SIDECAR_FILENAME)
  const hasGlue = existsSync(gluePath)

  if (!hasBinary && !hasGlue) return null
  if (!hasGlue) {
    return (
      `${t.id}: not loadable — ${t.outDir}/${ARTEFACT_FILENAME} is present but ` +
      `${SIDECAR_FILENAME} beside it is not. The loader imports the glue and ` +
      'the glue instantiates the binary; the binary alone cannot boot.'
    )
  }
  if (!hasBinary) {
    return (
      `${t.id}: not loadable — ${t.outDir}/${SIDECAR_FILENAME} is present but ` +
      `${ARTEFACT_FILENAME} beside it is not. The glue has nothing to instantiate.`
    )
  }

  // Both halves present. The glue still has to be able to LINK.
  const importRel = sidecarSnippetImport(gluePath)
  if (importRel === undefined) return null
  if (existsSync(join(outDirAbs, importRel))) return null
  return (
    `${t.id}: not loadable — ${t.outDir}/${SIDECAR_FILENAME} imports ` +
    `${importRel}, which is not on disk. ESM linking fails before the engine ` +
    'is ever instantiated.'
  )
}

function buildOne(t, engineRevision) {
  const outDirAbs = resolve(repoRoot, t.outDir)
  mkdirSync(dirname(outDirAbs), { recursive: true })

  const args = [
    'build',
    CRATE_PATH,
    '--release',
    '--target',
    t.target,
    '--out-dir',
    outDirAbs,
  ]
  // `--no-default-features` and `--features ...` flow through to the
  // underlying `cargo build`. Lean features only (fork divergence #5).
  if (t.noDefaultFeatures) {
    args.push('--no-default-features')
  }
  if (t.features.length > 0) {
    args.push('--features', t.features.join(','))
  }

  // Return BEFORE touching the out-dir (#305). `--check` is documented as
  // "verify toolchain + crate layout without running the build", and it
  // used to sit below the snapshot-and-clean below — so `pnpm
  // wasm:build:check` deleted `snippets/` from every out-dir, exited 0,
  // and left an engine that had been working unable to boot. It also
  // leaked the snapshot temp dir, since `cleanupSnapshot` is only reached
  // on the build path. A mode that only inspects must only inspect.
  if (checkOnly) {
    info(`[check] ${t.id}: would run \`wasm-pack ${args.join(' ')}\``)
    return { id: t.id, ok: true }
  }

  // Clean the wasm-bindgen JS SNIPPETS tree before building. wasm-pack
  // / wasm-bindgen does NOT reliably re-copy the `snippets/<hash>/`
  // JS-snippet files (the `causl-compute-imports.js` that backs the
  // `__causl_compute` / `__causl_fire` imports) when the out-dir is
  // PRE-POPULATED — e.g. the committed artefact tree this fork ships. A
  // partial cleanup then leaves an EMPTY `snippets/<hash>/` dir, so the
  // emitted `_bg.js` imports a snippet file that no longer exists and
  // the loader's sidecar dynamic-import throws `ERR_MODULE_NOT_FOUND`.
  // Removing the stale tree forces a fresh, complete snippet emission on
  // every rebuild. (The `.wasm` / `_bg.js` are overwritten by wasm-pack
  // directly, so only `snippets/` needs the explicit clean.)
  //
  // ROBUSTNESS GUARD (wasm load robustness): the clean above used to be
  // an UNCONDITIONAL `rmSync(snippets)` that trusted wasm-pack to
  // re-emit `causl-compute-imports.js`. That left the COMMITTED tree
  // broken whenever re-emission did not land the snippet the `_bg.js`
  // imports — a different wasm-bindgen hash, an out-of-tree crate name
  // change, or a partial/failed build all orphan the import and the
  // authoritative loader then throws `could not resolve
  // causl-compute-imports.js under …/snippets/`. We therefore SNAPSHOT
  // the committed snippets to a temp dir before cleaning, and after a
  // successful build VERIFY the snippet the freshly emitted `_bg.js`
  // imports is present — RESTORING it from the snapshot if wasm-pack did
  // not re-emit it. The committed tree is never left missing the snippet
  // the loader resolves.
  const snippetsDir = join(outDirAbs, SNIPPETS_DIRNAME)
  const snippetSnapshot = snapshotSnippets(snippetsDir)
  if (existsSync(snippetsDir)) {
    rmSync(snippetsDir, { recursive: true, force: true })
  }

  info(`[build] ${t.id}: wasm-pack ${args.join(' ')}`)
  const proc = spawnSync('wasm-pack', args, {
    stdio: 'inherit',
    cwd: repoRoot,
  })
  if (proc.status !== 0) {
    return { id: t.id, ok: false }
  }

  // wasm-pack's bundled wasm-opt is disabled via
  // `[package.metadata.wasm-pack.profile.release.wasm-opt = false]` in
  // the crate's Cargo.toml; drive the external binaryen instead. The
  // fork runs wasm-opt IN PLACE on the wasm-pack-emitted artefact —
  // no rename (fork divergence #2).
  const wasmPath = resolve(outDirAbs, ARTEFACT_FILENAME)
  if (!existsSync(wasmPath)) {
    info(`[fail] ${t.id}: wasm-pack succeeded but ${wasmPath} is missing`)
    return { id: t.id, ok: false }
  }
  if (!runWasmOpt(wasmPath)) {
    info(`[fail] ${t.id}: wasm-opt failed`)
    return { id: t.id, ok: false }
  }

  // Issue #296 — name the build in the bytes, immediately after the last
  // step that moves them and BEFORE `checkBudget`, so the size gate
  // measures the artefact as it ships.
  if (!stampArtefactProvenance(t, wasmPath, engineRevision)) {
    return { id: t.id, ok: false }
  }

  // ROBUSTNESS GUARD (wasm load robustness) — make sure the snippet the
  // freshly emitted `_bg.js` imports actually exists on disk, restoring
  // it from the pre-clean snapshot if wasm-pack did not re-emit it. This
  // is what keeps a rebuild from leaving the committed tree broken (the
  // authoritative loader's `could not resolve causl-compute-imports.js`
  // throw).
  const sidecarPath = resolve(outDirAbs, SIDECAR_FILENAME)
  const guard = ensureSnippetPresent(outDirAbs, sidecarPath, snippetSnapshot, (msg) =>
    info(`[snippet] ${t.id}: ${msg}`),
  )
  cleanupSnapshot(snippetSnapshot)
  if (!guard.ok) {
    info(
      `[fail] ${t.id}: emitted ${SIDECAR_FILENAME} imports ${guard.importRel} ` +
        'but that snippet was neither re-emitted by wasm-pack nor recoverable ' +
        'from the committed tree. The authoritative loader would throw ' +
        '`could not resolve causl-compute-imports.js`.',
    )
    return { id: t.id, ok: false }
  }

  dropWasmPackIgnoreFile(outDirAbs, t.id)

  // Check the per-artefact size AFTER wasm-opt so the bytes on disk are
  // the bytes the client ships. The gate ENFORCES the cap (an over-budget
  // artefact fails the build — issue #10's size gate); a genuinely missing
  // artefact always fails.
  const artefactPresent = checkBudget(t, wasmPath)
  return { id: t.id, ok: artefactPresent }
}

/**
 * Delete the `.gitignore` wasm-pack writes into the out-dir (#301).
 *
 * wasm-pack emits a `.gitignore` holding a single `*` beside its output, on
 * the assumption that the output is disposable. In this repo it is not: the
 * whole bridge tree is committed, because a clone that cannot boot the engine
 * fails 235 of the 1495 `packages/core` tests and the sibling Rust checkout
 * needed to rebuild it is not something every contributor or CI job has.
 *
 * Left in place that rule is quietly destructive. It cannot hide the files
 * already tracked — git applies ignore rules only to untracked paths — but it
 * hides every NEW one, and wasm-bindgen names the snippets directory with a
 * content hash that rotates whenever the bridge changes. So the next re-vendor
 * emits `snippets/<newhash>/causl-compute-imports.js` as a new path, `git
 * status` never mentions it, and the tracked `_bg.js` — whose change DOES show,
 * and gets committed — starts importing a snippet no clone will have. That is
 * PR #313's failure mode 4, made permanent. It is also self-concealing: the
 * `*` matches `.gitignore` itself, so nothing in `git status` ever points at
 * the rule doing it.
 *
 * The rule is simply wrong here. There is nothing under the out-dir that this
 * repo does not want tracked, so the fix is to remove it rather than to negate
 * it — a committed negation would be rewritten by the next wasm-pack run, and
 * whoever reviewed that diff would be looking at a file wasm-pack owns.
 * `__tests__/fresh-clone-is-loadable.test.mjs` asserts none was ever committed.
 */
function dropWasmPackIgnoreFile(outDirAbs, id) {
  const ignorePath = join(outDirAbs, '.gitignore')
  if (!existsSync(ignorePath)) return
  rmSync(ignorePath, { force: true })
  info(
    `[tree] ${id}: removed the .gitignore wasm-pack emitted — the bridge ` +
      'tree is committed, so an ignore-everything rule there would hide the ' +
      'next rotated snippets/<hash>/ from the commit that needs it.',
  )
}

function main() {
  // Precondition first (#305): without the crate there is nothing to
  // build, and a toolchain diagnostic would only bury that.
  ensureEngineCrate()

  // Second precondition (#296): a build that cannot name what it produced
  // is refused before wasm-pack burns three minutes on it. Both this and
  // `ensureEngineCrate` are questions about the engine checkout, so they
  // sit together and ahead of the toolchain probes for the same reason —
  // "install wasm-pack" is the wrong headline while the engine is
  // unresolvable.
  const resolved = resolveEngineRevision()
  if (checkOnly) {
    // `--check` reports; it does not refuse and it does not write. A
    // driver that cannot name its output is worth saying out loud here,
    // because `--check` is exactly where you ask whether the pipeline is
    // wired.
    if (resolved.fault !== undefined) {
      info(`[check] a real build would refuse: ${resolved.fault.split('\n')[0]}`)
    } else {
      info(`[check] engine revision: ${resolved.revision} (via ${resolved.via})`)
    }
  } else if (resolved.fault !== undefined) {
    fail(resolved.fault)
  } else {
    info(`engine revision: ${resolved.revision} (via ${resolved.via})`)
  }

  ensureWasmPack()
  if (!checkOnly) {
    ensureWasmOpt()
  }

  const results = targets.map((t) => buildOne(t, resolved.revision))
  const failed = results.filter((r) => !r.ok)
  const built = results.filter((r) => r.ok)

  info('---')
  info(`built:   ${built.map((r) => r.id).join(', ') || '(none)'}`)
  if (failed.length > 0) {
    info(`failed:  ${failed.map((r) => r.id).join(', ')}`)
    process.exit(1)
  }

  // #305 — the last thing this script says is whether the tree it leaves
  // behind is one the loader can boot. Every target reported success
  // above; that is a statement about wasm-pack's exit codes, not about
  // what is on disk.
  const faults = targets.map(bridgeLoadFault).filter((f) => f !== null)
  if (faults.length > 0) {
    for (const f of faults) info(`[fail] ${f}`)
    const remedy = checkOnly
      ? 'Nothing was emitted — `--check` only reports. Run `pnpm wasm:build` against\n' +
        'the sibling causl-core-rs checkout to produce the missing file(s).'
      : 'wasm-pack reported success but did not leave both halves of the pair on\n' +
        'disk. Clear the out-dir and rebuild.'
    fail(`the bridge artefact tree cannot be loaded.\n\n${remedy}`)
  }

  process.exit(0)
}

// Run the build only when invoked as the CLI entry (`node
// tools/wasm-build/build.mjs [--check]`). Importing this module (e.g. the
// `.size-limit.cjs` raw-cap contract test in `__tests__/`) reads the
// exported `bridges` budget table WITHOUT triggering a build or the
// `process.exit` at the tail of `main()`.
//
// Compare REAL paths (#305). This guard used to test `import.meta.url`
// against `pathToFileURL(process.argv[1])`. Node resolves `import.meta.url`
// through symlinks and leaves `process.argv[1]` as typed, so any symlinked
// segment on the invocation path — `/tmp` -> `/private/tmp` on macOS, a
// checkout reached through a symlinked parent — made the two strings differ
// for the same file. `main()` then never ran and the process exited 0
// having printed nothing at all: a third way to report success without
// building, and the one that leaves no evidence behind.
function isCliEntry() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(__filename)
  } catch {
    return false
  }
}

if (isCliEntry()) {
  main()
}

// Exported so the size-limit raw-cell contract test can assert the
// `.size-limit.cjs` wasm caps match THIS driver's enforced `rawBudgetBytes`
// byte-for-byte (issue #161) — one source of truth for the raw ceiling, so
// the redundant CI gate can never silently drift from the build driver.
export { bridges, targets }
