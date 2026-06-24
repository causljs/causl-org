# `@causl/core/wasm`

> ✅ **The wasm engine is a real Rust engine and the production
> default.** The §18A.3 FFI structural lift landed
> ([`causljs/causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170)):
> the engine reached over `@causl/core/wasm` is `engine-rs-core`
> compiled to WebAssembly — **not** the old "TS engine wrapped in the
> FFI shape" — and **every adopter operation resolves from Rust**:
> `commit` / `read` / `subscribe` / `derived` plus the second-tier
> `dependencies` / `dependents` / `stats` / `commitLog` /
> `explain` (incl. per-node timestamps via `node_meta`) / `exportModel`
> / `readAt` / `snapshotAt` / `subscribeCommits`. The only JS left in
> the hot path is the user's own `derived()` compute lambda, which runs
> in JS over the bridge callback **by design**. Multi-instance isolation
> is shipped via `engine_id` multiplexing, so independent graphs in one
> process never alias state.
>
> Orchestration is in Rust; compute lambdas are in JS; per-commit
> wall-time stays within the §14 RAIL responsiveness budget (perf is
> **not** the reason this engine ships — complexity-elimination is).
> What remains is the literal **zero-TS core** — removing the internal
> TS scaffolding the engine no longer routes through — a scoped future
> epic, not a gate on the production engine.

WebAssembly engine entry point for `@causl/core` — the production engine.

## Integrate causl-wasm + causl-client into your Node.js app

`causl-client` is **wasm-default with a TS capability-fallback**: the
wasm engine is the production engine behind the §12 `Graph` surface (SPEC
§18A.1), and the retained internal TS engine is the implicit
`createCausl()` path's WasmGC-unavailable fallback (SPEC §18A.13.1, loud,
never silent — explicit wasm still fails loud). Your application programs
against that surface only — never against an engine.

| Engine | What it is | Role in `causl-client` |
| --- | --- | --- |
| **causl-wasm** | The Rust → WebAssembly engine core (`engine-rs-core` + `engine-rs-bridge`), reached through the **causl-client** thin TS FFI binding. Every adopter op resolves from Rust; the §18A.3 FFI lift has landed ([causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)). | **The production engine** (`rust-ssot`), reached via `createCausl()` once `preloadCauslWasm()` has run. |
| internal TS floor (`createCauslTs`) | The deterministic TypeScript reference engine. | **Internal, not a public engine choice** — the §12 conformance reference, the `backend: 'auto'` auto-adapt path, the `WasmBackend` / `JsFallbackBackend` scaffolding, AND the implicit `createCausl()` path's WasmGC-unavailable **capability fallback** (SPEC §18A.13.1 — loud, never silent). |

> **Status — the production engine is real Rust.** `@causl/core/wasm`
> reaches `engine-rs-core` compiled to WebAssembly, and **every adopter
> operation resolves from Rust** (§18A.3 lift landed,
> [causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)) —
> this is **not** the old "TS engine wrapped in the FFI shape." The
> user's `derived()` compute lambdas run in JS over the bridge callback
> **by design**; that is the only JS in the hot path. The orchestration
> (commit pipeline, dependency walk, scheduling) is Rust. Per-commit
> wall-time stays inside the §14 RAIL responsiveness budget; perf is
> explicitly **not** the driver — `causl-client` made wasm its default
> engine for complexity-elimination, recorded as a dated §13.8/§18A.13
> governance amendment that deliberately bypassed the §18A.7 promotion
> gate (the implicit-path TS capability fallback is re-extended by
> §18A.13.1).

### Producer side — build & place the artefact with `causl-wasm`'s Python tooling (Enterprise)

The **producer** repo (`causljs/causl-wasm`) owns the Rust engine plus
two **stdlib-only Python 3 scripts** — no `pip install`, no Node, drops
into any CI/CD pipeline (SPEC §18A.11). It builds the size-optimised
`--target nodejs` `.wasm` **once** and places it, with a version +
per-file-sha256 manifest, at a destination the consuming app states.
Build-once / place-where-told; no rebuild-per-app, no runtime network,
fails **loudly** on any mismatch.

```sh
# BUILD half — needs a Rust toolchain (cargo ≥1.89), wasm-pack 0.14, binaryen wasm-opt ≥119.
# Compiles tools/engine-rs-bridge to a lean, serde-free, node-target .wasm
# (wasm-pack build … --target nodejs --no-default-features --features <strategy>),
# then external wasm-opt -Oz. --bridge picks the string strategy:
#   gc-classic  -> classic-strings   (UTF-16 fallback, DEFAULT)
#   gc-builtins -> js-string-builtins (no-copy wasm:js-string)
python3 scripts/build_wasm.py --bridge gc-classic            # -> build/wasm-nodejs

# PACKAGE half — CPython stdlib only, NO Rust toolchain. --dest is REQUIRED.
# Places causl_engine_bridge_bg.wasm + .js (node glue) + .d.ts verbatim,
# and writes causl-wasm.manifest.json (schema "causl-wasm/manifest@1") carrying
# engineVersion, bridge, target:"nodejs", wasmOptFlags, and files[] = {name, sha256, bytes}.
python3 scripts/package_wasm.py --build --dest apps/web/src/engine/wasm
```

The single `--build --dest <DIR>` call does build + place in one step —
the common pipeline entry point. The manifest is byte-reproducible (no
`built-at` by default), so git-track it and add a **loud, network-free
verify gate** (file existence + per-file sha256 against the manifest)
to CI and/or a pre-commit hook: a corrupt, missing, or version-skewed
`.wasm` is a hard failure, never a silent fall-through. A consuming app
needs only **CPython stdlib and a checksum to vendor** — **never a Rust
toolchain**.

To support the §18A.12 sync seam (above), `package_wasm.py` also places
the **`causl-compute-imports.js` snippet** next to the `.wasm` / `_bg.js`
in each bridge dir, and the scripts **assert (fail-loud)** on:

- the §18A.12 **sync instantiate seam** — `new WebAssembly.Instance` in
  the `--target nodejs` glue and an exported `__wbg_set_wasm` in the
  bundler `_bg.js` (a wasm-pack / wasm-bindgen upgrade that drops either
  fails the build, never silently);
- **snippet presence** — the compute-imports snippet is packaged, so the
  sync factory always has a real sidecar + snippet and the throw-stub
  path is dead;
- **node-loadability** — `gc-classic` loads as `--target nodejs`;
  `gc-builtins` emits `require("wasm:js-string")`, which stock Node
  cannot resolve, so it is **bundler-target only**.

### Consumer side — install `@causl/core` and load over `@causl/core/wasm`

The **consumer** package is **`@causl/core`** (the thin TS API;
`causl-client` is the repo, there is no separately-published
`causl-client` npm package). The `engines` field requires **Node ≥ 22**
(matching the host table below), ESM-only.

```bash
npm install @causl/core        # or: pnpm add @causl/core
```

```ts
import { createCausl } from '@causl/core'
import { loadWasmBackend, WasmBackendUnavailableError } from '@causl/core/wasm'

// The wasm seam lives behind the `./wasm` subpath export. Importing the
// bare `@causl/core` does NOT pull the wasm chunk (sideEffects:false) —
// only an explicit `import('@causl/core/wasm')` (or
// createCausl({ backend: 'auto' | 'wasm' }) past the auto threshold)
// pays the cost.
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

`loadWasmBackend(options?)` is the **primary entry point** of
`@causl/core/wasm` — async, returns a `BackendEngine` (the seven-method
`Graph` spine plus the second-tier methods), caches per bridge, and on
a non-loadable pinned bridge throws `WasmBackendUnavailableError` so
adopters branch back to the internal TS floor. The structured `code`
values are listed in the [API](#api) section below; a missing/unbuilt
artefact surfaces as `code: 'CAUSL_WASM_NOT_BUILT'`. Honoured options:
`bridge` (`'wasmgc-builtins'` | `'wasmgc-classic'`), `wasmBaseUrl`
(CDN/CSP override), `fetch`, `graphName`, `batchedFlush`, and `engine`
(`'rust-ssot'` default | `'js-ssot'` internal reference).

> **Higher-level convenience — the public factories.** The default
> public factory is `createCausl()`, exported from the main
> `@causl/core` barrel: it **routes to the real wasm engine
> synchronously** once `@causl/core/wasm` has been preloaded for the
> default bridge (via `preloadCauslWasm()`), and otherwise builds a
> working synchronous `Graph` on the internal TS floor (a
> sync-ergonomics fallback, non-breaking for sync callers that never
> preload). Alongside it, the `@causl/core/wasm` subpath exposes the
> wasm factories — `createCauslWasm()` (async) and
> `createCauslWasmSync()` (sync) — kept out of the main bundle. The
> synchronous `createCauslWasmSync()` is the §18A.12 sync-separation
> surface documented in [Synchronous
> construction](#synchronous-construction--preload--createcauslwasmsync-spec-18a12)
> below. `createCauslTs` is **not** a public factory of `@causl/core`
> — adopters cannot pick the pure-TS engine directly; it survives only
> internally as the wasm path's structural scaffolding.

## Synchronous construction — preload + `createCauslWasmSync` (SPEC §18A.12)

The wasm engine is **synchronous from a consumer's perspective**. The
one unavoidable async — compiling the `WebAssembly.Module` — is split
out of construction so a sync consumer (React render/hooks, an
`xldatagrid` cell, synchronous SSR) can build a wasm-backed `Graph`
with **no `await` at the call site**. The single `await` lives once, at
app init.

```ts
import {
  preloadCauslWasm,
  createCauslWasmSync,
  CauslWasmNotPreloadedError,
} from '@causl/core/wasm'

// ONCE, at app/init — the one async seam.
await preloadCauslWasm()

// Then, anywhere — fully synchronous, zero await at the call site.
function useCauslGraph() {
  const graph = createCauslWasmSync()   // sync; safe in render/hooks
  // ...
}
```

**`await preloadCauslWasm(opts?): Promise<CauslWasmModule>`** — the ONE
async seam, called **once** per process+bridge at app init. It resolves
the bridge (via `detectBridge()` unless pinned) and the per-graph
backend params, caches the result keyed by bridge, and is **idempotent**
(concurrent calls share one resolution; a transient failure drops the
cache entry so the next call retries). It is loud-fail: an unresolvable
bridge throws a `WasmEngineUnavailableError` rather than degrading. Two
synchronous companions peek the **resolved** state without awaiting:
`isCauslWasmPreloaded(bridge?)` and `getPreloadedCauslWasm(bridge?)`
(both read the resolved slot, set in the preload's `.then` — not merely
its in-flight promise).

**`createCauslWasmSync(handle?, create?): Graph`** — **fully
synchronous**. It constructs the backend for the preloaded bridge and
wraps it in a public seven-method `Graph`, all in one tick. The handle
is the value returned by `preloadCauslWasm()`, or — when omitted — the
preloaded handle for the most-recently-resolved bridge. It **never
silently awaits**: a wasm-authoritative graph and a TS graph differ in
`read()`-identity / commit-clock (§15.1), so a silent swap is a
glitch-freedom hazard. When nothing is preloaded for the bridge it
either

- **throws `CauslWasmNotPreloadedError`** (the default) — naming the
  remedy (`preloadCauslWasm()`) and the bridge; or
- with **`{ fallbackToTs: true }`** synchronously degrades to the
  **internal TS floor** — not a public engine choice, but the same
  structural scaffolding the wasm path wraps — safe because js-ssot is
  byte-identical (§18A.1.1).

`CauslWasmNotPreloadedError` is a subclass of the
`WasmEngineUnavailableError` family; branch on
`error.code === 'CAUSL_WASM_NOT_PRELOADED'` (the base family carries
`'CAUSL_WASM_ENGINE_UNAVAILABLE'`). The same `fallbackToTs` policy
applies to the explicit wasm request: **default `false` — an explicit
wasm request throws loud on failure**; set `true` only when you truly
want the soft TS path.

**`createCauslWasm(opts?): Promise<Graph>`** — the existing async
factory is **retained**, now re-expressed as
`preload ∘ createCauslWasmSync`: `const h = await preloadCauslWasm(opts);
return createCauslWasmSync(h, opts)`. One construct codepath, provably
equal to its two halves, zero drift. It honours the same
`{ fallbackToTs: true }` soft path.

**Node vs browser.** On Node/SSR the `--target nodejs` glue is
synchronous end-to-end (`readFileSync` + `new WebAssembly.Module` +
`new WebAssembly.Instance` at require-time), so `createCauslWasmSync`
works **without** a prior preload — server render stays synchronous. In
the browser the bundler path requires `await preloadCauslWasm()` to
complete **before the first render** that constructs a wasm graph; this
ordering is load-bearing for SSR↔CSR hydration parity. The construction
`await` is hoisted to bootstrap, **outside any commit envelope**, so the
§18A.6 single-tick atomicity invariant is untouched.

> **Shipped (honest).** The **API surface, the sync contract above, and
> the real Rust engine are all SHIPPED** in this `causl-client`
> distribution. `preloadCauslWasm()` compiles the real
> `WebAssembly.Module` (the `_bg.js` sidecar + compute-imports snippet
> are vendored under `packages/core/wasm-pkg/`), and
> `createCauslWasmSync()` constructs a wasm-authoritative `Graph` whose
> every adopter operation resolves from Rust (§18A.3 lift landed,
> [causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)).
> The user's `derived()` compute lambdas run in JS over the bridge
> callback **by design** — that is the only JS in the hot path. The
> authoritative loader source is mirrored in the
> `causl-ts-wasm-engine` fork, and `SPEC.md` stays byte-identical across
> both (§18A.12).

### Node-target status — shipped (precise)

| Capability | Status |
| --- | --- |
| Producer `--target nodejs` build + placement (`build_wasm.py` / `package_wasm.py`, sha256 manifest) | **SHIPPED** (SPEC §18A.11) |
| Consumer `@causl/core/wasm` loader, bridge picker, instantiate path | **SHIPPED** (epic #680) |
| Engine runtime = the **real `engine-rs-core` Rust engine** compiled to WebAssembly; every adopter op resolves from Rust | **SHIPPED** — §18A.3 FFI lift landed ([causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)) |
| Multi-instance isolation via `engine_id` multiplexing | **SHIPPED** |
| `read()` returns a fresh object per call (deserialised across FFI) — reference identity is **not** contractual | **SHIPPED** (SPEC §18A.5 / §15.1) — memoise on `commit.time` / node-version, never on the read reference (see the [H1 callout](#h1-callout--graphreadnode-reference-identity-is-not-contractual-1124-ratified-by-spec-151-amendment-via-pr-1129)). |
| `engine: 'rust-ssot'` (the default) | **SHIPPED** — the production engine. `'js-ssot'` is the internal conformance reference only. |
| Literal zero-TS core (removing the internal TS scaffolding the engine no longer routes through) | **FUTURE** — a scoped epic, not a gate on the production engine. |

So on Node today: the producer node-target tooling and the consumer
loader are real and shipped, and the engine they reach is the **real
Rust `engine-rs-core`** — orchestration in Rust, the user's `derived()`
compute lambdas in JS over the bridge callback. Per-commit wall-time
stays inside the §14 RAIL budget.

### Enterprise framing

**causl-wasm + causl-client are the Enterprise-tier path.** An
Enterprise CI/CD pipeline builds and vendors a pinned, checksummed
`.wasm` with the Python tooling (CPython stdlib + a checksum, never a
Rust toolchain in the consuming app), and the app reaches it through the
`@causl/core/wasm` seam — which is the **production engine**, not an
opt-in accelerator. The internal TS floor is retained only as the §12
conformance reference / auto-adapt / fallback scaffolding, never as a
public engine choice.

### `causl-client` is wasm-default with a TS capability-fallback (SPEC §18A.13 + §18A.13.1 — shipped)

A dated §13.8/§18A.7 governance amendment (2026-06-19) **committed
`causl-client` to ship the wasm engine as its default engine** and to
**remove the pure-TS engine (`createCauslTs`) from `causl-client`'s
public surface**. The driver is **complexity-elimination** — shedding
the dual-engine maintenance burden for one Rust-authoritative engine;
**perf is explicitly accepted as immaterial** (it stays within the §14
RAIL responsiveness budget) and is **not** an argument anywhere in the
amendment. The decision **deliberately bypassed** the §18A.7 GO/NO-GO
promotion gate for `causl-client` and stated the bypass plainly.

SPEC §18A.13.1 (2026-06-23) then **partially reversed the fail-loud
stance for the implicit `createCausl()` path only**: `createCauslTs` is
**retained and wired** as that path's WasmGC-unavailable **capability
fallback** (loud — one-time `console.warn` + `onCauslCapabilityFallback`
telemetry, never silent). The **explicit** `createCauslWasm()` /
`createCauslWasmSync()` / `engine:'rust-ssot'` factories **still fail
loud** (`CAUSL_WASM_ENGINE_UNAVAILABLE`). `createCauslTs` is **not
deleted** — it stays as the §12 conformance reference + the implicit
fallback engine.

This **shipped** (epic [#31](https://github.com/causljs/causl-client/issues/31)
/ issue [#34](https://github.com/causljs/causl-client/issues/34)),
executed in **wire-before-cut** order so the repo was never left with
zero working engine:

1. **WIRE** — the fork's authoritative Rust→wasm loader was ported into
   `causl-client` (the `.wasm` / `_bg.js` artefacts are vendored under
   `packages/core/wasm-pkg/`).
2. **FLIP + SYNC** — `createCausl()` runs the wasm engine synchronously,
   via the §18A.12 `preloadCauslWasm()` + `createCauslWasmSync()` split
   documented above. Sync consumers (e.g. `xldatagrid`'s `createCausl()`
   sites) keep calling `createCausl()` **unchanged** and transparently
   get wasm once the bridge is preloaded at app boot.
3. **CUT** — `createCauslTs` was removed from `causl-client`'s public
   `@causl/core` barrel; adopters can no longer pick the pure-TS engine
   directly. It survives **only internally**, as the §12 conformance
   reference / auto-adapt / fallback scaffolding — and, per **SPEC
   §18A.13.1**, is **retained and wired** as the implicit `createCausl()`
   path's WasmGC-unavailable capability fallback (the literal deletion of
   `createCauslTs` is dropped from scope — it is kept, not deleted). The
   §18A.3 FFI lift has since **landed**
   ([causljs/causl-wasm#170](https://github.com/causljs/causl-wasm/issues/170)),
   so every adopter op resolves from Rust under rust-ssot.

App-boot invariant: the only async step is `WebAssembly.compile`, so an
app `await preloadCauslWasm()` **once** at boot (before first render),
then calls sync `createCausl()` / `createCauslWasmSync()` everywhere. A
no-preload `createCausl()` still returns a working synchronous `Graph`
on the internal TS floor — a *silent* sync-ergonomics fallback, distinct
from the §18A.13.1 host-incompatibility fallback. On a host where the
WasmGC engine cannot **instantiate** (even with a module preloaded), the
behaviour splits by **how** the engine was requested: the **implicit**
`createCausl()` path degrades to the internal TS floor **loudly** (SPEC
§18A.13.1 — one-time `console.warn` + `onCauslCapabilityFallback`
telemetry), so a no-wasm enterprise user gets a working app; the
**explicit** `createCauslWasm()` / `createCauslWasmSync()` /
`engine:'rust-ssot'` factories **still fail loud**
(`CAUSL_WASM_ENGINE_UNAVAILABLE`).

The strip is scoped to `causl-client` only. The **`causl-ts-wasm-engine`
fork is NOT wasm-only**: it **keeps the dual-engine TS floor**, with
`createCauslTs` still public there, as the differential-test oracle
(§18A.1.1 JS side), the benchmark repo, and the source of the
authoritative loader ported here. `createCauslTs` is removed from
`causl-client`, not from `causl`.

## When to use

This entry point is the **production engine** for `causl-client`. The
default `createCausl()` (after one `await preloadCauslWasm()` at boot)
routes here; reach for the explicit `createCauslWasm()` /
`createCauslWasmSync()` factories when you want the engine spelled out at
the call site, or for `loadWasmBackend()` when you need the low-level
`BackendEngine` and the structured `WasmBackendUnavailableError`
fallback dispatch.

Orchestration (the commit pipeline, dependency walk, scheduling) runs in
Rust; the user's `derived()` compute lambdas run in JS over the bridge
callback **by design**. Per-commit wall-time stays inside the §14 RAIL
responsiveness budget — perf is **not** the reason this engine ships
(`causl-client` made wasm its default engine for complexity-elimination).
The internal TS floor and the `backend: 'auto'` auto-adapt heuristic
(#686) survive as conformance / fallback scaffolding and as the implicit
`createCausl()` path's §18A.13.1 capability fallback, never as a public
engine choice.

## Cost shape

| Surface                                     | Cost                                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@causl/core` main bundle                   | Tiny loader stub (~1 KB). No WASM import.                                                                                                                               |
| `@causl/core/wasm` (this)                   | Loader interface + bridge picker (~2 KB).                                                                                                                               |
| WASM artifact                               | 60–213 KB raw / 45–66 KB Brotli (GC-builtins ≈ 45 KB Brotli; serde-json **66 KB Brotli, 13 KB over the §17.6 80 KB target** — see Issue #1150 / PR #1161).              |
| First-use construction round-trip           | ~50–200 ms on a 10k-node graph.                                                                                                                                         |
| Per-commit boundary cost                    | Within the §14 RAIL responsiveness budget; the only JS in the hot path is the user's `derived()` compute lambda over the bridge callback. |

## H1 callout — `graph.read(node)` reference identity is **not** contractual (#1124, ratified by SPEC §15.1 amendment via PR #1129)

> **Read-identity warning.** `graph.read(node)` is not contractually
> required to return the same JavaScript reference across calls, and the
> production wasm engine **returns a fresh object per call** as the value
> is deserialised across the FFI boundary (the §18A.3 lift landed). The
> SPEC §15.1 amendment ratifying this (PR #1129) shipped with 0.9.0.
> Adopters who `React.memo` / `useMemo` on the read return reference
> re-render every commit silently. **Memoise on `commit.time` or
> `EngineTelemetry.nodeVersion(node)`, not on the read return
> reference.** See `docs/wasm-adoption-guide.md` § H1 for the
> right-vs-wrong code example, and SPEC §15.1 for the contract
> sentence.

## Host requirements

| Host                   | Status                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| **Node**               | 22.0+ (WebAssembly 1.0 baseline). 22.6+ for the GC-builtins bridge. |
| **Chrome / Edge**      | 95+ (WebAssembly 1.0 + `wasm-unsafe-eval`). 131+ for GC-builtins.   |
| **Firefox**            | 102+ (`wasm-unsafe-eval`). 130+ for GC-builtins.                    |
| **Safari**             | 16+ (WebAssembly 1.0). 18.2+ for the WasmGC-classic bridge.         |
| **Cloudflare Workers** | All current versions (`compatibility_date >= 2023-09-01`).          |
| **Deno**               | 1.30+ (`--allow-net` for fetch).                                    |

The bridge picker (`detectBridge()`) is **scaffolding today** — a
placeholder (#691) that always returns `'wasmgc-classic'`. The
**planned** real host probe selects the most-capable artifact the host
actually supports at module load, with hosts that lack WasmGC falling
back to the universal `serde-json` bridge automatically. Until that
lands, pin the bridge explicitly via `loadWasmBackend({ bridge })` if
you need a specific one.

## Content-Security-Policy

Modern WASM execution requires `script-src 'wasm-unsafe-eval'`
(Chrome 95+, Firefox 102+; supersedes the legacy `'unsafe-eval'`
escape hatch).

Restrictive CSPs without that directive cause `loadWasmBackend()` to
throw `WasmBackendUnavailableError` with
`code: 'CAUSL_WASM_CSP_BLOCKED'`; adopters branch on the code to fall
back to the TS engine. Document `'wasm-unsafe-eval'` prominently in
the host app's CSP posture before enabling.

For hosts with strict `connect-src`, expose a CDN fallback via
`WasmBackendOptions.wasmBaseUrl`:

```ts
import { loadWasmBackend } from '@causl/core/wasm'

const backend = await loadWasmBackend({
  wasmBaseUrl: 'https://cdn.jsdelivr.net/npm/@causl/core@<version>/wasm/pkg/',
})
```

The loader does **not** auto-fallback to the CDN — adopters must
whitelist the chosen origin in their CSP `connect-src` explicitly.

## Bundler interop

This entry point ships against three target bundlers:

- **webpack 5** — set `experiments.asyncWebAssembly: true` so
  `import()` of the `.wasm` artifact resolves through the asset
  module pipeline.
- **Vite 5** — install `vite-plugin-wasm` until the rolldown-native
  WASM path lands. The loader uses `?url`-style URL resolution
  internally.
- **esbuild 0.20+** — pass `--loader:.wasm=file`. The non-streaming
  fallback path covers esbuild's lack of native streaming-instantiate
  glue.
- **Node 22+ ESM** — works out of the box. The artifact is resolved
  through the package's `exports` map.

A fixture matrix lives in `e2e/bundler-interop/`
(landed via #689); PRs that touch this entry point or the
`wasm-pack` output are gated on every bundler in the matrix
producing a working build.

## API

```ts
import { loadWasmBackend, detectBridge, WasmBackendUnavailableError } from '@causl/core/wasm'

// Default — auto-detects the fastest bridge supported by the host.
const backend = await loadWasmBackend()

// Pin a bridge.
const backend = await loadWasmBackend({ bridge: 'wasmgc-classic' })

// CSP / CDN scenario.
const backend = await loadWasmBackend({
  wasmBaseUrl: 'https://cdn.example.com/causl/wasm/',
})
```

When `loadWasmBackend()` cannot resolve a usable bridge (CSP block,
missing host support, pinned bridge that the host does not support,
or fetch failure), it throws `WasmBackendUnavailableError`. Adopters
branch on the structured `code` field to fall back to the TS engine:

```ts
try {
  return await loadWasmBackend()
} catch (err) {
  if (err instanceof WasmBackendUnavailableError) return jsBackend
  throw err
}
```

See `docs/wasm-adoption-guide.md` §3 for the five structured `code`
values and the per-code adopter dispatch.

### Synchronous-construction surface (§18A.12)

For the preload + sync-factory split — the way a sync consumer builds a
wasm graph with no `await` at the call site — see [Synchronous
construction](#synchronous-construction--preload--createcauslwasmsync-spec-18a12)
above. The added exports:

```ts
import {
  preloadCauslWasm,        // async, ONCE at app init — the one async seam
  createCauslWasmSync,     // fully synchronous Graph construct (zero await)
  isCauslWasmPreloaded,    // sync peek — resolved-ness for a bridge
  getPreloadedCauslWasm,   // sync peek — the resolved handle (or undefined)
  CauslWasmNotPreloadedError,
  WasmEngineUnavailableError,
} from '@causl/core/wasm'

await preloadCauslWasm()                 // once, at app init
const g = createCauslWasmSync()          // sync, at every render/hook

// Soft path — degrade to the pure-TS floor instead of throwing:
const soft = createCauslWasmSync(undefined, { fallbackToTs: true })

// The retained async factory == preload ∘ createCauslWasmSync:
const viaAsync = await createCauslWasm({ fallbackToTs: true })
```

## Status

This module ships the **loader, bridge picker, instantiate path, and the
real `engine-rs-core` Rust engine** — the production engine for
`causl-client` (with a retained TS capability fallback on the implicit
path, SPEC §18A.13.1). The substrate sub-tasks landed under epic #680
(closed):

- #682 — Rust workspace + `engine-rs-core` + bridge crates. **Merged.**
- #683 — `wasm-pack` build pipeline + dual-artifact GC bridge. **Merged.**
- #693 — `serde_json` + UTF-8 fallback bridge (the universal baseline). **Merged.**
- #691 — Pluggable Bridge interface + feature-detection harness. **Merged.**
- #681 — `BackendEngine` interface in TS. **Merged.**
- #684 — JS bindings + lazy-load loader + `@causl/core/wasm` entry. **Merged (PR #1031).**
- #685 / #687 / #689 / #690 — determinism gate, migration envelope, bundle hygiene, host-tier matrix. **Merged.**

EPIC: [#680](https://github.com/causljs/causl-client/issues/680) — **closed**.
The §18A.3 FFI structural lift — every adopter op resolving from Rust —
**landed** in [`causljs/causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170);
multi-instance `engine_id` isolation is shipped.

### Current-state notes

- **Real Rust engine.** The shipping engine is `engine-rs-core` compiled
  to WebAssembly; the commit pipeline runs in Rust and every adopter op
  resolves from Rust. The user's `derived()` compute lambdas run in JS
  over the bridge callback by design — the only JS in the hot path. The
  one remaining item is the literal **zero-TS core** (removing the
  internal TS scaffolding the engine no longer routes through) — a scoped
  future epic, not a gate on the production engine.
- **Serde bridge bundle ceiling (Issue #1150, amended via PR #1161).**
  The `serde-json` bridge ships at 213 KB raw / 66 KB Brotli, **13 KB
  over** the SPEC §17.6 commitment 14 target of 80 KB Brotli. PR #1161
  amended the size-limit ceiling and documented the divergence as
  acknowledged debt; the GC-builtins and GC-classic bridges remain
  within budget.

## See also

- **SPEC §17.1 commitment 14** + **SPEC §17.6** — the host-tier
  substrate-compatibility commitment (#690 amendment). Commitment
  14 is the SPEC-level contract that this README's host-requirements
  table and the bridge picker's auto-walk behaviour implement.
- **`docs/wasm-adoption-guide.md`** — adopter-facing guide for the
  preload + Subresource Integrity (SRI) posture, dynamic-import
  patterns for vendoring the WASM artefacts, and the structured
  `WasmBackendUnavailableError` fallback dispatch (the five `code`
  values) for hosts where WASM is not available.
