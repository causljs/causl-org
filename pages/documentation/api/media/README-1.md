# Causl

## Published package

This repository publishes **`@causl/causl-wasm-ts`**: the TypeScript **client**: a thin API layer over the
`causl-core-rs` engine, not an engine itself.

Alongside it, this repository is the sole publisher of the satellite packages:
`@causl/react`, `@causl/sync`, `@causl/persistence`, `@causl/formula`, `@causl/devtools`,
`@causl/devtools-bridge`, `@causl/hypothesis`, `@causl/migration-check`.

Registry: Gitea npm registry; `https://git.opsite.ca/api/packages/causl/npm/`

> **Renamed from the retired `@causl/core`. On this registry that name no longer resolves; on public npmjs it still does, and there it serves a DIFFERENT package, so a stale pin fails silently rather than loudly.** `@causl/core` has zero versions in the Gitea registry, but it is live on **npmjs** at versions 0.3.0 through 0.3.3, published there as *"the reference TypeScript engine"*: the engine this line removed. So a dependency still pinning `@causl/core`, or an `.npmrc` missing the `@causl:registry=` line below, installs successfully from npmjs and gets the wrong package rather than an error. That is a reason to check every pin, not a reason to relax: update them to `@causl/causl-wasm-ts`.
> Naming follows the scheme in [`causl-wasm-ts` / `docs/repo-naming-decision.md`](https://git.opsite.ca/causl/causl-wasm-ts/src/branch/main/docs/repo-naming-decision.md): **engines are named by substrate** (`causl-core-rs`, `causl-core-ts`), **clients by consumer language** (`causl-wasm-ts`, future `causl-client-cpp`).


> Transactional state for tangled dependency graphs.

**`causl-wasm-ts` is the thin TypeScript API over the `causl-wasm` engine core**
(SPEC [§18A.4](./SPEC.md)). `causl` is a reactive dependency-graph engine whose
public contract is the §12 surface (the `input` / `derived` / `commit` / `read` /
`subscribe` / `snapshot` spine plus the `dependencies` / `dependents` structural
queries). **`causl-wasm-ts` ships exactly one engine:** the Rust→WebAssembly
engine (`engine-rs-core` + `engine-rs-bridge`, reached over FFI), `rust-ssot`.
Every adopter operation:
`commit` / `read` / `subscribe` / `derived` plus `dependencies` / `dependents` /
`stats` / `commitLog` / `explain` / `exportModel` / `readAt` / `snapshotAt` /
`subscribeCommits`: resolves from Rust (the §18A.3 FFI structural lift landed,
[`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)). The
only JS in the hot path is the user's own `derived()` compute lambda, which runs
in JS over the bridge callback **by design**. The Rust engine lives in
[`causl/causl-core-rs`](https://git.opsite.ca/causl/causl-core-rs), which also
owns the Python build/package tooling.

**There is no second engine and no degradation path.** As of **0.5.0**
(issue [#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280))
`createCausl()` is construct-or-throw: `await preloadCauslWasm()` once at app
init and it returns the wasm engine synchronously forever after; skip the
preload, or run on a host where WasmGC cannot instantiate, and it **throws**
during construction. The two options that used to pin the pure-TypeScript floor
— `engine: 'js-ssot'` and `backend: 'js'`: no longer exist, and neither does
the §18A.13.1 capability fallback that silently substituted the floor. The
authoritative statement of that release: the removed-surface inventory, the
failure contract and a numbered migration: is the `## [0.5.0]` section of
[`CHANGELOG.md`](./CHANGELOG.md).

**What "one engine" means.** It was once a claim about the
**adopter-reachable surface** alone: the pure-TypeScript closure
(`createCauslTs`) stayed declared in `packages/core/src/graph.ts` as the
structural closure every graph this package built sat inside, `rust-ssot`
included, while being absent from the package barrel and from all four declared
subpaths (`.`, `./internal`, `./testing`, `./wasm`). That qualifier is gone.
`del-final` (EPIC
[#275](https://git.opsite.ca/causl/causl-wasm-ts/issues/275), sub-task
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279)) deleted
`createCauslTs`, `commitInternal`, the structural facade and the
`injectedBackend` seam, so the TypeScript engine is off the surface **and** out
of the tree.
The two-engine topology: a TypeScript value-of-record floor, the differential
byte-identity oracle and the benchmarks: lives only in
[`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts), which stays
dual-engine and is now the organisation's only owner of that floor.

This repo (`causl/causl-wasm-ts`) is the **TypeScript API + Node loader** that
lets a TS/Node.js app integrate the placed `causl-wasm` artefact over FFI. It is
**not** a copy of the TS engine and ships **no Rust source** (§18A.4); the
authoritative produce-and-place build tooling (`build_wasm.py` /
`package_wasm.py`, §18A.11) lives in `causl/causl-core-rs`. (This repo does carry
one local dev convenience: `tools/wasm-build/build.mjs` / `pnpm wasm:build`;
which republishes the vendored artefacts by resolving the sibling `causl-core-rs`
checkout; it carries no Rust and is distinct from the authoritative producer.)
For the full Node-integration walkthrough: install, the `node:fs` loader,
artefact placement via `causl-core-rs`'s Python scripts, the read-identity
migration, and the perf ceiling: see
[`docs/integrating-causl-client.md`](./docs/integrating-causl-client.md).

---

## Development access

This is a private repository hosted on the self-hosted **Gitea** at `git.opsite.ca` (org `causl`); GitHub is a downstream mirror. Cloning the repo and installing the private `@causl` / `@iasbuilt` packages both require a Gitea account and a personal access token.

### Clone

```bash
# HTTPS — authenticate with your Gitea username and a token as the password
git clone https://git.opsite.ca/causl/causl-wasm-ts.git

# or SSH — add your key under git.opsite.ca → Settings → SSH / GPG Keys
git clone ssh://git@git.opsite.ca:2222/causl/causl-wasm-ts.git
```

Already have a GitHub clone? Repoint it at the Gitea primary:

```bash
git remote set-url origin https://git.opsite.ca/causl/causl-wasm-ts.git
```

### Private packages (`@causl/*`, `@iasbuilt/*`)

These scopes are served by Gitea's npm registry, not npmjs: needed whether you install this repo's dependencies or consume its published packages elsewhere. Create a token at **git.opsite.ca → Settings → Applications → Generate New Token** with the `read:package` scope, export it, and add the registry lines to your `~/.npmrc` (or a repo-root `.npmrc`):

```bash
export GITEA_PACKAGES_TOKEN=<your read:package token>
```

```ini
@causl:registry=https://git.opsite.ca/api/packages/causl/npm/
//git.opsite.ca/api/packages/causl/npm/:_authToken=${GITEA_PACKAGES_TOKEN}
@iasbuilt:registry=https://git.opsite.ca/api/packages/iasbuilt/npm/
//git.opsite.ca/api/packages/iasbuilt/npm/:_authToken=${GITEA_PACKAGES_TOKEN}
always-auth=true
```

Then install as usual: `pnpm install` (or `npm install`) resolves `@causl/*` and `@iasbuilt/*` from Gitea.

### Releases & published versions

- Releases / tags: https://git.opsite.ca/causl/causl-wasm-ts/releases
- Published package versions: https://git.opsite.ca/causl/-/packages

---

## Quickstart

The example in [SPEC §10](./SPEC.md#10-worked-example) is the gate for "the engine is real": two inputs, one derived value, one diamond derivation, one subscriber, two commits, three observed propagations. Everything else in the engine is downstream of getting this right.

```ts
import { createCausl } from '@causl/causl-wasm-ts'

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

The four invariants: atomic commit, dependency tracking, dynamic-dep cleanup, glitch-free diamond; fall out of this example. It is pinned as an acceptance test at [`packages/core/test/spec-10-worked-example.test.ts`](./packages/core/test/spec-10-worked-example.test.ts).

---

## Why does this need to exist?

The TypeScript / React ecosystem already has Redux, MobX, Jotai, Recoil, Zustand, Valtio, TanStack Query, XState, and a long tail of hooks-shaped variants. Each one is well engineered for the slice it owns. None of them (**none**) solves the problem causl is built for.

The problem is this: an application whose state is not a tree of values but a **live graph of facts whose derivations cascade**, where:

- A single user action invalidates dozens or hundreds of dependent values.
- Some dependencies change *which* inputs they depend on as state changes (dynamic dependencies).
- Async fetches can return after the dependency they were fetching against has already moved.
- Wrong update ordering produces visible-but-inconsistent intermediate UI states (glitches).
- The user is editing one part of the model while three other parts are recomputing from external feeds, server pushes, and other users' edits.
- A bug that corrupts dependent state is not a render bug: it's data corruption that ships to disk and to other users.

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

— or watched a 100-row tabular UI re-render the entire grid because a single cell's formula changed: you have hit the wall this library is for.

The existing libraries each handle a *piece*. Redux gives you transactional commits but no dependency tracking. MobX gives you dependency tracking but no transactional commits and no semantic glitch-freedom guarantee. TanStack Query gives you async safety but only for HTTP state. XState gives you statecharts but not a dependency engine. Jotai gives you fine-grained atoms but no story for cross-atom transactions or stale-async protection.

Causl is the library you reach for when *more than one of those concerns is true at the same time*. It is not a replacement for the others; it is a different shape of tool.

---

## What causl does differently

Eight commitments shape the library:

1. **A denotational semantic foundation.** A derived value's meaning is a mathematical function of its inputs at a given commit time: `Behavior a = GraphTime → a`. Glitch-freedom is then a *theorem*, not a scheduler trick. Most JS reactive libraries cannot define what their own values mean precisely enough to disagree with another implementation.
2. **Transactions as the only mutation boundary.** All writes happen inside `graph.commit(intent, tx => …)`. Outside, the graph is read-only. There is no concurrent-write API to misuse.
3. **Automatic dependency tracking with deterministic dynamic-dep cleanup.** A derivation that today reads `assetA` and tomorrow reads `assetB` no longer fires on `assetA` writes: proven by property-based tests, not promised by docs.
4. **One composite statechart for every lifecycle in the system.** Resource fetch, conflict status, transaction phases, and interaction modes share one chart with shared event vocabulary. No more parallel string enums sprinkled across object fields.
5. **Strict layering** between the user's information model, the editor's controller state (selection, drag-in-progress), and the engine's substrate. They live in separate identifier namespaces and separate packages.
6. **Discriminated-union state** everywhere optional fields would otherwise hide state machines. Impossible states cannot be represented; the type checker is the first reviewer.
7. **MVU-shaped application surface.** A typed `Msg` union dispatched through `update : Msg → Model → Commit`. Transactions are the engine room; messages are the front door.
8. **Pre-runtime race detection in CI/CD.** Two Rust-backed CI tools, both shipping today: `causl-check` is the static IR linter; twelve passes against the `CauslModel` IR (cycle, monotonic, glitch-propagation, subscribe-without-dispose, use-after-dispose, cross-graph-read, commit-from-subscribe, plus structural gates). `causl-enumerate` is the SPEC §16.4 bounded state-space enumerator; BFS over the §16.4.1 type surface (10-field `State`, 8-arm `Action`, phased `transition_phased` with per-step `events: Vec<Event>` and `phases: Vec<PhaseStep>`) with `Oracle::check(s, prev, a)` plugged into Tier-1/2/3 `Bound` presets. The Apalache differential runner (`tools/enumerator/diff/`) cross-checks the enumerator's verdicts against TLA+ counterexamples on the EPIC-7 corpus.

The public surface anchored by these commitments: the `Graph` interface; is the canonical seven-method API (`createCausl`, `graph.input`, `graph.derived`, `graph.commit`, `graph.read`, `graph.subscribe`, `graph.explain`) plus the in-flight extensions that have earned a slot by naming an unavoidable engine concept: `subscribeCommits` (a narrow per-fire notification capability for adapters that don't need the full log), `exportModel` (the bridge to the Rust race-detection toolchain; feeds both `causl-check` static IR linting and `causl-enumerate` bounded state-space enumeration), `simulate` (the §5 dry-run API; predict a commit's effect without advancing time, appending to the log, or firing subscribers; observer-invisible by construction), `snapshot`/`hydrate` (single-call SSR transfer that emits a `Commit` with `intent: 'hydrate'` so consumers wake), `readAt`/`snapshotAt` (time-travel devtools and replay-determinism testing, returning a `Retained | Evicted` discriminated union per the bounded retention contract), `commitLog` (realising the "transaction log is a `Behavior [Commit]`" promise as a subscribable derived node), and the `now` getter. Memory hygiene for long-lived processes is the `commitHistoryCap` knob, which **defaults to `0`, so retention is opt-in**: a long-lived process already has zero retention and passes nothing, while a caller who wants history passes both caps, `createCausl({ commitHistoryCap: 1000, snapshotRetentionCap: 1000 })`. There is no runtime flush, because firing `commitLog` subscribers outside a commit boundary would violate §5. Every addition is justified one-by-one against the rule "name the unavoidable concept the engine cannot express without it, or take the cost of growing every README and every consumer's mental model." The bar for a fifteenth surface item is the same as the bar for the first eleven.

---

## How causl compares

This table is honest about where the existing libraries are *strictly better* (✓), where they cover the concern in some form (~), and where the concern is missing (✗). The Causl column uses ✓ for what currently ships on `main` and `*` for in-flight or planned future work: see Status below.

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
- You need conflict records that survive the transaction that created them: not exceptions, *data*.
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
- **Not yet at 1.0.** Phases 1–4 ship on `main`; **v0.9.0 has shipped** (the wasm-only core is in: the real Rust engine is the sole engine, with the §18A.3 FFI lift landed and (since 0.5.0) no second engine and no fallback onto one, per §18A.13 and §18A.13.1's withdrawal; see Status below); APIs are stable but not version-locked.

---

## Status

> **Reading the issue numbers below.** A bare `#N` anywhere in this repository means
> [`causl/causl-wasm-ts#N`](https://git.opsite.ca/causl/causl-wasm-ts/issues) and nothing else. This
> repository is the third home of this text (`iasbuilt/causl` → `causljs/causl-ts` → here) and each
> move restarted the numbering, so a number from an earlier home is always written with the
> repository that owns it: `iasbuilt/causl#689`, `causljs/causl-ts#22`. Unqualified, those two would
> land on nothing and on an unrelated closed issue respectively.
> [`tools/reference-gate/check-issue-references.mjs`](./tools/reference-gate/check-issue-references.mjs)
> enforces it: `pnpm refs`, run by `.husky/pre-commit` and by
> [`main-fast.yml`](./.gitea/workflows/main-fast.yml), which DECLARES a run on every pull
> request, and which causl/causl-wasm-ts#409 moved into the root Gitea reads. It reads this
> repository's shipped documentation, both shipped source roots of `@causl/causl-wasm-ts` (`packages/core/src`
> **and** `packages/core/wasm`, the `./wasm` entry point) and the workflows. Read the file's
> "the watermark decays" note before refreshing its snapshot: every number this repository allocates
> retires a little of the rule, and a refresh can silently turn an upstream dangle into a collision.

The full specification lives in [the repo-root specification](./SPEC.md). Phased epics and sub-tasks live as Gitea issues. **Phases 1–4 have shipped on `main`, and v0.9.0 is out.** Phase 1 (semantic core), Phase 2 (React surface + spreadsheet demo), and Phase 3 (resources, conflicts, devtools inspection primitives) landed first; Phase 4 (the CI race-detection toolchain) wrapped via the Phase-8 SPEC compliance audit (umbrella `iasbuilt/causl#564` closed). Phase-5 perf experiment umbrella `iasbuilt/causl#679` closed 22/22 sub-issues (the scrolling-viewport 654× regression is resolved). Phase-6 WASM substrate epic `iasbuilt/causl#680` closed: all 17 Phase-0 + Phase-1 sub-issues are merged, including SPEC §17 commitment 13 (capability-cost residual band 3.0×–8.0×, `iasbuilt/causl#1024`) and commitment 14 (three-tier host matrix `wasmgc-builtins` / `wasmgc-classic` / `serde-json`, `iasbuilt/causl#1053`; two of those three tiers have since been retired, leaving `wasmgc-classic`, see SPEC §17.6's dated rider). Both Rust binaries; `causl-check` (static IR linter) and `causl-enumerate` (bounded state-space enumerator); are driven against the spreadsheet and async demos by workflows this repository declares and causl/causl-wasm-ts#409 moved into the root Gitea reads ([`docs/ci.md`](./docs/ci.md) carries the dated reading of what the forge does with them). See `four-way-classifier.yml` (the enumerator + Apalache differential cross-check, which is not in this repository) and [`.gitea/workflows/wasm.yml`](./.gitea/workflows/wasm.yml).

### Current state (post v0.9.0): the repository topology

Per the repository topology recorded in SPEC [§18A.10](./SPEC.md), the two-engine
**contract** spans three first-party `causl` repos, each owning one artefact and
none duplicating another's role. The two engines do not both ship from the same
repository, and the row for this one names **one artefact and one engine**:

- **`causl/causl-core-rs`**: the `causl-wasm` engine: the Rust core
  (`tools/engine-rs-core`) compiled to WebAssembly via the bridge
  (`tools/engine-rs-bridge`), the §18A.3 FFI surface, the byte-identity gate's
  Rust side, and the **Python build/package tooling** (`scripts/build_wasm.py` +
  `scripts/package_wasm.py`, §18A.11) that produces the node-target artefact and
  places it where a consumer states.
- **`causl/causl-wasm-ts`** (this repo): the **TypeScript API for
  `causl-wasm`**, and **one engine only**: `rust-ssot`. The thin TS binding of
  §18A.4 (a binding over the FFI, **not** a copy of the TS engine), the loader
  surface (the bundler-target lazy-instantiate path ships today; the
  consumer-side `node:fs` loader hook that resolves the placed `.wasm` is
  planned: §18A.2, see the SHIPPED-vs-PLANNED table below), and the adoption
  docs that let TS/Node.js web apps integrate it. Ships no Rust source, and
  since 0.5.0 ships **no adopter-selectable TypeScript engine and no fallback**
  onto one. Named integration consumers: `iasbuilt/xldatagrid` and
  `iasbuilt/webapp`.
- **`causl/causl-core-ts`**: `causl-ts`, the TypeScript
  value-of-record / §13.8 unconditional **floor**, and since 0.5.0 the
  organisation's **only** owner of it. Also the cross-backend
  benchmark/conformance harness (the §18A.1.1 byte-identity gate's JS side,
  which is differential and therefore cannot run in a one-engine repository)
  and the historical wasm-cutover R&D.

Within this repo:

- **The wasm engine is a real Rust engine, and it is the only engine.** The §18A.3 FFI structural lift landed ([`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)), so every adopter op resolves from Rust: orchestration in Rust, the user's `derived()` compute lambdas in JS over the bridge callback by design. The disclosure is repeated at the top of `packages/core/wasm/README.md`. `causl-wasm-ts` made wasm its default engine via a dated §18A.13 governance amendment that deliberately bypassed the §18A.7 promotion gate; §18A.13.1 briefly re-extended a TypeScript fallback to the implicit `createCausl()` path and was **withdrawn at 0.5.0**, so the fail-loud stance §18A.13 took is now the whole of it. Perf is explicitly immaterial (within the §14 RAIL budget).
- **The bundle budget gates green, and its ceilings come from one file.** [`tools/size-budget/js-budget.cjs`](./tools/size-budget/js-budget.cjs) is the single source of truth for the three JS `size-limit` cells; §14.2.2 pins them to a *leading* band a bounded distance above the §14.2 working target (28 KB since the 2026-08-03 amendment, 18 KB before it), rather than to whatever the bundle last measured. `pnpm size` exits 0. The `~2.5 KB over a 13 KB ceiling` overage this paragraph used to track was [`causljs/causl-ts#22`](https://github.com/causljs/causl-ts/issues/22), closed upstream against that repository's ceilings; this repository's come from the §14.2.2 reconciliation in issue #161 and no cell is over one. Per-cell numbers are under *Bundle-budget status* below.
- **Pre-commit ↔ CI parity landed upstream in [`causljs/causl-ts#25`](https://github.com/causljs/causl-ts/pull/25).** The full check union (typecheck, build, lint, size) now runs in `.husky/pre-commit`; the bundler-interop matrix moved to `.husky/pre-push`. See the *Pre-commit / pre-push hooks* subsection above. The vendor-manifest gate that used to sit in this union was deleted by issue #424: its subject lives in the sibling `causljs/causl-org` checkout, which CI here can never see.

What that means concretely for adopters:

- The semantic core (atomicity, glitch-freedom, dynamic-deps, replay determinism, cycle detection) is held by 1000-trial property suites under `packages/core/test/properties/`.
- The React surface (`useCausl`, `useDispatch`, `useCauslFamily`, Suspense + SSR) ships and is tested under StrictMode mount/unmount cycles; the `idle`-resource Suspense contract was locked in by `causljs/causl-ts#17` / `causljs/causl-ts#7`.
- `@causl/causl-wasm-ts` 0.3.0 carries the runtime `invariant` callback on `graph.input(id, initial, { invariant })` added in `causljs/causl-ts#2` / `causljs/causl-ts#1`.
- The `causl/no-graph-upcast` ESLint rule (`causljs/causl-ts#15` / `causljs/causl-ts#9`) is the third gate in the S-3 layering enforcement chain: `as Graph` upcasts that erase capability narrowing are now lint errors, not review notes.
- The cross-backend determinism property test (`packages/core/test/properties/cross-backend-determinism.property.test.ts`) was refreshed by `causljs/causl-ts#16` / `causljs/causl-ts#6` to drop the stale Phase-1 TODO and wire World-pairing through the Graph facade.
- The full Rust race-detection toolchain ships out of the dedicated race-detection repos: `causl-check` (the static IR linter + `causl-enumerate` bounded enumerator, in [`causl/causl-check`](https://git.opsite.ca/causl/causl-check)); and runs against the spreadsheet + async demos. This repo's `tools/apalache-diff/` is the TLA+ differential surface that consumes those enumerator verdicts.

#### The §18A.7 promotion gate: the bypass, and where it stands now (§18A.13)

The **org-wide** §18A.7 promotion narrative is five GO/NO-GO criteria that gate
promoting the wasm engine to default **over a TypeScript floor**. It still
governs the fork (`causl-core-ts`), which stays dual-engine and therefore still
has a floor to be promoted over.

**The governance position of this repository, stated as it stands today.** A
dated §18A.13 amendment deliberately bypassed §18A.7 and shipped wasm as the
sole production default, on **complexity-elimination** grounds: perf explicitly
immaterial, within the §14 RAIL budget. That bypass was granted for a **two-engine
roster**, and as of 0.5.0 that roster no longer exists here: there is one engine,
so four of the five criteria have nothing left to compare, and the fifth
(Criterion 5, "the TypeScript floor stays supported and byte-identical") is not
merely unmet but **withdrawn for this repository**: deliberately, by §18A.13,
and finished by the 0.5.0 removal. The honest reading is therefore **not** "the
gate is still pending here". It is: *the gate is inapplicable to a one-engine
distribution, the bypass that made that state reachable is named and dated, and
the conformance proof it would have produced is preserved in
`causl/causl-core-ts` rather than re-derived here.*

Two consequences a reader should take from that rather than infer:

- **The §18A.1.1 differential byte-identity oracle cannot run in this
  repository.** It compares two engines; this repository ships one. It runs in
  `causl/causl-core-ts`, against a frozen golden-vector corpus captured before
  the cut. Removing the TypeScript engine from this distribution did not remove
  the proof of correctness from the organisation, and the place to check the
  proof is that repository.
- **Re-acquiring a floor here would be a governance act, not a flag.** There is
  no option, no `catch`-and-degrade, and no build mode that restores one. The
  §18A.7 criteria are the shape such a decision would have to take, which is why
  they are kept in the SPEC rather than deleted with the roster they gated.

The five criteria, for reference, read against this repository as it stands:

1. **Correctness: cross-backend byte-identity** (MECHANICAL). Proven by the
   1000-trial per-flush gate: **run in the fork**, which keeps both engines.
   Not runnable here.
2. **Completeness: full FFI surface** (MECHANICAL). Every §12.1 canonical-seven
   + §12.2 second-tier row is reachable over FFI with no JS-engine fallback for
   any row: the §18A.3 lift that **landed**
   ([`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)).
   This one is met, and it is the criterion that made a one-engine distribution
   possible at all.
3. **Performance** (MECHANICAL). Single commit ≤ 250 µs p95 marshal overhead;
   batch / large mutation ≤ 5 ms p95. `causl-wasm-ts` does **not** treat perf as a
   promotion gate: it stays within the §14 RAIL responsiveness budget, which is
   the bar that matters for the adopter.
4. **Node target + real-world adoption** (MECHANICAL artefact + adopter
   attestation). The `--target nodejs` artefact + ESM/`node:fs` loader ships
   (§18A.2).
5. **TypeScript-floor maintained** (MECHANICAL + DESIGN-DISCIPLINE). **Sunset
   for `causl-wasm-ts` and retained for `causl-core-ts`.** The floor this
   criterion protects is the one 0.5.0 removed from the adopter-reachable
   surface here; the accepted cost: hosts below the declared engine floor
   (stated once on `WASM_HOST_FLOOR` in
   `packages/core/src/wasm-registry.ts`, causl/causl-wasm-ts#426) now
   hard-fail: is recorded in SPEC §18A.13.1 and in the `## [0.5.0]`
   CHANGELOG entry.

#### Integrate `causl-wasm` + `causl-wasm-ts` into your Node.js app

Your application programs against the §12 `Graph` surface only: never against
an engine. `causl-wasm-ts` ships **one engine**: the Rust→WebAssembly engine is
what is behind that surface, and there is nothing else behind it.
**`causl-wasm` + `causl-wasm-ts`
are the Enterprise-tier path.** Two repos cooperate, and the boundary is the
placed artefact:

**Producer side: build & place the artefact (Enterprise).** The producer repo
[`causl/causl-core-rs`](https://git.opsite.ca/causl/causl-core-rs) owns the Rust
engine plus two **stdlib-only Python 3 scripts** (no `pip install`, no Node;
drops into any CI/CD pipeline: §18A.11). It builds the size-optimised
`--target nodejs` `.wasm` **once** and places it, with a version + per-file
sha256 manifest, where the consuming app states:

```sh
# BUILD half — needs a Rust toolchain (cargo ≥1.89, wasm-pack 0.14, wasm-opt ≥119).
# --bridge picks the string strategy: gc-classic → classic-strings (UTF-16
# fallback, and the only one left; gc-builtins was retired by
# causl/causl-core-rs#355).
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
consuming app needs only **CPython stdlib and a checksum to vendor**: **never a
Rust toolchain**.

The package step also drops the **compute-imports snippet** next to the `.wasm` /
`_bg.js` and **fails loud** (`build_wasm.py` / `package_wasm.py` assert, never
warn) on three things: the §18A.12 sync seam is present (the `new
WebAssembly.Instance` construction path), the compute-imports snippet is present,
and the artefact is node-loadable. Node-loadability is **bridge-specific**:
`gc-classic` loads as `--target nodejs`. The `gc-builtins` variant emitted
`require("wasm:js-string")`, which stock Node can't resolve, so it was
bundler-target only; causl/causl-core-rs#355 retired it outright, because its
`wasm:js-string` imports are i32-typed and cannot bind the externref-typed
builtins on any host (causl/causl-core-rs#210).

**Consumer side: install `@causl/causl-wasm-ts`, load over `@causl/causl-wasm-ts/wasm`.** The
published package is **`@causl/causl-wasm-ts`** (`causl-wasm-ts` is the repo name, which now
matches the package). Node ≥ 22, ESM-only:

```bash
npm install @causl/causl-wasm-ts        # or: pnpm add @causl/causl-wasm-ts
```

```ts
// app boot (main.tsx / a top-level loader), ONCE, before the first graph.
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'
await preloadCauslWasm()          // compile + cache the WebAssembly.Module

// thereafter, anywhere — synchronous, no per-render await.
import { createCausl } from '@causl/causl-wasm-ts'

try {
  const graph = createCausl()     // the wasm engine, or a throw
} catch (err) {
  // Branch on `code`, never on `instanceof`: the never-imported case is
  // thrown by a leak-free twin class in the main bundle, which cannot
  // extend a `/wasm` class.
  switch ((err as { code?: string }).code) {
    case 'CAUSL_WASM_NOT_PRELOADED':      // fix the boot ordering
    case 'CAUSL_WASM_ENGINE_UNAVAILABLE': // import the subpath, or the host
      report(err)                         // cannot run the engine at all
      break
    default:
      throw err
  }
}
```

The wasm seam lives behind the `./wasm` subpath export: importing the bare
`@causl/causl-wasm-ts` does **not** pull the wasm chunk, and only an explicit
`import … from '@causl/causl-wasm-ts/wasm'` pays that cost. There is no
`backend` option and no engine to hand to `createCausl()`: the subpath
registers the engine at import time and `createCausl()` reaches it through that
runtime slot, which is what keeps the main bundle engine-agnostic (the
no-wasm-leak gate).

**`loadWasmBackend(options?)` is not the adopter path to the Rust engine, and
its own doc comment says so.** It returns a legacy `BackendEngine` shim that
wraps a plain TypeScript closure and does **not** attach the wasm exports or
enable the authoritative engine; it exists for the cross-backend determinism
gate and the snapshot/hydrate round-trip, where a SPEC-faithful oracle is the
point. An adopter reaching the Rust engine goes through `preloadCauslWasm()` and
the authoritative construct: never through this loader. Its honoured options
are `bridge` (`'wasmgc-classic'`; `'wasmgc-builtins'` is retired and refused),
`wasmBaseUrl` (CDN/CSP
override), `fetch`, `graphName`, `batchedFlush`, `commitHistoryCap` and
`snapshotRetentionCap`; the `engine` option it used to take was removed in 0.5.0
with the `WasmEngineMode` union it selected from.

**The factory surface: and the sync separation (§18A.12, shipped).** From a
consumer's perspective the wasm engine is now **synchronous to construct**. The
one unavoidable async (the `WebAssembly.compile`) is split off from
construction so the single `await` lives at app init, never at a render or hook
call site:

- `createCausl(options?): Graph`: the **default public factory**, and since
  0.5.0 **construct-or-throw**. It returns the **real wasm engine**
  (synchronously) once `preloadCauslWasm()` has resolved for the default bridge,
  and otherwise throws during construction: `CauslWasmNotPreloadedError`
  (`CAUSL_WASM_NOT_PRELOADED`) when the subpath is imported but nothing is
  preloaded, `WasmEngineUnavailableError` (`CAUSL_WASM_ENGINE_UNAVAILABLE`)
  when the subpath was never imported or when the host cannot instantiate
  WasmGC. It never returns a graph on any other engine, and there is no option
  that makes it degrade to one. The §18A.3 FFI lift has **landed**
  ([`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)),
  so every adopter op resolves from Rust under rust-ssot. `createCauslTs`
  stopped being a public engine choice at epic #31 / #34 and no longer exists at
  all: `del-final` (EPIC
  [#275](https://git.opsite.ca/causl/causl-wasm-ts/issues/275), sub-task
  [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279)) deleted the
  closure from the source tree.
- `await preloadCauslWasm(opts?)`: **the one async seam, called once** at
  app/init. Compiles + caches the `WebAssembly.Module` (plus the `_bg.js` sidecar
  and the compute-imports snippet), keyed by bridge. Idempotent: concurrent calls
  share one compile; a transient failure drops the cache entry for retry.
  Companions `isCauslWasmPreloaded(bridge?)` / `getPreloadedCauslWasm(bridge?)`
  peek the *resolved* state synchronously.
- `createCauslWasmSync(handle?, create?): Graph`: **fully synchronous** (a fresh
  `new WebAssembly.Instance` from the cached `Module`, zero `await`). With nothing
  preloaded for the bridge it throws `CauslWasmNotPreloadedError`, naming
  `preloadCauslWasm()`. That is the only behaviour: the `{ fallbackToTs: true }`
  soft path that used to return a TypeScript graph instead of throwing was
  removed in 0.5.0 rather than ignored, because honouring it against an engine
  this distribution no longer ships would reintroduce the silent-divergence hole
  the release closes. A silent TS↔wasm swap diverges in `read()`-identity and
  commit-clock, so the §18A loud-fail discipline is now the whole contract.
- `createCauslWasm(opts?): Promise<Graph>`: **retained**, now re-expressed as
  `preload ∘ createCauslWasmSync` (one instantiate codepath, provably no drift).

This is what lets **sync consumers**: React hooks/render, `iasbuilt/xldatagrid`;
build a wasm graph with **no `await` at the call site**: the single `await` is
hoisted to bootstrap, outside any commit envelope (Theorem 2's single-tick
invariant is untouched). On Node/SSR the `--target nodejs` glue is synchronous at
require-time, so `createCauslWasmSync` works with **no prior preload**: server
render stays synchronous end-to-end; only the **browser bundler target** needs the
one-time `await preloadCauslWasm()` before the first render that constructs a wasm
graph. The `createCauslWasm()` / `createCauslWasmSync()` factories are
exported from this repo's own `@causl/causl-wasm-ts/wasm`
([`packages/core/wasm/index.ts`](./packages/core/wasm/index.ts)): and from the
[`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts)
fork of `@causl/causl-wasm-ts/wasm` that wasm-capable consumers link against. Use whichever
your linked `@causl/causl-wasm-ts` exposes.

**Node-target status: SHIPPED (be precise).** On Node today:

| Capability | Status |
| --- | --- |
| Producer `--target nodejs` build + placement (`build_wasm.py` / `package_wasm.py`, sha256 manifest) | **SHIPPED** (§18A.11) |
| Sync construction seam: `preloadCauslWasm()` + `createCauslWasmSync()` (one `await` at init, sync at every call site) | **SHIPPED** (§18A.12; in the fork *and* in `causl-wasm-ts`) |
| Consumer `@causl/causl-wasm-ts/wasm` loader, bridge picker, instantiate path | **SHIPPED** (epic `iasbuilt/causl#680`) |
| Engine runtime = the **real `engine-rs-core` Rust engine** compiled to WebAssembly; every adopter op resolves from Rust | **SHIPPED**: §18A.3 FFI lift landed ([`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)) |
| Multi-instance isolation via `engine_id` multiplexing | **SHIPPED** |
| `read()` reference identity is **not** contractual | **SHIPPED** (§18A.5); memoise on `graph.stats().nodeVersion(node)` / `commit.time`, never on the read reference. This row used to say `read()` returns a fresh object per call. That is false: measured on the shipped artefact, a repeated read of an unchanged container returns the SAME reference, and it is the caller's own live, unfrozen object. The hazard is mutating it, not memoising on it. [`docs/wasm-adoption-guide.md`](./docs/wasm-adoption-guide.md) §H1 states the contract; `packages/core/test/read-identity-contract-405.test.ts` pins it ([causl/causl-wasm-ts#405](https://git.opsite.ca/causl/causl-wasm-ts/issues/405)). |
| `rust-ssot`: the one engine | **SHIPPED**; the production engine, and since 0.5.0 the only one. The `engine` option that used to select between it and a TypeScript reference was **removed**; there is no second canonicality left to name. |
| Single-engine roster: `createCausl()` returns the engine or **throws** | **SHIPPED at 0.5.0**; the §18A.13.1 implicit-path capability fallback is **WITHDRAWN**, not deprecated. See the failure contract in the `## [0.5.0]` [`CHANGELOG.md`](./CHANGELOG.md) entry. |
| Hosts below the declared engine floor (`WASM_HOST_FLOOR` in `packages/core/src/wasm-registry.ts`, causl/causl-wasm-ts#426) hard-fail | **REFUSED AT THE PROBE; UNMEASURED AT THE BOUNDARY**: causl/causl-wasm-ts#426 replaced the `detectBridge()` placeholder (`iasbuilt/causl#691`) with a real probe that validates the artefact's measured minimal feature set (typed function references plus four baseline features; the artefact declares zero WasmGC heap types, `test/host-failure-contract-275.test.ts` cell (A)). A below-floor host meets the typed refusal at the probe, or the compile/instantiate failure through the same class and `code` when the bridge is pinned. Still outstanding: a run on a real host at the version boundary (`DISTRIBUTION.md` §7.3). |
| Literal zero-TS core (deleting `createCauslTs` from the source tree) | **LANDED**: `del-final`, EPIC [#275](https://git.opsite.ca/causl/causl-wasm-ts/issues/275) sub-task [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279). `createCauslTs`, `commitInternal`, the structural facade and the `injectedBackend` seam are out of the tree. The §12 conformance reference is now the frozen golden-vector corpus plus the differential oracle in [`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts). |

So today: the **producer node-target tooling and the consumer loader are real and
shipped**, and the engine they reach is the **real Rust `engine-rs-core`**:
orchestration in Rust, the user's `derived()` compute lambdas in JS over the
bridge callback. Per-commit wall-time stays inside the §14 RAIL responsiveness
budget; perf is **not** the reason this engine ships. The full walkthrough
(install, the loader hook, the read-identity migration, and the perf ceiling)
lives in
[`docs/integrating-causl-client.md`](./docs/integrating-causl-client.md); the
seam-level disclosure and option reference are in
[`packages/core/wasm/README.md`](./packages/core/wasm/README.md) and
[`docs/wasm-adoption-guide.md`](./docs/wasm-adoption-guide.md).

#### `causl-wasm-ts` ships one engine (SPEC §18A.13, and §18A.13.1's withdrawal at 0.5.0)

A dated governance amendment ([§18A.13](./SPEC.md)) records the **committed and
now-executed** direction for this repo: distinct from the §18A.7 promotion gate
above, which it deliberately bypasses. **Scoped to `causl-wasm-ts` only:** this
distribution ships a **wasm-only core**. `createCausl()` **returns the wasm
engine** (synchronously, via the §18A.12 `preloadCauslWasm()` +
`createCauslWasmSync()` split: one `await` at app init, sync `createCausl()` at
every render/hook site thereafter) **or it throws**, and the pure-TS
`createCauslTs()` engine is **not on the `causl-wasm-ts` surface at all**.
Consumers calling `createCausl()` keep their call sites **unchanged** and get
wasm (e.g. `iasbuilt/xldatagrid`'s sync `createCausl()` sites need no async
refactor: just one `await preloadCauslWasm()` at boot; from 0.5.0 that `await`
is required rather than merely recommended). The driver is
**complexity-elimination** (collapsing the dual-engine roster) with perf
**explicitly accepted as immaterial** here (never a gate); this is not a promotion
on performance grounds.

**SPEC §18A.13.1 (2026-06-23) briefly reversed the fail-loud stance for the
implicit path, and was withdrawn at 0.5.0.** For roughly six weeks
`createCausl()` degraded to the internal TypeScript engine on a host where
WasmGC could not instantiate. That fallback is **gone**: removed by issue
[#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280), not deprecated:
and §18A.13.1 now reads as a dated withdrawal amendment. The reason it was
withdrawn is worth stating rather than leaving to the amendment: the fallback
engine and the primary **disagree**
([#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272), in-place mutation
of a committed value, a §18A.1.1 MUST-be-identical surface), and a fallback that
answers differently from the primary is worse than no fallback. The accepted cost
is a **dropped host tier**: hosts below the declared engine floor (stated once
on `WASM_HOST_FLOOR` in `packages/core/src/wasm-registry.ts`,
causl/causl-wasm-ts#426) now hard-fail at `createCausl()`, with no flag
that restores the old behaviour. `onCauslCapabilityFallback` and its event types
remain exported, `@deprecated`, and **never fire**; they are deleted at 0.6.0.

The **public** strip shipped **2026-06-20** (epic
[#31](https://git.opsite.ca/causl/causl-wasm-ts/issues/31)), executed
**wire-before-cut**: [#32](https://git.opsite.ca/causl/causl-wasm-ts/issues/32) WIRE
(port the authoritative loader) → [#33](https://git.opsite.ca/causl/causl-wasm-ts/issues/33)
FLIP (`createCausl()` → wasm, sync) → [#34](https://git.opsite.ca/causl/causl-wasm-ts/issues/34)
CUT (un-export `createCauslTs`). The **§18A.3 FFI structural lift has since
landed** ([`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)):
every adopter op resolves from Rust, with the user's `derived()` compute lambdas
running in JS over the bridge callback by design. The **literal zero-TS core**:
`del-final`, deleting `createCauslTs`, `commitInternal`, the structural facade
and the `injectedBackend` seam from the source tree: **has landed** under EPIC
[#275](https://git.opsite.ca/causl/causl-wasm-ts/issues/275), sub-task
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279). The TypeScript
closure is out of the tree, not merely unreachable, so "one engine" is no longer
a statement about the surface alone. The two costs #275 accepts are recorded there rather than
rediscovered: losing the in-repo TS-vs-Rust differential, and dropping the host
tier above. The
§18A.1.1 cross-backend byte-identity oracle is differential and needs two
engines, so it **cannot run inside `causl-wasm-ts`**: it is **preserved in
[`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts)**,
which keeps `causl-ts` + the byte-identity harness (it is the differential oracle
and benchmark repo) plus a frozen golden-vector corpus captured before the cut.
**The fork stays dual-engine; `causl-wasm-ts` ships one engine.** Removing
`causl-ts` from this repository does not remove the proof of correctness from the
org, and does not remove the TypeScript engine from the org either: it leaves
`causl/causl-core-ts` as its only owner.

Pre-1.0 caveats remain: public APIs may evolve before a tagged release; published-package tooling is a separate epic. The closing section of the specification enumerates the eight team commitments the repo is held against; semantic foundation lands first; the composite statechart is drawn before conflict and resource code is written; the model/controller/engine layering is enforced at the package boundary; every discriminated union carries an exhaustiveness check; the race-class catalogue is kept current; the worked example is the gate for "the engine is real"; no enum tags ship whose transitions are unspecified; and the Rust race-detection toolchain (`causl-check` + `causl-enumerate`) ships as a required CI gate. CONTRIBUTING.md documents how each commitment is enforced.

---

## Packages

| Path                        | Package                  | Role                                                                                   |
| --------------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `packages/core/`            | `@causl/causl-wasm-ts`   | Engine: Behaviors, derivations, transactions, snapshot/hydrate, retention, explain. Also exposes the opt-in `/wasm` subpath. |
| `packages/react/`           | `@causl/react`           | React bindings: `useCausl`, `useDispatch`, `useCauslFamily`, MVU runner, SSR.          |
| `packages/sync/`            | `@causl/sync`            | Async resources + conflict registry as composed statecharts.                            |
| `packages/formula/`         | `@causl/formula`         | Spreadsheet patterns *on top of* the core: formulas, ranges, cycles.                   |
| `packages/persistence/`     | `@causl/persistence`     | Persisted-input adapter with structured `PersistenceError` reporting.                   |
| `packages/devtools/`        | `@causl/devtools`        | Inspection primitives (explain materialisation, liveDerivation, snapshot, statechart).  |
| `packages/devtools-bridge/` | `@causl/devtools-bridge` | Redux DevTools Extension protocol bridge (zero-cost when absent).                       |
| `packages/migration-check/` | `@causl/migration-check` | Migration drift detector: flags unmigrated Jotai/MobX/Redux patterns in adopters.      |
| `packages/hypothesis/`      | `@causl/hypothesis`      | Hypothesis combinators + state-space hooks (Apalache differential surface).             |

**This table pins no version, for the same reason the publish table below does
not.** It carried a `Version` column until `causl/causl-wasm-ts#266`, and every
one of its nine rows was stale: `@causl/causl-wasm-ts` read `0.3.0` while
`0.3.7` was the published `latest`, and the other eight sat one to five releases
behind their own `package.json`. A literal semver in prose has nothing keeping
it true: which is the finding `causl/causl-wasm-ts#274` recorded when it took
the same column out of the publish table, and this table is where that sweep
stopped short. Read the shipped version off the registry, or off the **`release`
branch's** `packages/<name>/package.json`.

`@causl/causl-wasm-ts` runs ahead of the adapter and tooling tier because it has
absorbed race-class catalogue refinements those packages have not yet had to
chase; an adapter takes a breaking change when it has one of its own to ship,
not to stay in step with the engine.

Internal-only workspace siblings:

- `packages/core/testing/`: published as `@causl/core-testing-internal`; shared property-test seam helpers.
- `packages/sync-testing-internal/`: `@causl/sync-testing-internal` (currently `0.0.0`); fc.Arbitrary generators for the resource/conflict event vocabulary, consumed by the sync property suites.

The `causl-wasm` engine source: the Rust core (`engine-rs-core`), the FFI
bridge (`engine-rs-bridge`), and the Python build/package tooling: lives **out
of this repo** in [`causl/causl-core-rs`](https://git.opsite.ca/causl/causl-core-rs)
(SPEC §18A.10). The `causl-ts` floor and the experimental
`DEFAULT_WASM_ENGINE_MODE=rust-ssot` + shared-memory-worker R&D live in
[`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts).
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
| [`tools/release/`](./tools/release/) | `release.py`: bundles the minimum-viable per-package npm tree at `RELEASE_VERSION` for the TypeScript-only path. Output ships on the `release` branch. |
| [`tools/apalache-diff/`](./tools/apalache-diff/) | Apalache differential runner that cross-checks the bounded enumerator against the EPIC-7 TLA+ corpus. The Rust enumerator + checker crates themselves live in [`causl/causl-check`](https://git.opsite.ca/causl/causl-check); this directory holds the TS-side harness that consumes their verdicts. |
| [`tools/audit/`](./tools/audit/) | Governance / commitment-audit tooling (`pnpm audit:commitments`). |
| [`tools/drift/`](./tools/drift/) | Drift-telemetry helpers consumed by `@causl/migration-check`. |
| [`tools/eslint-plugin-causl/`](./tools/eslint-plugin-causl/) | ESLint plugin for causl-aware lint rules (e.g. `causl/no-graph-upcast` from `causljs/causl-ts#15` / `causljs/causl-ts#9`). |
| [`tools/lint/`](./tools/lint/) | Project lint helpers (orchestrates `eslint-plugin-causl`, prettier, custom passes). |
| [`tools/lint-fixtures/`](./tools/lint-fixtures/) | Fixture corpus for the lint rules. |
| [`tools/docs-postprocess/`](./tools/docs-postprocess/) | TypeDoc / Markdown post-processing for the docs pipeline. |
| [`tools/migrate-ir-2-to-3.ts`](./tools/migrate-ir-2-to-3.ts) | One-shot CauslModel IR schema-3 migration codemod. |

The `causl-wasm` Rust engine (`engine-rs-core` + `engine-rs-bridge`) and the
Python build/package tooling (`scripts/build_wasm.py` + `scripts/package_wasm.py`)
live in [`causl/causl-core-rs`](https://git.opsite.ca/causl/causl-core-rs) (SPEC
§18A.10); the `causl-check` static IR linter and `causl-enumerate` bounded
enumerator run from the race-detection toolchain. This repo
(`causl/causl-wasm-ts`) carries the **TypeScript API + Node loader** over that
engine, the TypeScript packages, the per-PR bundle-budget gate, the TLA+
differential runner, and the lint plugin: and ships no Rust source.

---

## Development setup

### Prerequisites

| Tool        | Version          | How to install                                |
| ----------- | ---------------- | --------------------------------------------- |
| Node.js     | 24.x (LTS Krypton) | Use [`nvm`](https://github.com/nvm-sh/nvm): `nvm install` reads `.nvmrc` |
| pnpm        | 10.x             | `corepack enable` (Node ships Corepack), or `npm i -g pnpm@10` |
| Rust        | stable           | [`rustup`](https://rustup.rs): only required to work on `tools/checker/` |

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

Husky is wired up via the root `prepare` script (`husky` install runs on `pnpm install`). [`causljs/causl-ts#25`](https://github.com/causljs/causl-ts/pull/25) replaced the previous "lint-staged only" hook with the **full CI-check union** so passing locally implies passing CI:

- **`.husky/pre-commit`** runs, in order: `lint-staged` (eslint --fix on staged TS) → `pnpm typecheck` → `pnpm build` → `pnpm lint` → the reference gate → `pnpm size` → the testing-types pack-and-typecheck (`scripts/check-core-testing-types.sh`). The vendor-manifest step was deleted by issue #424: `causl-org/` is a gitignored symlink to the sibling site checkout, so no vendor byte can be staged in this repository and the step could never fire on one.
- **`.husky/pre-push`** runs the `e2e/bundler-interop/` matrix (`webpack5-app`, `vite5-app`, `esbuild-app`): `npm install --no-save` → `npm run build` → `npm run verify`. Mirrors `wasm.yml`'s `bundler-interop` CI job; the gate is the **bundle-no-wasm-leak invariant**; each fixture's `verify.mjs` asserts the main chunk contains neither `loadWasmBackend` nor `WasmBackendUnavailableError` and that some other chunk does ([`webpack5-app/verify.mjs:55`](./e2e/bundler-interop/webpack5-app/verify.mjs), [`vite5-app/verify.mjs:46`](./e2e/bundler-interop/vite5-app/verify.mjs), [`esbuild-app/verify.mjs:49`](./e2e/bundler-interop/esbuild-app/verify.mjs)). It was specified as `iasbuilt/causl#689`, whose tracker did not survive the move here; the fixtures are the specification now.

Escape hatches: `SKIP_PRECOMMIT=1` / `SKIP_PREPUSH=1` env vars, or the standard `git commit --no-verify` / `git push --no-verify`.

### Bundle-budget status

The `size-limit` cells in [`.size-limit.cjs`](./.size-limit.cjs) gate dist-bundle ceilings on every PR; the three JS ceilings are read from the [`tools/size-budget/js-budget.cjs`](./tools/size-budget/js-budget.cjs) SSOT so the config and the prose cannot drift from each other. The measurements below are not remembered either: they are read out of the committed capture at [`tools/size-budget/runs/reference.json`](./tools/size-budget/runs/reference.json) (`pnpm size:capture`), and [`documented-ceilings.test.mjs`](./tools/size-budget/__tests__/documented-ceilings.test.mjs) fails when this prose and that capture disagree in either direction. That gate now runs on every `main` PR; until EPIC #275's W7 ([#282](https://git.opsite.ca/causl/causl-wasm-ts/issues/282)) wired it in, the three `tools/size-budget/__tests__` suites were a package script no workflow and no hook invoked; which is how this section came to print 17.7 / 15.69 / 19.85 KB for cells measuring 19.58 / 17.56 / 20.54 kB. Current caps, with the captured measurement per cell. They sit inside §14.2's **25-40 KB** shipping band (amended from 15-30 KB on 2026-08-03, causl/causl-wasm-ts#352, together with the +10 KB ceiling raise):

- `@causl/causl-wasm-ts` (full import) ≤ **30 KB**: 5.04 KB, from the committed capture of this tree. It was 20.49 KB before the selectors came out (causl/causl-wasm-ts#280) and 19.56 KB immediately after; the per-cell drop across THAT window is recorded in [`tools/size-budget/runs/DELTA.md`](./tools/size-budget/runs/DELTA.md), which measures it and not this one. The step from 20.06 KB to 5.04 KB is later and larger: causl/causl-wasm-ts#279 slices S12 and S13 struck `createCauslTs`, `commitInternal`, the structural facade and the `injectedBackend` seam out of the tree, so the main bundle stopped carrying a second engine at all. This capture is the first taken on that tree.
- `@causl/causl-wasm-ts` (createCausl-only) ≤ **26 KB**: 1.83 KB, from the committed capture of this tree (18.52 KB before the selector deletion, 17.6 KB immediately after, 18.09 KB at the previous capture, and 1.83 KB now that causl/causl-wasm-ts#279 S12/S13 has landed). The tightest cell by design: the minimal import is the one the budget defends hardest. It was **over** its previous 16 KB ceiling from before the #255/#275 campaign (16.05 KB at `67f66a2`) until causl/causl-wasm-ts#352 raised the band, and nothing went red the whole time; `bundle-budget.yml` runs only on `release`.
- `@causl/causl-wasm-ts/wasm` (Phase-1 loader + WasmBackend wrapper) ≤ **32 KB**: 23.11 KB, from the committed capture of this tree (21.04 KB before the selector deletion, 20.57 KB immediately after, 20.86 KB at the previous capture). This is the one cell that GREW across causl/causl-wasm-ts#279 S12/S13, and it grew for the reason the other two shrank: the operations the deleted TypeScript engine used to answer are now answered over the FFI, so the code that marshals them lives here rather than in the main bundle. It is still 8.89 KB under its ceiling. Not one of the four §14.2.2-named cells; it is the §18A loader chunk, externalised from the main bundle, so as of 2026-08-02 it leads a target of its **own** (`WASM_LOADER_TARGET_BYTES`, 30 KB since causl/causl-wasm-ts#352, + the same 2 KB bound) rather than borrowing the main bundle's 18 KB; the number it was externalised to stay out of. This bullet said `≤ 20 KB` after that change landed and `tools/size-budget/__tests__/documented-ceilings.test.mjs` was red on it.
- WASM artefact ceilings are two layers: the per-bridge raw + Brotli budgets the build driver enforces (`rawBudgetBytes` / `brotliBudgetBytes` in [`tools/wasm-build/build.mjs`](./tools/wasm-build/build.mjs)), and the redundant raw-byte `size-limit` cells in `.size-limit.cjs`. The vendored `.wasm` artefacts are republished by this repo's local stub builder `tools/wasm-build/build.mjs` (`pnpm wasm:build`), which carries **no Rust of its own**; it resolves the sibling `causl/causl-core-rs` checkout (via `CAUSL_WASM_PATH` or the conventional `../causl-core-rs` layout), runs `wasm-pack` + `wasm-opt -Oz` per bridge, and lands the optimised artefacts into `packages/core/wasm-pkg/`. The authoritative producer tooling (`build_wasm.py` / `package_wasm.py`, which build + place from Rust source with a sha256 manifest) lives in `causl/causl-core-rs` (§18A.11); `tools/wasm-build/` is a local dev convenience, distinct from that producer.

Upstream history, on the TypeScript fork this text arrived with: [`causljs/causl-ts#21`](https://github.com/causljs/causl-ts/pull/21) dropped the dangling bench-fixture size-limit cells (closing [`causljs/causl-ts#19`](https://github.com/causljs/causl-ts/issues/19)) and [`causljs/causl-ts#14`](https://github.com/causljs/causl-ts/pull/14) re-enabled the per-PR bundle-budget comment workflow. Those numbers are **not** this repository's; `causl/causl-wasm-ts#14` and `#19` are unrelated issues here.

---

## Try it live

The interactive playground + spreadsheet demos that load `@causl/causl-wasm-ts` from esm.sh ship out of the [`causljs/causl-org`](https://github.com/causljs/causl-org) static-site repo, hosted at `https://causl.org`. The `@causl/causl-wasm-ts` build this repo publishes is exactly what those demos pull at runtime, so a local `pnpm build` is enough to dogfood adopter-shaped imports.

---

## Enterprise distribution: private Gitea npm registry

The `@causl/*` packages are distributed to adopters through the **npm package
registry built into the self-hosted Gitea** this repository lives on:
**`https://git.opsite.ca/api/packages/causl/npm/`** (owner: the `causl` org).
The interim Verdaccio host was **retired at 0.3.6**: see the CHANGELOG entry
for that release. Nothing publishes to it and nothing resolves from it.

The registry is **private**: the `causl` org is private, so both *read* and
*publish* require a Gitea personal access token (`read:package` to install,
`write:package` to publish). Anonymous requests get `401`. Only the `@causl/*`
and `@iasbuilt/*` scopes live here: public dependencies come straight from
npmjs, which is what the scoped `@causl:registry=` line in the `.npmrc` below
expresses. Published versions are browsable at
<https://git.opsite.ca/causl/-/packages>.

### Publish

Gitea's npm registry authenticates with a host-scoped **bearer `_authToken`**:
**not** `npm login`, and **not** an HTTP Basic `_auth` line. Build,
sanity-check that the wasm engine is actually in the `@causl/causl-wasm-ts`
tarball, then publish:

```sh
# 1. build every package
pnpm build

# 2. sanity — the @causl/causl-wasm-ts tarball MUST ship the wasm engine
#    (wasm-pkg/<bridge>-bundler/*.wasm); a non-empty grep is the go/no-go
( cd packages/core && npm pack --dry-run 2>&1 | grep '\.wasm$' )

# 3. publish with the bearer-token .npmrc from Consume below
#    (GITEA_PACKAGES_TOKEN needs write:package for this, not read:package)
pnpm publish --registry https://git.opsite.ca/api/packages/causl/npm/
```

The publish is automated on paper: the **`.gitea/workflows/release-publish.yml`**
workflow declares a run on every push to the **`release`** branch and idempotently
publishes each package (skipping any version already on the registry), using
Gitea Actions' automatic per-run token. The manual steps above are the same
thing by hand.

That file is the **only** publish path, and it is in `.gitea/workflows/`:
Gitea reads that directory *exclusively* when it exists and ignores the legacy
forge root entirely. That is why causl/causl-wasm-ts#409 moved all nine
workflows at once rather than one of them; moving a single file would have
switched every other workflow in this repo off. The legacy root has since been
removed outright, and the gate now refuses its return rather than scanning it.

None of them runs today. Gitea Actions is **disabled** on this repository, so
the publish above is the manual path in practice. See
[`docs/ci.md`](./docs/ci.md) and [`ci/parked/README.md`](./ci/parked/README.md).

**It publishes the engine that is committed here.** The job does not re-vendor:
it runs `tools/wasm-build/provenance.mjs verify` against
`packages/core/wasm-pkg/gc-classic-bundler/`, refuses unless those bytes carry a
`causl-build-info` record naming the `causl.engine.revision` and
`codeSectionSha256` pinned in `packages/core/package.json`, and refuses a second
time on the packed tarball. An earlier revision of the job fetched a
`@causl/core-rs` tarball by version and `cp -R`'d it over the committed tree,
which shipped bytes no in-tree gate had run against; `test/engine-pin-matches-artefact-299.test.ts`
now fails any publish workflow that reintroduces that step.

**The full engine is published** (`release-publish.yml` publishes all nine):

| Package | Notes |
| --- | --- |
| `@causl/causl-wasm-ts` | ships the wasm engine in-tarball (both `wasm-pkg/gc-*-bundler/*.wasm`) |
| `@causl/persistence` | |
| `@causl/devtools` | |
| `@causl/devtools-bridge` | |
| `@causl/migration-check` | |
| `@causl/formula` | |
| `@causl/hypothesis` | |
| `@causl/sync` | |
| `@causl/react` | |

**Versions are deliberately not pinned here.** This table used to carry one, and
every row of it was stale: it read `@causl/causl-wasm-ts` `0.3.6` while `0.3.7`
was on the registry, and eight further rows were behind their own
`package.json`. A literal version in prose has nothing keeping it true.

Read the published version off the registry, or off the **`release` branch's**
`packages/<name>/package.json`: that is the tree `release-publish.yml`
publishes, so `main` sits behind it between a release and the merge back.

The same registry also hosts **`@causl/core-rs`** (from `causl/causl-core-rs`)
and the **`@iasbuilt/datagrid-*`** grid packages (from `xldatagrid`), which
consume `@causl/*`: and `iasbuilt/webapp`, which consumes the grid.

### Consume

Add an `.npmrc` that scopes `@causl` to the registry and carries the bearer
token (the same three lines as **Private packages** under
[Development access](#development-access) above):

```ini
@causl:registry=https://git.opsite.ca/api/packages/causl/npm/
//git.opsite.ca/api/packages/causl/npm/:_authToken=${GITEA_PACKAGES_TOKEN}
always-auth=true
```

`GITEA_PACKAGES_TOKEN` is a Gitea personal access token with `read:package`,
supplied **at install time** through the environment: a CI secret in the
pipeline, an exported shell var on a dev machine: and **never committed**:

```sh
export GITEA_PACKAGES_TOKEN=<your read:package token>
pnpm install
```

The registry URL is host-*and*-path scoped. `//git.opsite.ca/:_authToken=…`
does not match `…/api/packages/causl/npm/` and the request goes out anonymous,
which surfaces as a `401` on install rather than as a config error.

Because the wasm binary ships inside the `@causl/causl-wasm-ts` tarball, a registry
install lands the real Rust→WASM engine on the consumer's disk with **no**
separate vendor step: this is how `iasbuilt/xldatagrid`'s `main` builds
off-machine without a filesystem `link:` override.

---

## License

MIT: see [LICENSE](./LICENSE).

Copyright (c) 2026 Roman Goldmann <roman@iasbuilt.com>.
