# `@causl/causl-wasm-ts/wasm`

> ✅ **The wasm engine is a real Rust engine and the production
> default.** The §18A.3 FFI structural lift landed
> ([`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170)):
> the engine reached over `@causl/causl-wasm-ts/wasm` is `engine-rs-core`
> compiled to WebAssembly: **not** the old "TS engine wrapped in the
> FFI shape": and **every adopter operation resolves from Rust**:
> `commit` / `read` / `subscribe` / `derived` plus the second-tier
> `dependencies` / `dependents` / `stats` / `commitLog` /
> `explain` (incl. per-node timestamps via `node_meta`) / `exportModel`
> / `readAt` / `snapshotAt` / `subscribeCommits`. On the **read/derive**
> hot path the only JS left is the user's own `derived()` compute
> lambda, which runs in JS over the bridge callback **by design**.
> Multi-instance isolation is shipped via `engine_id` multiplexing, so
> independent graphs in one process never alias state.
>
> **The commit path is thin (issue #129: the write-SSOT cutover
> landed).** The **rust-ssot commit-SSOT cutover** has LANDED in this
> distribution: the ENGINE is the **commit SSOT**, and a fully-mirrored
> commit runs NO TS **Phase A–H** structural walk. Measured in this
> repository (`wasm-thin-binding-disclosure-129.test.ts` AC1), all four
> white-box counters stay flat across an accepted commit: the Phase A–C
> publication to the outer TS input cells is deleted, the Phase-D
> recompute fixpoint (#243) and structural topo walk (#248) are elided
> (the engine is the single cycle authority), and the Phase-F
> `commitLog` ring append is deleted: the adopter-facing `commitLog`,
> its per-commit refresh, and `stats().retainedCommits` are answered
> from the ENGINE's cap-bounded commit log (`commit_log_meta`,
> causl-wasm#318), whose eviction horizon is threaded from
> `commitHistoryCap` at boot. Commit-path value retention sits at the
> documented 2× floor (AC2: the outer TS input cell is released), and
> `graph.simulate` routes to the engine rather than a TS dry-run walk
> (causl-wasm#320). What stays TS-side per commit is deliberate, and it
> is not a shadow pipeline: the Phase-A staging validation pre-flight,
> the Phase-C.5 `lastWriteTime` stamps (the #83 explain mirror), the
> Phase-F.6 retention delta, and the TS-owned Phase-G group/projection
> dispatch (zero work without registrations).
>
> Read/derive orchestration is in Rust; compute lambdas are in JS;
> per-commit wall-time stays within the §14 RAIL responsiveness budget
> (perf is **not** the reason this engine ships: complexity-elimination
> is). What remains beyond that is the literal **zero-TS core**:
> removing the residual internal TS scaffolding (the structural closure
> is a binding, not an engine): a scoped future epic, not a gate on the
> production engine.

WebAssembly engine entry point for `@causl/causl-wasm-ts`: the production engine.

## Integrate causl-wasm + causl-client into your Node.js app

`causl-client` is **wasm-only**: the wasm engine is the *only* engine
behind the §12 `Graph` surface (SPEC §18A.1). Since 0.5.0 there is no
fallback of any kind: the §18A.13.1 TS capability-fallback for the
implicit `createCausl()` path is **withdrawn**
([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)), so every
route fails loud: implicit `createCausl()`, explicit `createCauslWasm()`
and `createCauslWasmSync()` alike. Your application programs against the
surface only (never against an engine) and handles the failure in a
`catch`, because there is nothing left to degrade onto.

| Engine | What it is | Role in `causl-client` |
| --- | --- | --- |
| **causl-wasm** | The Rust → WebAssembly engine core (`engine-rs-core` + `engine-rs-bridge`), reached through the **causl-client** thin TS FFI binding. Every adopter op resolves from Rust; the §18A.3 FFI lift has landed ([causl-wasm#170](https://git.opsite.ca/causl/causl-core-rs/issues/170)). | **The production engine** (`rust-ssot`), reached via `createCausl()` once `preloadCauslWasm()` has run. |
| internal TS floor | The deterministic TypeScript reference engine. | **DELETED** by [causl/causl-wasm-ts#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) slice S12. It was never a public engine choice, [#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280) removed the two options that reached it (`engine`, `backend`) and the §18A.13.1 capability fallback, and S12 removed the implementation from inside the structural closure. What survives is the STRUCTURAL half, which is not an engine: node-handle minting and identity, `Tx`, hosting the adopter's compute lambdas over the bridge callback, `subscribeMany`, `subscribeReads`, `explain` composition, IR and schema, and migration. It is reached through `constructGraphOverEngine(options, engine)`, which takes a REQUIRED engine and is not callable without one. The §12 conformance reference now lives in [`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts), at a pinned commit. |

> **Status: the production engine is real Rust.** `@causl/causl-wasm-ts/wasm`
> reaches `engine-rs-core` compiled to WebAssembly, and **every adopter
> operation resolves from Rust** (§18A.3 lift landed,
> [causl-wasm#170](https://git.opsite.ca/causl/causl-core-rs/issues/170)):
> this is **not** the old "TS engine wrapped in the FFI shape." The
> user's `derived()` compute lambdas run in JS over the bridge callback
> **by design**; on the read/derive hot path that is the only JS. The
> read/derive orchestration (dependency walk, scheduling) is Rust; the
> **commit** pipeline is thin too since the rust-ssot commit-SSOT
> cutover landed (issue #129): the engine is the commit SSOT, and a
> fully-mirrored commit runs no TS Phase A–H structural walk. Per-commit
> wall-time stays inside the §14 RAIL responsiveness budget; perf is
> explicitly **not** the driver: `causl-client` made wasm its default
> engine for complexity-elimination, recorded as a dated §13.8/§18A.13
> governance amendment that deliberately bypassed the §18A.7 promotion
> gate (the §18A.13.1 implicit-path TS capability fallback that briefly
> qualified this was **withdrawn at 0.5.0**).

### Producer side: build & place the artefact with `causl-wasm`'s Python tooling (Enterprise)

The **producer** repo (`causl/causl-core-rs`) owns the Rust engine plus
two **stdlib-only Python 3 scripts**: no `pip install`, no Node, drops
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
#   gc-classic  -> classic-strings   (UTF-16 fallback, and now the only one;
#                                     gc-builtins was retired by
#                                     causl/causl-core-rs#355)
python3 scripts/build_wasm.py --bridge gc-classic            # -> build/wasm-nodejs

# PACKAGE half — CPython stdlib only, NO Rust toolchain. --dest is REQUIRED.
# Places causl_engine_bridge_bg.wasm + .js (node glue) + .d.ts verbatim,
# and writes causl-wasm.manifest.json (schema "causl-wasm/manifest@1") carrying
# engineVersion, bridge, target:"nodejs", wasmOptFlags, and files[] = {name, sha256, bytes}.
python3 scripts/package_wasm.py --build --dest apps/web/src/engine/wasm
```

The single `--build --dest <DIR>` call does build + place in one step:
the common pipeline entry point. The manifest is byte-reproducible (no
`built-at` by default), so git-track it and add a **loud, network-free
verify gate** (file existence + per-file sha256 against the manifest)
to CI and/or a pre-commit hook: a corrupt, missing, or version-skewed
`.wasm` is a hard failure, never a silent fall-through. A consuming app
needs only **CPython stdlib and a checksum to vendor**: **never a Rust
toolchain**.

To support the §18A.12 sync seam (above), `package_wasm.py` also places
the **`causl-compute-imports.js` snippet** next to the `.wasm` / `_bg.js`
in each bridge dir, and the scripts **assert (fail-loud)** on:

- the §18A.12 **sync instantiate seam**: `new WebAssembly.Instance` in
  the `--target nodejs` glue and an exported `__wbg_set_wasm` in the
  bundler `_bg.js` (a wasm-pack / wasm-bindgen upgrade that drops either
  fails the build, never silently);
- **snippet presence**: the compute-imports snippet is packaged, so the
  sync factory always has a real sidecar + snippet and the throw-stub
  path is dead;
- **node-loadability**: `gc-classic` loads as `--target nodejs`. The
  `gc-builtins` variant emitted `require("wasm:js-string")`, which stock
  Node cannot resolve, so it was bundler-target only; it has since been
  retired outright (causl/causl-core-rs#355), because its
  `wasm:js-string` imports are i32-typed and cannot bind the
  externref-typed builtins on any host at all
  (causl/causl-core-rs#210).

### Consumer side: install `@causl/causl-wasm-ts` and load over `@causl/causl-wasm-ts/wasm`

The **consumer** package is **`@causl/causl-wasm-ts`** (the thin TS API;
`causl-client` is the repo, there is no separately-published
`causl-client` npm package). The `engines` field requires **Node ≥ 22**
(matching the host table below), ESM-only.

The package is served ONLY by the private Gitea registry, so point the
`@causl` scope there first (a `read:package` token is required; without
this the command resolves public npmjs, where the name has no versions):

```ini
# ~/.npmrc (or a repo-root .npmrc)
@causl:registry=https://git.opsite.ca/api/packages/causl/npm/
//git.opsite.ca/api/packages/causl/npm/:_authToken=${GITEA_PACKAGES_TOKEN}
```

```bash
npm install @causl/causl-wasm-ts        # or: pnpm add @causl/causl-wasm-ts
```

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'
import { createCausl } from '@causl/causl-wasm-ts'

// The wasm seam lives behind the `./wasm` subpath export. Importing the
// bare `@causl/causl-wasm-ts` does NOT pull the wasm chunk
// (sideEffects:false) — only an explicit `import('@causl/causl-wasm-ts/wasm')`
// pays the cost. Since 0.5.0 that import is also REQUIRED: `createCausl()`
// throws when it is absent.
//
// `preloadCauslWasm()` is the ONE async seam: it compiles and caches the
// WebAssembly.Module for the bridge. Call it once, at app init.
await preloadCauslWasm()

try {
  const graph = createCausl()   // synchronous, forever after
  const n = graph.input('n', 1)
  console.log(graph.read(n))    // 1
} catch (err) {
  // Substitution, not acceleration: there is no TS floor to branch back to.
  // Branch on `code`, never on `instanceof` — see "The failure contract" in
  // the CHANGELOG's `## [0.5.0]` section for why rows 1 and 3 share a code.
  switch ((err as { code?: string }).code) {
    case 'CAUSL_WASM_NOT_PRELOADED':      // fix the boot ordering
    case 'CAUSL_WASM_ENGINE_UNAVAILABLE': // import the subpath, or the host cannot run it
      throw new Error('this host cannot run the causl engine', { cause: err })
    default:
      throw err
  }
}
```

`preloadCauslWasm(options?)` is the **entry point an application calls**:
async, called once per process+bridge, idempotent, and loud-fail. Honoured
options: `wasmBaseUrl` (CDN/CSP override), `computeImportsUrl`, `fetch`,
`graphName`, and `bridge`. The `engine` option was removed in 0.5.0: every
construct is `rust-ssot`. The structured `code` values are listed in the
[API](#api) section below.

Two caveats on that list, both measured on this tree:

- **`bridge` has exactly one reachable value, `'wasmgc-classic'`.** The
  `BridgeId` union still declares `'wasmgc-builtins'` so the id can be
  named and refused, and refused is what it is:
  `preloadCauslWasm({ bridge: 'wasmgc-builtins' })` throws
  `WasmEngineUnavailableError` before it resolves anything, on the source
  checkout and the packed tarball alike. Vendoring the tree yourself does
  not help. causl/causl-core-rs#210 measured that artefact's
  `wasm:js-string` imports as i32-typed where the W3C builtins are
  externref-typed, so `WebAssembly.compile(bytes, { builtins:
  ['js-string'] })` refuses it on every host; causl/causl-core-rs#355
  deleted the tree and the build row on that finding. The way back is
  causl/causl-core-rs#358, which retypes those imports to `externref` on
  the engine side; no change in this package reopens the tier.
- **`batchedFlush` is accepted here but inert here.** Preloading with
  `batchedFlush: 1` and with `batchedFlush: 1000` yields identical
  subscriber-fire sequences. Pass it per-graph instead:
  `createCauslWasm({ create: { batchedFlush } })`: which is the route
  that reaches the backend.

`loadWasmBackend(options?)` is **not** an adopter entry point, despite being
exported: it is a **determinism-gate / test surface**. It returns a twelve-member
`BackendEngine` rather than the seven-method `Graph` this package documents, and
it does not stamp the per-graph engine identity.

What it is NOT any more, because this paragraph said the opposite until
[#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) slice S12a: it is
no longer a TypeScript wrap. From Phase 1 ([#1065](https://git.opsite.ca/causl/causl-wasm-ts/issues/1065))
until that slice the `WasmBackend` it returned wrapped a pure-TypeScript
`Graph` and answered nine of its twelve members off it. S12a deleted the wrap,
so the loader compiles the artefact, attaches the exports and enables the
authoritative engine, and `test/wasm-backend-engine-backed-279.test.ts` pins
that behaviourally: a value committed through this backend is read back out of
the engine that accepted the commit. Calling it still does **not** satisfy
`createCausl()`'s preload precondition (only `preloadCauslWasm()` populates
that cache), so it is still the wrong door for an adopter. The one option
that used to consume its return value, `createCausl({ backend })`, was removed
in 0.5.0, so its result now has no supported consumer. It is retained for the
cross-backend determinism gate and the snapshot/hydrate round-trip, where the
wrapped TS engine is the SPEC-faithful oracle by construction.

> **Higher-level convenience: the public factories.** The default
> public factory is `createCausl()`, exported from the main
> `@causl/causl-wasm-ts` barrel: it **routes to the real wasm engine
> synchronously** once `@causl/causl-wasm-ts/wasm` has been preloaded for the
> default bridge (via `preloadCauslWasm()`), and **throws during
> construction** when it has not: construct-or-throw, with no
> partially-built graph and no async window. Alongside it, the
> `@causl/causl-wasm-ts/wasm` subpath exposes the
> wasm factories: `createCauslWasm()` (async) and
> `createCauslWasmSync()` (sync): kept out of the main bundle. The
> synchronous `createCauslWasmSync()` is the §18A.12 sync-separation
> surface documented in [Synchronous
> construction](#synchronous-construction--preload--createcauslwasmsync-spec-18a12)
> below. There is **no** public pure-TypeScript factory on
> `@causl/causl-wasm-ts`, and since
> [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) slice S12 there
> is no internal one either: what survives in-package is the structural
> closure, which takes a required engine.

## Artefact layouts: how the loader finds the `.wasm` (issue #68)

The loader resolves the consolidated bridge artefact
(`<segment>/causl_engine_bridge_bg.wasm`, plus its `_bg.js` sidecar and
the `snippets/<crate-hash>/causl-compute-imports.js` compute-imports
snippet) through, in order:

1. **Explicit `{ wasmBaseUrl, computeImportsUrl }`**: always wins, and
   is the **only** path that works in a browser / bundler dev-server
   host (see below).
2. **Layout A: `dist/pkg/<segment>/` (opt-in, local only).** Probed
   next to the built `dist/wasm.js`. **Nothing populates `dist/pkg` at
   pack time**, so the published tarball ships no layout-A tree and the
   loader falls through to layout B (below). To materialise layout A in
   a source checkout, run `node tools/wasm-build/link-dist-pkg.mjs`
   after a build; it symlinks the layout-B trees into `dist/pkg/` (and
   its `--unlink` mode removes them again without leaving empty residue
   dirs).
3. **Layout B: `wasm-pkg/<segment>-bundler/`.** The artefact trees
   **committed in this repo** under `packages/core/wasm-pkg/`. This is
   the zero-config path on Node: for a source or `link:`-consumed
   checkout **and for a published-tarball install alike**:
   `preloadCauslWasm()` / `loadAuthoritativeWasm()` with no options
   resolve it via a filesystem probe (in an install the probe lands on
   `node_modules/@causl/causl-wasm-ts/wasm-pkg/…`, the sibling of the built
   `dist/`).

   **What the tarball actually ships** (the `files` field in
   `packages/core/package.json` is the source of truth): `dist/` **minus
   its `*.map` sourcemaps**, plus the single live `gc-classic-bundler`
   baseline: the segment `detectBridge()` returns, and now the only
   segment there is. The `gc-builtins-bundler` tree was excluded from the
   tarball by #147 as ~730 KiB of dead weight, and DELETED by
   causl/causl-core-rs#355 once causl/causl-core-rs#210 measured why it
   was dead: its `wasm:js-string` imports are i32-typed where the W3C
   builtins are externref-typed, so no host can bind them.
   causl/causl-core-rs#358 is the retype that would make it loadable
   again. Vendoring a future bridge for an Enterprise pin remains a
   served/explicit-URL concern (see the browser section below), not a
   default install cost.

**Browser / Vite / Storybook hosts.** Neither filesystem layout is
reachable from a browser (the loader's Node-builtin probe detects
Vite's `node:*` browser stubs and falls back cleanly: issue #68), so
the artefact must be **served** and named explicitly:

```ts
// Vendor packages/core/wasm-pkg/gc-classic-bundler/ (wasm + _bg.js +
// snippets/) into your static-assets dir, e.g. public/causl-wasm/
// gc-classic/…, then at app boot:
await preloadCauslWasm({
  wasmBaseUrl: '/causl-wasm/',
  computeImportsUrl:
    '/causl-wasm/gc-classic/snippets/<crate-hash>/causl-compute-imports.js',
})
```

`computeImportsUrl` is required alongside a non-`file:` `wasmBaseUrl`
because the `snippets/<crate-hash>/` segment is content-addressed and a
remote directory cannot be enumerated. A worked vendoring script lives
in the `xldatagrid` adopter (`scripts/causl-wasm-vendor.mjs`): copy the
bundler tree, serve it, pass the two URLs.

## Synchronous construction: preload + `createCauslWasmSync` (SPEC §18A.12)

The wasm engine is **synchronous from a consumer's perspective**. The
one unavoidable async (compiling the `WebAssembly.Module`) is split
out of construction so a sync consumer (React render/hooks, an
`xldatagrid` cell, synchronous SSR) can build a wasm-backed `Graph`
with **no `await` at the call site**. The single `await` lives once, at
app init.

```ts
import {
  preloadCauslWasm,
  createCauslWasmSync,
  CauslWasmNotPreloadedError,
} from '@causl/causl-wasm-ts/wasm'

// ONCE, at app/init — the one async seam.
await preloadCauslWasm()

// Then, anywhere — fully synchronous, zero await at the call site.
function useCauslGraph() {
  const graph = createCauslWasmSync()   // sync; safe in render/hooks
  // ...
}
```

**`await preloadCauslWasm(opts?): Promise<CauslWasmModule>`**: the ONE
async seam, called **once** per process+bridge at app init. It resolves
the bridge (via `detectBridge()` unless pinned) and the per-graph
backend params, caches the result keyed by bridge, and is **idempotent**
(concurrent calls share one resolution; a transient failure drops the
cache entry so the next call retries). It is loud-fail: an unresolvable
bridge throws a `WasmEngineUnavailableError` rather than degrading. Two
synchronous companions peek the **resolved** state without awaiting:
`isCauslWasmPreloaded(bridge?)` and `getPreloadedCauslWasm(bridge?)`
(both read the resolved slot, set in the preload's `.then`: not merely
its in-flight promise).

**`createCauslWasmSync(handle?, create?): Graph`**: **fully
synchronous**. It constructs the backend for the preloaded bridge and
wraps it in a public seven-method `Graph`, all in one tick. The handle
is the value returned by `preloadCauslWasm()`, or (when omitted) the
preloaded handle for the most-recently-resolved bridge. It **never
silently awaits**: a wasm-authoritative graph and a TS graph differ in
`read()`-identity / commit-clock (§15.1), so a silent swap is a
glitch-freedom hazard. When nothing is preloaded for the bridge it
**throws `CauslWasmNotPreloadedError`**, naming the remedy
(`preloadCauslWasm()`) and the bridge.

`CauslWasmNotPreloadedError` is a subclass of the
`WasmEngineUnavailableError` family; branch on
`error.code === 'CAUSL_WASM_NOT_PRELOADED'` (the base family carries
`'CAUSL_WASM_ENGINE_UNAVAILABLE'`). The `{ fallbackToTs: true }` /
`{ fallbackToJs: true }` opt-out of that throw was removed in 0.5.0
([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)): the floor
and `rust-ssot` disagree observably on in-place mutation of a committed
value ([#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272)), so a
soft path silently delivered an engine that answers differently from the
one the caller asked for.

**`createCauslWasm(opts?): Promise<Graph>`**: the existing async
factory is **retained**, now re-expressed as
`preload ∘ createCauslWasmSync`: `const h = await preloadCauslWasm(opts);
return createCauslWasmSync(h, opts)`. One construct codepath, provably
equal to its two halves, zero drift. It throws on the same conditions.

**Node vs browser.** On Node/SSR the `--target nodejs` glue is
synchronous end-to-end (`readFileSync` + `new WebAssembly.Module` +
`new WebAssembly.Instance` at require-time), so `createCauslWasmSync`
works **without** a prior preload: server render stays synchronous. In
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
> [causl-wasm#170](https://git.opsite.ca/causl/causl-core-rs/issues/170)).
> The user's `derived()` compute lambdas run in JS over the bridge
> callback **by design**: on the read/derive hot path that is the only
> JS (and the commit path is thin as well: the rust-ssot commit-SSOT
> cutover landed, issue #129, so no TS Phase A–H structural walk runs
> per commit). The
> authoritative loader source is mirrored in `causl/causl-core-ts` (the
> repo formerly called `causl-ts-wasm-engine`, a name no longer in use).
> The two repositories' copies of `SPEC.md` are **not** byte-identical and
> have not been for some time: the structural divergence is recorded in
> `DISTRIBUTION.md`, and restoring the invariant is `causl-core-ts#58`'s.

### Node-target status: shipped (precise)

| Capability | Status |
| --- | --- |
| Producer `--target nodejs` build + placement (`build_wasm.py` / `package_wasm.py`, sha256 manifest) | **SHIPPED** (SPEC §18A.11) |
| Consumer `@causl/causl-wasm-ts/wasm` loader, bridge picker, instantiate path | **SHIPPED** (epic #680) |
| Engine runtime = the **real `engine-rs-core` Rust engine** compiled to WebAssembly; every adopter op resolves from Rust | **SHIPPED**: §18A.3 FFI lift landed ([causl-wasm#170](https://git.opsite.ca/causl/causl-core-rs/issues/170)) |
| Multi-instance isolation via `engine_id` multiplexing | **SHIPPED** |
| `read()` reference identity is **not** contractual | **SHIPPED** (SPEC §18A.5 / §15.1): memoise on `commit.time` / `stats().nodeVersion(node)`, never on the read reference. What the engine returns *today* is a live, unfrozen reference to the committed value; see the [read-identity callout](#read-identity--reads-are-live-and-unfrozen-1124-spec-151-via-pr-1129). |
| `rust-ssot` (the only mode) | **SHIPPED**: the production engine. The `engine` option and its `'js-ssot'` value were removed in 0.5.0 ([#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)); the internal TS closure remains the conformance reference and is not selectable. |
| Literal zero-TS core (removing the internal TS scaffolding the engine no longer routes through) | **FUTURE**: a scoped epic, not a gate on the production engine. |

So on Node today: the producer node-target tooling and the consumer
loader are real and shipped, and the engine they reach is the **real
Rust `engine-rs-core`**: orchestration in Rust, the user's `derived()`
compute lambdas in JS over the bridge callback. Per-commit wall-time
stays inside the §14 RAIL budget.

### Enterprise framing

**causl-wasm + causl-client are the Enterprise-tier path.** An
Enterprise CI/CD pipeline builds and vendors a pinned, checksummed
`.wasm` with the Python tooling (CPython stdlib + a checksum, never a
Rust toolchain in the consuming app), and the app reaches it through the
`@causl/causl-wasm-ts/wasm` seam: which is the **production engine**, not an
opt-in accelerator. The internal TS floor was DELETED by
[causl/causl-wasm-ts#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279)
slice S12: the §12 conformance reference now lives in
[`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts) at a
pinned commit, and what remains here is the structural closure
(`constructGraphOverEngine`), which is not an engine: it takes a REQUIRED
engine argument. The floor was never a public engine choice and, since
0.5.0, is not a fallback either.

### `causl-client` is wasm-only (SPEC §18A.13; §18A.13.1 withdrawn at 0.5.0)

A dated §13.8/§18A.7 governance amendment (2026-06-19) **committed
`causl-client` to ship the wasm engine as its default engine** and to
**remove the pure-TS engine from `causl-client`'s public surface**. The driver is **complexity-elimination**: shedding
the dual-engine maintenance burden for one Rust-authoritative engine;
**perf is explicitly accepted as immaterial** (it stays within the §14
RAIL responsiveness budget) and is **not** an argument anywhere in the
amendment. The decision **deliberately bypassed** the §18A.7 GO/NO-GO
promotion gate for `causl-client` and stated the bypass plainly.

SPEC §18A.13.1 (2026-06-23) then **partially reversed the fail-loud
stance for the implicit `createCausl()` path only**: the pure-TS engine was
**retained and wired** as that path's WasmGC-unavailable **capability
fallback** (loud: one-time `console.warn` + `onCauslCapabilityFallback`
telemetry, never silent). **That reversal is WITHDRAWN at 0.5.0**
([causl/causl-wasm-ts#280](https://git.opsite.ca/causl/causl-wasm-ts/issues/280)):
the fallback engine and the primary **disagree** on a §18A.1.1
MUST-be-identical surface: in-place mutation of a committed value,
[causl/causl-wasm-ts#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272)
— and a fallback that answers differently from the engine it stands in for
is worse than no fallback. **Every** path now fails loud with
`CAUSL_WASM_ENGINE_UNAVAILABLE` / `CAUSL_WASM_NOT_PRELOADED`: implicit
`createCausl()`, explicit `createCauslWasm()`, `createCauslWasmSync()`.
The pure-TS ENGINE **is now deleted**, by
[causl/causl-wasm-ts#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279)
slice S12. This paragraph said it was "still not deleted: it stays as the §12
conformance reference and the structural closure the wasm path wraps", and both
halves have moved. The conformance reference is
[`causl/causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts) at a pinned
commit, replayed here as captured traces rather than run in-process. The
structural closure is retained, renamed `constructGraphOverEngine`, and is not
an engine: it takes a REQUIRED engine argument, and node-handle minting, `Tx`,
compute-lambda hosting, `subscribeMany`, `subscribeReads`, `explain`
composition, IR and schema and migration are what is in it. Whatever "zero
TypeScript in the core" means beyond that is EPIC
[causl/causl-wasm-ts#275](https://git.opsite.ca/causl/causl-wasm-ts/issues/275).

This **shipped** (epic [#31](https://git.opsite.ca/causl/causl-wasm-ts/issues/31)
/ issue [#34](https://git.opsite.ca/causl/causl-wasm-ts/issues/34)),
executed in **wire-before-cut** order so the repo was never left with
zero working engine:

1. **WIRE**: the fork's authoritative Rust→wasm loader was ported into
   `causl-client` (the `.wasm` / `_bg.js` artefacts are vendored under
   `packages/core/wasm-pkg/`).
2. **FLIP + SYNC**: `createCausl()` runs the wasm engine synchronously,
   via the §18A.12 `preloadCauslWasm()` + `createCauslWasmSync()` split
   documented above. Sync consumers (e.g. `xldatagrid`'s `createCausl()`
   sites) keep calling `createCausl()` **unchanged** and transparently
   get wasm once the bridge is preloaded at app boot.
3. **CUT**: the pure-TS engine factory was removed from `causl-client`'s
   public `@causl/causl-wasm-ts` barrel; adopters can no longer pick the pure-TS
   engine directly. It survived **only internally** until
   [#279](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) slice S12
   deleted the engine from inside the structural closure. **SPEC
   §18A.13.1** briefly wired it as the implicit `createCausl()` path's
   WasmGC-unavailable capability fallback; that reversal was **withdrawn at
   0.5.0** and the literal deletion is tracked by EPIC
   [causl/causl-wasm-ts#275](https://git.opsite.ca/causl/causl-wasm-ts/issues/275).
   The §18A.3 FFI lift has since **landed**
   ([causl/causl-core-rs#170](https://git.opsite.ca/causl/causl-core-rs/issues/170)),
   so every adopter op resolves from Rust under rust-ssot.

App-boot invariant: the only async step is `WebAssembly.compile`, so an
app `await preloadCauslWasm()` **once** at boot (before first render),
then calls sync `createCausl()` / `createCauslWasmSync()` everywhere.
Since 0.5.0 that preload is a **hard prerequisite**, not an optimisation: a
no-preload `createCausl()` **throws during construction** rather than
returning a TS-floor `Graph`. On a host where the WasmGC engine cannot
**instantiate** (even with a module preloaded), every path fails the same
way: implicit `createCausl()`, explicit `createCauslWasm()` and
`createCauslWasmSync()` alike: with `CAUSL_WASM_ENGINE_UNAVAILABLE`. The
split by **how** the engine was requested is gone, because there is nothing
left to degrade onto.

The strip is scoped to `causl-client` only.
[**`causl/causl-core-ts`**](https://git.opsite.ca/causl/causl-core-ts) is
**NOT wasm-only**: it **keeps the dual-engine TS floor**, with its
pure-TypeScript factory still public there, as the differential-test oracle
(§18A.1.1 JS side), the benchmark repo, and the source of the
authoritative loader ported here: and it is now the organisation's only
owner of that floor. The TS engine is removed from `causl-client`, not
from `causl`.

## When to use

This entry point is the **production engine** for `causl-client`, and since
0.5.0 it is not optional: the default `createCausl()` routes here after one
`await preloadCauslWasm()` at boot, and throws without it. Reach for the
explicit `createCauslWasm()` / `createCauslWasmSync()` factories when you
want the engine spelled out at the call site. `loadWasmBackend()` is **not**
one of these choices: it is a determinism-gate shim that returns a TS-wrapped
`BackendEngine`, and the `backend` option that consumed it was removed in
0.5.0.

Orchestration (the commit pipeline, dependency walk, scheduling) runs in
Rust; the user's `derived()` compute lambdas run in JS over the bridge
callback **by design**. Per-commit wall-time stays inside the §14 RAIL
responsiveness budget: perf is **not** the reason this engine ships
(`causl-client` made wasm its default engine for complexity-elimination).
The internal TS floor is gone: #279 slice S12 deleted it, the §12
conformance reference moved to `causl/causl-core-ts` at a pinned commit,
and the structural closure that stays (`constructGraphOverEngine`) is a
binding over a REQUIRED engine, not an engine choice.
Since 0.5.0 it is not a fallback either: the `backend: 'auto'` auto-adapt
heuristic (#686) and the §18A.13.1 capability fallback are both gone, and
a host that cannot run the engine gets a `WasmEngineUnavailableError`.

## Cost shape

| Surface                                     | Cost                                                                                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@causl/causl-wasm-ts` main bundle                   | Tiny loader stub (~1 KB). No WASM import.                                                                                                                               |
| `@causl/causl-wasm-ts/wasm` (this)                   | Loader interface + bridge picker (~2 KB).                                                                                                                               |
| WASM artifact                               | 60–213 KB raw / 45–66 KB Brotli (GC-builtins ≈ 45 KB Brotli; serde-json **66 KB Brotli, 13 KB over the §17.6 80 KB target**: see Issue #1150 / PR #1161).              |
| First-use construction round-trip           | ~50–200 ms on a 10k-node graph.                                                                                                                                         |
| Per-commit boundary cost                    | Within the §14 RAIL responsiveness budget. **Thin (issue #129: the rust-ssot commit-SSOT cutover landed):** the engine is the commit SSOT, and a fully-mirrored commit runs no TS Phase A–H structural walk (all four white-box counters flat, `wasm-thin-binding-disclosure-129.test.ts` AC1). The Phase-D walks are elided (#243/#248), the TS Phase-F ring append is deleted, and `commitLog` / `retainedCommits` are answered from the ENGINE's cap-bounded commit log (`commit_log_meta`, causl-wasm#318). Values are retained at the 2× floor (AC2: the outer TS input cell is released). The read/derive hot path is Rust-only save the user's `derived()` lambda; the deliberate TS residue per commit is the Phase-A staging validation pre-flight, the Phase-C.5 `lastWriteTime` stamps, the Phase-F.6 retention delta and the Phase-G group/projection dispatch. |

## Read identity: reads are live and unfrozen (#1124, SPEC §15.1 via PR #1129)

Two separate things, often conflated. Keep them apart:

**The contract.** `graph.read(node)` is not contractually required to
return the same JavaScript reference across calls (SPEC §15.1, amended
by PR #1129). So do not key `React.memo` / `useMemo` on the read return
reference: **memoise on `commit.time` or
`graph.stats().nodeVersion(node)`**, both value-typed and stable under
any future change to how values cross the FFI boundary.

**The behaviour.** What `rust-ssot` does today is the *other* hazard,
and it is the one that actually costs adopters:

> `read(node)` hands back the **caller's own live, unfrozen object.**
> Two reads in the same tick are `===`; a read is `===` the value passed
> to `input` / `tx.set`; it is unchanged across unrelated commits; and
> `Object.isFrozen` on it is `false`. So `read(n).a = 999` **mutates
> committed state**: no commit, no `GraphTime` advance, no subscriber
> fire, nothing in `explain`, and every later read observes it.

```ts
const passed = { a: 1 }
const n = graph.input('obj', passed)

graph.read(n) === graph.read(n)   // true
graph.read(n) === passed          // true
Object.isFrozen(graph.read(n))    // false

graph.read(n).a = 999             // silent write-through
graph.read(n).a                   // 999
```

**Treat committed values as read-only.** Clone before you mutate and
commit the clone; deep-freeze in development to turn the silent
corruption into a `TypeError` at the mutation site. This is the
in-place-mutation divergence that
[#272](https://git.opsite.ca/causl/causl-wasm-ts/issues/272) records:
the reason the TS capability-fallback was withdrawn rather than kept.

## Host requirements

| Host                   | Status                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Node**               | 22.0+ for the WasmGC-classic bridge (the first release whose V8 enables typed function references by default). 22.6+ for the retired GC-builtins bridge. |
| **Chrome / Edge**      | 119+ for the WasmGC-classic bridge (V8's default-on release; CSP still needs `wasm-unsafe-eval`). 131+ for the retired GC-builtins bridge. |
| **Firefox**            | 120+ for the WasmGC-classic bridge (`wasm-unsafe-eval`). 130+ for the retired GC-builtins bridge. |
| **Safari**             | 18.2+ for the WasmGC-classic bridge.                                                              |
| **Cloudflare Workers** | All current versions (`compatibility_date >= 2023-09-01`).                                        |
| **Deno**               | 1.39+ for the WasmGC-classic bridge (V8 12.0; `--allow-net` for fetch).                           |

This table is a mirror, not an authority. The floor is declared ONCE, on
`WASM_HOST_FLOOR` in `packages/core/src/wasm-registry.ts`, together with
its measured basis: a wasm-tools feature bisect of the shipped artefact
whose minimal validation set is typed function references (`call_ref`,
`(ref $t)`) plus reference types, bulk memory, sign-extension and
non-trapping float-to-int. `test/host-floor-single-source-426.test.ts`
holds this table equal to that declaration, because the two used to
disagree (causl/causl-wasm-ts#426): earlier revisions of this table carried "WebAssembly
1.0 baseline" versions, which describe hosts that can run SOME wasm, not
hosts that can run this artefact, and the 0.5.0 package throws on the
difference.

The **GC-builtins** floors in that table are the host requirements that
*would* apply if you vendored that bridge; they are not an invitation to
pin it. The published package ships only `gc-classic`, so the row that
governs a default install is the WasmGC-classic one: read the
GC-builtins columns as forward-looking, not as a supported configuration.

The bridge picker (`detectBridge()`) **probes** (causl/causl-wasm-ts#426, resolving the iasbuilt/causl#691
placeholder that always returned `'wasmgc-classic'`): it validates a
56-byte module using exactly the artefact's measured minimal feature set
above, resolves `'wasmgc-classic'` on hosts that accept it, and throws
the typed `WasmEngineUnavailableError` naming the declared floor on
hosts that refuse it, before any artefact fetch. A pinned
`preloadCauslWasm({ bridge })` skips the probe and leaves the host's own
`WebAssembly.compile` of the real artefact as the arbiter.

There is nothing to choose between: `'wasmgc-classic'` is the only bridge
this package builds or ships, and
`preloadCauslWasm({ bridge: 'wasmgc-builtins' })` throws
`WasmEngineUnavailableError` naming causl/causl-core-rs#210,
causl/causl-core-rs#355 and causl/causl-core-rs#358 (the retype that would
bring the tier back). If you have vendored another bridge tree
yourself, pin it with **`preloadCauslWasm({ bridge, wasmBaseUrl,
computeImportsUrl })`**: that is the only call that populates the
preload cache `createCausl()` reads. `loadWasmBackend({ bridge })` pins
nothing: it is the determinism-gate shim described above, it leaves
`isCauslWasmPreloaded()` `false`, and a `createCausl()` after it still
throws `CAUSL_WASM_NOT_PRELOADED`.

## Content-Security-Policy

Modern WASM execution requires `script-src 'wasm-unsafe-eval'`
(Chrome 95+, Firefox 102+; supersedes the legacy `'unsafe-eval'`
escape hatch).

A restrictive CSP without that directive is one of the ways the engine
fails to compile, and it surfaces like every other host failure:
`preloadCauslWasm()` **rejects** with `WasmEngineUnavailableError` /
`code: 'CAUSL_WASM_ENGINE_UNAVAILABLE'`. There is no CSP-specific code
— the `code` values are exhaustively listed under [API](#api): and
there is no TS engine to branch back to, so the adopter dispatch is a
`catch` that decides what an unsupported host should do. Document
`'wasm-unsafe-eval'` prominently in the host app's CSP posture before
enabling.

For hosts with strict `connect-src`, serve the artefact from your own
asset origin and point `wasmBaseUrl` at it:

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm({
  wasmBaseUrl: 'https://assets.example.com/causl/<version>/gc-classic-bundler/',
  computeImportsUrl:
    'https://assets.example.com/causl/<version>/gc-classic-bundler/snippets/<crate-hash>/causl-compute-imports.js',
})
```

**A public CDN is not one of the options.** Earlier revisions of this
section pointed these two URLs at jsDelivr. jsDelivr and unpkg mirror
npmjs, and `@causl/causl-wasm-ts` is private to the Gitea registry, so
neither can serve it at any version. Copy the directory out of
`node_modules/@causl/causl-wasm-ts/wasm-pkg/gc-classic-bundler/` at
deploy time, preserving the `snippets/` subtree, and host it yourself.

The loader does **not** auto-fallback to that origin: adopters must
whitelist it in their CSP `connect-src` explicitly.

## Bundler interop

This entry point ships against three target bundlers:

- **webpack 5**: set `experiments.asyncWebAssembly: true` so
  `import()` of the `.wasm` artifact resolves through the asset
  module pipeline.
- **Vite 5**: install `vite-plugin-wasm` until the rolldown-native
  WASM path lands. The loader uses `?url`-style URL resolution
  internally.
- **esbuild 0.20+**: pass `--loader:.wasm=file`. The non-streaming
  fallback path covers esbuild's lack of native streaming-instantiate
  glue.
- **Node 22+ ESM**: works out of the box. The artifact is resolved
  through the package's `exports` map.

A fixture matrix lives in `e2e/bundler-interop/`
(landed via #689); PRs that touch this entry point or the
`wasm-pack` output are gated on every bundler in the matrix
producing a working build.

## API

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

// Default — auto-detects the fastest bridge supported by the host.
await preloadCauslWasm()

// Pin a bridge.
await preloadCauslWasm({ bridge: 'wasmgc-classic' })

// CSP / CDN scenario. `computeImportsUrl` is required alongside a
// non-`file:` `wasmBaseUrl`: the `snippets/<crate-hash>/` segment is
// content-addressed and a remote directory cannot be enumerated.
await preloadCauslWasm({
  wasmBaseUrl: 'https://cdn.example.com/causl/wasm/',
  computeImportsUrl:
    'https://cdn.example.com/causl/wasm/gc-classic/snippets/<crate-hash>/causl-compute-imports.js',
})
```

When the bridge cannot be resolved (CSP block, missing host support, a
pinned bridge the host does not support, or a fetch failure),
`preloadCauslWasm()` **rejects** rather than degrading, and the
`createCausl()` that follows throws. Since 0.5.0 there is no TS engine to
branch to: the adopter dispatch is a `catch` that decides what an
unsupported host should do: a rendered error, a degraded read-only view, a
bug report: keyed on `err.code`:

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'
import { createCausl } from '@causl/causl-wasm-ts'

export async function boot(): Promise<ReturnType<typeof createCausl> | null> {
  try {
    await preloadCauslWasm()
    return createCausl()
  } catch (err) {
    switch ((err as { code?: string }).code) {
      case 'CAUSL_WASM_NOT_PRELOADED':
      case 'CAUSL_WASM_ENGINE_UNAVAILABLE':
      case 'CAUSL_WASM_NOT_BUILT':
        renderUnsupportedHost(err)
        return null
      default:
        throw err
    }
  }
}
```

`loadWasmBackend()` and `WasmBackendUnavailableError` remain exported for the
cross-backend determinism gate; see the note above the factory callout for
why an adopter should not call them.

### The structured `code` values

This is the complete list: branch on `err.code`, never on `instanceof`:

| `code` | Condition | Adopter action |
| --- | --- | --- |
| `CAUSL_WASM_ENGINE_UNAVAILABLE` | The `/wasm` subpath was never imported, **or** it was and the host cannot compile/instantiate the WasmGC artefact (no WasmGC support, a CSP without `'wasm-unsafe-eval'`, a pinned bridge this package does not ship, a failed fetch). | Render an unsupported-host state. There is no TS engine to fall back to. If it is a vendoring problem rather than a host problem, pass `wasmBaseUrl` / `computeImportsUrl`. |
| `CAUSL_WASM_NOT_PRELOADED` | The subpath is imported but `preloadCauslWasm()` has not resolved for this bridge. | Fix the boot ordering: `await preloadCauslWasm()` once, before the first `createCausl()`. `err.bridge` names the bridge, or is `undefined` when nothing was preloaded and none was pinned. |
| `CAUSL_WASM_NOT_BUILT` | The bridge artefacts are absent from the tree (an unbuilt source checkout). | Build or vendor the artefact. Not reachable from a published install. |
| `CAUSL_WASM_PRELOAD_CONFLICT` | A second `preloadCauslWasm()` asked for a different bridge than the one already resolved in this process. | Preload once, at app init, with one set of options. |
| `CAUSL_REMOVED_ENGINE_OPTION` | The options bag still carries `engine`, `backend`, `fallbackToTs` or `fallbackToJs`. | Delete the key: see the `0.5.0` migration. Not a host failure. |
| `CAUSL_NOT_A_GRAPH` | A value that is not a `Graph` built by this subpath was passed to a subpath helper (e.g. `disposeCauslWasmGraph`). | Fix the call site. |

### Synchronous-construction surface (§18A.12)

For the preload + sync-factory split: the way a sync consumer builds a
wasm graph with no `await` at the call site: see [Synchronous
construction](#synchronous-construction--preload--createcauslwasmsync-spec-18a12)
above. The added exports:

```ts
import {
  preloadCauslWasm,        // async, ONCE at app init — the one async seam
  createCauslWasmSync,     // fully synchronous Graph construct (zero await)
  createCauslWasm,         // async: preload ∘ createCauslWasmSync
  isCauslWasmPreloaded,    // sync peek — resolved-ness for a bridge
  getPreloadedCauslWasm,   // sync peek — the resolved handle (or undefined)
  CauslWasmNotPreloadedError,
  WasmEngineUnavailableError,
} from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm()                 // once, at app init
const g = createCauslWasmSync()          // sync, at every render/hook

// The retained async factory == preload ∘ createCauslWasmSync:
const viaAsync = await createCauslWasm()

// There is no soft path. A host that cannot run the engine throws
// WasmEngineUnavailableError; catch it and decide what to do.
```

## Status

This module ships the **loader, bridge picker, instantiate path, and the
real `engine-rs-core` Rust engine**: the **only** engine `causl-client`
ships (SPEC §18A.13.1's implicit-path TS capability fallback was withdrawn
at 0.5.0). The substrate sub-tasks landed under epic #680
(closed):

- #682: Rust workspace + `engine-rs-core` + bridge crates. **Merged.**
- #683: `wasm-pack` build pipeline + dual-artifact GC bridge. **Merged.**
- #693: `serde_json` + UTF-8 fallback bridge (the universal baseline). **Merged.**
- #691: Pluggable Bridge interface + feature-detection harness. **Merged.**
- #681: `BackendEngine` interface in TS. **Merged.**
- #684: JS bindings + lazy-load loader + `@causl/causl-wasm-ts/wasm` entry. **Merged (PR #1031).**
- #685 / #687 / #689 / #690: determinism gate, migration envelope, bundle hygiene, host-tier matrix. **Merged.**

EPIC: [#680](https://git.opsite.ca/causl/causl-wasm-ts/issues/680), **closed**.
The §18A.3 FFI structural lift: every adopter op resolving from Rust;
**landed** in [`causl/causl-core-rs#170`](https://git.opsite.ca/causl/causl-core-rs/issues/170);
multi-instance `engine_id` isolation is shipped.

### Current-state notes

- **Real Rust engine.** The shipping engine is `engine-rs-core` compiled
  to WebAssembly; every adopter read/derive op resolves from Rust, and
  the user's `derived()` compute lambdas run in JS over the bridge
  callback by design: on the read/derive hot path that is the only JS.
  **The commit path is thin (issue #129):** the rust-ssot commit-SSOT
  cutover landed in this distribution, the engine is the commit SSOT,
  and a fully-mirrored commit runs no TS Phase A–H structural walk (all
  four white-box counters flat: Phase-B cell publish, the Phase-D walks
  elided by #243/#248, the Phase-F `commitLog` ring append deleted with
  the log engine-sourced, causl-wasm#318). Values are retained at the
  2× floor. The deliberate TS residue per commit (Phase-A validation
  pre-flight, Phase-C.5 stamps, Phase-F.6 retention delta, Phase-G
  group/projection dispatch) is a binding concern, not a shadow engine;
  the residual literal **zero-TS core** stays a scoped future epic, not
  a gate on the production engine.
- **Serde bridge bundle ceiling (Issue #1150, amended via PR #1161).**
  The `serde-json` bridge ships at 213 KB raw / 66 KB Brotli, **13 KB
  over** the SPEC §17.6 commitment 14 target of 80 KB Brotli. PR #1161
  amended the size-limit ceiling and documented the divergence as
  acknowledged debt; the GC-builtins and GC-classic bridges remain
  within budget.

## See also

- **SPEC §17.1 commitment 14** + **SPEC §17.6**: the host-tier
  substrate-compatibility commitment (#690 amendment). Commitment
  14 is the SPEC-level contract that this README's host-requirements
  table and the bridge picker's auto-walk behaviour implement.
- [**`docs/wasm-adoption-guide.md`**](https://git.opsite.ca/causl/causl-wasm-ts/src/branch/main/docs/wasm-adoption-guide.md)
 : adopter-facing guide for the preload + Subresource Integrity (SRI)
  posture and the dynamic-import patterns for vendoring the WASM
  artefacts. It lives in the repository, not in this tarball, hence the
  absolute link. The authoritative `code` list is the table under
  [API](#the-structured-code-values) above, not the guide.
