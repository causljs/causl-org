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
   — the one breaking change you must audit for before a real-Rust build.
6. [The performance ceiling](#6-the-performance-ceiling-18a7) — what the wasm
   path costs and what it does *not* buy you today.

Every load-bearing claim cites a SPEC § anchor. Where the shipped code and the
SPEC contract differ — they do, in two named places — the gap is called out as
**Shipped today** vs **Planned (§…)**, never blurred.

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
| **`causl-wasm`** | The Rust core (`engine-rs-core` + `engine-rs-bridge`) compiled to WebAssembly, reached over FFI. | The **committed alternative** now, the **planned replacement** once *all* §18A.7 GO/NO-GO criteria are met and a dated amendment records the promotion. Lives in `causljs/causl-wasm`. |

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

> **Current state of the wasm path (SPEC §18A.5 step 1 / v0.9.0).** Today's
> `WasmBackend` returned by `loadWasmBackend()` is the **TS engine wrapped in the
> FFI shape, not a real Rust engine**. The FFI seam, the bridge picker, and the
> cross-backend byte-identity gate are stable and enforced; the runtime
> characteristics today match the TS engine. The real Rust swap is the
> post-0.9.0 epic (#1133), gated by §18A.7. Importing the wasm entry point at
> 0.9.0 is for wiring the seam, exercising the host-tier matrix, and surfacing
> the fallback path — **not** for a wall-time win, which the wrapper does not
> deliver. This is repeated at the top of
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

### 2.2 The smallest worked example (TS engine — the floor)

Identical to [SPEC §10](../SPEC.md). Two inputs, one derived, one diamond, one
subscriber, two commits, three observed propagations:

```ts
import { createCausl } from '@causl/core'

const graph = createCausl() // backend: 'js' is the default
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
unconditionally or only when a workload heuristic trips.

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

> **Shipped today vs Planned.** The `.wasm` artefacts vendored in this repo under
> `packages/core/wasm-pkg/gc-classic-bundler/` and `gc-builtins-bundler/` are
> **`--target bundler`** builds (webpack 5 / Vite 5 / esbuild via asset-pipeline
> loaders). The **`--target nodejs`** artefact + the `node:fs` loader hook is the
> **§18A.2 hard requirement** for promotion (Criterion 4) and is the contract
> this guide and the `causl-wasm` scripts target; it is **planned, not yet
> merged** in `causl-client`. Until it lands, the Node consumption shape is the
> bundler-resolved `new URL(..., import.meta.url)` path (§4.2). When you wire a
> pure-Node service with the `--target nodejs` artefact today, consume it as the
> `causl-wasm` `scripts/README.md` shows (synchronous `require`/`import` of the
> node glue) and bind it through the `BackendEngine` seam.

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

**Planned (Node target, §18A.2).** The `--target nodejs` glue instantiates the
wasm synchronously at `require`/`import` time, so the Node loader hook resolves
the placed artefact via **`node:fs`** with no async load shape — it works
identically in CJS and ESM. This is the loader the `causl-wasm` `scripts/README.md`
"Consuming the packaged artefact in Node" section pairs with, and it is the
§18A.2 promotion requirement. It is not yet merged here; the bundler path above
is what ships at 0.9.0.

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
(§15.1, ratified by PR #1129, shipped with 0.9.0).

**Why it bites later, not now.** Today's `WasmBackend` is a TS-engine wrapper, so
`read()` returns identical references trivially. The day the real Rust
serde/wasmgc bridges land (epic #1133), a wasm-backed `read()` returns a **fresh
object per call** — the value is deserialised across the FFI boundary on each
read. Any adopter who keys memoisation on the `read()` return **reference**
re-renders every commit, silently, after the swap. No error fires.

**The fix — key on `commit.time` or a per-node version, not on `read()`
identity.**

```ts
// WRONG — breaks at the real-Rust swap. The `read()` reference changes
// every commit, so this memo invalidates every commit (or, worse,
// never updates if the reference is reused trivially today).
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

**Pre-migration checklist (required reading before a real-engine upgrade,
§18A.5).** Audit, across your codebase:

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
crossing cost: the **78× wire tax** — ~156.4 ms for 10k commits across the
boundary vs ~2.017 ms TS median. This is the floor that batching (epic #1493) can
amortise the *crossing* portion of (down toward the ≤50 ns/op floor at large
`afterN`), but it does **not** amortise the *engine-exec* cost. At current WASM
runtime maturity (no GC GA, limited JIT, no SIMD) the Rust-engine-in-WASM
per-commit execution cost is **~85×** the TS engine — a property of today's
runtime, not of the engine design, and one batching provably cannot remove.

**What this means for you, concretely:**

- **At 0.9.0 (the wrapper):** expect **~0% wall-time delta** vs `backend: 'js'`.
  The wrapper runs the same TS pipeline under the FFI shape. The right reason to
  opt in today is to wire the seam and exercise the host-tier matrix — not to win
  on wall-time.
- **At the real-Rust swap (epic #1133):** the wasm path is **acceleration for
  specific graph shapes** — very high derivation depth, large node counts where
  the JS engine's GC and hidden-class pressure dominate CPU profiles — **not** a
  universal speedup. For most workloads the TS engine wins on cold-start latency
  and bundle size; for those, importing the wasm entry point is a net loss.
- **Opting into the v2.x `engine: 'rust-ssot'` surface** (epic #1515,
  default-off) is **not** a perf win at v1.x/v2.x and is explicitly not promoted
  by default; it is future-facing infrastructure behind a per-graph opt-in and a
  maturity tripwire. The #1133 perf-floor falsification (the A.1 probe fired a
  STOP-VERDICT on 2026-05-13) is **not** refuted by it.

**Promotion is governance, not a CI flip.** The wasm engine becomes the default /
replacement only when **all** five §18A.7 GO/NO-GO criteria pass — byte-identity
(1), full FFI surface (2), the perf ceiling above (3), the Node target + a
real-Rust production adopter (4), and the §18A.7 governance criterion (5) — and a
**dated amendment** by the governance authority records the promotion. A green
gate never auto-flips the value-of-record. Until then, the TS engine is the
unconditional floor and the wasm engine is the documented alternative with its
costs transparent.

---

## See also

- [`SPEC.md` §18A](../SPEC.md) — the two-engine contract (the governing source
  for everything above): §18A.1 equivalence, §18A.2 Node target, §18A.4 thin TS
  API, §18A.5 read-identity, §18A.6 FFI atomicity, §18A.7 GO/NO-GO criteria,
  §18A.10 topology, §18A.11 Python tooling.
- [`packages/core/wasm/README.md`](../packages/core/wasm/README.md) — the
  `@causl/core/wasm` entry point: cost shape, host requirements, CSP, bundler
  interop, the H1 callout, the `WasmBackendUnavailableError` codes.
- [`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) — preload / SRI
  posture, dynamic-import vendoring, the five structured fallback codes, and the
  full H1 read-identity migration walkthrough.
- `causljs/causl-wasm` [`scripts/README.md`](https://github.com/causljs/causl-wasm/blob/main/scripts/README.md)
  — the producer-side `build_wasm.py` / `package_wasm.py` contract this guide
  consumes.
