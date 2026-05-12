# CI

Three jobs run on every PR and on every push to `main`:

| Job | What it does | Time budget |
| --- | --- | --- |
| `ts` | `pnpm install` + `typecheck` + `test:run` across all packages | ~2 min |
| `rust` | `cargo build --release` + `cargo test` for `tools/checker` | ~3 min (cold), ~30 s (warm) |
| `checker-gate` | Adopter's CI runs the same binary our CI runs — `@causl/checker` resolves the matching `@causl/checker-<target>` `optionalDependency` and execs its prebuilt artefact, the same one we publish from `release-checker.yml`. Locally this job builds the binary in-tree and runs `@causl/checker`'s integration tests against the Phase 3 + Phase 4 demos. | <60 s warm (SPEC §16.6) |

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
| `perf-invariant — SPEC §14 gate` | #1 (recompute count) | `pnpm --filter @causl/core run test:perf-invariant` |
| `perf-invariant — SPEC §14 React subscription gate` | #2 (render scope) | `pnpm --filter @causl/react run test:perf-invariant` |

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

## Release flow — `causl-check` cross-platform binaries

`release-checker.yml` is the publish path for `@causl/checker`. It
fires on a `checker-v*` git tag and on `workflow_dispatch` (the latter
runs build + checksum + artefact upload only — no Release, no npm
publish — so I can dry-run the matrix without minting a tag).

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
the five per-platform packages by `os`/`cpu` filtering — no postinstall
network fetch, no corporate-proxy blast radius.

## Running locally

```bash
pnpm install
pnpm -r --filter './packages/*' run typecheck
pnpm -r --filter './packages/*' run test:run
cargo build --release --manifest-path tools/checker/Cargo.toml
pnpm --filter @causl/checker test:run
```
