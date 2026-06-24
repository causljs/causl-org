# Integrating causl-client into a TypeScript / Node.js app

> The Node-integration counterpart to `causl-wasm`'s producer-side
> [`scripts/README.md`](https://github.com/causljs/causl-wasm). That file
> documents how a Python pipeline **builds and places** the wasm artefact;
> this file documents how a TS/Node app **consumes** the placed artefact and
> binds it through the `@causl/core/wasm` thin TS API.

This guide is the consumer-side concretion of **SPEC §18A.4** (the thin-TS-API
definition) and **§18A.2** (the Node-target requirement). It covers, in order:

1. [What `causl-client` is](#1-what-causl-client-is) — the thin TS API over the
   wasm core, and what it is *not*.
2. [Installing and using it in a TS/Node app](#2-installing-and-using-it).
3. [Where the wasm artefact comes from](#3-the-wasm-artefact-placement-the-producerconsumer-split)
   — the producer/consumer split and the `causl-wasm` Python scripts.
4. [The `node:fs` loader and host-tier matrix](#4-the-loader-and-the-host-tier-matrix).
5. [The `read()`-identity migration](#5-the-read-identity-migration-18a5--151-1124)
   — the one breaking change you must audit for before shipping on the wasm default.
6. [The performance ceiling](#6-the-performance-ceiling-18a7) — what the wasm
   path costs, and why that cost is immaterial within the §14 RAIL budget.
7. [Synchronous construction — preload once, build sync](#7-synchronous-construction--preload-once-build-sync-18a12)
   — the §18A.12 `preloadCauslWasm()` + `createCauslWasmSync()` split that lets
   sync render/hook sites build a wasm graph with no `await` at the call site.
8. [The wasm-default surface of causl-client](#8-the-wasm-default-surface-of-causl-client-18a13)
   — the shipped §18A.13 cut of the public TS engine from *this*
   distribution, plus the §18A.13.1 implicit-path TS capability fallback.

Every load-bearing claim cites a SPEC § anchor. Where the shipped code and the
SPEC contract differ, the gap is called out as **Shipped today** vs
**Planned (§…)**, never blurred. The wasm path is **real Rust shipped today**:
`rust-ssot` is the unconditional production default (the §18A.7 gate passed, the
§18A.3 FFI structural lift landed — causl-wasm#170), so every adopter operation
resolves from Rust.

---

## 1. What causl-client is

`causl` is a **reactive dependency-graph engine** with denotational,
glitch-free, transactional semantics. Its public contract is the **§12
surface**: the seven-method spine

```
input · derived · commit · read · subscribe · snapshot · explain
```

plus the structural queries `dependencies` / `dependents` (and their transitive
closures, the commit log, commit metadata, handle/disposal validation, stats —
the §12.2 second-tier surface).

Per **SPEC §18A.1**, that contract ships in **two conformant engines**, held
byte-identical at the §12 boundary by the cross-backend determinism gate
(§18A.1.1):

| Engine | What it is | Status |
| --- | --- | --- |
| **`causl-ts`** | The TypeScript reference engine — the value-of-record running natively on the JS event loop. | The **unconditional floor** (§13.8). Lives in `causljs/causl-ts-wasm-engine`. |
| **`causl-wasm`** | The Rust core (`engine-rs-core` + `engine-rs-bridge`) compiled to WebAssembly, reached over FFI. | The **production engine** (`rust-ssot` is the unconditional default since 2026-06-21; all five §18A.7 GO/NO-GO criteria are met, the dated promotion amendment landed — causl-wasm#169). Lives in `causljs/causl-wasm`. |

> **Distribution note (§18A.13 + §18A.13.1 — shipped for *this* repo).** The
> two-engine roster above is the **org-wide** contract and the standing reality
> in the dual-engine repo `causljs/causl-ts-wasm-engine` (the TS floor stays).
> For the **`causl-client` distribution specifically**, a dated §18A.13 amendment
> took it **wasm-default**: `createCausl` routes to the wasm engine and
> `createCauslTs` has been **removed from the public `@causl/core` barrel of
> *this* package**. Adopters can no longer pick the pure-TS engine directly here.
> That cut shipped (epic #31 / issue #34), executed wire-before-cut. **SPEC
> §18A.13.1 (2026-06-23)** then **retained `createCauslTs`** (not deleted) and
> **wired it as the implicit `createCausl()` path's WasmGC-unavailable capability
> fallback** — loud (one-time `console.warn` + telemetry), never silent; explicit
> wasm still fails loud. The deeper §18A.3 FFI lift has landed
> (causljs/causl-wasm#170), so every adopter op resolves from Rust under
> rust-ssot. §8 records the shipped surface. **The fork is never wasm-only** — it
> keeps the dual-engine floor (and a public `createCauslTs`) as the conformance
> oracle.

**`causl-client` is the thin TypeScript API over the `causl-wasm` core**
(§18A.4). Stated plainly so the boundary stays honest, it is **not**:

- not a copy of the TS engine's `graph.ts`;
- not the ~7.5k-LOC TS shell under a new name;
- not "the same TS engine, just calling into WASM."

It is a thin adapter that (1) implements the public `Graph` interface by
delegating each method to the wasm core over FFI; (2) marshals parameters across
the JS↔WASM boundary (the cost is measured, not hidden — §6 below); and (3)
binds to the placed `.wasm` artefact. It **ships no Rust source and no build
tooling** — the produce-and-place tooling is the engine repo's
(`causljs/causl-wasm`, §18A.11); the consume-and-bind surface is this repo's.

### Repository topology (§18A.10)

```
causljs/causl-wasm          Rust engine + FFI externs + Python build/package tooling
                            (the source of truth for the causl-wasm engine)
causljs/causl-client        THIS REPO — the thin TS API + Node loader + adoption docs
                            (consumes the placed .wasm; ships no Rust)
causljs/causl-ts-wasm-engine  causl-ts (the TS floor) + cross-backend bench/conformance harness
```

Named first-party integration consumers: `iasbuilt/xldatagrid` and
`iasbuilt/webapp` (Node.js TS web apps).

> **Current state of the wasm path — real Rust shipped (SPEC §18A.7 / §18A.8).**
> The engine returned by `loadWasmBackend()` is the **real `engine-rs-core` Rust
> core** compiled to WebAssembly, reached over FFI — not a TS wrapper. `rust-ssot`
> is the **unconditional production default** (`DEFAULT_WASM_ENGINE_MODE =
> 'rust-ssot'`, 2026-06-21), with **no per-flush byte-compare oracle and no
> sticky-downgrade fail-safe** (both removed per §18A.8 / causl-wasm#169). The
> §18A.3 FFI structural lift **landed** (causl-wasm#170), so **every adopter
> operation resolves from Rust** — the only JS in the hot path is the user's own
> `derived()` compute lambda, which runs over the bridge callback **by design**.
> The FFI seam, the bridge picker, and the CI-blocking cross-backend determinism
> gate (§18A.1.1, 0-divergence) are the standing conformance guarantee. This is
> repeated at the top of
> [`packages/core/wasm/README.md`](../packages/core/wasm/README.md).

---

## 2. Installing and using it

### 2.1 Install

```sh
pnpm add @causl/core        # or: npm i @causl/core / yarn add @causl/core
```

The wasm path is an **opt-in subpath**. Importing `@causl/core` pulls in only the
TS engine and a tiny loader stub (~1 KB); the wasm bundle cost is paid only by
callers who explicitly `import('@causl/core/wasm')`. Node 22+ is required
(`engines.node: ">=22"`).

### 2.2 The smallest worked example

Identical to [SPEC §10](../SPEC.md). Two inputs, one derived, one diamond, one
subscriber, two commits, three observed propagations. Your model code is
identical on either substrate; `createCausl()` routes to the wasm engine
(`rust-ssot`) once preloaded, and otherwise builds on the internal TS floor:

```ts
import { createCausl } from '@causl/core'

const graph = createCausl() // routes to the wasm engine once preloaded (§7); internal TS floor otherwise
const a = graph.input('a', 1)
const b = graph.input('b', 2)
const sum = graph.derived('sum', (get) => get(a) + get(b))
const sumPlusOne = graph.derived('sumPlusOne', (get) => get(sum) + 1)

graph.subscribe(sumPlusOne, (v) => console.log(v)) // 4

graph.commit('bump-a', (tx) => tx.set(a, 10)) // 13

graph.commit('bump-both', (tx) => {
  tx.set(a, 100)
  tx.set(b, 200)
}) // 301 — exactly one notification, not two (glitch-free)
```

All mutation happens **inside `commit`**; outside, the graph is read-only
(§12, commitment 2). The single notification on the second commit is
glitch-freedom as a *theorem*, not a scheduler trick (§3 Theorem 2).

### 2.3 Opting into the wasm engine

There are two adopter-facing paths. Pick based on whether you want WASM
unconditionally or only when a workload heuristic trips. Both shown here are
**async at the call site** (`await loadWasmBackend()`). If you need to build a
wasm graph from **synchronous** code — a React render, an `xldatagrid` cell, an
SSR pass — do not reach for these; use the §18A.12 preload-then-sync split in
[§7](#7-synchronous-construction--preload-once-build-sync-18a12), which hoists
the single unavoidable `await` to app init so the construction call itself has
zero `await`.

**Path A — drive the wasm backend directly (`loadWasmBackend()`).** This is the
canonical path for "I want the wasm engine on this graph." `loadWasmBackend()`
returns a `BackendEngine` — the third actor at the `BackendEngine` seam
(`packages/core/src/backend.ts`), alongside `JsBackend` (the TS engine) and
`WasmBackend` (the Rust core). Always wrap it in the documented fallback:

```ts
import { createCausl } from '@causl/core'
import { loadWasmBackend, WasmBackendUnavailableError } from '@causl/core/wasm'
import type { BackendEngine } from '@causl/core/wasm'

async function makeEngine(): Promise<{ kind: 'wasm' | 'js' }> {
  try {
    const backend: BackendEngine = await loadWasmBackend()
    // … wire `backend` as the graph's engine seam (see §2.4 note) …
    return { kind: 'wasm' }
  } catch (err) {
    if (err instanceof WasmBackendUnavailableError) {
      // Host can't run the chosen bridge (CSP block, missing WasmGC,
      // pinned-but-unsupported bridge, fetch failure). Fall back to the
      // TS floor — it runs on any host that runs JavaScript.
      return { kind: 'js' }
    }
    throw err
  }
}
```

`WasmBackendUnavailableError` carries a structured `code` field so you can
dispatch per failure mode (`CAUSL_WASM_NOT_BUILT`, `CAUSL_WASM_CSP_BLOCKED`,
…); the five codes and the per-code dispatch are documented in
[`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) §3. The loader does
**not** auto-fall-back — you decide.

**Path B — let the engine choose (`backend: 'auto'`).** Start on the TS engine
and migrate to the wasm backend at runtime when the auto-adapt heuristic trips
(graph size, derivation depth, subscriber count). The migration is one-way (a
transient spike cannot ping-pong the selection):

```ts
import { createCausl } from '@causl/core'

const graph = createCausl({ backend: 'auto' })
// runs on the TS engine until the heuristic trips, then transparently
// migrates the same graph onto the wasm backend.
```

> **Accuracy note — the `createCausl` `backend` option.** On the shipped
> synchronous `createCausl` constructor, `backend` accepts **`'js' | 'auto'`
> only** — `'wasm'` is intentionally not a constructor value, because loading
> the artefact requires the async `import('@causl/core/wasm')` +
> `loadWasmBackend()` call. SPEC §18A.4/§18A.1 describe the *target* seam as
> "`backend: await loadWasmBackend()` passed to `createCausl`"; the shipped
> adopter API expresses the same intent through **Path A** (drive the backend
> directly) and **Path B** (`'auto'`). Treat the SPEC's
> `backend: <engine instance>` phrasing as the seam contract, and the two paths
> above as how you reach it today.

### 2.4 Switch engines at the seam, never in user code

The whole point of the byte-identity gate is that the two engines are
**interchangeable at the public-contract boundary**. Your model code —
`input` / `derived` / `commit` / `read` / `subscribe` — is identical regardless
of which engine is behind it. The `'js'`↔`'wasm'` choice lives at the
`BackendEngine` seam (`packages/core/src/backend.ts`) and nowhere else. If a
piece of application logic has to know which engine it's running on, that is a
bug — the only legitimate exception is the `read()`-identity migration (§5),
which you fix *once*, defensively, so it is correct under both engines.

---

## 3. The wasm artefact placement (the producer/consumer split)

`causl-client` consumes a **placed** `.wasm` artefact. It does not build one. Per
**§18A.11**, the build-and-place tooling is two stdlib-only Python scripts in
`causljs/causl-wasm` — the producer side — and a webapp's CI/CD pipeline drives
them. The split:

| Side | Repo | Artefact | Tool |
| --- | --- | --- | --- |
| **Producer** | `causljs/causl-wasm` | builds + places the `.wasm` | `scripts/build_wasm.py`, `scripts/package_wasm.py` |
| **Consumer** | `causljs/causl-client` (you) | binds the placed `.wasm` over FFI | the `@causl/core/wasm` loader |

### 3.1 Producer side — the Python scripts (run by your pipeline)

These need a Rust toolchain (`cargo` + `wasm-pack` + `wasm-opt`); your *consuming*
pipeline does not — it only needs CPython stdlib to run `package_wasm.py`. The
full contract is in `causl-wasm`'s [`scripts/README.md`](https://github.com/causljs/causl-wasm/blob/main/scripts/README.md).

```sh
# Build + place in one call — the common pipeline entry point.
# --dest states WHERE the artefact goes; the consumer picks the path.
python3 scripts/build_wasm.py --bridge gc-classic        # → build/wasm-nodejs
python3 scripts/package_wasm.py --build --dest /path/to/app/src/engine/wasm
```

`build_wasm.py` produces a size-optimised, **node-target** (`--target nodejs`)
`.wasm` plus the node glue (`causl_engine_bridge.js`) and `.d.ts` typings.
`package_wasm.py` copies that artefact set into `--dest` and writes a
deterministic manifest (`causl-wasm.manifest.json`, schema
`causl-wasm/manifest@1`) recording the engine version, bridge, target,
`wasm-opt` flags, and a **per-file sha256**. It is stdlib-only, makes no network
calls, and **fails loud** (non-zero exit, clear stderr) if `--src` is
incomplete, a file can't be hashed, or `--dest` is unwritable.

### 3.2 Consumer side — vendor + verify the manifest

In your app's CI/CD, after `package_wasm.py` has placed the artefact, verify it
against the manifest before the build proceeds. This closes the
"producer ships, consumer places" loop honestly:

```python
# verify-wasm-manifest.py — a loud post-place gate for your pipeline.
import hashlib, json, pathlib, sys

dest = pathlib.Path("src/engine/wasm")
manifest = json.loads((dest / "causl-wasm.manifest.json").read_text())
for f in manifest["files"]:
    digest = hashlib.sha256((dest / f["name"]).read_bytes()).hexdigest()
    if digest != f["sha256"]:
        sys.exit(f"checksum mismatch for {f['name']}")
print(f"wasm artefact verified: {manifest['engineVersion']} ({manifest['bridge']})")
```

Git-track the manifest so rebuilds are deterministic and a drifted artefact
fails CI loudly rather than shipping silently.

> **Vendored target — be precise.** The `.wasm` artefacts vendored in *this repo*
> under `packages/core/wasm-pkg/gc-classic-bundler/` and `gc-builtins-bundler/`
> are **`--target bundler`** builds (webpack 5 / Vite 5 / esbuild via
> asset-pipeline loaders). The consumer-side **`node:fs` loader hook is shipped**
> (`packages/core/wasm/index.ts` resolves a placed `.wasm` through
> `node:fs`/`node:fs/promises`), and the producer **`--target nodejs`** build +
> placement (the `causl-wasm` Python scripts, §18A.11) is shipped on the engine
> side — that pairing satisfies the §18A.2 Node-target requirement (§18A.7
> Criterion 4, GO). When you wire a pure-Node service with the `--target nodejs`
> artefact, consume it as the `causl-wasm` `scripts/README.md` shows (synchronous
> `require`/`import` of the node glue) and bind it through the `BackendEngine`
> seam. For bundler builds the artefact resolves via the
> `new URL(..., import.meta.url)` path (§4.2).

---

## 4. The loader and the host-tier matrix

### 4.1 The host-tier bridges (§17.6)

The bridge picker (`detectBridge()`) probes the host at module load and selects
the most-capable artefact it actually supports; a host that lacks the higher tier
falls back automatically, and the TS engine is the universal floor below all of
them. The two shipped bridge variants of the consolidated
`causl-engine-bridge` crate:

| Bridge id | String strategy | When picked |
| --- | --- | --- |
| `wasmgc-builtins` | `js-string-builtins` — no-copy `wasm:js-string` | Hosts with `wasm:js-string` host bindings (Node 22.6+, Chrome 131+, Firefox 130+). The fastest tier. |
| `wasmgc-classic` | `classic-strings` — UTF-16 fallback | The universal WasmGC baseline; needs no `wasm:js-string` host support, so it instantiates on every WasmGC-capable host. The safe default `detectBridge()` returns. |

Pin a bridge to skip detection cost when you know your target:

```ts
const backend = await loadWasmBackend({ bridge: 'wasmgc-classic' })
```

### 4.2 The loader resolution shape

**Shipped today (bundler target).** The loader resolves the artefact via
`new URL('./pkg/<segment>/causl_engine_bridge_bg.wasm', import.meta.url)` — the
lowest common denominator across webpack 5 (`experiments.asyncWebAssembly`),
Vite 5 (`vite-plugin-wasm`), esbuild 0.20+ (`--loader:.wasm=file`), and Node
22+ ESM. Override the base URL for a CSP `connect-src` / CDN scenario:

```ts
const backend = await loadWasmBackend({
  wasmBaseUrl: 'https://cdn.jsdelivr.net/npm/@causl/core@<version>/wasm/pkg/',
})
```

**Node target (§18A.2, shipped).** The `--target nodejs` glue instantiates the
wasm synchronously at `require`/`import` time, so the Node loader hook resolves
the placed artefact via **`node:fs`** with no async load shape — it works
identically in CJS and ESM. The consumer-side `node:fs` loader hook is shipped
(`packages/core/wasm/index.ts`), and it pairs with the producer `--target
nodejs` build the `causl-wasm` `scripts/README.md` "Consuming the packaged
artefact in Node" section describes — together they satisfy the §18A.2
Node-target requirement (§18A.7 Criterion 4, GO). The bundler path above is the
shape for browser/bundler builds, where the artefacts vendored in *this repo*
are `--target bundler`.

### 4.3 The FFI single-tick invariant — never `await` the commit entry (§18A.6)

The FFI commit entry point (`apply_commands` / the Rust `commit_batch` extern) is
a **synchronous** `#[wasm_bindgen]` call. The async surface you `await` is
*loading* the backend (`await loadWasmBackend()`), not *committing* through it.
A commit is one atomic tick (§3 Theorem 2 / §5 Phase A–H "no intermediate
time"). **Do not `await` a commit** — interleaving an `await` mid-commit would
break single-tick atomicity silently. `graph.commit(intent, tx => …)` is and
stays synchronous on both engines.

---

## 5. The `read()`-identity migration (§18A.5 / §15.1 #1124)

This is the **one breaking change** the wasm path introduces, and the one thing
you must audit for **before** upgrading to a real-Rust build.

**The contract.** `graph.read(node)` is **not** contractually required to return
the same JavaScript reference across calls. *Value* identity at a fixed
`GraphTime` is guaranteed; *reference* identity across commits is **not**
(§15.1, ratified by PR #1129).

**Why it bites under the wasm engine.** Under the real Rust engine
(`rust-ssot`, the shipped default) a wasm-backed `read()` of an object value
returns a **fresh object per call** — the value is deserialised across the FFI
boundary on each read, even when the underlying data did not change. Any adopter
who keys memoisation on the `read()` return **reference** re-renders every
commit, silently. No error fires. (The `js-ssot` internal reference returns
identical references trivially, so a codebase that only ever ran the TS floor
will not see the bug there — which is exactly why this audit matters before you
ship on the wasm default or under the implicit `createCausl()` path.)

**The fix — key on `commit.time` or a per-node version, not on `read()`
identity.**

```ts
// WRONG — breaks under the wasm engine. The `read()` reference changes
// every commit, so this memo invalidates every commit (the TS floor
// reuses the reference trivially, which only masks the bug).
import { useMemo } from 'react'
function UserCard({ user }: { user: User /* a read() return */ }) {
  const transformed = useMemo(() => transform(user), [user]) // ← reference key
  // ...
}
```

```ts
// RIGHT — keys on commit.time (the GraphTime on the published Commit),
// which advances by exactly one per commit and is byte-identical under
// both engines.
import { useMemo } from 'react'
function UserCard({ user }: { user: User }) {
  const commit = useCauslCommit()           // commit.time: GraphTime
  const transformed = useMemo(() => transform(user), [commit.time, user])
  // ...
}
```

For workloads where `commit.time` is too coarse (it advances on *every* commit,
even ones that don't touch your node), key on the **per-node version counter**
instead — the `read_derived_version` extern surfaced through `EngineTelemetry`:

```ts
const telemetry = useEngineTelemetry()
const version = telemetry.nodeVersion(node)   // bumps only when `node` changes
const transformed = useMemo(() => expensiveTransform(value), [version])
```

**Pre-migration checklist (required reading before you ship on the wasm
default, §18A.5).** Audit, across your codebase:

- every `React.memo(C, (prev, next) => prev.value === next.value)` whose equality
  compares a `read()` return;
- every `useMemo(() => transform(value), [value])` whose dependency array holds a
  `read()` return;
- any cache, `WeakMap`, or `===` check keyed on a `read()` reference held across a
  commit boundary.

Migrate each to `commit.time` (`GraphTime` on the `Commit`) or the per-node
version counter. A dev-only hazard warning is available behind
`createCausl({ enableH1HazardWarning: true })` — it records each long-held
`read()` return as a `WeakRef` and emits one `console.warn` per survivor whose
read-time `GraphTime` predates the post-commit clock (opt-in; off by default;
dead-code-eliminated in production builds). The right-vs-wrong example also
lives in [`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) §H1.

---

## 6. The performance ceiling (§18A.7)

Honesty about cost is a contract, not a footnote. State it in front of every
wasm-vs-js decision.

**The perf ceiling (SPEC §18A.7 Criterion 3).** For the wasm path to be a
promotion candidate, the JS↔WASM marshal overhead must hold to:

- **single commit ≤ 250 µs p95** marshal overhead;
- **batch / large mutation ≤ 5 ms p95**.

These are the *marshal-overhead* bars the cross-backend benchmark gates against —
the cost of crossing the boundary, separate from the engine's own work.

**The standing wire tax.** Before the engine does any work there is a documented
crossing cost: the **~78× FFI marshaling tax** — ~156.4 ms for 10k commits
across the boundary (15.64 µs/commit) vs ~2.017 ms TS median. There is also a
per-commit *engine-exec* cost: at current WASM runtime maturity (no GC GA,
limited JIT, no SIMD) the Rust-engine-in-WASM per-commit execution cost is
several tens of × the TS engine — a property of today's runtime, not of the
engine design. **These costs are named, not hidden — and they are immaterial to
the adopter UX** (see below).

**What this means for you, concretely:**

- **Perf is immaterial within the §14 RAIL budget.** The wasm path ships as the
  default for **complexity-elimination**, not performance: a single-engine
  roster, not a faster one. Per-commit wall-time stays inside the §14 RAIL
  responsiveness budget (all six RAIL cells PASS, §18A.7 Criterion 3
  GO/RESOLVED), which is the bar that matters for the adopter. The boundary tax
  and the engine-exec cost above are explicitly accepted as UX-immaterial — they
  are a cost you can see, not a regression you feel.
- **The wasm path is the real Rust engine, not a wrapper.** Every adopter
  operation resolves from Rust (the §18A.3 FFI lift landed, causl-wasm#170). It
  is the production substrate, not an opt-in experiment.
- **`engine: 'js-ssot'` is the one-line per-graph opt to the TS floor** — the
  retained §18A.7 Criterion-5 reference engine, available if you have a specific
  reason to run the TS substrate on a given graph. It is the internal
  conformance reference, not the production path.

**Promotion is governance — and it has happened.** The wasm engine became the
default when **all five** §18A.7 GO/NO-GO criteria passed — byte-identity (1),
full FFI surface (2, the §18A.3 lift landed), the §14 RAIL perf floor (3,
GO/RESOLVED), the Node target + a real-world adopter (4, `iasbuilt/xldatagrid`),
and the governance criterion (5) — recorded by a **dated amendment** (the
2026-06-21 promote-default, causl-wasm#169). `rust-ssot` is the **unconditional
production default** (`DEFAULT_WASM_ENGINE_MODE = 'rust-ssot'`), with no
per-flush byte-compare oracle and no sticky-downgrade fail-safe (both removed per
§18A.8). The CI-blocking cross-backend determinism gate (§18A.1.1, 0-divergence
over 100,000 trials) is the sole conformance guarantee; a divergence is a
halt-before-merge condition, resolved by a governance revert, never an in-process
downgrade.

---

## 7. Synchronous construction — preload once, build sync (§18A.12)

Everything above `await`s the wasm backend at the **call site**
(`await loadWasmBackend()` / `await createCauslWasm()`). That is a problem for the
consumers that build a graph from **synchronous** code — a React render, an
`xldatagrid` cell factory, a synchronous SSR pass — where there is no place to
put an `await`. **SPEC §18A.12** (shipped 2026-06-19 in `causl-client` and in the
fork) makes the wasm engine **synchronous from the consumer's perspective** by
splitting construction into a one-time async *preload* and a fully synchronous
*factory*.

### 7.1 Why one `await` is unavoidable — and where it goes

The wasm artefacts are ~630 KB. A synchronous `new WebAssembly.Module(bytes)` on
a module that large is **spec-prohibited on a browser main thread**, so the
**COMPILE** step (`await WebAssembly.compile`) plus the two dynamic `import()`s
(the `_bg.js` sidecar and the `causl-compute-imports.js` snippet) must stay
async. But **INSTANTIATE** — `new WebAssembly.Instance(module, imports)` — is a
**synchronous primitive**: from an already-compiled `WebAssembly.Module` it does
the identical work as `await WebAssembly.instantiate(...)` at any size, with zero
`await`. §18A.12 hoists the one unavoidable compile-`await` to app init and keeps
the per-graph construction synchronous.

This does **not** change the default engine (§18A.7 is untouched), does **not**
alter byte-identity (§18A.1.1), and does **not** promote the wasm engine. It is a
purely additive construction capability.

### 7.2 The trio

| Factory | Async? | Subpath | What it is |
| --- | --- | --- | --- |
| `createCausl(opts?)` | sync | `@causl/core` | The **default** factory. Routes to the real wasm engine synchronously once `@causl/core/wasm` has been preloaded (via `preloadCauslWasm()`) for the default bridge; with no preload it builds a working synchronous `Graph` on the internal TS floor, so sync callers that never preload stay non-breaking. |
| `createCauslWasm(opts?)` | **async** | `@causl/core/wasm` | The retained async wasm factory. Re-expressed as exactly `preloadCauslWasm(opts)` ∘ `createCauslWasmSync(handle, opts)` — one instantiate codepath, provably `preload ∘ sync`, zero drift. Use it where an `await` at the call site is fine. |
| `createCauslWasmSync(handle?, create?)` | **sync** | `@causl/core/wasm` | The fully-synchronous wasm factory. Zero `await`. Use it at sync render/hook/SSR sites — **after** a one-time preload. |

`preloadCauslWasm()` (async compile-once) lives on the `@causl/core/wasm`
subpath alongside the two wasm factories, keeping the wasm bundle out of the main
barrel. **`createCauslTs` is not a public factory in this package** — it has been
un-exported from the public `@causl/core` barrel (§8), but is **retained
internally** as the implicit-path capability fallback (§18A.13.1). The §18A.3
FFI structural lift has **landed** (causljs/causl-wasm#170), so under `rust-ssot`
the retained TS engine is a clean standalone fallback, no longer wasm-path
structural scaffolding; the only remaining item is the literal zero-TS-core
deletion, which §18A.13.1 **dropped from near-term scope**.

### 7.3 The pattern — `preloadCauslWasm()` once, `createCauslWasmSync()` everywhere

`await preloadCauslWasm(opts?)` **once** at app/init. It compiles and caches the
`WebAssembly.Module` + sidecar + compute-imports snippet (keyed by bridge), pays
the dynamic imports, and is **idempotent** — concurrent calls share one compile;
a transient failure drops the cache entry so a later call can retry. Companions
`isCauslWasmPreloaded(bridge?)` and `getPreloadedCauslWasm(bridge?)` expose the
**resolved** preload state synchronously (set in the `.then`, not merely the
in-flight promise), so a sync site can check readiness without `await`.

Thereafter, `createCauslWasmSync(handle?, create?)` is **fully synchronous**:
`new WebAssembly.Instance(...)` → re-point the sidecar → return a `Graph`, with no
`await` anywhere on the path.

```ts
// app-init.ts — runs once, where async is already tolerated (bootstrap / a
// top-level loader / a Suspense data dependency).
import { preloadCauslWasm } from '@causl/core/wasm'

await preloadCauslWasm() // compiles + caches the Module/sidecar/snippet; idempotent
```

```tsx
// AnyComponent.tsx — a synchronous React render. No `await` here.
import { createCauslWasmSync } from '@causl/core/wasm'

function buildGraph() {
  const graph = createCauslWasmSync()   // FULLY SYNCHRONOUS — new WebAssembly.Instance, zero await
  const a = graph.input('a', 1)
  const sum = graph.derived('sum', (get) => get(a) + 1)
  return graph
}
```

The commit entry stays synchronous on both engines (§4.3) — §18A.12 only moves
the *construction* await to bootstrap; it does not introduce any await inside a
commit envelope, so §3 Theorem 2's single-tick invariant is untouched.

### 7.4 Not-preloaded is a loud failure, not a silent await

`createCauslWasmSync` **never silently awaits**. If nothing is preloaded for the
resolved bridge it throws **`CauslWasmNotPreloadedError`**
(`code: 'CAUSL_WASM_NOT_PRELOADED'`, a `WasmEngineUnavailableError` subclass)
whose message names `preloadCauslWasm()`. This preserves the §18A loud-fail
discipline: a wasm-authoritative graph and a TS graph differ in `read()`-identity
and commit-clock, so a silent swap would be a glitch-freedom hazard.

```ts
import { createCauslWasmSync, CauslWasmNotPreloadedError } from '@causl/core/wasm'

try {
  const graph = createCauslWasmSync()         // throws if no preload completed for this bridge
} catch (err) {
  if (err instanceof CauslWasmNotPreloadedError) {
    // You forgot the one-time `await preloadCauslWasm()` at app init.
  }
  throw err
}
```

If you want a sync site to **degrade to the internal TS floor** instead of
throwing when no preload is ready, pass `{ fallbackToTs: true }` — it
synchronously returns a `Graph` built on that internal floor (safe because
js-ssot is byte-identical per §18A.1.1). This is the **internal** sync-ergonomics
floor, **not** a public engine choice: `createCauslTs` is no longer a public
factory here (§8), so `fallbackToTs` is the only way to reach that floor: 

```ts
const graph = createCauslWasmSync(undefined, { fallbackToTs: true }) // wasm if preloaded, else the TS floor
```

### 7.5 Node vs browser

On Node / SSR the `--target nodejs` glue (§18A.2) is **already synchronous** at
require-time (`readFileSync` + `new WebAssembly.Module` + `new
WebAssembly.Instance` at module-eval), so `createCauslWasmSync` works **without**
a prior `await` — server render stays synchronous. The browser **bundler** target
is where the one-time `await preloadCauslWasm()` is load-bearing: it must complete
**before the first render** that constructs a wasm graph. That ordering is also
what gives SSR↔CSR hydration parity (no engine is constructed mid-render in an
unresolved-promise state). Skip the preload and `createCauslWasmSync` throws (or,
with `fallbackToTs`, degrades) — it never silently blocks.

> **Packaging note (cross-ref §18A.11).** The sync factory needs the
> `causl-compute-imports.js` snippet placed next to the `.wasm`/`_bg.js` in
> `wasm-pkg/<bridge>/`; `package_wasm.py` places it. No Rust regeneration is
> required — the nodejs glue is already sync and the bundler `_bg.js` already
> exports the `__wbg_set_wasm` re-point seam §18A.12 instantiates against. A
> build-parity CI assertion pins both sync seams so a wasm-pack/wasm-bindgen
> upgrade that drops either fails loud.

---

## 8. The wasm-default surface of causl-client (§18A.13)

> **Shipped for *this* distribution** (with the §18A.13.1 implicit-path
> TS capability fallback).

A dated **§18A.13** amendment took `causl-client` — and **only** `causl-client` —
to the **wasm engine as its default public engine** and **removed `createCauslTs`
from this package's public barrel**. SPEC **§18A.13.1 (2026-06-23)** then retained
`createCauslTs` (not deleted) as the implicit `createCausl()` path's capability
fallback (see the end of this section). State the boundaries plainly:

- **Scope is `causl-client` only.** The fork `causljs/causl-ts-wasm-engine`
  **keeps** the dual-engine TS floor and a **public `createCauslTs`**: it stays
  the §18A.1.1 differential-test oracle, the benchmark repo, and the source of the
  authoritative Rust→wasm loader ported here. **The fork is never wasm-only.**
  Say `createCauslTs` was removed *from causl-client*, not *from causl*.
- **It is a governance decision that deliberately bypassed the §18A.7 GO/NO-GO
  gate for `causl-client`, and says so** — it does *not* claim the criteria are
  met. The driver is **complexity-elimination** (shedding the dual-engine
  maintenance burden), **not** performance; the §17.6 boundary tax and the
  per-commit median (§6 above) are explicitly accepted as UX-immaterial within
  the §14 RAIL budget for this enterprise-only distribution. Perf is never a gate
  or an argument for or against the wasm engine here.

It was executed **wire-before-cut** (an ordering constraint, so the repo was never
left with zero working engine), and the public cut was the **last** step:

1. **WIRE** — ported the fork's real Rust→wasm loader + sidecar wiring into
   `causl-client`. (The `.wasm`/`_bg.js` artefacts are vendored here; the
   compute-imports snippet is placed via `package_wasm.py`.)
2. **FLIP + SYNC** — `createCausl()` now **routes to the wasm engine**
   synchronously once preloaded, using exactly the §7 `preloadCauslWasm()` +
   `createCauslWasmSync()` split as the mechanism. Sync consumers (e.g.
   `xldatagrid`'s synchronous `createCausl()` sites) keep calling `createCausl()`
   **unchanged** and transparently get wasm — no async refactor of the call sites.
   A `createCausl()` that runs **before** any preload builds on the internal TS
   floor, so callers that never preload stay non-breaking.
3. **CUT** — removed `createCauslTs` from the public `@causl/core` barrel.
   Adopters can no longer pick the pure-TS engine directly in this package.

**Status — honest and dated.** *Shipped:* the §7 sync split, the vendored
bundler artefacts, the loader port (step 1), the `createCausl`→wasm routing +
sync preload (step 2), the public `createCauslTs` removal from the barrel
(step 3), and — per **§18A.13.1** — the implicit-path TS capability fallback.
The pure-TS engine survives **internally** (the §18A.3 FFI lift has landed —
causljs/causl-wasm#170 — so under rust-ssot it is no longer wasm-path structural
scaffolding but a **clean standalone fallback engine**) and is **wired as the
implicit `createCausl()` path's WasmGC-unavailable capability fallback**.
*Dropped from near-term scope by §18A.13.1:* the literal **zero-TS core** (deleting
`createCauslTs` outright) — the TS engine is retained as the §12 conformance
reference + the implicit-path fallback, a deliberate multi-subsystem migration
tracked separately, not a loose end.

For `causl-client`, §18A.7 Criterion 5 ("TS-engine floor maintained") is **partly
re-extended** by §18A.13.1, and the §17.6 Commitment 14 "fall-through to the TS
engine" host fallback is **partially restored — for the implicit `createCausl()`
path only**: on a host where the WasmGC engine cannot **instantiate** (Safari < 18
/ macOS < 15, policy-pinned pre-119 Chromium/WebView2, Node ≤ 20), `createCausl()`
degrades to the retained internal TS engine **loudly** (one-time `console.warn` +
`onCauslCapabilityFallback` telemetry, never silent), so a no-wasm enterprise user
gets a working app instead of a hard error. The **explicit** `createCauslWasm()` /
`createCauslWasmSync()` / `engine:'rust-ssot'` factories **still fail loud**
(`CAUSL_WASM_ENGINE_UNAVAILABLE`) — a consumer that explicitly asked for wasm must
never silently run on JS. The full TS floor stays **in force for the fork**. The
§18A.1.1 byte-identity proof survives the strip because it lives in the fork
(which keeps both engines) plus a frozen golden-vector corpus captured before the
cut.

---

## See also

- [`SPEC.md` §18A](../SPEC.md) — the two-engine contract (the governing source
  for everything above): §18A.1 equivalence, §18A.2 Node target, §18A.4 thin TS
  API, §18A.5 read-identity, §18A.6 FFI atomicity, §18A.7 GO/NO-GO criteria,
  §18A.10 topology, §18A.11 Python tooling, §18A.12 synchronous construction
  (preload + sync factory), §18A.13 the `causl-client` wasm-default amendment,
  §18A.13.1 the implicit-path TS capability fallback.
- [`packages/core/wasm/README.md`](../packages/core/wasm/README.md) — the
  `@causl/core/wasm` entry point: cost shape, host requirements, CSP, bundler
  interop, the H1 callout, the `WasmBackendUnavailableError` codes.
- [`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) — preload / SRI
  posture, dynamic-import vendoring, the five structured fallback codes, and the
  full H1 read-identity migration walkthrough.
- `causljs/causl-wasm` [`scripts/README.md`](https://github.com/causljs/causl-wasm/blob/main/scripts/README.md)
  — the producer-side `build_wasm.py` / `package_wasm.py` contract this guide
  consumes.
