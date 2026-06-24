# Causl

> Transactional state for tangled dependency graphs.

**`causl-client` is the thin TypeScript API over the `causl-wasm` engine core**
(SPEC [§18A.4](./SPEC.md)). `causl` is a reactive dependency-graph engine whose
public contract is the §12 surface (the `input` / `derived` / `commit` / `read` /
`subscribe` / `snapshot` spine plus the `dependencies` / `dependents` structural
queries). **`causl-client` is wasm-default with a TS capability-fallback:** the
Rust→WebAssembly engine (`engine-rs-core` + `engine-rs-bridge`, reached over FFI)
is the **production engine** (`rust-ssot` is the default), and every adopter
operation —
`commit` / `read` / `subscribe` / `derived` plus `dependencies` / `dependents` /
`stats` / `commitLog` / `explain` / `exportModel` / `readAt` / `snapshotAt` /
`subscribeCommits` — resolves from Rust (the §18A.3 FFI structural lift landed,
[`causljs/causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170)). The
only JS in the hot path is the user's own `derived()` compute lambda, which runs
in JS over the bridge callback **by design**. On a host where the WasmGC engine
cannot instantiate, the implicit `createCausl()` path degrades to a retained
internal TS engine **loudly** (one-time `console.warn` +
`onCauslCapabilityFallback` telemetry, never silent — SPEC §18A.13.1); explicit
`createCauslWasm()` / `engine:'rust-ssot'` still fail loud. The Rust engine
lives in [`causljs/causl-wasm`](https://github.com/causljs/causl-wasm), which
also owns the Python build/package tooling.

The pure-TS engine (`createCauslTs`) is **retained internally** — as the §12
conformance reference, the `backend: 'auto'` auto-adapt path, and the
`WasmBackend` / `JsFallbackBackend` scaffolding — but is **not** the production
engine and is not on the public surface. The two-engine topology (a TypeScript
floor held byte-identical to wasm, plus the differential oracle and benchmarks)
lives only in the
[`causljs/causl-ts-wasm-engine`](https://github.com/causljs/causl-ts-wasm-engine)
fork, not in `causl-client`.

This repo (`causljs/causl-client`) is the **TypeScript API + Node loader** that
lets a TS/Node.js app integrate the placed `causl-wasm` artefact over FFI. It is
**not** a copy of the TS engine and ships **no Rust source and no build tooling**
(§18A.4). For the full Node-integration walkthrough — install, the `node:fs`
loader, artefact placement via `causl-wasm`'s Python scripts, the read-identity
migration, and the perf ceiling — see
[`docs/integrating-causl-client.md`](./docs/integrating-causl-client.md).

---

## Quickstart

The example in [SPEC §10](./SPEC.md#10-worked-example) is the gate for "the engine is real" — two inputs, one derived value, one diamond derivation, one subscriber, two commits, three observed propagations. Everything else in the engine is downstream of getting this right.

```ts
import { createCausl } from '@causl/core'

const graph = createCausl()
const a = graph.input('a', 1)
const b = graph.input('b', 2)
const sum = graph.derived('sum', (get) => get(a) + get(b))
const sumPlusOne = graph.derived('sumPlusOne', (get) => get(sum) + 1)

graph.subscribe(sumPlusOne, (v) => console.log(v))
// 4

graph.commit('bump-a', tx => tx.set(a, 10))
// 13

graph.commit('bump-both', tx => { tx.set(a, 100); tx.set(b, 200) })
// 301  — exactly one notification, not two
```

The four invariants — atomic commit, dependency tracking, dynamic-dep cleanup, glitch-free diamond — fall out of this example. It is pinned as an acceptance test at [`packages/core/test/spec-10-worked-example.test.ts`](./packages/core/test/spec-10-worked-example.test.ts).

---

## Why does this need to exist?

The TypeScript / React ecosystem already has Redux, MobX, Jotai, Recoil, Zustand, Valtio, TanStack Query, XState, and a long tail of hooks-shaped variants. Each one is well engineered for the slice it owns. None of them — **none** — solves the problem causl is built for.

The problem is this: an application whose state is not a tree of values but a **live graph of facts whose derivations cascade**, where:

- A single user action invalidates dozens or hundreds of dependent values.
- Some dependencies change *which* inputs they depend on as state changes (dynamic dependencies).
- Async fetches can return after the dependency they were fetching against has already moved.
- Wrong update ordering produces visible-but-inconsistent intermediate UI states (glitches).
- The user is editing one part of the model while three other parts are recomputing from external feeds, server pushes, and other users' edits.
- A bug that corrupts dependent state is not a render bug — it's data corruption that ships to disk and to other users.

Real systems that look like this: spreadsheets, CMMS, capital-planning tools, BIM-style asset graphs, configuration editors, scheduling/Gantt systems, scenario planning, dashboard composers, and large operational consoles. The author of this library has shipped several. Every one of them ran into the same wall.

If you have ever written this and watched it fire in the wrong order:

```ts
useEffect(() => { setHighlights(deriveFromSelection(selection, plan)); }, [selection, plan])
useEffect(() => { setActiveAttachments(forSelection(selection)); }, [selection])
useEffect(() => { setPlanPings(forHighlights(highlights)); }, [highlights])
```

— or written this and wondered if the result is still relevant:

```ts
const fetched = await fetchAssetStatus(activeAssetId)
setStatus(fetched) // is activeAssetId still the same as when we started?
```

— or watched a 100-row tabular UI re-render the entire grid because a single cell's formula changed — you have hit the wall this library is for.

The existing libraries each handle a *piece*. Redux gives you transactional commits but no dependency tracking. MobX gives you dependency tracking but no transactional commits and no semantic glitch-freedom guarantee. TanStack Query gives you async safety but only for HTTP state. XState gives you statecharts but not a dependency engine. Jotai gives you fine-grained atoms but no story for cross-atom transactions or stale-async protection.

Causl is the library you reach for when *more than one of those concerns is true at the same time*. It is not a replacement for the others; it is a different shape of tool.

---

## What causl does differently

Eight commitments shape the library:

1. **A denotational semantic foundation.** A derived value's meaning is a mathematical function of its inputs at a given commit time: `Behavior a = GraphTime → a`. Glitch-freedom is then a *theorem*, not a scheduler trick. Most JS reactive libraries cannot define what their own values mean precisely enough to disagree with another implementation.
2. **Transactions as the only mutation boundary.** All writes happen inside `graph.commit(intent, tx => …)`. Outside, the graph is read-only. There is no concurrent-write API to misuse.
3. **Automatic dependency tracking with deterministic dynamic-dep cleanup.** A derivation that today reads `assetA` and tomorrow reads `assetB` no longer fires on `assetA` writes — proven by property-based tests, not promised by docs.
4. **One composite statechart for every lifecycle in the system.** Resource fetch, conflict status, transaction phases, and interaction modes share one chart with shared event vocabulary. No more parallel string enums sprinkled across object fields.
5. **Strict layering** between the user's information model, the editor's controller state (selection, drag-in-progress), and the engine's substrate. They live in separate identifier namespaces and separate packages.
6. **Discriminated-union state** everywhere optional fields would otherwise hide state machines. Impossible states cannot be represented; the type checker is the first reviewer.
7. **MVU-shaped application surface.** A typed `Msg` union dispatched through `update : Msg → Model → Commit`. Transactions are the engine room; messages are the front door.
8. **Pre-runtime race detection in CI/CD.** Two Rust-backed CI tools, both shipping today: `causl-check` is the static IR linter — twelve passes against the `CauslModel` IR (cycle, monotonic, glitch-propagation, subscribe-without-dispose, use-after-dispose, cross-graph-read, commit-from-subscribe, plus structural gates). `causl-enumerate` is the SPEC §16.4 bounded state-space enumerator — BFS over the §16.4.1 type surface (10-field `State`, 8-arm `Action`, phased `transition_phased` with per-step `events: Vec<Event>` and `phases: Vec<PhaseStep>`) with `Oracle::check(s, prev, a)` plugged into Tier-1/2/3 `Bound` presets. The Apalache differential runner (`tools/enumerator/diff/`) cross-checks the enumerator's verdicts against TLA+ counterexamples on the EPIC-7 corpus.

The public surface anchored by these commitments — the `Graph` interface — is the canonical seven-method API (`createCausl`, `graph.input`, `graph.derived`, `graph.commit`, `graph.read`, `graph.subscribe`, `graph.explain`) plus the in-flight extensions that have earned a slot by naming an unavoidable engine concept: `subscribeCommits` (a narrow per-fire notification capability for adapters that don't need the full log), `exportModel` (the bridge to the Rust race-detection toolchain — feeds both `causl-check` static IR linting and `causl-enumerate` bounded state-space enumeration), `simulate` (the §5 dry-run API — predict a commit's effect without advancing time, appending to the log, or firing subscribers; observer-invisible by construction), `snapshot`/`hydrate` (single-call SSR transfer that emits a `Commit` with `intent: 'hydrate'` so consumers wake), `readAt`/`snapshotAt` (time-travel devtools and replay-determinism testing, returning a `Retained | Evicted` discriminated union per the bounded retention contract), `commitLog` (realising the "transaction log is a `Behavior [Commit]`" promise as a subscribable derived node), and the `now` getter. Memory hygiene for long-lived processes is the `commitHistoryCap` knob (default 1000; pass `0` or `1` for zero retention) — there is no runtime flush, because firing `commitLog` subscribers outside a commit boundary would violate §5. Every addition is justified one-by-one against the rule "name the unavoidable concept the engine cannot express without it, or take the cost of growing every README and every consumer's mental model." The bar for a fifteenth surface item is the same as the bar for the first eleven.

---

## How causl compares

This table is honest about where the existing libraries are *strictly better* (✓), where they cover the concern in some form (~), and where the concern is missing (✗). The Causl column uses ✓ for what currently ships on `main` and `*` for in-flight or planned future work — see Status below.

| Concern                                                  | Redux + RTK | MobX | Jotai | Recoil | Zustand | Valtio | TanStack Query | XState | Causl |
| -------------------------------------------------------- | :---------: | :--: | :---: | :----: | :-----: | :----: | :------------: | :----: | :------: |
| Transactional commits (atomic write boundary)            |      ✓      |  ~   |   ✗   |   ✗    |    ✗    |   ✗    |       ~        |   ~    |    ✓     |
| Automatic dependency tracking on reads                   |      ✗      |  ✓   |   ✓   |   ✓    |    ✗    |   ~    |       ~        |   ✗    |    ✓     |
| Dynamic dependency cleanup proven correct                |      n/a    |  ~   |   ~   |   ~    |   n/a   |   ~    |      n/a       |  n/a   |    ✓     |
| Glitch-free diamond as a *guarantee* (not best-effort)   |      ✗      |  ~   |   ~   |   ~    |    ✗    |   ✗    |       ✗        |   ✗    |    ✓     |
| Denotational semantic specification                      |      ✗      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ✗        |   ~    |    ✓     |
| Composite statechart for *all* lifecycles                |      ✗      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ✗        |   ✓    |    ✓     |
| Stale-async protection by version, not by abort-only     |      ~      |  ✗   |   ✗   |   ~    |    ✗    |   ✗    |       ✓        |   ✗    |    ✓     |
| Conflict records as first-class queryable state          |      ✗      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ~        |   ✗    |    ✓     |
| Discriminated-union state ("impossible states")          |      ~      |  ✗   |   ~   |   ~    |    ~    |   ✗    |       ~        |   ✓    |    ✓     |
| Strict model / controller / engine layering              |      ~      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ✗        |   ~    |    ✓     |
| MVU-shaped typed Msg dispatch                            |      ✓      |  ✗   |   ✗   |   ✗    |    ~    |   ✗    |       ✗        |   ✓    |    ✓     |
| Pre-runtime race detection in CI/CD (static IR linter + bounded enumerator + Apalache differential) |      ✗      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ✗        |   ~    |    ✓     |
| Live derivation editing in devtools                      |      ~      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ✗        |   ~    |    ✓     |
| Spreadsheet-grade dependency cascades (formulas, ranges) |      ✗      |  ~   |   ~   |   ~    |    ✗    |   ✗    |       ✗        |   ✗    |    ✓     |
| Excellent at: small global state                         |      ~      |  ✓   |   ✓   |   ~    |    ✓    |   ✓    |      n/a       |   ~    |    ~     |
| Excellent at: server cache / fetch dedupe                |      ~      |  ✗   |   ~   |   ~    |    ~    |   ✗    |       ✓        |   ✗    |    ~     |
| Excellent at: hierarchical UI state machines             |      ✗      |  ✗   |   ✗   |   ✗    |    ✗    |   ✗    |       ✗        |   ✓    |    ~     |
| Bundle size (smaller is better)                          |      ~      |  ~   |   ✓   |   ~    |    ✓    |   ✓    |       ~        |   ~    |    ~     |

**Reading the table:**

- **Redux + RTK** is excellent for transactional commits and time-travel debugging. It has no automatic dependency tracking; you write selectors by hand and remember to memoize them. Stale async is partly addressed by RTK Query for HTTP cache only.
- **MobX** is excellent for ergonomic reactive objects. Glitch-free is best-effort; semantic glitch-freedom isn't a stated property. Mutations are not bounded by atomic transactions, so multi-write cascades have observable intermediate states.
- **Jotai** and **Recoil** are excellent for fine-grained atomic state. They lack a transaction boundary, lack a model-checker, and conflict/stale-async stories are application-level concerns.
- **Zustand** and **Valtio** prioritize ergonomics and small bundle size. Neither addresses dependency cascades, conflicts, or async safety as first-class concerns.
- **TanStack Query** is the gold standard for server-state cache. It is not a general state engine; for client-side dependency graphs, you still need one of the others alongside it. Causl's `@causl/sync` is *complementary*, not a replacement.
- **XState** is the closest peer in spirit. It nails statecharts. It is not a dependency-graph engine; cell formulas, range dependencies, and value-derived-from-other-values are not its model. Causl treats the statechart as the *lifecycle layer* and adds the dependency engine on top.

The concerns where causl is currently `~` rather than `✓` (small global state, server cache, hierarchical UI state machines) are honest: for those problems alone, a smaller, more focused library is the right answer. Causl is for the case where you need *several* of those concerns at once and you are tired of stitching libraries together.

---

## When to use causl

Reach for this library when **two or more** of these are true:

- Your state is a graph of facts where one user action cascades through dozens of derived values.
- Your derived values change *what they depend on* as the user navigates.
- You have async fetches whose results may be stale by the time they return.
- You need an audit trail of every state change with a typed intent.
- You need conflict records that survive the transaction that created them — not exceptions, *data*.
- You have spreadsheet-like cells with formula references, or asset hierarchies with reference-based dependencies.
- You want to catch race conditions in CI before they reach production.
- A bug in your state propagation is data corruption, not a UI glitch.

## When **not** to use causl

Reach for something else when:

- Your state is a flat object with maybe twenty fields and no cross-field derivations. Use Zustand or Jotai.
- Your state is mostly cached HTTP responses. Use TanStack Query (or Apollo / Relay if GraphQL).
- Your problem is "one giant form with validation." Use React Hook Form.
- Your problem is "a wizard with five steps and a back button." Use XState directly.
- You want a library you can adopt incrementally without thinking about your model layer. Causl asks you to commit to a layered approach (information model vs editor controllers vs engine substrate). That is a feature for the problems above and overhead for the problems below.

The honest summary: causl is over-engineered for simple apps and the only way to ship the complex ones without losing your mind. Pick the right tool.

---

## What causl is *not*

I want this in writing too, because the spec used to promise too much:

- **Not a spreadsheet engine.** `@causl/formula` is a small package that demonstrates spreadsheet patterns on top of the core. It does not ship VLOOKUP.
- **Not a CRDT.** Multi-user merge semantics belong in a layer above this one.
- **Not a database, message bus, workflow engine, or rules engine.**
- **Not a competitor to Redux/MobX/etc.** for problems they already handle well.
- **Not yet at 1.0.** Phases 1–4 ship on `main`; **v0.9.0 has shipped** (the wasm-default core is in: the real Rust engine is the production default, with the §18A.3 FFI lift landed and a retained TS capability-fallback on the implicit path per §18A.13.1 — see Status below); APIs are stable but not version-locked.

---

## Status

The full specification lives in [the repo-root specification](./SPEC.md). Phased epics and sub-tasks live as GitHub issues. **Phases 1–4 have shipped on `main`, and v0.9.0 is out.** Phase 1 (semantic core), Phase 2 (React surface + spreadsheet demo), and Phase 3 (resources, conflicts, devtools inspection primitives) landed first; Phase 4 (the CI race-detection toolchain) wrapped via the Phase-8 SPEC compliance audit (umbrella #564 closed). Phase-5 perf experiment umbrella #679 closed 22/22 sub-issues (the scrolling-viewport 654× regression is resolved). Phase-6 WASM substrate epic #680 closed: all 17 Phase-0 + Phase-1 sub-issues are merged, including SPEC §17 commitment 13 (capability-cost residual band 3.0×–8.0×, PR #1024) and commitment 14 (three-tier host matrix `wasmgc-builtins` / `wasmgc-classic` / `serde-json`, PR #1053). Both Rust binaries — `causl-check` (static IR linter) and `causl-enumerate` (bounded state-space enumerator) — run in CI against the spreadsheet and async demos. See [`.github/workflows/four-way-classifier.yml`](./.github/workflows/four-way-classifier.yml) (the enumerator + Apalache differential cross-check) and [`.github/workflows/wasm.yml`](./.github/workflows/wasm.yml).

### Current state (post v0.9.0) — the two-engine topology

Per the repository topology recorded in SPEC [§18A.10](./SPEC.md), the
two-engine contract spans three first-party `causljs` repos, each owning one
artefact and none duplicating another's role:

- **`causljs/causl-wasm`** — the `causl-wasm` engine: the Rust core
  (`tools/engine-rs-core`) compiled to WebAssembly via the bridge
  (`tools/engine-rs-bridge`), the §18A.3 FFI surface, the byte-identity gate's
  Rust side, and the **Python build/package tooling** (`scripts/build_wasm.py` +
  `scripts/package_wasm.py`, §18A.11) that produces the node-target artefact and
  places it where a consumer states.
- **`causljs/causl-client`** (this repo) — the **TypeScript API for
  `causl-wasm`**: the thin TS binding of §18A.4 (a binding over the FFI, **not** a
  copy of the TS engine), the loader surface (the bundler-target lazy-instantiate
  path ships today; the consumer-side `node:fs` loader hook that resolves the
  placed `.wasm` is planned — §18A.2, see the SHIPPED-vs-PLANNED table below), and
  the adoption docs that let TS/Node.js web apps integrate it. Ships no Rust
  source. Named integration consumers: `iasbuilt/xldatagrid` and
  `iasbuilt/webapp`.
- **`causljs/causl-ts-wasm-engine`** — `causl-ts`, the TypeScript
  value-of-record / §13.8 unconditional **floor**, plus the cross-backend
  benchmark/conformance harness (the byte-identity gate's JS side) and the
  historical wasm-cutover R&D, including the experimental
  `DEFAULT_WASM_ENGINE_MODE=rust-ssot` substrate.

Within this repo:

- **The wasm engine is a real Rust engine and the production default.** The engine returned by `loadWasmBackend()` is `engine-rs-core` compiled to WebAssembly; the §18A.3 FFI structural lift landed ([causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)), so every adopter op resolves from Rust — orchestration in Rust, the user's `derived()` compute lambdas in JS over the bridge callback by design. The disclosure is repeated at the top of `packages/core/wasm/README.md`. `causl-client` made wasm its default engine via a dated §18A.13 governance amendment that deliberately bypassed the §18A.7 promotion gate; §18A.13.1 then re-extended a TS capability-fallback to the implicit `createCausl()` path (loud, never silent). Perf is explicitly immaterial (within the §14 RAIL budget).
- **Bundle-budget overage tracked in issue #22.** The post-v0.9.0 size-limit cells were re-tuned in PR #23 (createCausl-only ratcheted from 15 KB to 16 KB to absorb the `invariant` option from PR #2 / issue #1); the `@causl/core/wasm` cell still sits ~2.5 KB over the 13 KB ceiling and is the only known-red gate. PR #21 dropped the dangling bench-fixture cells that were producing six consecutive red CI runs against unrelated PRs.
- **Pre-commit ↔ CI parity landed in PR #25.** The full check union — typecheck, build, lint, size, vendor-manifest — now runs in `.husky/pre-commit`; the bundler-interop matrix moved to `.husky/pre-push`. See the *Pre-commit / pre-push hooks* subsection above.

What that means concretely for adopters:

- The semantic core (atomicity, glitch-freedom, dynamic-deps, replay determinism, cycle detection) is held by 1000-trial property suites under `packages/core/test/properties/`.
- The React surface (`useCausl`, `useDispatch`, `useCauslFamily`, Suspense + SSR) ships and is tested under StrictMode mount/unmount cycles; the `idle`-resource Suspense contract was locked in by PR #17 / issue #7.
- `@causl/core` 0.3.0 carries the runtime `invariant` callback on `graph.input(id, initial, { invariant })` added in PR #2 / issue #1.
- The `causl/no-graph-upcast` ESLint rule (PR #15 / issue #9) is the third gate in the S-3 layering enforcement chain — `as Graph` upcasts that erase capability narrowing are now lint errors, not review notes.
- The cross-backend determinism property test (`packages/core/test/properties/cross-backend-determinism.property.test.ts`) was refreshed by PR #16 / issue #6 to drop the stale Phase-1 TODO and wire World-pairing through the Graph facade.
- The full Rust race-detection toolchain (`causl-check` + `causl-enumerate`) ships out of the parent monorepo and runs against the spreadsheet + async demos there. This repo's `tools/apalache-diff/` is the TLA+ differential surface that consumes the parent repo's enumerator verdicts.

#### The §18A.7 promotion gate — and why `causl-client` bypassed it (§18A.13)

The **org-wide** §18A.7 promotion narrative — five GO/NO-GO criteria that gate
promoting the wasm engine to default over the TS floor — still governs the
**fork** (`causl-ts-wasm-engine`), which stays dual-engine. **`causl-client`,
however, did not wait for that gate:** a dated §18A.13 governance amendment
**deliberately bypassed** §18A.7 and shipped the wasm engine as the sole
production default, on **complexity-elimination** grounds (perf explicitly
immaterial — within the §14 RAIL budget). The five criteria, for reference:

1. **Correctness — cross-backend byte-identity** (MECHANICAL). The Rust and TS
   reference engines produce byte-identical `Commit` records, snapshots,
   structural-query results, and subscriber fire-order, proven by the 1000-trial
   per-flush gate (run in the fork, which keeps both engines).
2. **Completeness — full FFI surface** (MECHANICAL). Every §12.1 canonical-seven
   + §12.2 second-tier-thirteen row is reachable over FFI with no JS-engine
   fallback for any row — the §18A.3 lift that **landed**
   ([causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)).
3. **Performance** (MECHANICAL). Single commit ≤ 250 µs p95 marshal overhead;
   batch / large mutation ≤ 5 ms p95. `causl-client` does **not** treat perf as a
   promotion gate — it stays within the §14 RAIL responsiveness budget, which is
   the bar that matters for the adopter.
4. **Node target + real-world adoption** (MECHANICAL artefact + adopter
   attestation). The `--target nodejs` artefact + ESM/`node:fs` loader ships
   (§18A.2).
5. **Governance** (DESIGN-DISCIPLINE). Promotion is a named, dated amendment by
   the §13.8 authority — which is exactly what §18A.13 is for `causl-client`.

#### Integrate `causl-wasm` + `causl-client` into your Node.js app

Your application programs against the §12 `Graph` surface only — never against
an engine. `causl-client` is **wasm-default with a TS capability-fallback**: the
Rust→WebAssembly engine is the production engine behind that surface, with the
retained internal TS engine as the implicit `createCausl()` path's
WasmGC-unavailable fallback (SPEC §18A.13.1). **`causl-wasm` + `causl-client`
are the Enterprise-tier path.** Two repos cooperate, and the boundary is the
placed artefact:

**Producer side — build & place the artefact (Enterprise).** The producer repo
[`causljs/causl-wasm`](https://github.com/causljs/causl-wasm) owns the Rust
engine plus two **stdlib-only Python 3 scripts** (no `pip install`, no Node;
drops into any CI/CD pipeline — §18A.11). It builds the size-optimised
`--target nodejs` `.wasm` **once** and places it, with a version + per-file
sha256 manifest, where the consuming app states:

```sh
# BUILD half — needs a Rust toolchain (cargo ≥1.89, wasm-pack 0.14, wasm-opt ≥119).
# --bridge picks the string strategy: gc-classic → classic-strings (UTF-16
# fallback, DEFAULT); gc-builtins → js-string-builtins (no-copy wasm:js-string).
python3 scripts/build_wasm.py --bridge gc-classic            # → build/wasm-nodejs

# PACKAGE half — CPython stdlib only, NO Rust toolchain. --dest is REQUIRED.
# Places the .wasm + node glue (.js) + .d.ts and writes causl-wasm.manifest.json
# (schema "causl-wasm/manifest@1": engineVersion, bridge, target:"nodejs",
# wasmOptFlags, files[] = {name, sha256, bytes}).
python3 scripts/package_wasm.py --build --dest apps/web/src/engine/wasm
```

The single `--build --dest <DIR>` call does build + place in one step. The
manifest is byte-reproducible (no `built-at` by default), so git-track it and
add a **loud, network-free verify gate** (file existence + per-file sha256
against the manifest) to CI and/or a pre-commit hook: a corrupt, missing, or
version-skewed `.wasm` is a hard failure, never a silent fall-through. A
consuming app needs only **CPython stdlib and a checksum to vendor** — **never a
Rust toolchain**.

The package step also drops the **compute-imports snippet** next to the `.wasm` /
`_bg.js` and **fails loud** (`build_wasm.py` / `package_wasm.py` assert, never
warn) on three things: the §18A.12 sync seam is present (the `new
WebAssembly.Instance` construction path), the compute-imports snippet is present,
and the artefact is node-loadable. Node-loadability is **bridge-specific**:
`gc-classic` loads as `--target nodejs`, but `gc-builtins` emits
`require("wasm:js-string")` which stock Node can't resolve, so it is
**bundler-target only**.

**Consumer side — install `@causl/core`, load over `@causl/core/wasm`.** The
published package is **`@causl/core`** (`causl-client` is the repo name; there is
no separately-published `causl-client` npm package). Node ≥ 22, ESM-only:

```bash
npm install @causl/core        # or: pnpm add @causl/core
```

```ts
import { createCausl } from '@causl/core'
import { loadWasmBackend, WasmBackendUnavailableError } from '@causl/core/wasm'

// The wasm seam lives behind the `./wasm` subpath export. Importing the bare
// `@causl/core` does NOT pull the wasm chunk — only an explicit
// `import('@causl/core/wasm')` (or createCausl({ backend: 'auto' | 'wasm' })
// past the auto threshold) pays the cost.
async function makeBackend() {
  try {
    return await loadWasmBackend()        // binds the FFI seam over the placed .wasm
  } catch (err) {
    // Acceleration, not substitution: any host that runs JS runs the TS floor.
    if (err instanceof WasmBackendUnavailableError) return 'js' as const
    throw err
  }
}

const graph = createCausl({ backend: await makeBackend() })
```

`loadWasmBackend(options?)` is the **primary entry point** of `@causl/core/wasm`
— async, returns a `BackendEngine` (the canonical-seven `Graph` spine plus the
second-tier methods), caches per bridge, and on a non-loadable pinned bridge
throws `WasmBackendUnavailableError` (`code: 'CAUSL_WASM_NOT_BUILT'`) so adopters
branch back to the TS floor. Honoured options include `bridge`
(`'wasmgc-builtins'` | `'wasmgc-classic'`), `wasmBaseUrl` (CDN/CSP override),
`fetch`, `graphName`, `batchedFlush`, and `engine` (`'rust-ssot'` default |
`'js-ssot'` internal reference).

**The factory surface — and the sync separation (§18A.12, shipped).** From a
consumer's perspective the wasm engine is now **synchronous to construct**. The
one unavoidable async — the `WebAssembly.compile` — is split off from
construction so the single `await` lives at app init, never at a render or hook
call site:

- `createCausl(options?): Graph` — the **default public factory**. It routes to
  the **real wasm engine** (synchronously) once `preloadCauslWasm()` has run for
  the default bridge, and otherwise builds a working sync `Graph` on the
  **internal** TS floor (a *silent* sync-ergonomics fallback, non-breaking for
  sync callers that never preload). On a host where the WasmGC engine cannot
  **instantiate** even though a module is preloaded, it degrades to the internal
  TS engine **loudly** (one-time `console.warn` + `onCauslCapabilityFallback`
  telemetry, never silent — SPEC §18A.13.1). `createCauslTs` is **no longer a
  public engine choice** (epic #31 / #34): the pure-TS floor survives only
  internally, as the §12 conformance reference / auto-adapt / fallback
  scaffolding and the implicit-path capability fallback. The §18A.3 FFI lift has
  **landed**
  ([`causljs/causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170)),
  so every adopter op resolves from Rust under rust-ssot; the literal zero-TS
  core (deleting `createCauslTs`) is **dropped from near-term scope by §18A.13.1**
  — the TS engine is kept, not deleted.
- `await preloadCauslWasm(opts?)` — **the one async seam, called once** at
  app/init. Compiles + caches the `WebAssembly.Module` (plus the `_bg.js` sidecar
  and the compute-imports snippet), keyed by bridge. Idempotent: concurrent calls
  share one compile; a transient failure drops the cache entry for retry.
  Companions `isCauslWasmPreloaded(bridge?)` / `getPreloadedCauslWasm(bridge?)`
  peek the *resolved* state synchronously.
- `createCauslWasmSync(handle?, create?): Graph` — **fully synchronous** (a fresh
  `new WebAssembly.Instance` from the cached `Module`, zero `await`). With nothing
  preloaded for the bridge it throws `CauslWasmNotPreloadedError` (naming
  `preloadCauslWasm()`) by default — a silent TS↔wasm swap would diverge in
  `read()`-identity / commit-clock, so the §18A loud-fail discipline holds — or,
  with `{ fallbackToTs: true }`, degrades to the **internal** TS floor (a
  sync-ergonomics fallback, not a public engine choice).
- `createCauslWasm(opts?): Promise<Graph>` — **retained**, now re-expressed as
  `preload ∘ createCauslWasmSync` (one instantiate codepath, provably no drift).

This is what lets **sync consumers** — React hooks/render, `iasbuilt/xldatagrid` —
build a wasm graph with **no `await` at the call site**: the single `await` is
hoisted to bootstrap, outside any commit envelope (Theorem 2's single-tick
invariant is untouched). On Node/SSR the `--target nodejs` glue is synchronous at
require-time, so `createCauslWasmSync` works with **no prior preload** — server
render stays synchronous end-to-end; only the **browser bundler target** needs the
one-time `await preloadCauslWasm()` before the first render that constructs a wasm
graph. The lower-level `loadWasmBackend()` + `createCausl({ backend })` seam shown
above remains, and the `createCauslWasm()` / `createCauslWasmSync()` factories are
exported from this repo's own `@causl/core/wasm`
([`packages/core/wasm/index.ts`](./packages/core/wasm/index.ts)) — and from the
[`causljs/causl-ts-wasm-engine`](https://github.com/causljs/causl-ts-wasm-engine)
fork of `@causl/core/wasm` that wasm-capable consumers link against. Use whichever
your linked `@causl/core` exposes.

**Node-target status — SHIPPED (be precise).** On Node today:

| Capability | Status |
| --- | --- |
| Producer `--target nodejs` build + placement (`build_wasm.py` / `package_wasm.py`, sha256 manifest) | **SHIPPED** (§18A.11) |
| Sync construction seam — `preloadCauslWasm()` + `createCauslWasmSync()` (one `await` at init, sync at every call site) | **SHIPPED** (§18A.12 — in the fork *and* in `causl-client`) |
| Consumer `@causl/core/wasm` loader, bridge picker, instantiate path | **SHIPPED** (epic #680) |
| Engine runtime = the **real `engine-rs-core` Rust engine** compiled to WebAssembly; every adopter op resolves from Rust | **SHIPPED** — §18A.3 FFI lift landed ([causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)) |
| Multi-instance isolation via `engine_id` multiplexing | **SHIPPED** |
| `read()` returns a fresh object per call (deserialised across FFI) — reference identity is **not** contractual | **SHIPPED** (§18A.5) — memoise on `commit.time` / node-version, never on the read reference. |
| `engine: 'rust-ssot'` (the default) | **SHIPPED** — the production engine. `'js-ssot'` is the internal conformance reference only. |
| Implicit-path TS capability fallback (`createCausl()` degrades loudly on a WasmGC-unavailable host; explicit wasm still fails loud) | **SHIPPED** (§18A.13.1) |
| Literal zero-TS core (deleting `createCauslTs` outright) | **DROPPED from near-term scope by §18A.13.1** — the TS engine is retained as the §12 conformance reference + the implicit-path capability fallback. |

So today: the **producer node-target tooling and the consumer loader are real and
shipped**, and the engine they reach is the **real Rust `engine-rs-core`** —
orchestration in Rust, the user's `derived()` compute lambdas in JS over the
bridge callback. Per-commit wall-time stays inside the §14 RAIL responsiveness
budget; perf is **not** the reason this engine ships. The full walkthrough
(install, the loader hook, the read-identity migration, and the perf ceiling)
lives in
[`docs/integrating-causl-client.md`](./docs/integrating-causl-client.md); the
seam-level disclosure and option reference are in
[`packages/core/wasm/README.md`](./packages/core/wasm/README.md) and
[`docs/wasm-adoption-guide.md`](./docs/wasm-adoption-guide.md).

#### `causl-client` is wasm-default with a TS capability-fallback (SPEC §18A.13 + §18A.13.1 — shipped)

A dated governance amendment ([§18A.13](./SPEC.md)) records the **committed and
now-executed** direction for this repo — distinct from the §18A.7 promotion gate
above, which it deliberately bypasses. **Scoped to `causl-client` only:** this
distribution ships a **wasm-default core**. `createCausl()` **routes to the wasm
engine** (synchronously, via the §18A.12 `preloadCauslWasm()` +
`createCauslWasmSync()` split — one `await` at app init, sync `createCausl()` at
every render/hook site thereafter), and the pure-TS `createCauslTs()` engine **has
been removed from the public `causl-client` surface**. Consumers calling
`createCausl()` keep their call sites **unchanged** and transparently get wasm
(e.g. `iasbuilt/xldatagrid`'s sync `createCausl()` sites need no async refactor —
just one `await preloadCauslWasm()` at boot). The driver is
**complexity-elimination** — collapsing the dual-engine roster — with perf
**explicitly accepted as immaterial** here (never a gate); this is not a promotion
on performance grounds.

**SPEC §18A.13.1 (2026-06-23) partially reversed the fail-loud stance for the
implicit path only.** `createCauslTs` is **retained** (not deleted) and **wired**
as the implicit `createCausl()` path's WasmGC-unavailable **capability fallback**:
on a host where the WasmGC engine cannot instantiate (Safari < 18 / macOS < 15,
policy-pinned pre-119 Chromium/WebView2, Node ≤ 20), `createCausl()` degrades to
the internal TS engine **loudly** (one-time `console.warn` +
`onCauslCapabilityFallback` telemetry, never silent), so a no-wasm enterprise
user gets a working app. The **explicit** `createCauslWasm()` /
`createCauslWasmSync()` / `engine:'rust-ssot'` factories **still fail loud**
(`CAUSL_WASM_ENGINE_UNAVAILABLE`) — a consumer that explicitly asked for wasm
must never silently run on JS.

The **public** strip shipped **2026-06-20** (epic
[#31](https://github.com/causljs/causl-client/issues/31)), executed
**wire-before-cut**: [#32](https://github.com/causljs/causl-client/issues/32) WIRE
(port the authoritative loader) → [#33](https://github.com/causljs/causl-client/issues/33)
FLIP (`createCausl()` → wasm, sync) → [#34](https://github.com/causljs/causl-client/issues/34)
CUT (un-export `createCauslTs`). The **§18A.3 FFI structural lift has since
landed** ([`causljs/causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170)):
every adopter op resolves from Rust, with the user's `derived()` compute lambdas
running in JS over the bridge callback by design. The literal **zero-TS core**
(deleting `createCauslTs` outright) is **dropped from near-term scope by SPEC
§18A.13.1** — the TS engine is kept as the §12 conformance reference + the
implicit-path capability fallback, not deleted. The
§18A.1.1 cross-backend byte-identity oracle is differential and needs two
engines, so it **cannot run inside `causl-client`** (whose public surface
exposes only the wasm engine) — it is **preserved in
[`causljs/causl-ts-wasm-engine`](https://github.com/causljs/causl-ts-wasm-engine)**,
which keeps `causl-ts` + the byte-identity harness (it is the differential oracle
and benchmark repo) plus a frozen golden-vector corpus captured before the cut.
**The fork stays dual-engine; `causl-client` is wasm-default with a TS
capability-fallback.** Removing `causl-ts` from this repo's *public* surface
does not remove the proof of correctness from the org.

Pre-1.0 caveats remain — public APIs may evolve before a tagged release; published-package tooling is a separate epic. The closing section of the specification enumerates the eight team commitments the repo is held against — semantic foundation lands first; the composite statechart is drawn before conflict and resource code is written; the model/controller/engine layering is enforced at the package boundary; every discriminated union carries an exhaustiveness check; the race-class catalogue is kept current; the worked example is the gate for "the engine is real"; no enum tags ship whose transitions are unspecified; and the Rust race-detection toolchain (`causl-check` + `causl-enumerate`) ships as a required CI gate. CONTRIBUTING.md documents how each commitment is enforced.

---

## Packages

| Path                          | Package                       | Version | Role                                                                                  |
| ----------------------------- | ----------------------------- | :-----: | ------------------------------------------------------------------------------------- |
| `packages/core/`              | `@causl/core`                 | `0.3.0` | Engine — Behaviors, derivations, transactions, snapshot/hydrate, retention, explain. Also exposes the opt-in `/wasm` subpath. |
| `packages/react/`             | `@causl/react`                | `0.2.0` | React bindings — `useCausl`, `useDispatch`, `useCauslFamily`, MVU runner, SSR.        |
| `packages/sync/`              | `@causl/sync`                 | `0.2.0` | Async resources + conflict registry as composed statecharts.                          |
| `packages/formula/`           | `@causl/formula`              | `0.2.0` | Spreadsheet patterns *on top of* the core — formulas, ranges, cycles.                 |
| `packages/persistence/`       | `@causl/persistence`          | `0.1.0` | Persisted-input adapter with structured `PersistenceError` reporting.                 |
| `packages/devtools/`          | `@causl/devtools`             | `0.1.0` | Inspection primitives (explain materialisation, liveDerivation, snapshot, statechart). |
| `packages/devtools-bridge/`   | `@causl/devtools-bridge`      | `0.1.0` | Redux DevTools Extension protocol bridge (zero-cost when absent).                     |
| `packages/migration-check/`   | `@causl/migration-check`      | `0.1.0` | Migration drift detector — flags unmigrated Jotai/MobX/Redux patterns in adopters.    |
| `packages/hypothesis/`        | `@causl/hypothesis`           | `0.1.0` | Hypothesis combinators + state-space hooks (Apalache differential surface).           |

`@causl/core` carries the major-zero `0.3.x` line because it has absorbed the post-0.2.0 race-class catalogue refinements that the adapter packages have not yet had to chase. The adapter and tooling tier sits at `^0.2.0` / `^0.1.0` until those packages have their own breaking changes to ship.

Internal-only workspace siblings:

- `packages/core/testing/` — published as `@causl/core-testing-internal`; shared property-test seam helpers.
- `packages/sync-testing-internal/` — `@causl/sync-testing-internal` (currently `0.0.0`); fc.Arbitrary generators for the resource/conflict event vocabulary, consumed by the sync property suites.

The `causl-wasm` engine source — the Rust core (`engine-rs-core`), the FFI
bridge (`engine-rs-bridge`), and the Python build/package tooling — lives **out
of this repo** in [`causljs/causl-wasm`](https://github.com/causljs/causl-wasm)
(SPEC §18A.10). The `causl-ts` floor and the experimental
`DEFAULT_WASM_ENGINE_MODE=rust-ssot` + shared-memory-worker R&D live in
[`causljs/causl-ts-wasm-engine`](https://github.com/causljs/causl-ts-wasm-engine).
The interface and bridge contracts this repo exposes (`packages/core/wasm/index.ts`)
are the stable FFI surface those repos are held byte-identical against by the
cross-backend determinism gate.

See each package's `README.md` for build and run instructions where they exist.

---

## Tools

Build infrastructure, CI gates, lint rules, and release tooling live
under [`tools/`](./tools/). Brief role descriptions below; the
authoritative documentation lives in each tool's own `README.md`
where one ships, otherwise in the module-level header comments.

| Path | Purpose |
| --- | --- |
| [`tools/release/`](./tools/release/) | `release.py` — bundles the minimum-viable per-package npm tree at `RELEASE_VERSION` for the TypeScript-only path. Output ships on the `release` branch. |
| [`tools/apalache-diff/`](./tools/apalache-diff/) | Apalache differential runner that cross-checks the bounded enumerator against the EPIC-7 TLA+ corpus. The Rust enumerator + checker crates themselves live in the parent monorepo (`causljs/causl`); this directory holds the TS-side harness that consumes their verdicts. |
| [`tools/audit/`](./tools/audit/) | Governance / commitment-audit tooling (`pnpm audit:commitments`). |
| [`tools/drift/`](./tools/drift/) | Drift-telemetry helpers consumed by `@causl/migration-check`. |
| [`tools/eslint-plugin-causl/`](./tools/eslint-plugin-causl/) | ESLint plugin for causl-aware lint rules (e.g. `causl/no-graph-upcast` from PR #15 / issue #9). |
| [`tools/lint/`](./tools/lint/) | Project lint helpers (orchestrates `eslint-plugin-causl`, prettier, custom passes). |
| [`tools/lint-fixtures/`](./tools/lint-fixtures/) | Fixture corpus for the lint rules. |
| [`tools/docs-postprocess/`](./tools/docs-postprocess/) | TypeDoc / Markdown post-processing for the docs pipeline. |
| [`tools/migrate-ir-2-to-3.ts`](./tools/migrate-ir-2-to-3.ts) | One-shot CauslModel IR schema-3 migration codemod. |

The `causl-wasm` Rust engine (`engine-rs-core` + `engine-rs-bridge`) and the
Python build/package tooling (`scripts/build_wasm.py` + `scripts/package_wasm.py`)
live in [`causljs/causl-wasm`](https://github.com/causljs/causl-wasm) (SPEC
§18A.10); the `causl-check` static IR linter and `causl-enumerate` bounded
enumerator run from the race-detection toolchain. This repo
(`causljs/causl-client`) carries the **TypeScript API + Node loader** over that
engine, the TypeScript packages, the per-PR bundle-budget gate, the TLA+
differential runner, and the lint plugin — and ships no Rust source.

---

## Development setup

### Prerequisites

| Tool        | Version          | How to install                                |
| ----------- | ---------------- | --------------------------------------------- |
| Node.js     | 24.x (LTS Krypton) | Use [`nvm`](https://github.com/nvm-sh/nvm) — `nvm install` reads `.nvmrc` |
| pnpm        | 10.x             | `corepack enable` (Node ships Corepack), or `npm i -g pnpm@10` |
| Rust        | stable           | [`rustup`](https://rustup.rs) — only required to work on `tools/checker/` |

The repository pins Node via `.nvmrc` and pnpm via `packageManager` in the root `package.json`. With `nvm` and Corepack on, switching into the directory and running `pnpm install` is enough.

```sh
# one-time setup
nvm install        # installs Node 24 from .nvmrc
nvm use            # activates it for this shell
corepack enable    # makes the pinned pnpm available

# install workspace dependencies
pnpm install
```

### Common commands

```sh
pnpm install        # install workspace deps
pnpm build          # tsup builds for every package
pnpm test:run       # vitest --run across every workspace (single pass)
pnpm typecheck      # tsc --noEmit across packages
pnpm lint           # eslint across packages
pnpm size           # size-limit gate (uses the dist/ from `pnpm build`)
pnpm test           # vitest in watch mode (interactive)
pnpm validate       # typecheck + build + test:run + docs:test (pre-publish)
```

Smoke flow for a fresh clone:

```sh
pnpm install && pnpm build && pnpm test:run
```

### Pre-commit / pre-push hooks

Husky is wired up via the root `prepare` script (`husky` install runs on `pnpm install`). PR [#25](https://github.com/causljs/causl-client/pull/25) replaced the previous "lint-staged only" hook with the **full CI-check union** so passing locally implies passing CI:

- **`.husky/pre-commit`** runs, in order: `lint-staged` (eslint --fix on staged TS) → `pnpm typecheck` → `pnpm build` → `pnpm lint` → `pnpm size` → `scripts/check-vendor-manifest.sh` (paths-filtered, fires only when vendored bytes are staged).
- **`.husky/pre-push`** runs the `e2e/bundler-interop/` matrix (`webpack5-app`, `vite5-app`, `esbuild-app`) — `npm install --no-save` → `npm run build` → `npm run verify`. Mirrors `wasm.yml`'s `bundler-interop` CI job; the gate is the bundle-no-wasm-leak invariant from issue #689.

Escape hatches: `SKIP_PRECOMMIT=1` / `SKIP_PREPUSH=1` env vars, or the standard `git commit --no-verify` / `git push --no-verify`. The `pnpm size` step is known-red on `main` until issue [#22](https://github.com/causljs/causl-client/issues/22) closes — see the bundle-budget paragraph below.

### Bundle-budget status (post PR #21 + #23)

The `size-limit` cells in the root `package.json` gate dist-bundle ceilings on every PR. Current band:

- `@causl/core` (full import) ≤ **20 KB**.
- `@causl/core` (createCausl-only) ≤ **16 KB** — bumped 1 KB in PR [#23](https://github.com/causljs/causl-client/pull/23) to absorb the post-`invariant` overage.
- `@causl/core/wasm` ≤ **13 KB** — still over per issue [#22](https://github.com/causljs/causl-client/issues/22); the gate stays in the hook so the moment the cell goes green new drift starts being caught.
- WASM artefact ceilings (per-bridge, raw + Brotli) are documented in the root `package.json`'s `//size-limit-wasm` comment block — the `.wasm` artefacts themselves ship from the parent repo's `tools/wasm-build/` driver.

PR [#21](https://github.com/causljs/causl-client/pull/21) dropped the dangling bench-fixture size-limit cells (closing issue [#19](https://github.com/causljs/causl-client/issues/19)); PR [#14](https://github.com/causljs/causl-client/pull/14) re-enabled the per-PR bundle-budget comment workflow.

---

## Try it live

The interactive playground + spreadsheet demos that load `@causl/core` from esm.sh ship out of the parent monorepo's `causl-org/` static-site tree, hosted at `https://causl.org`. The `@causl/core` build this repo publishes is exactly what those demos pull at runtime, so a local `pnpm build` is enough to dogfood adopter-shaped imports.

---

## License

MIT — see [LICENSE](./LICENSE).

Copyright (c) 2026 Roman Goldmann <roman@iasbuilt.com>.
