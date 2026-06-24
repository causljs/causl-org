# WASM adoption guide (#690, merged)

Adopter-facing companion to SPEC §17.6 (commitment 14, host-tier
substrate compatibility — ratified via PR #1053) and to the
entry-point reference at `packages/core/wasm/README.md`. This
document covers the five adopter-side questions §17.6's host-tier
table does not answer on its own:

> **Current-state note — real Rust shipped (§18A.7 / §18A.8).** The engine
> returned by `loadWasmBackend()` is the **real `engine-rs-core` Rust core**
> compiled to WebAssembly, reached over FFI — not a TS wrapper. `rust-ssot` is
> the **unconditional production default** (`DEFAULT_WASM_ENGINE_MODE =
> 'rust-ssot'`, 2026-06-21; all five §18A.7 GO/NO-GO criteria GO), with **no
> per-flush byte-compare oracle and no sticky-downgrade fail-safe** (both removed
> per §18A.8 / causl-wasm#169). The §18A.3 FFI structural lift **landed**
> (causl-wasm#170), so **every adopter operation resolves from Rust** — the only
> JS in the hot path is the user's own `derived()` compute lambda, over the
> bridge callback **by design**. The interface is stable, the host-tier matrix is
> live, and the CI-blocking cross-backend determinism gate (§18A.1.1) is green at
> 0-divergence over 100,000 trials. Per-commit wall-time stays inside the §14
> RAIL responsiveness budget; perf is **immaterial** to the default (the driver
> is complexity-elimination, not speed). The contracts and patterns in this guide
> hold under the wasm engine today.

> **Sync-separation note (SPEC §18A.12 — SHIPPED in the fork and in
> causl-client).** Independently of the Rust-port timeline above, the
> wasm engine is now **synchronous from a consumer's perspective**.
> The async work (compiling the `WebAssembly.Module`, the sidecar, and
> the compute-imports snippet) is hoisted into a one-time
> `await preloadCauslWasm(opts?)` at app/init; after it resolves,
> `createCauslWasmSync(handle?, create?)` builds a graph with **zero
> `await` at the call site** (one `new WebAssembly.Instance`, no
> per-call I/O). This is what lets sync consumers — React render,
> `xldatagrid` — build a wasm graph inline. The `--target nodejs` glue
> is already sync end-to-end; only the browser/bundler target needs the
> one-time preload. See §0a for the full surface and the
> not-preloaded / `fallbackToTs` policy. This note is about *call-site
> synchrony*; the §15.1 read-identity hazard in H1 below is orthogonal
> and still applies under the wasm engine.

0. **H1: long-held value references** (#1124). Why
   `React.memo(component, (prev, next) => prev.value === next.value)`
   or `useMemo(() => transform(value), [value])` silently re-renders
   every commit the day you `migrate('wasm')`, and the
   `commit.time`-keyed pattern that survives the migration.
1. **Preload + Subresource Integrity (SRI).** How to make the WASM
   bytes part of your CSP / SRI posture rather than an out-of-band
   fetch.
2. **Dynamic-import patterns for vendoring.** How to ship the WASM
   artefacts from your own origin (CDN, S3, intranet) without
   forking the loader.
3. **Fallback strategy when WASM is unavailable.** The structured
   `WasmBackendUnavailableError` code field and the
   `try`/`catch` shape that lets one codebase target every host in
   §17.6's matrix.
4. **Where to read the host-tier matrix.** A pointer at the
   authoritative spot in `packages/core/wasm/README.md` and the
   SPEC §17.6 elaboration.

This guide is normative for adopters; the SPEC §17.6 row is
normative for the team.

## H1. Long-held value references (the load-bearing read-identity risk)

The Markbåge/Miller ship-verdict panel flagged this as the H1 risk
in the WASM-backend adopter audit (`docs/wasm-backend-adopter-audit.md`,
PR #1021), and the SPEC §15.1 amendment ratifying the non-contract
shipped via PR #1129: **`graph.read(node)` is not contractually
required to return the same JavaScript reference across calls.**
Reference identity is an implementation detail of the internal TS
floor only; the production wasm engine (`rust-ssot`, the shipped
default) returns a **fresh object per call** for an object-valued
node, as the value is deserialised across the FFI boundary on each
read — even when the underlying data did not change.

Adopters who memoise on the read return reference re-render every
commit silently under the wasm engine. The internal `js-ssot`
reference returns the same object trivially, so a codebase that only
ever ran the TS floor will not see the bug there — which is exactly
why this audit matters before you ship on the wasm default (or under
the implicit `createCausl()` path). **Write code that is correct
under the wasm engine, which is what ships.**

### The wrong pattern (silently breaks under the wasm engine)

```tsx
import { useEffect, useState, useMemo } from 'react'
import { useCausl } from '@causl/react'

function Dashboard({ userNode }) {
  const user = useCausl(userNode) // user: { name, email, ... }

  // WRONG: keys on the reference of `user`. Under the TS engine,
  // `user` is the same object across commits where `userNode`
  // didn't change, so `transformedUser` is memoised correctly.
  // Under WASM, every read returns a fresh object — `user`'s
  // reference changes every commit, `useMemo` invalidates every
  // commit, `transform(...)` runs every commit, every downstream
  // memo invalidates, and the dashboard re-renders every commit.
  const transformedUser = useMemo(() => transform(user), [user])

  return <UserCard data={transformedUser} />
}
```

### The right pattern (survives the migration)

Key the memo on **`commit.time`** (the `GraphTime` exposed on
every `Commit` record — monotonic per SPEC §3 atomicity) or on
the per-node version counter exposed by `EngineTelemetry`. Both
survive the reference-identity break because both are value-typed
across the FFI boundary:

```tsx
import { useMemo } from 'react'
import { useCausl, useCauslCommit } from '@causl/react'

function Dashboard({ userNode }) {
  const user = useCausl(userNode)
  const commit = useCauslCommit() // commit.time: GraphTime

  // RIGHT: keys on `commit.time` (a number that monotonically
  // advances) plus the node id. The memo invalidates iff the
  // commit time changes AND the read returns a different value —
  // both conditions are backend-independent.
  const transformedUser = useMemo(() => transform(user), [commit.time, user])

  return <UserCard data={transformedUser} />
}
```

The `[commit.time, user]` dependency array works under both
backends because:

- **Under the TS engine.** `user` reference is stable across
  commits that don't write to `userNode`; `commit.time` advances
  every commit. `useMemo` re-runs every commit, but
  `transformedUser`'s shape is whatever `transform(user)` returns
  — if `transform` itself returns a stable shape for a stable
  input, downstream `React.memo` boundaries hold.
- **Under WASM.** `user` reference changes every commit (a fresh
  deep-copy); `commit.time` still advances every commit.
  `useMemo` re-runs every commit (same as TS); the downstream
  `React.memo` boundary holds the same way.

The two backends end up observably equivalent at the
`React.memo` boundary, which is the contract surface that
matters — the engine cannot promise reference equality of
`read()` returns, but it does promise commit-time monotonicity
and the value-equality of any two reads at the same `GraphTime`.

### Alternative: `EngineTelemetry`'s per-node version counter

For workloads where `commit.time` is too coarse (e.g. the dashboard
holds many nodes and only a few advance per commit), key on the
per-node version counter `EngineTelemetry` surfaces:

```ts
import { useMemo } from 'react'
import { useCausl, useEngineTelemetry } from '@causl/react'

function ExpensiveTransform({ node }) {
  const value = useCausl(node)
  const telemetry = useEngineTelemetry()
  // Per-node version counter — advances iff this node's value
  // actually changed at the most recent commit.
  const version = telemetry.nodeVersion(node)

  return useMemo(() => expensiveTransform(value), [version])
}
```

This is the right shape for "memo on commit only if this specific
node changed" — the per-node version counter is backend-independent
by construction.

### Cross-link

- **SPEC §15.1 amendment (Issue #1124, ratified via PR #1129).** The
  contract-level statement: reference identity is not part of the
  `graph.read(node)` contract; adopters must memoise on `commit.time`
  or `EngineTelemetry.nodeVersion(node)`.
- **SPEC §17.6.** Names the substrate where this hazard materialises
  (the real Rust engine, `rust-ssot` — the shipped default). The
  internal `js-ssot` TS floor returns a stable reference, which only
  masks the bug; the wasm engine that ships does not.
- **`docs/wasm-backend-adopter-audit.md` H1.** PR #1021's audit
  doc; the H1 row is this hazard. PR #1129 executed the SPEC §15.1
  amendment the audit recommended; this section is the
  adopter-facing companion.
- **`packages/core/wasm/README.md` H1 callout.** Adopter-facing
  callout above the host-tier table that points at this section.

## 0a. Synchronous construction: `preloadCauslWasm` + `createCauslWasmSync`

SPEC §18A.12 splits the wasm engine's one async step away from its
construction so that **building a wasm graph is synchronous at the
call site**. This section is SHIPPED — in the fork and in
causl-client. It is the recommended path for any consumer that
constructs a graph inside a synchronous frame (a React render, an
`xldatagrid` cell-model setup, a synchronous factory) and therefore
cannot `await`.

### The two-step surface

```ts
import {
  preloadCauslWasm,
  isCauslWasmPreloaded,
  getPreloadedCauslWasm,
  createCauslWasmSync,
  createCauslWasm,
} from '@causl/core/wasm'

// 1. ONCE, at app/init (top of `main`, a bootstrap effect, a test
//    `beforeAll`). Compiles + caches the WebAssembly.Module, the
//    sidecar, and the compute-imports snippet. Idempotent — calling it
//    again is a cheap no-op that resolves to the cached handle.
await preloadCauslWasm()

// 2. Anywhere downstream, with NO await at the call site:
const graph = createCauslWasmSync()
```

- **`preloadCauslWasm(opts?): Promise<PreloadedCauslWasm>`** — the
  single `await`. Compiles and caches the `WebAssembly.Module` plus the
  sidecar and the compute-imports snippet. Idempotent and safe to call
  from multiple call sites; concurrent callers share one in-flight
  compile. Takes the same option surface that configures the underlying
  bridge/artefact resolution.
- **`isCauslWasmPreloaded(): boolean`** and
  **`getPreloadedCauslWasm(): PreloadedCauslWasm | undefined`** —
  companions for code that needs to branch on, or hand off, the cached
  handle without re-triggering the compile.
- **`createCauslWasmSync(handle?, create?, opts?): Graph`** — **fully
  synchronous**: it does one `new WebAssembly.Instance` against the
  already-compiled module and returns a `Graph` with **zero `await`**.
  Pass an explicit preload `handle` to bind a specific cached snapshot,
  or omit it to use the module-global one from `preloadCauslWasm()`.
  The optional `create` callback is your graph-construction body, run
  synchronously against the new instance. The optional `opts` object
  carries the not-preloaded policy (`{ fallbackToTs }`) — see below.

### The not-preloaded policy (`fallbackToTs`)

`createCauslWasmSync()` cannot compile on demand — that is the whole
point of moving the `await` out. If it is called before
`preloadCauslWasm()` has resolved, it **throws
`CauslWasmNotPreloadedError`**. That is the default, fail-loud
behaviour: it tells you your init ordering is wrong rather than
silently stalling a render.

Consumers that prefer a graceful degrade pass `{ fallbackToTs: true }`,
which constructs a graph on the **internal TS floor** (the synchronous
sync-ergonomics fallback) instead of throwing:

```ts
// Fail loud (default) — surfaces an init-ordering bug.
const graph = createCauslWasmSync()

// Degrade to the internal TS floor if the wasm preload has not landed yet.
const graph = createCauslWasmSync(undefined, undefined, { fallbackToTs: true })
```

The internal TS floor is behaviour-equivalent per the §15.1
cross-backend contract (see §3), so a `fallbackToTs` graph is correct —
it is only unaccelerated. Note that this is the **internal floor**, not
a public engine choice: `createCauslTs` is no longer exported from the
causl-client `@causl/core` barrel, so `fallbackToTs` is the only way to
reach the floor explicitly, and that opt-in degrades **silently** (you
asked for it) — distinct from the §18A.13.1 **implicit** capability
fallback (which is loud; see §0b).

**Two different fallbacks — do not conflate them:**

- `{ fallbackToTs: true }` (this section) — a **sync-ergonomics**
  opt-in: a caller that explicitly uses the wasm factory accepts a TS
  graph rather than a throw when the wasm path is unresolvable.
  Silent, per-call, opt-in.
- the §18A.13.1 **implicit-path capability fallback** (§0b) — the
  default `createCausl()` factory degrades to the TS floor on a host
  where the WasmGC engine cannot **instantiate**, **loudly** (one-time
  `console.warn` + telemetry). No opt-in needed; never silent.

The **explicit** `createCauslWasm()` / `createCauslWasmSync()` /
`engine:'rust-ssot'` factories **still fail loud**
(`WasmEngineUnavailableError`, `code === 'CAUSL_WASM_ENGINE_UNAVAILABLE'`)
on a WasmGC-unavailable host unless you pass `{ fallbackToTs: true }` —
a consumer that explicitly asked for wasm must never silently run on JS.

### `createCauslWasm` is retained = preload ∘ sync

The original async one-shot is still exported and unchanged in meaning:

```ts
// createCauslWasm(opts?)  ===  await preloadCauslWasm(opts) then createCauslWasmSync()
const graph = await createCauslWasm()
```

Use `createCauslWasm()` when you already have an `await` in scope and
do not need to amortise the compile across many graphs.
`preloadCauslWasm()` + `createCauslWasmSync()` is the right split when
the *construction* site is synchronous, or when you build many graphs
and want to pay the compile exactly once.

### The constructors

The adopter-facing public surface is **wasm-first**. The factories are:

| Constructor | Engine | Sync? |
| --- | --- | --- |
| `createCausl(...)` | wasm (real engine) once preloaded; internal TS floor otherwise (not-preloaded, silent) OR on a WasmGC-unavailable host (§18A.13.1 capability fallback, loud) | synchronous |
| `createCauslWasm(opts?)` / `createCauslWasmSync(handle?, create?, opts?)` | wasm — fails loud on a WasmGC-unavailable host (no silent fallback) | `createCauslWasm` is async; `createCauslWasmSync` is synchronous after preload |

`createCausl(...)` is the **default factory** and the engine-selection
entry point. Once `@causl/core/wasm` has been preloaded for the default
bridge (via `preloadCauslWasm()`), `createCausl()` routes to the real
wasm engine **synchronously**. If no preload has happened, it builds a
working synchronous `Graph` on the **internal TS floor** — a
sync-ergonomics fallback that keeps sync callers who never preload
non-breaking. And on a host where the WasmGC engine cannot
**instantiate** even though a module IS preloaded, it degrades to the TS
floor **loudly** (the §18A.13.1 capability fallback — one-time
`console.warn` + telemetry). It is no longer a thin wrapper, and no
longer the same thing as a pure-TS factory.

`createCauslWasm` / `createCauslWasmSync` are exported from the
`@causl/core/wasm` subpath (kept out of the main bundle) for callers who
want the wasm factory explicitly. `createCauslTs` is **not** part of the
adopter-facing surface — it is no longer exported from the causl-client
`@causl/core` barrel (see §0b).

### Node vs browser

The `--target nodejs` glue is already synchronous end to end — Node
adopters can call `createCauslWasmSync()` (or even `createCauslWasm()`)
without a meaningful preload cost. The one-time `preloadCauslWasm()` is
the path that matters for the **browser/bundler target**, where the
module compile is the async step being hoisted out of the render path.

## 0b. causl-client is wasm-default with a TS capability-fallback (SPEC §18A.13 + §18A.13.1)

> **SHIPPED — causl-client only.** Epic #31 / issue #34 (2026-06-20)
> made causl-client a **wasm-first core**: the public `@causl/core`
> surface is wasm-first and `createCauslTs` is gone from the barrel.
> SPEC §18A.13.1 (2026-06-23) then **retained `createCauslTs` as the
> implicit `createCausl()` path's WasmGC-unavailable capability
> fallback** (loud, never silent); explicit wasm still fails loud. This
> is gate-bypassed and enterprise-only. Authority: SPEC §18A.13 +
> §18A.13.1 + §18A.10 and causl-client's `DISTRIBUTION.md`.

SPEC §18A.13 scoped causl-client to a **wasm-first core**, and that cut
has landed; SPEC §18A.13.1 then kept a TS **capability fallback** on the
implicit path. `createCausl` is the wasm-first default factory (§0a):
once `@causl/core/wasm` has been preloaded for the default bridge (via
`preloadCauslWasm()`), it routes to the **real wasm engine
synchronously**; with no preload it builds a working synchronous graph
on the **internal TS floor** (a *silent* sync-ergonomics fallback,
non-breaking for sync callers that never preload). **New in §18A.13.1:**
on a host where the WasmGC engine cannot **instantiate** even though a
module IS preloaded (Safari < 18 / macOS < 15, policy-pinned pre-119
Chromium/WebView2, Node ≤ 20), `createCausl()` degrades to the internal
TS floor **loudly** — a one-time `console.warn` plus a structured
telemetry marker you observe via `onCauslCapabilityFallback(event =>
…)`. A no-wasm enterprise user gets a working app on the proven TS floor
instead of a hard error.

`createCauslTs` remains **removed from the causl-client `@causl/core`
barrel**: adopters can no longer select the pure-TS engine directly. It
survives internally and is now **wired as the implicit capability
fallback** (via `JsFallbackBackend`) — post epic `causljs/causl-wasm#170`
it is a **clean standalone fallback engine**, no longer wasm-path
structural scaffolding (the four projection reads were lifted to Rust, so
under rust-ssot no adopter read consults the TS `entries` map). The
literal deletion of `createCauslTs` is dropped from scope — it is kept,
not deleted (SPEC §18A.13.1).

**Scope discipline — read this before you generalise it.** The
public-TS-engine cut (and the §18A.13.1 wasm-default-with-fallback
posture) is **scoped to causl-client and nothing else**. The
upstream **fork (`causljs/causl-ts-wasm-engine`) keeps the dual-engine
architecture**: it retains the synchronous `createCauslTs()` TS floor as
the unconditional, *publicly selectable* substrate described throughout
this guide (§3's "any host that runs JavaScript runs causl" floor is a
fork-level guarantee). **Never describe the fork as wasm-only** —
`createCauslTs` is removed **from causl-client**, not from causl. Say it
that way.

Practical implication for adopters: the `fallbackToTs` escape in §0a
degrades to causl-client's **internal TS floor** (a *silent*
sync-ergonomics opt-in on the explicit factories, not a public engine
choice), while the §3 TS-engine fallback and a publicly selectable
`createCauslTs()` remain fork-level guarantees. Within causl-client a
WasmGC-unavailable host is handled by **how** the engine was requested:
the **implicit** `createCausl()` path degrades to the internal TS floor
**loudly** (the §18A.13.1 capability fallback — one-time `console.warn`
+ telemetry), so a no-wasm enterprise user gets a working app; the
**explicit** `createCauslWasm()` / `createCauslWasmSync()` /
`engine:'rust-ssot'` factories **still fail loud**
(`CAUSL_WASM_ENGINE_UNAVAILABLE`) unless the caller opts into
`{ fallbackToTs: true }` — a consumer that explicitly asked for wasm
must never silently run on JS.

## 1. Preload + SRI

The WASM artefact is fetched lazily on the first `loadWasmBackend()`
call. Adopters who want predictable first-paint behaviour preload
the bytes; adopters with a strict CSP also pin the SRI hash.

### Preload (recommended for SPA shells)

Add a `<link rel="modulepreload">` for the JS bindings and a
`<link rel="preload" as="fetch">` for the `.wasm` artefact:

```html
<!-- Tier 1 host (Chromium 131+, Firefox 130+, Node 22.6+) -->
<link rel="modulepreload" href="/causl/wasm-pkg/gc-builtins-bundler/causl_engine_bridge.js" />
<link
  rel="preload"
  as="fetch"
  type="application/wasm"
  href="/causl/wasm-pkg/gc-builtins-bundler/causl_engine_bridge_bg.wasm"
  crossorigin="anonymous"
/>
```

For Tier 2 (`gc-classic`) and Tier 3 (`serde`) hosts, swap the path
segment. A production setup typically emits all three preload
pairs and lets the browser fetch the one its bridge picker
ultimately needs — preload requests are cheap to issue and the
unused two simply do not enter execution.

Pair with `<link rel="dns-prefetch">` if your CDN sits on a
separate origin from the document.

### Subresource Integrity (SRI)

If your CSP includes `require-sri-for script` or your security
posture pins every external asset by hash, compute the SRI digest
of each bridge artefact at build time and add it to the preload
link:

```html
<link
  rel="preload"
  as="fetch"
  type="application/wasm"
  href="/causl/wasm-pkg/gc-builtins-bundler/causl_engine_bridge_bg.wasm"
  integrity="sha384-..."
  crossorigin="anonymous"
/>
```

The SRI hash is computed over the **raw `.wasm` byte sequence**
(not the JS-bindings glue produced by `wasm-pack`). Recompute on
every causl release because the artefact bytes change with the
Rust crate version.

> **CSP reminder.** WASM execution requires
> `script-src 'wasm-unsafe-eval'` (Chrome 95+, Firefox 102+;
> supersedes the legacy `'unsafe-eval'` escape hatch). The preload
> link is fetched against `connect-src` (or `default-src` if you
> have not split them) — whitelist your CDN origin explicitly.
> Hosts whose CSP forbids `'wasm-unsafe-eval'` automatically fall
> through to the JS-engine fallback per §17.6 (the loader throws
> `WasmBackendUnavailableError` with `code: 'CAUSL_WASM_CSP_BLOCKED'`).

## 2. Dynamic-import patterns for vendoring

`@causl/core/wasm` ships with a default loader that resolves the
`.wasm` artefact via the package's `exports` map. Adopters who
host their own copy (CDN, S3, intranet asset server) override the
base URL through `WasmBackendOptions.wasmBaseUrl`:

```ts
import { loadWasmBackend } from '@causl/core/wasm'

const backend = await loadWasmBackend({
  wasmBaseUrl: 'https://cdn.example.com/causl/0.0.0/wasm-pkg/',
})
```

The loader appends the bridge-id segment (`gc-builtins-bundler/` or
`gc-classic-bundler/`) and the artefact filename
(`causl_engine_bridge_bg.wasm`) to the base URL. The base URL **must end with
a trailing slash**; the loader does not normalise.

### Versioned vendoring

Every causl release pins the WASM artefacts at the package's
version string (`VERSION` exported from `@causl/core`). A
deployment-time script that copies `node_modules/@causl/core/wasm-pkg/`
into your asset server should preserve the version segment so the
SRI hashes in the preload links stay correct:

```sh
# deploy-time
VERSION=$(node -e "console.log(require('@causl/core').VERSION)")
cp -r node_modules/@causl/core/wasm-pkg ./public/causl/$VERSION/wasm-pkg
```

And at runtime:

```ts
import { VERSION } from '@causl/core'
import { loadWasmBackend } from '@causl/core/wasm'

const backend = await loadWasmBackend({
  wasmBaseUrl: `/causl/${VERSION}/wasm-pkg/`,
})
```

### Picking a specific bridge tier

The loader's `detectBridge()` auto-selects the highest tier the
host supports. Adopters who need a specific tier — typically for
testing the fallback path under a Tier 1 dev environment — pin
the bridge explicitly:

```ts
// Force Tier 3 (universal) — useful for cross-browser parity testing
const backend = await loadWasmBackend({ bridge: 'serde-json' })

// Force Tier 1 — hard error on Safari 18.0 (WasmGC but no JS string builtins)
const backend = await loadWasmBackend({ bridge: 'wasmgc-builtins' })
```

Pinning a bridge that the host does not support throws
`WasmBackendUnavailableError` with
`code: 'CAUSL_WASM_BRIDGE_UNAVAILABLE'`. The auto-walk path
(`bridge` omitted or `bridge: 'auto'`) never throws on host
mismatch — it walks down the tier ladder per §17.6 and surfaces
the chosen tier on the returned backend's `BridgeFeatures` shape.

## 3. Fallback strategy when WASM is unavailable

SPEC §17.6 names the TS engine as the unconditional floor: any
host that runs JavaScript runs causl. The WASM substrate is
_acceleration_, not _substitution_. The structured fallback
contract is:

```ts
import { createCausl } from '@causl/core'
import { loadWasmBackend, WasmBackendUnavailableError } from '@causl/core/wasm'

async function makeBackend() {
  try {
    return await loadWasmBackend()
  } catch (err) {
    if (err instanceof WasmBackendUnavailableError) {
      // Log the structured `code` field so observability surfaces
      // tell you which fallback fired.
      console.info('[causl] WASM unavailable, using TS engine', err.code)
      return 'js' as const
    }
    throw err
  }
}

const graph = createCausl({ backend: await makeBackend() })
```

### The five structured codes

The `WasmBackendUnavailableError.code` field is the public contract
for fallback dispatch. The five codes are:

| Code                            | Condition                                                                                       | Adopter action                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `CAUSL_WASM_NOT_BUILT`          | The bridge artefacts have not yet shipped (pre-#682 / #683 / #693).                             | Fall back to `'js'`. Will resolve once the upstream sub-tasks land.                                                                           |
| `CAUSL_WASM_UNAVAILABLE`        | `WebAssembly` is not defined or `WebAssembly.Module` cannot instantiate the probe module.       | Fall back to `'js'`. The host does not support WebAssembly 1.0.                                                                               |
| `CAUSL_WASM_CSP_BLOCKED`        | The host runtime supports WASM but the page's CSP rejected `'wasm-unsafe-eval'`.                | Fall back to `'js'`, or widen the CSP if the security review allows it.                                                                       |
| `CAUSL_WASM_BRIDGE_UNAVAILABLE` | Adopter pinned a specific bridge id that the host does not support.                             | Either drop the pin (let `detectBridge()` auto-walk) or fall back to `'js'`.                                                                  |
| `CAUSL_WASM_FETCH_FAILED`       | The `.wasm` byte stream failed to fetch — network error, wrong MIME type, 404 on `wasmBaseUrl`. | Verify the `wasmBaseUrl` resolves and the asset server returns `Content-Type: application/wasm`. Fall back to `'js'` for the current session. |

### Behaviour-equivalence across the fallback

SPEC §17.6 commits to behaviour-equivalence: the JS engine and the
WASM substrate are semantically identical per the SPEC §3 contract
surface (atomicity, glitch-freedom, replay determinism) and the
§15.1 cross-backend determinism gate (landed in #685; reinforced by
the Phase-1 fuzz green at 10 000 trials per `docs/wasm/phase-1-perf.md`).
A graph that falls through to the TS engine on a CSP-restricted host
produces the same `commitLog` it would have produced on a Tier 1
host — only slower per the §17.5 capability-cost residual. Under
the Phase-1 wrapper, "only slower" is in fact ~0% delta because the
wrapper delegates to the same TS pipeline; the residual cost
projection (~0.7 ms/commit) applies to the real Rust port (epic
#1133), not to 0.9.0.

Adopters do not need to test their application against both
backends for correctness; the cross-backend property fuzz (#685)
holds that line. They _do_ need to size their bundle budget
against the fallback floor — see the §14.2 ceiling in the SPEC,
and note the documented serde-bridge divergence (Issue #1150 /
PR #1161 — 13 KB Brotli over the §17.6 80 KB target).

### When to short-circuit the probe

Server-side renderers and CLI tools that know their host runtime
in advance can skip the probe entirely:

```ts
// Node 22.6+ — bypass the probe, go straight to Tier 1
const backend = await loadWasmBackend({ bridge: 'wasmgc-builtins' })
```

```ts
// Browser environments where bundle budget matters more than perf
const graph = createCausl({ backend: 'js' })
```

The `backend: 'js'` short-circuit never imports `@causl/core/wasm`
at all — adopters who pin the TS engine pay zero bundle cost for
the WASM entry stub.

## 4. Batched-flush opt-in (`createCausl({ batchedFlush })`)

> **Read this framing first. `batchedFlush` delivers ZERO
> adopter-visible performance change at v1.x.** It is *scaffolding*
> for a possible future v2.x cutover, not a speed knob you turn on
> today. If you are looking for "make causl faster", this option is
> not it — the JS engine remains the single source of truth for
> every read, subscribe, and `commit()` return regardless of this
> setting. Turning it on changes only *when the WASM-side shadow wire
> crossing happens*, which is invisible to your application code.

### What it is

Epic #1493 (the #1483 re-architecture decision's option-c
implementation) added a per-graph opt-in that buffers the WASM-side
shadow commit-wire crossing and flushes it as one batched envelope
instead of one envelope per commit:

```ts
import { loadWasmBackend } from '@causl/core/wasm'

const backend = await loadWasmBackend({
  batchedFlush: { afterN: 100, intervalMs: 16 },
})
```

…or, on the `backend: 'auto'` path:

```ts
import { createCausl } from '@causl/core'

const graph = createCausl({
  backend: 'auto',
  batchedFlush: { afterN: 100 }, // forwarded to loadWasmBackend on migration
})
```

- **`afterN`** (default `1`) — flush after this many buffered commits.
  `1` flushes every commit, which is **byte-identical to omitting the
  option entirely** (and to pre-#1493 dev). Set `100` for the
  "production-grade" batch window or `312` for the
  `docs/epic-1483/option-c-batched-boundary.md` §1 kill-threshold
  window.
- **`intervalMs`** (default `16` — one 60 Hz frame) — flush after this
  many ms even if `afterN` is not reached, so a low commit rate does
  not strand buffered work. `0` disables the time trigger.
- **Manual flush** — `backend.flush()` forces any buffered window
  across the wire NOW (before navigation, before `snapshot()`, in
  tests).
- **Implicit flush** — `snapshot()` and `dispose()` flush
  automatically so the WASM-side state reflects committed work.

### What does NOT change (the contract you can rely on)

`createCausl({ batchedFlush })` preserves every adopter-facing
contract verbatim (SPEC §17.6 "Option (c) batched-commit boundary
scaffolding" callout; option-c doc §2.1 Answer C):

- **`commit()` still returns a frozen `Commit` synchronously.** Phases
  A–H run in the JS engine on the same tick; there is no `Promise`,
  no deferred apply, no codemod.
- **`graph.now` still advances by exactly one tick per commit**, always
  (SPEC §3 Theorem 4).
- **Per-node and `subscribeCommits` subscribers still fire per-commit,
  synchronously**, in the same call stack as `commit()`'s return
  (SPEC §15.3 — subscriber fires are NOT batched; option (c) pins
  this deliberately).
- **`read()` returns the JS engine's authoritative value** — no FFI
  round-trip on the read path.
- **Default behaviour is byte-identical to not passing the option.**
  This is a load-bearing acceptance test (epic #1493 phase C.4):
  default-config `commit`/`read`/`subscribe`/`exportModel`/`now` is
  byte-identical to a bare pure-TS `createCausl()` graph.

The opt-in is **per-graph** (not a global flag) and **additive** (no
deprecation cycle, no lint, no RC track). Multi-graph adopters
(`@causl/sync`, embedded use-cases) opt in per graph without
cross-graph coupling.

### Why turn it on at all, then?

You generally should **not**, at v1.x. The batched-flush capability
exists so a *future* v2.x cutover that moves the single source of
truth into the WASM/Rust engine can do so without re-paying the
per-commit FFI boundary tax — the wire is already batched. The C.6
`op-rust-batch-boundary` measurement confirms the boundary tax
amortises exactly `15.64 / N` μs per the option-c doc §1 arithmetic
(crossing the ≤50 ns floor at N≥312), but under the v1.x "JS engine
SSOT" architecture that amortisation buys *no adopter-visible perf* —
it is the ceiling a future SSOT swap would obtain, not today's cost.
The #1133 boundary-tax falsification is **not** refuted by this
capability; epic #1493 ships the plumbing, not the perf.

If you have a specific reason to exercise the batched wire path early
(e.g. you are validating the v2.x cutover in a staging harness), set
`afterN` to your target window and use `backend.flush()` at
quiescence boundaries. Otherwise, leave it unset.

## 4a. The v2.x `engine: 'rust-ssot'` opt-in (epic #1515)

> **Read this framing first — it is verbatim and load-bearing.**
> `engine: 'rust-ssot'` delivers **ZERO adopter-visible performance
> change at current WASM maturity**. It is **opt-in only and is NOT
> the production default**, and it will **not** become the default
> until a documented maturity tripwire clears (it has not). **The
> #1133 median falsification STANDS — it is NOT refuted by v2.x.** If
> you are looking for "make causl faster", this option is not it.

### What it is

Epic #1515 (the v2.x Rust-SSOT cutover) built — on top of the §4
batched-flush scaffolding — a per-graph opt-in that promotes the
Rust engine's post-state as canonical for the WASM-side mirror at
each flush boundary, **after** a per-flush byte-compare against the
always-on JS-engine shadow:

```ts
import { loadWasmBackend } from '@causl/core/wasm'

const backend = await loadWasmBackend({
  engine: 'rust-ssot', // opt-in; default is 'js-ssot'
})
```

…or on the `backend: 'auto'` path, `createCausl({ backend: 'auto',
engine: 'rust-ssot' })`. `engine: 'rust-ssot'` implies the
batched-flush queue; if you do not also pass `batchedFlush`, v2.x
installs the `afterN: 312` window (the #1484 §3 / C.6 ≤50 ns
crossing-floor window) so the *crossing* tax is amortised — this
does **not** amortise the *engine-exec* tax (see below).

### What does NOT change (the contract you can rely on)

`engine: 'rust-ssot'` preserves every adopter-facing contract
verbatim (SPEC §19 V2-final "NO amendment" trail row; V2-DESIGN
§5). The JS engine stays the **synchronous per-commit source of
truth**: `commit()` still returns a frozen `Commit` synchronously,
`graph.now` still advances exactly one tick per commit, subscribers
still fire per-commit synchronously, `read()` still returns the JS
engine's authoritative value. **Omitting `engine` (or passing
`'js-ssot'`) is byte-identical to a default WASM graph** — the
load-bearing V2.1 acceptance property (epic #1515). The opt-in is
per-graph, additive, zero-codemod, zero-deprecation.

### The honest performance picture

`engine: 'rust-ssot'` does **not** make causl faster at current WASM
maturity. The honest re-measurement
(`docs/epic-1515/v2.3-rust-ssot-remeasure.md`) recorded:

- **The Rust-engine-in-WASM per-commit execution cost is ~85× the
  TS engine** (~17 μs vs ~0.2 μs; F-marshal.6.1 #1479 comment
  4455257530) — *even with zero boundary crossing*. This is the
  binding constraint. It is a property of *today's* WASM runtime (no
  GC GA, limited baseline JIT, no SIMD on the hot path), **not** of
  the bridge architecture. #1493's batching provably cannot amortise
  it (batching amortises only the *crossing* tax, 1/N — the
  engine-exec gap is downstream of every boundary optimisation).
- **The #1133 median falsification STANDS / is NOT refuted.** Any
  reader who comes away thinking "v2.x makes causl faster today" has
  misread it.

### The present value: large-tree GC-survival (#1525)

What `engine: 'rust-ssot'` *does* deliver today is **large-tree
GC-survival**, the present, non-maturity-gated axis the #1525 gate
empirically confirmed on the real serde-wasm engine. On a 50k-node
tree the real Rust-in-WASM engine survives where the TS-SSOT path
GC-destabilises — the **43→1 natural-major-GC collapse**. The
**corrected** #1525 figures (carried verbatim from the V2.3
re-measure, narrowing the earlier synthetic #1518 numbers):

- **p99.9 latency flattening is ~16.6×** — **not** the synthetic
  ~437×.
- the raw heap slope is **transient (serde marshal envelope), not
  retained, and NOT ≈0** — **not** the synthetic ≈0.

These narrowings are honest and do **not** weaken the #1133 /
V2-DESIGN §0 framing one bit. GC-survival is a *robustness* property
for very large trees, not a median-latency win.

### When (not) to turn it on

You generally should **not**, in production, today. Turn it on only
if you are (a) validating the v2.x cutover in a staging harness, or
(b) running a very large tree where the GC-survival axis matters
more to you than median latency and you have measured your own
workload. If a per-flush byte-divergence ever occurs, the graph
**fail-safe sticky-downgrades to `js-ssot`** for its remaining
lifetime (V2.5 Decision 6 tier 2) and surfaces a structured error
you can dispatch on:

```ts
// V2.5 (#1544) — Decision 6 tier 2 structured-error code.
if (err?.code === 'CAUSL_RUST_SSOT_DOWNGRADED') {
  // This graph self-demoted off the Rust SSOT after a divergence.
  // No data loss — the JS engine was the canonical authority all
  // along (V2-DESIGN §1.2). Lossless, fail-safe.
}
```

To roll back entirely (Decision 6 tier 3 — **free**, no redeploy):
just omit `engine` (or pass `'js-ssot'`). It is a per-graph runtime
config flip, byte-identical to a default WASM graph the moment the
flag is gone.

### The maturity tripwire (when it could become the default)

Promotion of `engine: 'rust-ssot'` to the **production default** is
a **separate, tripwire-gated, SPEC-amending future decision
explicitly out of epic #1515's scope**. It becomes a *candidate*
only when a **conjunctive** four-axis tripwire clears on one
measurement run:

| Axis | Threshold | Current |
| --- | --- | --- |
| **T1** Rust-in-WASM engine-exec vs TS | ≤ 3× | ~85× — **NOT cleared** (binding axis) |
| **T2** WASM GC GA on SPEC §17.6 host floor | GA, unflagged | **NOT cleared** (browser-vendor timeline) |
| **T3** C.5 determinism gate, Rust promoted | 1000 trials × 0 byte diffs | **GREEN** (🚦V2.4 GO verified) |
| **T4** crossing tax @ N=312 | ≤ 50 ns/op | 50.1 ns/op — **clears** (informational; T1 binding) |

T1 needs a **~28× WASM-runtime improvement** (85× → 3×) that no
current runtime delta delivers. The full, re-runnable monitor is
`docs/epic-1515/v2-final-tripwire-checklist.md` (a **manual**
re-measurement checklist by design — the binding axis moves on the
WASM-runtime-vendor calendar, not on causl's PR cycle). Until all
four clear, `engine: 'rust-ssot'` stays opt-in only.

## 5. Where to read the host-tier matrix

The authoritative host-tier compatibility matrix lives in two
places, both maintained in lockstep:

- **`packages/core/wasm/README.md`** — adopter-facing entry-point
  documentation, with the per-bridge bundle costs, CSP guidance,
  and bundler-interop notes.
- **SPEC §17.6** — the host-tier matrix as a SPEC commitment
  (commitment 14, DESIGN-DISCIPLINE), with the four feature-detection
  probes named, the bundle-size ceiling table, and the
  fall-through fallback contract.

When a new host version graduates a WASM feature (e.g. Safari ships
JS String Builtins, promoting it from Tier 2 to Tier 1), both
documents update in the same PR per SPEC §17.6's DESIGN-DISCIPLINE
mechanism. Adopters checking the floor for a specific host should
read the SPEC §17.6 row first — it is the contract — and the
README for the implementation detail.

## Cross-references

- SPEC §17.1, commitment 14 — the contract row (ratified via PR #1053).
- SPEC §17.6 — the host-tier elaboration, feature-detection
  checklist, bundle-size impact, fall-through fallback.
- SPEC §19 — the amendment trail rows for #690 (host-tier matrix)
  and #1124 (read-reference identity, ratified via PR #1129), plus
  the #1493 C.7 and the V2-final (#1546) "NO amendment" rows (v2.x
  requires no SPEC amendment; the future promotion-to-default does).
- `docs/epic-1515/V2-DESIGN.md` — the v2.x Rust-SSOT cutover design
  pin (§0 honest framing, §3 the maturity tripwire, §6 the rollback
  story).
- `docs/epic-1515/v2.3-rust-ssot-remeasure.md` — the honest
  re-measurement under `engine: 'rust-ssot'` (the ~85× T1 axis; the
  corrected #1525 GC-survival figures).
- `docs/epic-1515/v2-final-tripwire-checklist.md` — the manual,
  re-runnable maturity-tripwire checklist (T1∧T2∧T3∧T4).
- EPIC #1515 — the v2.x Rust-SSOT cutover (**OPEN**; tracks the
  tripwire-gated promotion-to-default + child #1541). The #1133
  falsification STANDS; `engine: 'rust-ssot'` is opt-in only.
- `packages/core/wasm/README.md` — entry-point reference, bridge
  picker behaviour, bundler interop.
- `docs/wasm-backend-adopter-audit.md` (#695, **merged**) — the
  Phase-0 adopter-API audit that gated the `BackendEngine` carve in
  #681 (**also merged**).
- EPIC #680 — the full WASM-backend design (**closed**; 17 sub-issues
  merged).
- EPIC #1133 — the post-0.9.0 real Rust engine port (**deferred**
  behind GO/NO-GO criteria).
- SPEC §18A.12 — the sync separation (**SHIPPED** in the fork and in
  causl-client): `preloadCauslWasm` / `createCauslWasmSync`, the
  `isCauslWasmPreloaded` / `getPreloadedCauslWasm` companions, the
  `CauslWasmNotPreloadedError` + `fallbackToTs` policy, and
  `createCauslWasm` = preload ∘ sync. See §0a.
- SPEC §18A.13 / §18A.13.1 / §18A.10 / EPIC #31 (issue #34) — the
  causl-client **wasm-default core** (**SHIPPED** 2026-06-20;
  gate-bypassed, enterprise-only; **scoped to causl-client only** —
  `createCauslTs` removed from the causl-client `@causl/core` barrel,
  while the fork `causljs/causl-ts-wasm-engine` keeps the publicly
  selectable dual-engine TS floor). **§18A.13.1 (2026-06-23)** retained
  `createCauslTs` (not deleted) as the implicit `createCausl()` path's
  WasmGC-unavailable capability fallback; the §18A.3 FFI lift has landed
  (`causljs/causl-wasm#170`). See §0b.
