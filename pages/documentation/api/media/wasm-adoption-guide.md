# WASM adoption guide (#690, merged)

> **Swept for 0.5.0 and for the TS-engine deletion.** §§0a, 0b and 4a used to
> describe the pre-0.5.0 world: a `{ fallbackToTs: true }` not-preloaded
> policy, a §18A.13.1 TS capability fallback on the implicit `createCausl()`
> path, and `backend: 'js'` / `engine: 'js-ssot'` as selectable engines. **All
> of those are removed**, passing any of `engine`, `backend`, `fallbackToTs`,
> `fallbackToJs` throws `RemovedEngineOptionError`
> ([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)), and
> [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) deleted the
> TypeScript engine those options used to reach. Those three sections now say
> so. Where this guide and
> [`packages/core/wasm/README.md`](../packages/core/wasm/README.md) or the
> `## [0.5.0]` section of [`CHANGELOG.md`](../CHANGELOG.md) disagree, those
> two are authoritative.

Adopter-facing companion to SPEC §17.6 (commitment 14, host-tier
substrate compatibility: ratified via PR #1053) and to the
entry-point reference at `packages/core/wasm/README.md`. This
document covers the five adopter-side questions §17.6's host-tier
table does not answer on its own:

> **Current-state note: real Rust shipped (§18A.7 / §18A.8).** The engine
> installed by `preloadCauslWasm()` is the **real `engine-rs-core` Rust core**
> compiled to WebAssembly, reached over FFI: not a TS wrapper. `rust-ssot` is
> the **unconditional production default** (`DEFAULT_WASM_ENGINE_MODE =
> 'rust-ssot'`, 2026-06-21; all five §18A.7 GO/NO-GO criteria GO), with **no
> per-flush byte-compare oracle and no sticky-downgrade fail-safe** (both removed
> per §18A.8 / causl-wasm#169). The §18A.3 FFI structural lift **landed**
> (causl-wasm#170), so **every adopter operation resolves from Rust**: the only
> JS in the hot path is the user's own `derived()` compute lambda, over the
> bridge callback **by design**. The interface is stable, the host-tier matrix is
> live, and the CI-blocking cross-backend determinism gate (§18A.1.1) is green at
> 0-divergence over 100,000 trials. Per-commit wall-time stays inside the §14
> RAIL responsiveness budget; perf is **immaterial** to the default (the driver
> is complexity-elimination, not speed). The contracts and patterns in this guide
> hold under the wasm engine today.

> **Sync-separation note (SPEC §18A.12: SHIPPED in the fork and in
> causl-client).** Independently of the Rust-port timeline above, the
> wasm engine is now **synchronous from a consumer's perspective**.
> The async work (compiling the `WebAssembly.Module`, the sidecar, and
> the compute-imports snippet) is hoisted into a one-time
> `await preloadCauslWasm(opts?)` at app/init; after it resolves,
> `createCauslWasmSync(handle?, create?)` builds a graph with **zero
> `await` at the call site** (one `new WebAssembly.Instance`, no
> per-call I/O). This is what lets sync consumers: React render,
> `xldatagrid`: build a wasm graph inline. The `--target nodejs` glue
> is already sync end-to-end; only the browser/bundler target needs the
> one-time preload. See §0a for the full surface and the
> not-preloaded policy. This note is about *call-site
> synchrony*; the §15.1 read-identity hazard in H1 below is orthogonal
> and still applies under the wasm engine.

0. **H1: committed values are live and unfrozen** (#1124). Why
   `graph.read(node)` must be treated as read-only: mutating what it
   returns edits committed state with no commit and no fire: and why
   memoisation keys on `commit.time` / `stats().nodeVersion(node)`
   rather than on the returned reference.
1. **Preload + Subresource Integrity (SRI).** How to make the WASM
   bytes part of your CSP / SRI posture rather than an out-of-band
   fetch.
2. **Dynamic-import patterns for vendoring.** How to ship the WASM
   artefacts from your own origin (CDN, S3, intranet) without
   forking the loader.
3. **What to do when the engine is unavailable.** The structured
   `code` field and the `try`/`catch` shape that decides in one place
   what an unsupported host renders. There is no fallback to
   configure: §17.6's matrix is one row, and nothing sits under it.
4. **Where to read the host-tier matrix.** A pointer at the
   authoritative spot in `packages/core/wasm/README.md` and the
   SPEC §17.6 elaboration.

This guide is normative for adopters; the SPEC §17.6 row is
normative for the team.

## H1. Committed values are live and unfrozen (the load-bearing read risk)

**This section is the single normative statement of what a wasm `read()`
returns.** Everything else in this repository that touches read identity
points here rather than restating it, because restating it is how the
account drifted:
[#405](https://git.opsite.ca/causl/causl-wasm-ts/issues/405) records the
period when `docs/integrating-causl-client.md` §5 and this section gave
adopters two different answers and two non-overlapping audits. Every
claim below is measured on the shipped artefact and pinned by
`packages/core/test/read-identity-contract-405.test.ts`, so if the engine
moves, that suite goes red before this prose goes stale.

The Markbåge/Miller ship-verdict panel flagged read identity as the H1
risk in the WASM-backend adopter audit
(`docs/wasm-backend-adopter-audit.md`, PR #1021), and the SPEC §15.1
amendment ratifying the non-contract shipped via PR #1129:
**`graph.read(node)` is not contractually required to return the same
JavaScript reference across calls.** That is a rule about what you may
*depend on*, and it stands: do not key memoisation on the read return
reference.

Earlier revisions of this guide went further and said the wasm engine
"returns a fresh object per call". **It does not, and never did.** Here
is what it does instead, on `rust-ssot`, for a plain object, an array and
a nested structure alike. All three are containers, and every container
crosses the boundary as an interned CONTENT_HASH marker while the value
itself stays host-side in `#valueCache`, so the marker path is the only
path a container read takes:

| What you do | What `read()` gives you |
| --- | --- |
| Read the same unchanged value twice | The **same reference**. `read(n) === read(n)`. |
| Read a value you just committed | The **very object** you passed to `input()` / `tx.set()`. |
| Read across commits that touched other nodes | **Unchanged.** Stable across 50 unrelated commits. |
| Read across a commit that replaced the value | The **newly committed** reference. The reference tracks the write, never the call. |
| Read after `hydrate()` | A **reconstructed** object, not your pre-hydrate one. It is then cached, so repeated reads of it are `===` again. Fresh once, never fresh per call. |

The one place the reference moves without the value moving is a
**container-valued derived**. A commit that recomputes it to a
structurally equal result replaces the cached reference, because the host
cache holds whatever your compute lambda last returned, while the
engine's structural cutoff correctly reports the node unchanged: absent
from `changedNodes`, `stats().nodeVersion(node)` unmoved. So keying a
memo on the read reference re-runs your transform on a commit where the
value did not change, and keying it on `nodeVersion` does not. That is
the concrete reason for the rule, not an appeal to the contract.

**None of this is the hazard.** The hazard is the opposite one:

> `read(node)` hands back your own **live, unfrozen** object, at every
> depth. `Object.isFrozen` is `false` on the container, on a nested
> array, and on a leaf object. So `read(n).a = 999` mutates committed
> state: with no commit, no `GraphTime` advance, no subscriber fire, and
> nothing in `explain`. Every later read observes it, `snapshot()`
> serialises it, and nothing re-renders.

This is the §18A.1.1 divergence recorded in
[#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272): the
reason the TS capability-fallback was withdrawn rather than kept.

### The wrong pattern (silently corrupts committed state)

```ts
const rows = graph.read(rowsNode)

// WRONG: `rows` IS the committed array. `sort` mutates in place, so
// this reorders committed state behind the commit pipeline's back:
// no commit, no fire, no way for anything to observe that it happened.
const sorted = rows.sort((a, b) => a.rank - b.rank)
```

### The right pattern

Clone before you mutate, and commit the clone:

```ts
const rows = graph.read(rowsNode)
const sorted = [...rows].sort((a, b) => a.rank - b.rank)
graph.commit('sort-rows', (tx) => tx.set(rowsNode, sorted))
```

Deep-freezing values before you commit them turns the silent corruption
into a `TypeError` at the mutation site, which is what you want in
development.

If you are sweeping an existing codebase for in-place mutation rather
than writing new code, read
[`docs/integrating-causl-client.md`](./integrating-causl-client.md) §5
next. It carries the audit and the one repair that looks correct and
silently does nothing.

### Memoise on a value-typed key, not on the reference

Separately from the mutation hazard: because reference identity is not
contractual, key memoisation on **`graph.stats().nodeVersion(node)`** (an
integer that advances by exactly 1 on each commit in which that node's
value changed) or on **`commit.time`** (the `GraphTime` on every
`Commit`, monotonic per SPEC §3). Both are value-typed and survive any
future change to how values cross the FFI boundary.

Prefer `nodeVersion`. `commit.time` advances on *every* commit, so it
re-runs your transform whenever anything in the graph moves;
`nodeVersion` advances only when this node's value changed, and it is
exactly the counter that stays put through the container-valued-derived
reference churn described above.

`stats()` is engine authority and is deliberately **absent** from the
narrowed `ReadOnlyGraph` a `@causl/react` selector receives, so reach
for it on the graph itself rather than through the selector argument:

```tsx
import { useMemo } from 'react'
import { useCausl } from '@causl/react'

// `graph` is the module-scope graph passed to <CauslProvider>.

function Dashboard({ userNode }) {
  // NOT `useCausl((g) => g.stats()…)`, which throws CapabilityViolation.
  const version = useCausl(() => graph.stats().nodeVersion(userNode))
  const user = useCausl((g) => g.read(userNode))

  // `version` is the load-bearing dependency. `user` is deliberately
  // absent: it is the reference whose churn this key exists to ignore.
  const transformedUser = useMemo(() => transform(user), [version])

  return <UserCard data={transformedUser} />
}
```

`transformedUser` is then stable for as long as the node's value is,
so the downstream `React.memo` boundary holds. That boundary is the
contract surface that matters. The engine does not promise reference
equality of `read()` returns; it does promise commit-time monotonicity
and the value-equality of any two reads at the same `GraphTime`, and
those are the two things this key rests on.

**There is no `useEngineTelemetry` hook.** Earlier revisions of this
section, and of `docs/integrating-causl-client.md` §5, wrote the
per-node counter as `useEngineTelemetry().nodeVersion(node)` and even
spelled the import out. `@causl/react` has never exported it, and it
never exported `useCauslCommit` either
([#405](https://git.opsite.ca/causl/causl-wasm-ts/issues/405)).
`EngineTelemetry` is the *type* of what `graph.stats()` returns, and
`graph.stats().nodeVersion(node)` above is how you reach the counter
from React today. The gate in
`packages/core/test/read-identity-contract-405.test.ts` now checks every
`@causl/react` import in these documents against the package's actual
barrel, so a doc cannot prescribe an unexportable hook again.

### Cross-link

- **SPEC §15.1 amendment (Issue #1124, ratified via PR #1129).** The
  contract-level statement: reference identity is not part of the
  `graph.read(node)` contract; adopters must memoise on `commit.time`
  or `EngineTelemetry.nodeVersion(node)`.
- **SPEC §17.6.** Names the substrate where this hazard materialises
  (the real Rust engine, `rust-ssot`: the only engine that ships).
- **`docs/wasm-backend-adopter-audit.md` H1.** PR #1021's audit
  doc; the H1 row is this hazard. PR #1129 executed the SPEC §15.1
  amendment the audit recommended; this section is the
  adopter-facing companion.
- **`packages/core/wasm/README.md` H1 callout.** Adopter-facing
  callout above the host-tier table that points at this section.
- **`packages/core/test/read-identity-contract-405.test.ts`.** The
  measurement behind every claim in this section, run against the
  shipped artefact: the identity table, the derived reference churn, the
  unfrozen depth, and the documentation gate that refuses a re-drift.
- **`docs/integrating-causl-client.md` §5.** The pre-migration audit
  that this section's contract feeds, including the repair that looks
  correct and silently does nothing.

## 0a. Synchronous construction: `preloadCauslWasm` + `createCauslWasmSync`

SPEC §18A.12 splits the wasm engine's one async step away from its
construction so that **building a wasm graph is synchronous at the
call site**. This section is SHIPPED: in the fork and in
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
} from '@causl/causl-wasm-ts/wasm'

// 1. ONCE, at app/init (top of `main`, a bootstrap effect, a test
//    `beforeAll`). Compiles + caches the WebAssembly.Module, the
//    sidecar, and the compute-imports snippet. Idempotent — calling it
//    again is a cheap no-op that resolves to the cached handle.
await preloadCauslWasm()

// 2. Anywhere downstream, with NO await at the call site:
const graph = createCauslWasmSync()
```

- **`preloadCauslWasm(opts?): Promise<PreloadedCauslWasm>`**: the
  single `await`. Compiles and caches the `WebAssembly.Module` plus the
  sidecar and the compute-imports snippet. Idempotent and safe to call
  from multiple call sites; concurrent callers share one in-flight
  compile. Takes the same option surface that configures the underlying
  bridge/artefact resolution.
- **`isCauslWasmPreloaded(): boolean`** and
  **`getPreloadedCauslWasm(): PreloadedCauslWasm | undefined`**:
  companions for code that needs to branch on, or hand off, the cached
  handle without re-triggering the compile.
- **`createCauslWasmSync(handle?, create?): Graph`**: **fully
  synchronous**: it does one `new WebAssembly.Instance` against the
  already-compiled module and returns a `Graph` with **zero `await`**.
  Pass an explicit preload `handle` to bind a specific cached snapshot,
  or omit it to use the module-global one from `preloadCauslWasm()`.
  The optional `create` bag is your `CreateCauslOptions`, applied to the
  graph built against the new instance. There is no third
  policy argument: the not-preloaded behaviour is a throw, see below.

### The not-preloaded policy

`createCauslWasmSync()` cannot compile on demand: that is the whole
point of moving the `await` out. If it is called before
`preloadCauslWasm()` has resolved, it **throws
`CauslWasmNotPreloadedError`**. That is the only behaviour: it tells you
your init ordering is wrong rather than silently stalling a render.

The `{ fallbackToTs: true }` / `{ fallbackToJs: true }` graceful-degrade
opt-in was **removed at 0.5.0**
([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)). Passing
either key throws `RemovedEngineOptionError`
(`code: 'CAUSL_REMOVED_ENGINE_OPTION'`), and it fires on the *key*, not
the value, so a spread `0.4.x` config throws too:

```ts
// The only behaviour: it surfaces an init-ordering bug.
const graph = createCauslWasmSync()

// Removed at 0.5.0. This throws RemovedEngineOptionError; it does not degrade.
const graph = createCauslWasmSync(undefined, { fallbackToTs: true })
```

There is no internal TS floor left to degrade to.
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) deleted
`createCauslTs` and the closure around it, so honouring a soft path
would mean substituting an engine this distribution does not ship,
which is the silent divergence 0.5.0 closed.

**Both fallbacks this section used to distinguish are gone:**

- `{ fallbackToTs: true }`: the **sync-ergonomics** opt-in that let a
  caller of an explicit wasm factory take a TS graph instead of a
  throw. Removed at 0.5.0.
- the §18A.13.1 **implicit-path capability fallback** (§0b): the
  default `createCausl()` factory degrading to the TS floor, loudly, on
  a host where the WasmGC engine could not **instantiate**. Withdrawn
  at 0.5.0.

Every factory now fails loud on a host that cannot run the engine.
`createCausl()`, `createCauslWasm()` and `createCauslWasmSync()` alike
throw `WasmEngineUnavailableError`
(`code === 'CAUSL_WASM_ENGINE_UNAVAILABLE'`) there, with no key that
restores a degrade. Catch it and decide what your application should
render; §3 is the full contract.

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

The adopter-facing public surface is **wasm-only**. There is no engine
selection left to make, so the table below is a shape reference, not a
menu:

| Constructor | Engine | Sync? |
| --- | --- | --- |
| `createCausl(...)` | wasm (the real engine) once preloaded; a throw otherwise, and a throw on a WasmGC-unavailable host | synchronous |
| `createCauslWasm(opts?)` / `createCauslWasmSync(handle?, create?)` | wasm: fails loud on a WasmGC-unavailable host (no fallback exists) | `createCauslWasm` is async; `createCauslWasmSync` is synchronous after preload |

`createCausl(...)` is the **default factory**. Once
`@causl/causl-wasm-ts/wasm` has been preloaded for the default bridge
(via `preloadCauslWasm()`), `createCausl()` routes to the real wasm
engine **synchronously**. With no preload it is construct-or-throw, and
on a host where the WasmGC engine cannot **instantiate** it throws as
well: since 0.5.0 there is nothing for it to degrade to. It is not a
thin wrapper and is not a pure-TS factory under another name.

`createCauslWasm` / `createCauslWasmSync` are exported from the
`@causl/causl-wasm-ts/wasm` subpath (kept out of the main bundle) for callers who
want the wasm factory explicitly. `createCauslTs` is **not** part of any
surface: it left the causl-client `@causl/core` barrel at epic #31 / #34
and [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) deleted
the declaration (see §0b).

### Node vs browser

The `--target nodejs` glue is already synchronous end to end: Node
adopters can call `createCauslWasmSync()` (or even `createCauslWasm()`)
without a meaningful preload cost. The one-time `preloadCauslWasm()` is
the path that matters for the **browser/bundler target**, where the
module compile is the async step being hoisted out of the render path.

## 0b. causl-client ships one engine (SPEC §18A.13; §18A.13.1 withdrawn at 0.5.0)

> **SHIPPED: causl-client only.** Epic #31 / issue #34 (2026-06-20)
> made causl-client a **wasm-first core**: the public `@causl/core`
> surface is wasm-first and `createCauslTs` left the barrel. SPEC
> §18A.13.1 (2026-06-23) briefly retained it as the implicit
> `createCausl()` path's WasmGC-unavailable capability fallback; that
> reversal was **withdrawn at 0.5.0**
> ([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)), and
> [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) then
> deleted the declaration itself. This is gate-bypassed and
> enterprise-only. Authority: SPEC §18A.13 + §18A.13.1 + §18A.10 and
> causl-client's `DISTRIBUTION.md`.

SPEC §18A.13 scoped causl-client to a **wasm-only core**, and that cut
has landed. `createCausl` is the default factory (§0a): once
`@causl/causl-wasm-ts/wasm` has been preloaded for the default bridge (via
`preloadCauslWasm()`), it routes to the **real wasm engine
synchronously**; with no preload it **throws** during construction. On a
host where the engine cannot **instantiate** even though a module
IS preloaded (a host below the declared floor: stated once on
`WASM_HOST_FLOOR` in `packages/core/src/wasm-registry.ts` and mirrored
under test by the wasm README's Host requirements table,
causl/causl-wasm-ts#426), it throws as well. SPEC §18A.13.1 spent
six weeks degrading that path to an internal TS floor, loudly, with a
one-time `console.warn` plus an `onCauslCapabilityFallback` telemetry
marker. That is **withdrawn**: the floor and `rust-ssot` answer
differently on a §18A.1.1 MUST-be-identical surface
([#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272), in-place
mutation of a committed value), and a fallback that disagrees with the
engine it stands in for is worse than no fallback.
`onCauslCapabilityFallback` stays exported, `@deprecated` and never
firing, until 0.6.0. The accepted cost is a dropped host tier.

`createCauslTs` is **not in causl-client at all**. Epic #31 / issue #34
took it off the public `@causl/core` barrel, and
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) deleted the
declaration together with `commitInternal`, the structural facade and
the `injectedBackend` seam. The `JsFallbackBackend` wiring §18A.13.1
introduced went with the withdrawal.

**Scope discipline: read this before you generalise it.** The
single-engine posture is **scoped to causl-client and nothing else**. The
upstream **fork (`causl/causl-core-ts`) keeps the dual-engine
architecture**: it retains the synchronous `createCauslTs()` TS floor as
the unconditional, *publicly selectable* substrate, and it is now the
organisation's only owner of that floor. **Never describe the fork as
wasm-only**: the TypeScript engine was removed **from causl-client**, not
from causl. Say it that way.

Practical implication for adopters: within causl-client a
WasmGC-unavailable host produces the same outcome however the engine was
requested. The **implicit** `createCausl()` path and the **explicit**
`createCauslWasm()` / `createCauslWasmSync()` factories all throw
`CAUSL_WASM_ENGINE_UNAVAILABLE`, and there is no key that softens it:
`fallbackToTs` / `fallbackToJs` throw `RemovedEngineOptionError`, and
`engine` / `backend` do too. A publicly selectable `createCauslTs()` and
the "any host that runs JavaScript runs causl" floor are fork-level
guarantees, not this package's.

## 1. Preload + SRI

The WASM artefact is fetched lazily on the first `preloadCauslWasm()`
call. Adopters who want predictable first-paint behaviour preload
the bytes; adopters with a strict CSP also pin the SRI hash.

### Preload (recommended for SPA shells)

Add a `<link rel="modulepreload">` for the JS bindings and a
`<link rel="preload" as="fetch">` for the `.wasm` artefact:

```html
<link rel="modulepreload" href="/causl/wasm-pkg/gc-classic-bundler/causl_engine_bridge.js" />
<link
  rel="preload"
  as="fetch"
  type="application/wasm"
  href="/causl/wasm-pkg/gc-classic-bundler/causl_engine_bridge_bg.wasm"
  crossorigin="anonymous"
/>
```

One pair, not three. This section was written for a three-tier matrix in which
a host-capability probe picked between `gc-builtins`, `gc-classic` and `serde`,
and a production shell preloaded all three. `serde` went with the split-crate
`engine_rs` lineage (issue #10) and `gc-builtins` was retired by
causl/causl-core-rs#355, so `gc-classic` is the segment the loader resolves and
the only one worth a preload. causl/causl-core-rs#358 is the engine-side retype
that would put a second segment back.

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
  href="/causl/wasm-pkg/gc-classic-bundler/causl_engine_bridge_bg.wasm"
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
> have not split them): whitelist your CDN origin explicitly.
> On a host whose CSP forbids `'wasm-unsafe-eval'` the engine cannot
> compile, and since 0.5.0 there is nothing to fall through to:
> `preloadCauslWasm()` rejects with `WasmEngineUnavailableError` /
> `code: 'CAUSL_WASM_ENGINE_UNAVAILABLE'` and the `createCausl()` that
> follows throws. There is no CSP-specific code: see §3.

## 2. Dynamic-import patterns for vendoring

`@causl/causl-wasm-ts/wasm` ships with a default loader that resolves the
`.wasm` artefact via the package's `exports` map. Adopters who host their own
copy (S3, intranet asset server, any origin they control) override the base URL
through `wasmBaseUrl` on **`preloadCauslWasm`**:

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm({
  wasmBaseUrl: 'https://assets.example.com/causl/0.5.0/',
  computeImportsUrl:
    'https://assets.example.com/causl/0.5.0/gc-classic/snippets/causl-engine-bridge-<hash>/causl-compute-imports.js',
})
```

> **`preloadCauslWasm`, not `loadWasmBackend`.** Earlier revisions of this
> section handed you `const backend = await loadWasmBackend({ … })`. Nothing
> accepts that return value any more: the `backend` option that consumed it was
> removed at 0.5.0 and `createCausl({ backend })` throws
> `RemovedEngineOptionError`. `loadWasmBackend` still resolves, so the call
> looks like it worked, and it is then silently ignored by every graph you
> build. `preloadCauslWasm` is the seam that actually installs the artefact,
> and it takes the same `bridge` / `wasmBaseUrl` / `fetch` / `graphName`
> options.

### Where the artefact must be placed

Two rules, both of which the loader enforces and neither of which is
guessable from the vendored directory's own name.

1. **`wasmBaseUrl` names the PARENT of the bridge directory, not the bridge
   directory itself.** The loader appends `<segment>/causl_engine_bridge_bg.wasm`
   to it. The base URL **must end with a trailing slash**; the loader does not
   normalise.
2. **That `<segment>` is `gc-classic`, and the directory you are copying is
   called `gc-classic-bundler`. You must rename it.** The segment is derived
   from the bridge id (`wasmgc-classic` → `gc-classic`), and the `-bundler`
   suffix is recovered only on the zero-config path that probes the package's
   own source layout. Once you pass `wasmBaseUrl` explicitly, that probe does
   not run and the suffix is never appended.

MEASURED, copying `wasm-pkg/gc-classic-bundler/` into an empty directory and
preloading against it:

| on-disk directory name | result |
| --- | --- |
| `gc-classic-bundler` (copied as-is) | `WasmEngineUnavailableError`: the wasm engine could not be loaded |
| `gc-classic` (renamed) | loads, and the graph commits |

So the deploy step is a copy **and** a rename:

```sh
# deploy-time
VERSION=$(node -e "console.log(require('@causl/causl-wasm-ts').VERSION)")
cp -R node_modules/@causl/causl-wasm-ts/wasm-pkg/gc-classic-bundler \
      ./public/causl/$VERSION/gc-classic
```

Copy the whole directory: the `snippets/<crate-hash>/` subtree beside the
`.wasm` is part of the artefact, not a build leftover.

And at runtime:

```ts
import { VERSION } from '@causl/causl-wasm-ts'
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm({
  wasmBaseUrl: `/causl/${VERSION}/`,
  computeImportsUrl: `/causl/${VERSION}/gc-classic/snippets/${CRATE_HASH}/causl-compute-imports.js`,
})
```

**`computeImportsUrl` is required whenever `wasmBaseUrl` is not a `file:` URL**,
which means it is required for every browser deployment. The loader
auto-resolves the snippet by reading the `snippets/` directory, and a directory
cannot be enumerated over HTTP, so it refuses rather than guessing. Read
`CRATE_HASH` off the vendored tree at deploy time:

```sh
CRATE_HASH=$(basename ./public/causl/$VERSION/gc-classic/snippets/*/)
```

### Picking a specific bridge

`detectBridge()` returns `wasmgc-classic` unconditionally, so there is no
highest tier to auto-select and no fallback path to test against. Pin the
bridge when you want the dependency stated in your own source rather than
inherited:

```ts
// The one bridge this package ships. Pinning it is the same as omitting it.
await preloadCauslWasm({ bridge: 'wasmgc-classic' })
```

The tier ids this section was written around are gone. `serde-json` was retired
with the split-crate `engine_rs` lineage (issue #10), and `wasmgc-builtins` by
causl/causl-core-rs#355; asking for either now throws
`WasmEngineUnavailableError`, and the gc-builtins message names the measurement
(causl/causl-core-rs#210) rather than reporting a host mismatch, because it is
not one. It also names causl/causl-core-rs#358, the retype that would make the
tier loadable again.

Pinning a bridge the host cannot instantiate throws
`WasmBackendUnavailableError` (`code: 'CAUSL_WASM_NOT_BUILT'`); pinning the
retired id throws `WasmEngineUnavailableError` before anything is fetched,
because that is a fact about the artefact rather than about the host. With one
bridge there is no ladder left to walk down, so omitting `bridge` resolves the
same artefact as naming it and surfaces it on the returned backend's
`BridgeFeatures` shape.

## 3. What to do when the engine is unavailable

**There is no fallback strategy, because since 0.5.0 there is no
second engine to fall back to.** The §18A.13.1 TS capability-fallback
is withdrawn ([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280));
`backend: 'js'` and `engine: 'js-ssot'` are removed and now *throw*.
Substitution, not acceleration: a host that cannot run the engine gets
an error, and your application decides what to render.

```ts
import { createCausl } from '@causl/causl-wasm-ts'
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

export async function boot() {
  try {
    await preloadCauslWasm()
    return createCausl()
  } catch (err) {
    switch ((err as { code?: string }).code) {
      case 'CAUSL_WASM_ENGINE_UNAVAILABLE':
      case 'CAUSL_WASM_NOT_PRELOADED':
      case 'CAUSL_WASM_NOT_BUILT':
        renderUnsupportedHost(err)
        return null
      default:
        throw err
    }
  }
}
```

`isCauslEngineUnavailable(err)`: exported from both the main barrel
and `/wasm`: narrows the first two without a cast under
`useUnknownInCatchVariables`.

### The structured codes

Branch on `err.code`, never on `instanceof`: the main bundle must not
name a `/wasm` symbol, so the never-imported row is thrown by a
leak-free twin class that cannot extend the subpath's.

| Code                            | Condition                                                                                                                                                                                 | Adopter action                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CAUSL_WASM_ENGINE_UNAVAILABLE` | Either `@causl/causl-wasm-ts/wasm` was never imported in this process, or it was and the host cannot compile/instantiate the artefact: no WasmGC, a CSP without `'wasm-unsafe-eval'`, a pinned bridge this package does not ship, or a failed fetch. The two are indistinguishable from the main bundle's position, so they share a code; the message carries the difference. | Render an unsupported-host state. If the message points at artefact resolution rather than at the host, pass `wasmBaseUrl` / `computeImportsUrl`.            |
| `CAUSL_WASM_NOT_PRELOADED`      | The subpath is imported, but `preloadCauslWasm()` has not resolved for this bridge.                                                                                                       | A boot-ordering bug, not a host limit: `await preloadCauslWasm()` once at init, and once in global test setup. `err.bridge` names the bridge, or is `undefined` when nothing was preloaded and none was pinned. |
| `CAUSL_WASM_NOT_BUILT`          | The bridge artefacts are absent from the tree: an unbuilt source checkout.                                                                                                              | Run the build, or vendor the artefact. Not reachable from a published install.                                                                              |
| `CAUSL_WASM_PRELOAD_CONFLICT`   | A second `preloadCauslWasm()` asked for a different bridge than the one already resolved in this process.                                                                                | Preload once, at app init, with one set of options.                                                                                                          |
| `CAUSL_REMOVED_ENGINE_OPTION`   | The options bag still carries `engine`, `backend`, `fallbackToTs` or `fallbackToJs`.                                                                                                     | Delete the key. Not a host failure: see the `0.5.0` migration, step 5.                                                                                     |
| `CAUSL_NOT_A_GRAPH`             | A value that is not a `Graph` built by this subpath was handed to a subpath helper (e.g. `disposeCauslWasmGraph`).                                                                       | Fix the call site.                                                                                                                                           |

`CAUSL_WASM_CSP_BLOCKED`, `CAUSL_WASM_UNAVAILABLE`,
`CAUSL_WASM_BRIDGE_UNAVAILABLE` and `CAUSL_WASM_FETCH_FAILED` were
listed in earlier revisions of this guide and **never existed**. All
four of those conditions surface as `CAUSL_WASM_ENGINE_UNAVAILABLE`.

### There is no behaviour-equivalence question any more

The old text here promised that a graph which fell through to the TS
floor produced a byte-identical `commitLog`. That promise is exactly
what `0.5.0` retracted: the floor and `rust-ssot` **disagree** on a
§18A.1.1 MUST-be-identical surface: in-place mutation of a committed
value, [#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272):
and a fallback that answers differently from the engine it stands in
for is worse than no fallback. There is one engine, so there is one
set of answers, and nothing to test your application against twice.

The dual-engine TS floor, its differential oracle and the benchmarks
live in [`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts),
which is now the organisation's only owner of that floor.

### When to short-circuit the probe

There is nothing left to short-circuit. `detectBridge()` returns
`wasmgc-classic` unconditionally, so naming the bridge saves no probing and
only states the dependency in your own source:

```ts
// Bypass the probe and name the bridge. There is one, so this is a
// documentation gesture rather than a choice.
await preloadCauslWasm({ bridge: 'wasmgc-classic' })
```

The second example this section carried, `createCausl({ backend: 'js' })` as a
zero-wasm-cost path for bundle-constrained browsers, is false twice over:
`backend` was removed at 0.5.0 and now throws `RemovedEngineOptionError`, and
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) deleted the
TypeScript engine it used to select. Importing `@causl/causl-wasm-ts` on its own
still costs no wasm bytes, but a graph needs the engine, so no configuration
both runs and skips the artefact.

## 4. Batched-flush opt-in (`createCausl({ batchedFlush })`)

> **Read this framing first. `batchedFlush` delivers ZERO
> adopter-visible behaviour change.** It is a **wire-tempo control**, not
> a speed knob: under the `rust-ssot` default the Rust engine is the
> authority, and this option changes only *when the buffered commit-wire
> crossing flushes*, which is invisible to your application code.
> `commit()` still returns a frozen `Commit` synchronously, `graph.now`
> still advances one tick per commit, and subscribers still fire
> per-commit. If you are looking for "make causl faster", this option is
> not it.

### What it is

Epic #1493 (the #1483 re-architecture decision's option-c
implementation) added a per-graph opt-in that buffers the WASM-side
shadow commit-wire crossing and flushes it as one batched envelope
instead of one envelope per commit:

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm({
  batchedFlush: { afterN: 100, intervalMs: 16 },
})
```

…or, per graph, through the wasm factory's `create` bag:

```ts
import { createCauslWasm } from '@causl/causl-wasm-ts/wasm'

const graph = await createCauslWasm({
  create: { batchedFlush: { afterN: 100 } },
})
```

The `backend: 'auto'` form this example used to take is gone: `backend` was
removed at 0.5.0 and now throws `RemovedEngineOptionError`, and the
auto-migration it named moved a graph between two engines, of which this
package ships one. On the preload path `batchedFlush` is accepted and inert;
the `create` bag above is where it is honoured.

- **`afterN`** (default `1`): flush after this many buffered commits.
  `1` flushes every commit, which is **byte-identical to omitting the
  option entirely** (and to pre-#1493 dev). Set `100` for the
  "production-grade" batch window or `312` for the
  `docs/epic-1483/option-c-batched-boundary.md` §1 kill-threshold
  window.
- **`intervalMs`** (default `16` (one 60 Hz frame)) flush after this
  many ms even if `afterN` is not reached, so a low commit rate does
  not strand buffered work. `0` disables the time trigger.
- **Manual flush**: `backend.flush()` forces any buffered window
  across the wire NOW (before navigation, before `snapshot()`, in
  tests).
- **Implicit flush**: `snapshot()` and `dispose()` flush
  automatically so the WASM-side state reflects committed work.

### What does NOT change (the contract you can rely on)

`createCausl({ batchedFlush })` preserves every adopter-facing
contract verbatim (SPEC §17.6 "Option (c) batched-commit boundary
scaffolding" callout; option-c doc §2.1 Answer C):

- **`commit()` still returns a frozen `Commit` synchronously** on the
  same tick; there is no `Promise`, no deferred apply, no codemod. The
  `apply_commands` / `commit_batch` FFI extern is synchronous: never
  `await` across a commit (§18A.6).
- **`graph.now` still advances by exactly one tick per commit**, always
  (SPEC §3 Theorem 4).
- **Per-node and `subscribeCommits` subscribers still fire per-commit,
  synchronously**, in the same call stack as `commit()`'s return
  (SPEC §15.3: subscriber fires are NOT batched; option (c) pins
  this deliberately).
- **`read()` returns the engine's authoritative value**: under
  `rust-ssot` that authority is the Rust engine (every adopter read
  resolves from Rust, §18A.3 lift landed).
- **Default behaviour is byte-identical to not passing the option.**
  This is a load-bearing acceptance test (epic #1493 phase C.4):
  default-config `commit`/`read`/`subscribe`/`exportModel`/`now` is
  byte-identical to a bare default `createCausl()` graph.

The opt-in is **per-graph** (not a global flag) and **additive** (no
deprecation cycle, no lint, no RC track). Multi-graph adopters
(`@causl/sync`, embedded use-cases) opt in per graph without
cross-graph coupling.

### Why turn it on at all, then?

You generally should **not**. `batchedFlush` amortises the per-commit
FFI boundary tax across a window (the C.6 measurement confirms the
crossing tax amortises ~`15.64 / N` µs, crossing the ≤50 ns floor at
N≥312), so a workload that commits at very high frequency and is
sensitive to the marshaling tax can trim the *crossing* portion of
that cost. It does **not** change any adopter-visible behaviour, and
perf is immaterial within the §14 RAIL budget: so most adopters
leave it unset. If you do enable it, use `backend.flush()` at
quiescence boundaries (before navigation, before `snapshot()`).

## 4a. `engine: 'rust-ssot'` is the unconditional production default

> **Read this framing first.** `rust-ssot` is the **unconditional production
> default** (`DEFAULT_WASM_ENGINE_MODE = 'rust-ssot'`, promoted 2026-06-21,
> causl-wasm#169). There is **no per-flush byte-compare oracle and no
> sticky-downgrade fail-safe**: both were **removed** (§18A.8). The Rust
> `commit_batch` post-state is applied **unconditionally**. Perf is **not** a
> gate: the driver is complexity-elimination, and per-commit wall-time stays
> inside the §14 RAIL responsiveness budget.

### What ships

The §18A.7 GO/NO-GO promotion gate passed (all five criteria GO), and the dated
amendment (causl-wasm#169) made the Rust engine the value-of-record for the WASM
path. You do not opt in: it is the default `createCausl()` / `createCauslWasm()`
route, and since 0.5.0 it is the only route. The `engine` option that used to
name a canonicality was removed with the `js-ssot` floor it selected, so there
is no per-graph opt left to describe:

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

// rust-ssot is the engine. Passing nothing is the whole API:
await preloadCauslWasm()

// Removed at 0.5.0. This throws RemovedEngineOptionError, it does not select:
await preloadCauslWasm({ engine: 'js-ssot' })
```

The `js-ssot` TS floor itself is gone from this package:
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) deleted
`createCauslTs` and the closure around it, and the conformance reference now
lives in [`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts).

### What does NOT change (the contract you can rely on)

The adopter-facing contract is preserved verbatim: `commit()` returns a frozen
`Commit` synchronously, `graph.now` advances exactly one tick per commit,
subscribers fire per-commit synchronously, and `read()` returns the engine's
authoritative value. Under `rust-ssot` that authority is the Rust engine.
Reference identity across `read()` calls is **not** part of that contract:
memoise on `commit.time` or `stats().nodeVersion(node)`, never on the read
reference: and what `read()` returns today is a **live, unfrozen** reference
to the committed value, which you must treat as read-only. See §H1.

### No oracle, no fail-safe, no downgrade

The earlier opt-in design carried a per-flush TS-vs-Rust byte-compare oracle and
a sticky-downgrade fail-safe that emitted `CAUSL_RUST_SSOT_DOWNGRADED`. **Both
were removed** by the §18A.8 fail-safe-removal amendment (causl-wasm#169):
`rust-ssot` applies the Rust post-state unconditionally: no per-flush compare,
no rollback, no demotion to `js-ssot`. The justification is the cross-backend
determinism gate at **0-byte divergence over 100,000 trials** (seed 1718935200,
maxCommands 2000), far beyond the 1000-trial floor. That CI-blocking gate
(§18A.1.1) is now the **sole** conformance guarantee and **sole** detector; a
divergence is a halt-before-merge condition resolved by a governance revert
(re-pinning the floor), **not** an in-process downgrade. There is no
`CAUSL_RUST_SSOT_DOWNGRADED` runtime path to dispatch on.

### The honest performance picture

`rust-ssot` ships for complexity-elimination, not speed. Crossing the JS↔WASM
boundary costs real time on every commit, and the engine pays today's WASM
runtime maturity (no GC GA, limited baseline JIT, no SIMD on the hot path).
Earlier editions quoted a specific FFI-tax multiplier against the
pure-TypeScript engine here; that figure traced to a measurement whose driver
and outputs are not committed to this workspace, and the TS engine it compared
against was deleted at 0.5.0 (#279, #280), so this guide no longer asserts it.
The measurements this repository commits are the six cells in
`packages/core/bench/baseline.json`, captured on the shipped engine; read
current costs there. What remains true: the cost is a property of *today's*
WASM runtime, not the engine design, and it is **immaterial to the adopter
UX**: per-commit wall-time stays inside the §14 RAIL responsiveness budget
(all six RAIL cells PASS, §18A.7 Criterion 3 GO/RESOLVED). Perf is neither a
reason to adopt nor a reason to avoid the wasm engine here.

### The present value: large-tree GC-survival

A robustness property worth naming: on a very large tree (tens of thousands of
nodes) the real Rust-in-WASM engine survives memory pressure where a pure-JS
substrate GC-destabilises. This is a *robustness* axis for large trees, not a
median-latency win: consistent with the perf framing above.

## 4b. Graph lifetime: many graphs in one synchronous turn

Every graph `createCauslWasmSync` builds owns a wasm engine, and that engine is
held by module-level per-`engineId` handler maps until something tears it down.
There are two ways for that to happen, and they cost different amounts.

**Dispose, and the engine is gone immediately.** `disposeCauslWasmGraph(graph)`,
`graph.dispose()` and `using graph = createCauslWasmSync(...)` all run the same
teardown, synchronously, in the turn that calls them. A loop that constructs and
disposes 20 000 graphs without yielding once retains 2.1 MB, about 0.11 KB per
graph (Node v26.5.1, arm64, `heapUsed` after two forced full collections). That
is the shape to reach for.

**Drop it without disposing, and release waits for the next turn.** The
`FinalizationRegistry` backstop runs the same teardown for a graph nobody
disposed, but a finalizer callback is an event-loop turn by definition, so a
synchronous loop that never yields never sees one. Measured on the same host:
20 000 dropped graphs retain 323 MB, about 16.2 KB each, and return to baseline
across a single turn boundary. Yielding periodically
(`await new Promise((resolve) => setImmediate(resolve))`) is what makes the
backstop reachable.

An adopter who builds tens of thousands of graphs in one turn therefore needs
one of the two. Disposing is cheaper and is the only one available without
yielding. Before causl/causl-core-rs#370 disposing did not help either: the
teardown registry aimed a `WeakRef` at the engine's backend, and the `WeakRef`
constructor's AddToKeptObjects pin (ECMA-262 §26.1.1) is dropped by the host at
the next turn and by nothing a program can call, so a disposed engine stayed
pinned at about 15.3 KB a graph regardless. The registry now aims that `WeakRef`
at a one-field cell the teardown nulls, so disposal severs the last edge.

## 5. Where to read the host-tier matrix

The authoritative host-tier compatibility matrix lives in two
places, both maintained in lockstep:

- **`packages/core/wasm/README.md`**: adopter-facing entry-point
  documentation, with the per-bridge bundle costs, CSP guidance,
  and bundler-interop notes.
- **SPEC §17.6**: the host-tier matrix as a SPEC commitment
  (commitment 14, DESIGN-DISCIPLINE), with the four feature-detection
  probes named, the bundle-size ceiling table, and the
  fall-through fallback contract.

When a new host version graduates a WASM feature, both documents update in the
same PR per SPEC §17.6's DESIGN-DISCIPLINE mechanism. The example this
paragraph used to give, Safari shipping JS String Builtins and promoting a host
from Tier 2 to Tier 1, no longer describes anything: the ladder collapsed when
causl/causl-core-rs#355 retired `gc-builtins`, and the one remaining bridge
asks for no host feature above WasmGC. Adopters checking the floor for a
specific host should read the SPEC §17.6 row first (it is the contract) and the
README for the implementation detail, remembering that Commitment 14's
fall-through to the TS engine was withdrawn at 0.5.0: below WasmGC there is a
throw, not a floor.

## Cross-references

- SPEC §17.1, commitment 14: the contract row (ratified via PR #1053).
- SPEC §17.6: the host-tier elaboration, feature-detection
  checklist, bundle-size impact, fall-through fallback.
- SPEC §19: the amendment trail rows for #690 (host-tier matrix)
  and #1124 (read-reference identity, ratified via PR #1129).
- SPEC §18A.7 / §18A.8: the promotion amendment (rust-ssot is the
  unconditional default, all five GO/NO-GO criteria met) and the
  fail-safe-removal amendment (the per-flush byte-compare oracle and
  the sticky-downgrade fail-safe removed; causl-wasm#169).
- SPEC §18A.1.1: the CI-blocking cross-backend determinism gate
  (0-byte divergence over 100,000 trials), now the sole conformance
  guarantee for the wasm path.
- `packages/core/wasm/README.md`: entry-point reference, bridge
  picker behaviour, bundler interop.
- `docs/wasm-backend-adopter-audit.md` (#695, **merged**): the
  Phase-0 adopter-API audit that gated the `BackendEngine` carve in
  #681 (a dated historical record; the wasm path is now the real Rust
  engine: see the HISTORICAL banner on that file).
- SPEC §18A.12: the sync separation (**SHIPPED** in the fork and in
  causl-client): `preloadCauslWasm` / `createCauslWasmSync`, the
  `isCauslWasmPreloaded` / `getPreloadedCauslWasm` companions, the
  `CauslWasmNotPreloadedError` throw policy, and
  `createCauslWasm` = preload ∘ sync. See §0a.
- SPEC §18A.13 / §18A.13.1 / §18A.10 / EPIC #31 (issue #34): the
  causl-client **wasm-only core** (**SHIPPED** 2026-06-20;
  gate-bypassed, enterprise-only; **scoped to causl-client only**:
  `createCauslTs` removed from the causl-client `@causl/core` barrel,
  while the fork `causl/causl-core-ts` keeps the publicly
  selectable dual-engine TS floor). **§18A.13.1 (2026-06-23)** briefly
  retained `createCauslTs` as the implicit `createCausl()` path's
  WasmGC-unavailable capability fallback and was **withdrawn at 0.5.0**
  ([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280));
  [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) then
  deleted the declaration. The §18A.3 FFI lift has landed
  (`causl/causl-core-rs#170`). See §0b.
