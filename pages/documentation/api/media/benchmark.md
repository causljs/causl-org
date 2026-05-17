# Causl vs Jotai, Redux Toolkit, MobX

> **Status: methodology contract — results pending.** This article ships as the design of the benchmark, not yet the report. Every `[TBD]` marker is a slot a real benchmark run will fill. The team's TDD commitment forbids fabricated numbers; the libviprs benchmark article that this one models works because every number in it is real, and we plan to earn the same posture before we publish anything that competes for attention against Jotai's 5 KB story or Redux DevTools' install base.

---

A pure-TypeScript transactional dependency-graph engine is taking on three of the most-installed React state libraries in the ecosystem. In head-to-head benchmarks across seven canonical workloads — diamond cascades, 1000-cell scrolling viewports, dynamic-dependency flips, async-resource races, batch commits, equality-cutoff propagation, and large-fanout subscriber notification — Causl's results land at `[TBD]`× to `[TBD]`× the speed of the closest competitor on the workloads that match its design center, while staying within `[TBD]` MB of the closest minimum-bundle competitor. Those won't be typos either. And this isn't a rigged comparison: every library receives the same scenario set, every measurement is taken in the same Node.js process or the same Playwright-driven Chromium, and every chart axis labels what it is honestly. The difference is architectural — and the architectural difference is the only reason a fifth state library can exist in 2026 and be worth installing.

## How We Test

Fair benchmarking between state libraries with different mutation semantics is harder than it looks. Run a microbenchmark and you measure the engine in isolation, missing the React reconciliation cost that dominates real apps. Run a Playwright harness and you measure the browser, hiding the engine's own cost behind paint and layout. Mount components and you measure mount; update them and you measure scheduler decisions you didn't make. To eliminate every variable except the engine itself on the relevant workloads, we run every benchmark in two layers:

- **In-process microbenchmarks** measure the cost of state operations themselves: a commit, a derived recompute, a subscriber notification, an equality cutoff. Every library is loaded into the same Node.js process via dynamic import; every benchmark is run with [`tinybench`](https://github.com/tinylibs/tinybench) using a 200ms warm-up and a 1000-iteration sample, with the median reported and the noise floor recorded. No DOM, no React, no scheduler interference — just the engine doing what it claims to do.
- **DOM-rendering benchmarks** measure end-to-end React mount and update cost using Playwright against a production build. Each library renders the same scenario component tree; the harness counts dropped frames at 60 Hz, measures wall time from `commit` (or equivalent mutation) to `requestIdleCallback` settling, and reports per-frame paint cost from the Chrome DevTools Protocol's `Performance.metrics`.

Both layers run under the same Node version, the same `react@^18.3` (and a separate sweep on `react@19.0` once stable), the same machine class (Apple Silicon M-series for the `[TBD]` headline numbers; x64 Linux for the `[TBD]` reproduction in CI). Every library is loaded from npm at its latest stable release on the day the run was made, and the resolved versions are recorded in the JSON output. Source code for all benchmarks lives in [`packages/bench/`](https://github.com/causljs/causl-bench/tree/main/packages/bench), and the benchmark can be reproduced in Docker via `python tools/bench/run-bench.py`.

## The Workloads

We picked seven workloads. Each one isolates a behavior the architectural difference between Causl and its competitors makes load-bearing.

| # | Workload | What it measures |
|---|---|---|
| 1 | **Linear chain (`A → B → C → D → E`)** | Cost of forwarding a single change through five linear derivations. |
| 2 | **Diamond cascade (`A → B; A → C; B + C → D`)** | Cost of glitch-free recomputation when two paths converge. Only Causl guarantees `D(t) = f(B(t), C(t))` as a denotational property; the others provide it as a scheduler artifact. |
| 3 | **1000-cell scrolling viewport** | Real-world DX: virtualized grid where each row needs parameterized inputs, mounting and unmounting under user scroll. Measures: GC pressure, leak rate, dropped frames at 60 Hz. |
| 4 | **Dynamic-dependency flip** | A derivation conditionally reads input A *or* input B based on a third input. After the flip, writes to the abandoned input must not trigger recomputation. Measures: dynamic-dep cleanup cost, false-recompute count. |
| 5 | **Async-resource race** | Component dispatches a fetch keyed by input X; X changes while fetch is in flight; late result must not overwrite the newer state. Measures: stale-result detection cost, observable wrong-data window. |
| 6 | **Batch commit** | One user action writes 50 inputs simultaneously. Subscribers should fire once per batch, not 50 times. Measures: notification coalescing, recompute count for unchanged downstream values. |
| 7 | **Equality-cutoff propagation** | A derivation recomputes to the same value (`Object.is` equal). Downstream subscribers should not fire. Measures: false-positive notifications, propagation depth. |

Each workload runs at four scales: 100, 1k, 10k, and 100k nodes. Memory is measured via [`process.memoryUsage().heapUsed`](https://nodejs.org/api/process.html#processmemoryusage) deltas around forced GC cycles in the in-process layer, and via Chromium's `--enable-precise-memory-info` heap totals in the DOM layer. The methodology section at the bottom of this article documents every knob.

## The Numbers

[Headline charts and tables go here once the bench has run. The structure they will follow:]

### Wall time per commit (single mutation, 1k nodes)

| Library | Linear chain | Diamond | Dynamic-dep flip | Batch (50 writes) | Equality cutoff |
|---|--:|--:|--:|--:|--:|
| Jotai | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms |
| Redux Toolkit | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms |
| MobX | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms |
| **Causl** | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms | `[TBD]` ms |

[At the diamond row we will show that Causl's recompute count is exactly `|affected|` — measured directly via the `whyUpdated` instrumentation — while the others either over-fire (Jotai diamond glitches above N=100 in some configurations) or relink under the hood with measurable bookkeeping cost. We expect Causl to lead on the diamond and on equality cutoff, and to be competitive (within a small constant) on the rest.]

### Memory at 10k nodes

| Library | Initial heap | After 1k commits | After 10k commits |
|---|--:|--:|--:|
| Jotai | `[TBD]` MB | `[TBD]` MB | `[TBD]` MB |
| Redux Toolkit | `[TBD]` MB | `[TBD]` MB | `[TBD]` MB |
| MobX | `[TBD]` MB | `[TBD]` MB | `[TBD]` MB |
| **Causl** | `[TBD]` MB | `[TBD]` MB | `[TBD]` MB |

[We expect Causl to be heavier at the initial-heap row — the engine carries a statechart and a commit log the others don't — and to be flatter under load because the dependency graph is built once and reused. The libviprs comparison teaches us that an architectural floor that doesn't go to zero is sometimes the right floor.]

### Dropped frames during 1000-cell scroll (Playwright, 60 Hz target, 30s scroll)

| Library | Dropped frames | Worst-case frame time |
|---|--:|--:|
| Jotai | `[TBD]` / 1800 | `[TBD]` ms |
| Redux Toolkit | `[TBD]` / 1800 | `[TBD]` ms |
| MobX | `[TBD]` / 1800 | `[TBD]` ms |
| **Causl** | `[TBD]` / 1800 | `[TBD]` ms |

### Bundle size (gzipped, full import)

The cells below are derived from the latest `size-limit --json` run
in CI. The renderer (`tools/bench/render-bundle-table.ts`) splices a
fresh table between the markers below on every nightly bench run, so
the numbers in this article cannot drift from the
size-limit gate (PR #203 review).

<!-- bundle-table:start -->
| Library | Full | Tree-shaken minimal |
|---|--:|--:|
| Jotai (core) | 6.1 KB | 0.2 KB |
| Redux Toolkit | n/a | n/a |
| MobX | 16.0 KB | 13.8 KB |
| **Causl** (`@causl/core`) | 2.4 KB | 2.2 KB |
<!-- bundle-table:end -->

[We have committed a per-import `size-limit` budget for `@causl/core` of 4 KB on minimal import (`createCausl`, `input`, `derived`, `commit`) and 6 KB on full import. That is 1 KB above Jotai's core and well below Redux Toolkit and MobX. The budget is enforced as a CI gate, not folklore (Adoption Epic E). We will not publish a bundle number that drifts from the budget without re-baselining the budget in writing.]

## The Memory Wall

This is where the architectural difference will hit hardest. Causl is the only library on the list that pays for a transactional commit boundary on every write. Jotai mutates per-atom; Redux dispatches an action that produces a new immutable state; MobX wraps every observable in a proxy and tracks reads via a global derivation context. None of those three has a per-commit "stage everything, validate, publish atomically" lifecycle. The cost of that lifecycle is a non-zero floor at small N, and the design bets that the floor is worth paying because it lets us guarantee glitch-freedom as a *theorem* rather than a *scheduler artifact*. The benchmark will quantify that bet at every scale we test.

## Efficiency Under Constraint

The efficiency chart we will publish — `commits per second per MB of peak heap` — is the metric that matters for deployment, the same way it does for libviprs in container-billing economics. A frontend isn't billed by memory-second the way a backend is, but the analogous constraint exists on the user's machine: a Chrome tab competing with twelve other tabs for system memory has a finite budget, and a state library that uses a fraction of the resources to do the same work means the rest of the page (a chart, a video, a 3D scene) gets the headroom. We expect Causl to lead on this metric on the workloads where its dependency graph stays warm — diamonds, dynamic deps, batch commits — and to be competitive (within a small constant) where the workload doesn't exercise the graph (linear chains).

## Raw Speed Still Matters

If the comparison is reduced to "single mutation, single subscriber, no diamond, no async, no batch" — the smallest possible workload — Jotai will win on every machine we test. Its core is 5 KB of essentially zero-overhead atom assignment. We do not expect to beat that, and we will not pretend to. Causl's value proposition is what happens *between* the smallest workload and the workload your real app actually has. The benchmark will show that crossover honestly: at workload `[TBD]` the lines cross.

## How Jotai Works (And Why It's Architectural Not Personal)

Jotai's core is roughly 600 lines of TypeScript built around a single primitive: an atom is a `{ read: (get) => T, write?: (get, set, ...) => void }` pair. Atoms register with a `Store`; reads track dependencies via a context-scoped `get`; writes invalidate dependents and re-render observing components. The architecture is brilliant for two reasons: it composes (every derived atom is just another atom), and it tree-shakes (an unused utility doesn't bring its dependencies). The cost is that Jotai has no transaction boundary — `setX(); setY();` is two distinct mutations, two distinct re-render passes, two distinct opportunities for an observer to read inconsistent state. For most apps this is fine; for spreadsheets, dependency-heavy editors, and the long tail of "live graph of facts" applications Causl targets, it is the foot-gun the user reaches us looking to escape.

Jotai also has no story for stale-async by version — its `loadable()` aborts the in-flight promise, but cannot detect that the dependency it was loading against has changed and therefore the result is wrong even if it arrives. Causl's resource statechart (per `SPEC.md` §6) makes that distinction first-class: a `Loaded` value's freshness is computed against the `GraphTime` at which the fetch began, and a stale arrival is either silently discarded or recorded as a typed conflict. The benchmark workload #5 will measure this difference directly: under random fetch ordering and random dependency mutation, how many wrong-data renders does each library produce?

## How Redux Toolkit Works

Redux's reducer-and-action model is the most explicit of the four. Every state change is a typed action; the reducer is a pure function from `(state, action)` to a new state. Time-travel debugging falls out for free, the action log is auditable by construction, and the model is teachable in fifteen minutes. The overhead is also the most explicit: every dispatch produces a new state object via `Immer` (in RTK), every subscriber re-renders unless it `useSelector`-s a stable slice, and every derivation is a memoized selector the user has to compose by hand. Selectors don't track dependencies; the user must remember to memoize against the correct inputs.

For workloads where the dependency graph is small and the action vocabulary is rich (form state, wizard state, undo-redo of distinct user intents), Redux is excellent. For workloads where the dependency graph is the whole app and the user mostly wants `cell.value = 42` to recompute the world, Redux makes the user write the dependency tracker by hand. The benchmark will not measure "does Redux make the user write more code" — that's a DX claim, not a perf claim — but it will measure the cost of the per-dispatch immutable state copy at scale, where Immer's structural-sharing cost grows with state shape.

## How MobX Works

MobX's proxy-based reactivity is the closest competitor to Causl's design center. `makeAutoObservable(thing)` wraps every property in a proxy that tracks reads through a global derivation context; `computed()` properties memoize and invalidate via the same dependency graph; `reaction()` subscribes to a closure and fires on every relevant change. This is the smallest, most ergonomic dependency-graph state library on the JavaScript side of the table — and the one most likely to be the right answer for many apps Causl is *not* the right answer for.

The architectural differences MobX cannot match are the ones the team picked deliberately:

- **No transaction boundary.** `runInAction` batches notifications, but does not atomically stage writes; an observer reading mid-action sees partial state. Causl's `commit` either lands wholesale or not at all.
- **No glitch-freedom as a theorem.** MobX uses topological recomputation to avoid most glitches in practice, but cannot derive the property from a denotational definition the way Causl does (`SPEC.md` §3). The benchmark workload #2 (diamond) will quantify whether this matters at scale.
- **No discriminated-union state.** MobX's value types are nominally `T`; Causl's are `Resource = Loading | Loaded | Stale | Errored`. The type system carries the lifecycle.
- **No statechart-modeled lifecycle.** MobX's `keepAlive`/`requestObservation` story for derived values is not formalized; Causl's per-node sub-statechart is.

We expect MobX to be the closest competitor on workloads 1, 6, and 7 (linear, batch, equality cutoff), and Causl to lead on workloads 2, 3, 4, and 5 (diamond, scrolling viewport, dynamic-dep, async race) where the architectural differences pay for themselves.

## What Each of Them Does Better

**Jotai** does small global state with the smallest install footprint. If your app has fifteen pieces of UI state and no dependency graph worth talking about, Jotai is the right answer and we will not pretend otherwise. The migration guide in this repo (`docs/migration/from-jotai.md`, Adoption Epic F) exists precisely for the case where you started with Jotai and grew into the complexity Causl is designed for.

**Redux Toolkit** does explicit auditable mutations with industry-standard DevTools and the largest hiring pool of developers who already know it. Time-travel debugging in Redux DevTools is the single best debugging experience in the React state-management ecosystem, which is exactly why we built `@causl/devtools-bridge` (Adoption Epic D) to plug into the same protocol.

**MobX** does ergonomic reactive objects in the smallest amount of user code. `makeAutoObservable(thing)` is one line; the equivalent Causl code defines inputs and derived selectors explicitly. If terse object-oriented mutation is the goal, MobX is the right answer and we will not pretend otherwise.

**TanStack Query** (not on the chart but worth naming) is the gold standard for server-state cache. It is not a general state engine, and Causl's `@causl/sync` adapter is intentionally narrower: it owns the *integration* of async resources with the dependency graph, not the cache, dedupe, refetch, and focus-revalidation story that TanStack Query owns end-to-end. The two compose; one does not replace the other.

## Methodology Notes

All in-process benchmarks run on Node.js `[TBD]` with `--expose-gc` to enable forced GC cycles between samples. tinybench is configured for 200ms warm-up, 1000 iterations, and median reporting; the noise floor is computed from 30 runs of a no-op benchmark and reported alongside every result. DOM benchmarks run in Playwright `[TBD]` against Chromium `[TBD]` with `--enable-precise-memory-info`, `--js-flags="--expose-gc"`, and a fresh user data directory per run. Every library's bundle is the latest stable as of the run date, captured in `report/run-metadata.json` along with the resolved version numbers, the OS and CPU model, the Node version, the React version, and the git SHA of `packages/bench/`.

We do not measure code-splitting, lazy-loading, or service-worker assets. We do not measure SSR (the SSR sub-issue in Adoption Epic B will produce a separate result table once `<Hydrate>` ships). We do not measure RSC. We do not measure the React Compiler — every library is benchmarked under the same compilation pipeline, with and without the compiler, and both numbers are reported.

The DOM-rendering benchmarks count dropped frames using the [`requestAnimationFrame` delta technique](https://web.dev/articles/rendering-performance) — a frame is "dropped" when the delta between consecutive `rAF` callbacks exceeds 16.67ms × 1.5 (so transient ~1-frame stalls are tolerated; sustained jank is counted). We use the 1.5× multiplier instead of 2× because we want to measure perceptible jank conservatively, not just paint failures.

### Determinism + baseline regression

Two test invariants in `packages/bench/test/runAll.test.ts` defend the bench's headline claims at the unit-test layer:

1. **Replay determinism (SPEC §15.2).** Running every (library × canonical scenario) cell twice at scale=100 must produce identical integer counters (`glitches`, `notifications`, `recomputes`). Wall-clock fields are excluded — they are noisy by definition. This catches accidental nondeterminism inside any harness before it ships.
2. **Counter baseline.** A committed `packages/bench/fixtures/baseline.json` pins the three integer counters per cell exactly. A regression that silently flips a comparator from per-dispatch to per-frame notifications is a test failure, not a silent chart drift. Runtime is checked as a soft 3× ceiling against the baseline median (only for cells whose baseline median exceeds 1ms — sub-millisecond noise has no signal); the integer counters are exact.

**Refresh procedure** when an intentional engine change moves the counters: regenerate the baseline and commit it in the same PR as the change.

```sh
pnpm --filter @causl/bench exec tsx test/regen-baseline.ts
git add packages/bench/fixtures/baseline.json
```

Larger scales (1k / 10k / 100k) are not enforced at the unit-test layer — running the full 4 libs × 7 scenarios × 100k matrix on every PR is a denial-of-service attack on CI. Larger-scale regressions are caught by the comparative bench job (`tools/bench/run-bench.py`), whose output is committed under `benchmarks/results/`.

### Reproducer Docker image

`tools/bench/run-bench.py` invokes `pnpm --filter @causl/bench bench` inside a pinned Docker image (`tools/bench/Dockerfile`) by default. The image pins the Node major version (selected via `--node`, currently 20 / 22 / 24), pins pnpm via corepack, and defaults `NODE_OPTIONS=--expose-gc` so the bench's typed `MissingExposeGcError` never fires inside the official image. The launcher builds the image on first invocation; subsequent runs reuse the cached tag (`causl-bench:node<major>`). The repo is bind-mounted at `/work` and the lockfile is the source of truth — `node_modules` is not baked into the image.

The host-mode path (`--no-docker`) is preserved for contributors without Docker, but host-mode numbers do **not** carry the reproducibility guarantee. Published numbers in this article are produced by the Docker path; PR-time bench reruns should match it.

### Reproducer exit codes

`tools/bench/run-bench.py` returns a typed exit code so CI scripts can branch on the failure class instead of pattern-matching log lines. The contract is pinned in code and exercised by `tools/bench/test_run_bench.py`.

| Code | Meaning |
|---:|---|
| `0` | Success — JSON results written to `benchmarks/results/YYYY-MM-DD.json` |
| `10` | Config / usage error (unsupported `--node`, negative `--seed`, etc.) |
| `11` | The bench harness itself failed (`pnpm --filter @causl/bench bench` exited non-zero). The child's actual returncode is logged on stderr; the launcher always returns `11` so the typed boundary stays unambiguous. |
| `12` | JSON parse / validation failed on bench stdout |
| `13` | Output JSON write failed (disk full, permission denied) |
| `14` | Docker invocation failed (`docker` not on `PATH`, daemon unreachable, image build failed) |
| `20` | Environment guard failed (CPU governor wrong, host probe failed, etc. — slot reserved for forthcoming guards) |

The launcher deliberately does not propagate the child's raw returncode — a child's `1` would collide with launcher-level failures and CI could not branch reliably. The original code is always written to stderr for operator forensics.

Source code for all benchmarks lives in [`packages/bench/`](https://github.com/causljs/causl-bench/tree/main/packages/bench). The benchmark can be reproduced in Docker via `python tools/bench/run-bench.py`. Result history is committed to `packages/bench/report/benchmark_history.json` per release; SVG charts are regenerated on every nightly CI run and stored at `packages/bench/report/chart_*.svg`.

## What This Benchmark Is Not

This benchmark measures the cost and behavior of state operations under seven specific workloads. It does not measure:

- **Whether you should migrate.** A 2× perf win on workload 4 means nothing if your app never exercises workload 4. Use the workload table to find the workloads you actually have, and read those rows.
- **Developer experience.** Jotai's atom syntax, MobX's proxy ergonomics, Redux's action vocabulary, and Causl's MVU surface are all defensible DX choices, and the benchmark cannot adjudicate between them. Read the migration guides and try the libraries.
- **Production stability.** Jotai, MobX, and Redux Toolkit have shipped to billions of users. Causl is `0.x.y`. The benchmark says nothing about how many production bugs each library has shipped this year.
- **Ecosystem fit.** Redux Toolkit's middleware story, Jotai's ecosystem, and MobX's extensions are not measured here. They are real and they matter.

## Conclusion

Causl is not a replacement for Jotai, Redux Toolkit, or MobX in the apps those libraries already serve well. It is a specialised tool that does one job — transactional state for tangled dependency graphs — and aims to do it `[TBD]`× more efficiently per MB than the closest competitor on the workloads that match its design center, while staying within a `[TBD]` MB envelope of the smallest competitor's bundle. For applications building spreadsheets, asset hierarchies, configuration editors, and operational dashboards where state corruption is data corruption, the numbers in this benchmark — once it runs — translate directly to faster interactions, fewer wrong-data renders, and a system the team can reason about.

The benchmark we promise here is the benchmark we will publish. Until then, the only number on this page that is not `[TBD]` is the one that says we will not publish a number we cannot defend.

---

*Causl is `[TBD-license]`. View on [GitHub](https://github.com/causljs/causl-ts). Benchmark source: [packages/bench](https://github.com/causljs/causl-bench/tree/main/packages/bench).*
