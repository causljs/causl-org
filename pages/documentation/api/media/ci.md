# CI

## Reading taken 2026-08-09 (causl/causl-wasm-ts#468)

```
causl/causl-wasm-ts   has_actions: True   default_branch: main
causl/causl-core-rs   has_actions: True   default_branch: main
```

`causl-wasm-ts` returned 1143 task rows on that reading: 848 on the
pull-request lane, 260 on push, 26 hand-triggered and 9 scheduled. Every push
to `main` publishes five statuses. The local gates in `CONTRIBUTING.md` and the
`.husky/` hooks are unchanged and are still the first line, because a red
caught before a push costs a minute and a red caught on a lane costs a round
trip.

That is a reading, not a standing fact, and this page states it as one on
purpose. Whether a lane fires is a forge setting plus that lane's own run
history, neither of which a file in this tree can consult, so a sentence here
asserting it is correct only until somebody flips a switch.

### What this page said before, and why the old reading is dated rather than deleted

It opened with **NOTHING RUNS**, from causl/causl-wasm-ts#409. Two separate
things were true then, and they stopped being true on different days:

1. **The workflows were in a directory Gitea does not read.** Gitea reads
   `.gitea/workflows/` exclusively once it exists and ignores the legacy forge
   root entirely. `causl/causl-core-rs` found this in its #345 and fixed it in
   #346. #409 moved all nine of this repository's workflows the same way, so
   they are now where the forge looks. The legacy root has since been removed
   from this repository outright, and `tools/audit/check-workflow-paths.ts`
   fails if it reappears: an existence check rather than a scan, because a scan
   of an absent directory returns an empty list and reads as clean (#461).
2. **The Actions unit was switched off on these two repositories.** It was off
   on `causl/causl-wasm-ts` and on `causl/causl-core-rs` from 2026-08-04
   through 2026-08-07, and the task history carries zero rows across those four
   days. The outage was repo-scoped rather than a runner or a forge failure:
   the rest of the instance ran green throughout. Rows resume on 2026-08-08.

#468 is the lesson drawn from the gap between those two dates. The #409 reading
was copied into seven lines across six source files and into seven workflow
headers, and nothing in the tree could notice when it died, so this repository
ended up with a green gate requiring its workflows to describe themselves as
inert while they ran. Hence the rule the pages and headers now follow: say what
a lane IS, and keep a forge reading as history, dated.

### Historical note

Per PR #725, every workflow was moved out of the live root on 2025-09 when
hosted Actions runners became unavailable for the org due to a billing issue
(every PR was failing with `runner_name: ""` and 0-step failures within 11
seconds: masking real test results). Those thirteen files are still parked and
are checked in as a design record. They now live in `ci/parked/`, which is
neither workflow root, so nothing can pick them up by accident. See
[`ci/parked/README.md`](../ci/parked/README.md).

The wasm-substrate epic (#680) shipped after PR #725 with three of its
own workflows added directly under the legacy forge root. Those were
described as the "only active CI lanes"; on Gitea they were not active
either, for the directory reason above.

Workflows (root of `.gitea/workflows/`):

| File | What it does | Trigger |
| --- | --- | --- |
| `wasm.yml` | `cargo check --workspace`, `wasm-pack build` matrix over 6 (bridge × target) cells, plus a `bundler-interop` matrix over 3 fixture apps | PR + push to main + workflow_dispatch |
| `cross-backend-fuzz.yml` | Nightly 100k-trial cross-backend WASM-vs-TS determinism property (#1073 / shipped via PR #1097) | cron `0 4 * * *` + workflow_dispatch |
| `engine-revendor.yml` | Re-vendors the engine when `causl/causl-core-rs` publishes: pulls the published tarball's bytes, re-pins `causl.engine` from the artefact's own `causl-build-info` record, re-stamps the fixtures, runs the gates, and opens a pull request carrying the measured digests and the four escalation signals. It never writes a version, merges, or moves `release`: picking the version, writing the upgrade note and merging are the human half (causl/causl-wasm-ts#456) | `workflow_dispatch` from the engine's publish job + cron `0 12 * * *` |
| `four-way-classifier.yml` | 4-way differential classifier across TS / WASM-serde / WASM-gc-builtins / Rust enumerator (#1070 / shipped via PR #1101). **Not in this repository**: the file is absent from every workflow root, and three of its four arms are gone (the TS engine to #279, `serde` to issue #10, `gc-builtins` to causl/causl-core-rs#355) | PR (paths-filtered) + cron `15 7 * * *` + workflow_dispatch |

The rest of this page documents the disabled-but-checked-in CI design
so the workflows can be re-enabled without re-deriving the rationale.
Treat the tables below as the design contract, not the live status.

## Disabled-but-checked-in: PR-gating workflow (`ci.yml`)

Three jobs run on every PR and on every push to `main` when
`ci/parked/ci.yml` is re-enabled:

| Job | What it does | Time budget |
| --- | --- | --- |
| `ts` | `pnpm install` + `typecheck` + `build` + `test:run` across all packages, plus the named §14 perf-invariant steps, lint, commitment audits, and the test-d compile-time gate. Runs on a React peer-dep matrix (18.3.1 and 19.0.0 per #261). | ~2 min |
| `rust` | `cargo fmt --check` + `cargo clippy -D warnings` + `cargo build --release` + `cargo test` for `tools/checker` | ~3 min (cold), ~30 s (warm) |
| `size` | `andresz1/size-limit-action@v1` runs the `size-limit` cells in `.size-limit.cjs` against PR head and merge base, posts a delta-vs-base comment, and fails on overage. Replaces the in-line `pnpm size` step that the `ts` job used to carry. The action builds first via its `build_script` input; a bare `pnpm size` step needs its own build ahead of it, because eight of the nine cells measure `packages/*/dist/*` (#453). | <1 min |
| `formula-e2e` | Playwright dropped-frame gate for `@causl/formula`'s 60fps spreadsheet demo (#226 / SPEC §14 perceptual perf). Depends on `ts`. | ~3 min |
| `checker-gate` | Adopter's CI runs the same binary our CI runs: `@causl/checker` resolves the matching `@causl/checker-<target>` `optionalDependency` and execs its prebuilt artefact, the same one we publish from `release-checker.yml`. Locally this job builds the binary in-tree and runs `@causl/checker`'s integration tests against the Phase 3 + Phase 4 demos. Depends on `ts` and `rust`. | <60 s warm (SPEC §16.6) |

## SPEC §14 perf-invariant gates

SPEC §14 lists two correctness-criteria-phrased-as-performance:

1. A commit producing N derived recomputations runs in O(N), not O(graph size).
2. A React component subscribed to one node re-renders only when that node's value changes.

Both are wired as named, PR-blocking steps inside the `ts` job so a
regression surfaces directly on the check list rather than buried
inside the generic `Run tests` step (see #247 for the visibility
argument):

| Step | Backs SPEC §14 bullet | Script |
| --- | --- | --- |
| `perf-invariant: SPEC §14 gate` | #1 (recompute count) | `pnpm --filter @causl/core run test:perf-invariant` |
| `perf-invariant: SPEC §14 React subscription gate` | #2 (render scope) | `pnpm --filter @causl/react run test:perf-invariant` |

The React-side step also runs the `family-grid.test.tsx` heap-delta
leg with `CAUSL_HEAP_GATE=1` and `NODE_OPTIONS=--expose-gc` so the
heap-retention assertion produces honest numbers rather than silently
skipping (#389). The env is scoped to this step rather than job-wide
to avoid GC pressure on unrelated specs.

## Required checks (target)

`checker-gate` is the row that pins SPEC §17.8: `causl-check` is a
required green check on every PR. The job depends on `ts` and `rust`,
so failures in either skip it.

## Failure modes

The Rust binary's stdout is JSON; the wrapper raises an error if the
JSON cannot be parsed. The most common operational failures are:

- **Schema mismatch.** The TS engine exported an IR at a schema the
  binary doesn't understand. Action: rebuild the binary or re-run
  `pnpm install` to get the matching version.
- **Bound exceeded.** A test produced a graph larger than the
  `--max-nodes` / `--max-commits` defaults. Action: shrink the test or
  pass higher bounds explicitly.
- **Cycle.** A registered derivation closes a cycle. Action: fix the
  formula / dependency chain.
- **Determinism mismatch.** A commit's `changedNodes` references a
  node id that is not registered. Action: this is a bug in
  `@causl/core`'s commit log; file an issue.

## WASM build pipeline (`wasm.yml`)

`wasm.yml` is one of the three workflows that survived the PR #725
disable sweep (it was added afterwards by the wasm-substrate epic
#680, which closed with 17 sub-issues merged). It DECLARES a run on
every PR and push to main (it has never executed, see the current-state
section above) and consists of two jobs:

1. **`cargo-check`**: workspace-wide `cargo check --workspace
   --all-targets`. Defensively skips if no root `Cargo.toml` workspace
   exists. Also enforces the architectural invariant from #682: the
   `causl-enumerator` dep tree MUST NOT pull `wasm-bindgen`, `js-sys`,
   or `serde-wasm-bindgen` transitively (`cargo tree` grep gate).
2. **`wasm-pack`**: matrix over **2 cells** = 1 bridge (`gc-classic`)
   × 2 wasm-pack targets (`bundler`, `nodejs`). It was 6 cells over 3
   bridges: `serde` went with the split-crate `engine_rs` lineage
   (issue #10), and `gc-builtins` was retired by
   causl/causl-core-rs#355 because its `wasm:js-string` imports are
   i32-typed and cannot bind the externref-typed builtins on any host
   (causl/causl-core-rs#210). Per #1103 the driver `tools/wasm-build/build.mjs` emits
   both target variants per bridge so the bridge-roundtrip property
   gate can run under vitest (consumes `nodejs`) while the runtime
   loader + bundler-interop fixtures consume `bundler`. Each leg
   installs binaryen 119 for the #1085 size gate (wasm-pack 0.14.0's
   bundled wasm-opt predates stable WasmGC), runs `pnpm wasm:build`
   (wasm-pack → wasm-opt -Oz → raw + Brotli q11 budget check), uploads
   `wasm-pkg-<bridge>-<target>` as an artefact, and runs `pnpm size`
   as an independent second-layer raw-byte gate.
3. **`bundler-interop`**: matrix over **3 fixture apps** under
   `e2e/bundler-interop/` (`webpack5-app`, `vite5-app`, `esbuild-app`)
   per #689. Each fixture imports `@causl/core` (main barrel) and
   dynamically imports `@causl/causl-wasm-ts/wasm` (lazy-load entry); the
   per-fixture `verify.mjs` enforces the bundle-no-wasm-leak invariant
  : the main chunk must not contain `loadWasmBackend` /
   `WasmBackendUnavailableError` sentinels, and some other chunk MUST
   contain them (proves the dynamic import was preserved as a
   code-split rather than inlined).

### Stub-fallback for the bundler-interop job (#1108)

The `bundler-interop` job runs `node e2e/bundler-interop/stub-wasm-pkg.mjs`
between the `@causl/core` build and the per-fixture install. The stubs
are minimal-valid 8-byte WASM modules committed under both
`<bridge>-bundler/` and `<bridge>-nodejs/` artefact trees; they let
webpack 5 (with `experiments.asyncWebAssembly`) statically resolve
`new URL('./pkg/...', import.meta.url)` asset paths even when the real
wasm-pack pipeline has not produced artefacts on the runner yet. The
stubs are never instantiated: `loadWasmBackend()` throws before
reaching the fetch path. The same stub mechanism gates the
`op-wasm-boundary-1k` microbench cell on developer machines (see
[`precommit.md`](./precommit.md): `isWasmStubArtifactPresent()`
guards the cell so fresh clones without the Rust toolchain don't
trip the pre-commit hook). Tracking issues: #1098 (the bench-side
flake), #1108 (Option B / skip-with-clear-error fix that shipped).

## Nightly cross-backend determinism (`cross-backend-fuzz.yml`)

Shipped via PR #1097 closing #1073. Declares a cross-backend
WASM-vs-TS determinism property run at the `nightly` tier (100 000
trials, `maxCommands` 2000) on `0 4 * * *` UTC. It has never fired;
run it locally with `CAUSL_FUZZ_TIER=nightly`. The PR-lane gate
(5k trials) ships as a separate matrix leg once the main test
workflow lands; until then, every PR runs at the default
1000-trial floor and this workflow is the 100k canary. Tier knobs
honoured via `CAUSL_FUZZ_TIER` and `CAUSL_FUZZ_TRIALS`
(`resolveCrossBackendFuzzTier()` in seed.ts).

## Parked: 4-way differential classifier (`four-way-classifier.yml`)

Shipped via PR #1101 closing #1070. Walks the EPIC-7 corpus and the
canonical-seed registry across four implementations:

1. TS engine: this repository no longer has one. #279 deleted
   `commitInternal` and the TypeScript closure around it, so the arm
   this row named (`packages/core/src/graph.ts`, with its Phase A / B /
   C / C.5 markers) survives only in
   [`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts),
   which still ships the TypeScript value-of-record.
2. WASM serde bridge (`tools/engine-rs-bridge-serde`)
3. WASM gc-builtins bridge (`tools/engine-rs-bridge-gc` with
   `js-string-builtins`): retired by causl/causl-core-rs#355, so this
   arm no longer exists either
4. Rust enumerator (`tools/enumerator` bounded BFS: the existing
   `apalache-diff` half)

Disagreement is classified by which subset of implementations agrees
(see `tools/enumerator/diff/src/four_way.rs` for the seven arms).
Rows excused by the `[[exceptions]]` table in
`tools/apalache-diff/mapping.toml` do not strict-fail. Trigger: PR
when any of the classifier-input paths change, plus a daily cron at
`15 7 * * *` UTC (ten minutes after the #574 apalache-diff job).

## Disabled-but-checked-in: release flow (`release-checker.yml`)

`release-checker.yml` is the publish path for `@causl/checker`.
Disabled along with the rest under PR #725. When re-enabled it fires
on a `checker-v*` git tag and on `workflow_dispatch` (the latter
runs build + checksum + artefact upload only: no Release, no npm
publish: so the matrix can be dry-run without minting a tag).

1. **`version-lockstep`** asserts the Cargo `version`, the
   `@causl/checker` npm `version`, and the `CAUSL_MODEL_SCHEMA`
   constant exported from `@causl/core` (`packages/core/src/ir.ts`)
   all agree before any binary is built. The schema pin lives in
   `tools/checker/Cargo.toml` under `[package.metadata]
   causl_model_schema = "..."`. A bump in any of the three without
   the matching companion bump fails the job.
2. **`build`** cross-compiles `causl-check` for five targets via a
   matrix over `runs-on:`. Linux x64 builds natively on
   `ubuntu-latest`; Linux arm64 builds via `cross`; Darwin x64 and
   Darwin arm64 build natively on `macos-13` and `macos-14`
   respectively; Windows x64 builds natively on `windows-latest`. Each
   leg computes a SHA256 checksum and uploads the binary into the
   matching `packages/checker-<target>/bin/` directory as a workflow
   artefact.
3. **`github-release`** downloads all five artefacts and creates a
   GitHub Release for the tag, attaching every binary plus its
   `.sha256`.
4. **`publish-npm`** publishes each `@causl/checker-<target>` to
   the npm registry with `pnpm publish --no-git-checks --access public`,
   pinning the per-platform package version to match the tag.
   Authentication uses `${{ secrets.NPM_TOKEN }}`.
5. **`publish-wrapper`** publishes `@causl/checker` last, with its
   `optionalDependencies` rewritten from the `0.0.0` workspace
   placeholder to the just-published version.

Adopter installs (`pnpm add -D @causl/checker`) resolve to one of
the five per-platform packages by `os`/`cpu` filtering: no postinstall
network fetch, no corporate-proxy blast radius.

## Divergence: SPEC §17.6 serde-bundle ceiling (retired)

This section used to record a live divergence: the size-limit cell
`@causl/core wasm bridge: serde-json (raw)` sat at **230 KB** against
SPEC §17.6 commitment-14's **200 KB raw**, on a 213 KB artefact, and
`iasbuilt/causl#1150` accepted that as an Option C divergence pending
the Rust engine port.

None of that describes a gate any more, and it named the wrong file
while it lasted (#453). The serde-json cell was retired together with
the split-crate `engine_rs` lineage: the consolidated
`causl-engine-bridge` crate emits no serde-json variant, so there is
no artefact to measure and no cell measuring one. The header of
[`.size-limit.cjs`](../.size-limit.cjs) carries that retirement and
the `gc-builtins` one alongside it. The cells that remain are declared
there, not in the root manifest.

## Running locally

```bash
pnpm install
pnpm -r --filter './packages/*' run typecheck
pnpm -r --filter './packages/*' run test:run
cargo build --release --manifest-path tools/checker/Cargo.toml
pnpm --filter @causl/checker test:run
```

For the WASM-side gates (requires Rust toolchain +
`rustup target add wasm32-unknown-unknown` + `cargo install wasm-pack`):

```bash
pnpm wasm:build       # build + #1085 raw + Brotli budget gate
pnpm size             # second-layer size-limit cells
```
