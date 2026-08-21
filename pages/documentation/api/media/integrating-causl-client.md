# Integrating causl-client into a TypeScript / Node.js app

> The Node-integration counterpart to `causl-wasm`'s producer-side
> [`scripts/README.md`](https://git.opsite.ca/causl/causl-core-rs). That file
> documents how a Python pipeline **builds and places** the wasm artefact;
> this file documents how a TS/Node app **consumes** the placed artefact and
> binds it through the `@causl/causl-wasm-ts/wasm` thin TS API.

This guide is the consumer-side concretion of **SPEC §18A.4** (the thin-TS-API
definition) and **§18A.2** (the Node-target requirement). It covers, in order:

1. [What `causl-client` is](#1-what-causl-client-is): the thin TS API over the
   wasm core, and what it is *not*.
2. [Installing and using it in a TS/Node app](#2-installing-and-using-it).
3. [Where the wasm artefact comes from](#3-the-wasm-artefact-placement-the-producerconsumer-split)
  : the producer/consumer split and the `causl-wasm` Python scripts.
4. [The `node:fs` loader and host-tier matrix](#4-the-loader-and-the-host-tier-matrix).
5. [The `read()`-identity migration](#5-the-read-identity-migration-18a5--151-1124)
  : the one breaking change you must audit for before shipping on the wasm default.
6. [The performance ceiling](#6-the-performance-ceiling-18a7): what the wasm
   path costs, and why that cost is immaterial within the §14 RAIL budget.
7. [Synchronous construction: preload once, build sync](#7-synchronous-construction--preload-once-build-sync-18a12)
  : the §18A.12 `preloadCauslWasm()` + `createCauslWasmSync()` split that lets
   sync render/hook sites build a wasm graph with no `await` at the call site.
8. [The single-engine surface of causl-client](#8-the-single-engine-surface-of-causl-client-18a13)
  : the shipped §18A.13 cut of the TS engine from *this* distribution, the
   0.5.0 withdrawal of the §18A.13.1 capability fallback, and the deletion of
   the closure itself.

Every load-bearing claim cites a SPEC § anchor. Where the shipped code and the
SPEC contract differ, the gap is called out as **Shipped today** vs
**Planned (§…)**, never blurred. The wasm path is **real Rust shipped today**:
`rust-ssot` is the unconditional production default (the §18A.7 gate passed, the
§18A.3 FFI structural lift landed: causl-wasm#170), so every adopter operation
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
closures, the commit log, commit metadata, handle/disposal validation, stats:
the §12.2 second-tier surface).

**SPEC §18A.1** defines that contract over two conformant engines, held
byte-identical at the §12 boundary by the cross-backend determinism gate
(§18A.1.1). **This package ships one of them:**

| Engine | What it is | Status here |
| --- | --- | --- |
| **`causl-wasm`** | The Rust core (`engine-rs-core` + `engine-rs-bridge`) compiled to WebAssembly, reached over FFI. | **The only engine** (`rust-ssot` is the unconditional default since 2026-06-21; all five §18A.7 GO/NO-GO criteria are met, the dated promotion amendment landed: causl-wasm#169). Lives in `causl/causl-core-rs`. |
| **`causl-ts`** | The TypeScript reference engine: the value-of-record running natively on the JS event loop. | **Not in this package**, on any surface or in any file. It lives in `causl/causl-core-ts`, which stays dual-engine and is now the organisation's only owner of that floor. |

> **Distribution note (§18A.13, and §18A.13.1's withdrawal: shipped for *this*
> repo).** The two-engine roster is the **org-wide** contract and the standing
> reality in the dual-engine repo `causl/causl-core-ts` (the TS floor stays
> there). For the **`causl-client` distribution specifically**, a dated §18A.13
> amendment took it **wasm-default**: `createCausl` routes to the wasm engine
> and `createCauslTs` was **removed from the public `@causl/core` barrel of
> *this* package**. That cut shipped (epic #31 / issue #34), executed
> wire-before-cut. **SPEC §18A.13.1 (2026-06-23)** then briefly retained
> `createCauslTs` as the implicit `createCausl()` path's WasmGC-unavailable
> capability fallback; that reversal was **withdrawn at 0.5.0** (issue #280),
> because the floor and `rust-ssot` disagree on a §18A.1.1 MUST-be-identical
> surface (issue #272). Issue #279 then **deleted** `createCauslTs`,
> `commitInternal`, the structural facade and the `injectedBackend` seam from
> the source tree. The deeper §18A.3 FFI lift has landed
> (causl/causl-core-rs#170), so every adopter op resolves from Rust under
> rust-ssot. §8 records the shipped surface. **The fork is never wasm-only**: it
> keeps the dual-engine floor (and a public `createCauslTs`) as the conformance
> oracle.

**`causl-client` is the thin TypeScript API over the `causl-wasm` core**
(§18A.4). Stated plainly so the boundary stays honest, it is **not**:

- not a copy of the TS engine's `graph.ts`;
- not the ~7.5k-LOC TS shell under a new name;
- not "the same TS engine, just calling into WASM."

It is a thin adapter that (1) implements the public `Graph` interface by
delegating each method to the wasm core over FFI; (2) marshals parameters across
the JS↔WASM boundary (the cost is measured, not hidden: §6 below); and (3)
binds to the placed `.wasm` artefact. It **ships no Rust source**: the
authoritative produce-and-place tooling is the engine repo's (`causl/causl-core-rs`'s
`build_wasm.py` / `package_wasm.py`, §18A.11); the consume-and-bind surface is
this repo's. (A local dev convenience, `tools/wasm-build/build.mjs` /
`pnpm wasm:build`, republishes the vendored artefacts by resolving the sibling
`causl-wasm` checkout; it carries no Rust and is distinct from the authoritative
producer.)

### Repository topology (§18A.10)

```
causl/causl-core-rs          Rust engine + FFI externs + Python build/package tooling
                            (the source of truth for the causl-wasm engine)
causl/causl-wasm-ts        THIS REPO — the thin TS API + Node loader + adoption docs
                            (consumes the placed .wasm; ships no Rust)
causl/causl-core-ts  causl-ts (the TS floor) + cross-backend bench/conformance harness
```

Named first-party integration consumers: `iasbuilt/xldatagrid` and
`iasbuilt/webapp` (Node.js TS web apps).

> **Current state of the wasm path: real Rust shipped (SPEC §18A.7 / §18A.8).**
> The engine installed by `preloadCauslWasm()` is the **real `engine-rs-core` Rust
> core** compiled to WebAssembly, reached over FFI: not a TS wrapper. `rust-ssot`
> is the **unconditional production default** (`DEFAULT_WASM_ENGINE_MODE =
> 'rust-ssot'`, 2026-06-21), with **no per-flush byte-compare oracle and no
> sticky-downgrade fail-safe** (both removed per §18A.8 / causl-wasm#169). The
> §18A.3 FFI structural lift **landed** (causl-wasm#170), so **every adopter
> operation resolves from Rust**: the only JS in the hot path is the user's own
> `derived()` compute lambda, which runs over the bridge callback **by design**.
> The FFI seam, the bridge picker, and the CI-blocking cross-backend determinism
> gate (§18A.1.1, 0-divergence) are the standing conformance guarantee. This is
> repeated at the top of
> [`packages/core/wasm/README.md`](../packages/core/wasm/README.md).

---

## 2. Installing and using it

### 2.1 Install

The package is **`@causl/causl-wasm-ts`**, and it is **private**: the `@causl`
scope is served by the Gitea npm registry at
`https://git.opsite.ca/api/packages/causl/npm/`, not by npmjs. Point the scope
at that registry first, or the install cannot resolve it (anonymous requests
get `401`):

```ini
# ~/.npmrc, or a repo-root .npmrc
@causl:registry=https://git.opsite.ca/api/packages/causl/npm/
//git.opsite.ca/api/packages/causl/npm/:_authToken=${GITEA_PACKAGES_TOKEN}
always-auth=true
```

`GITEA_PACKAGES_TOKEN` is a Gitea personal access token carrying the
`read:package` scope (**git.opsite.ca → Settings → Applications → Generate New
Token**). The repo-root [`README.md`](../README.md) has the full setup,
including the publish side.

```sh
pnpm add @causl/causl-wasm-ts        # or: npm i @causl/causl-wasm-ts
```

> **Do not install `@causl/core`, and do not read a successful install of it as
> success.** Earlier revisions of this guide said `pnpm add @causl/core`. That
> command still works, which is exactly what makes it worth a warning rather
> than a correction: `@causl/core` is **not** an unresolvable old name. It is
> live on **public npmjs** at versions 0.3.0 through 0.3.3, described there as
> *"the reference TypeScript engine"*, which is the engine this line removed.
> So without the scoped registry line above, npm reaches npmjs, the install
> succeeds, and every `import` in this guide then resolves against the wrong
> package and a deleted engine.

The wasm artefact sits behind an **explicit subpath**, and since 0.5.0 importing
it is **required** rather than optional. Importing `@causl/causl-wasm-ts` pulls
in the public API plus a tiny loader stub (~1 KB) and no engine; the wasm bundle
cost is paid by callers who `import('@causl/causl-wasm-ts/wasm')` and call
`preloadCauslWasm()`, which every application now does. Node 22+ is required
(`engines.node: ">=22"`).

### 2.2 The smallest worked example

Identical to [SPEC §10](../SPEC.md). Two inputs, one derived, one diamond, one
subscriber, two commits, three observed propagations. `createCausl()` returns
the wasm engine (`rust-ssot`) once preloaded, and throws otherwise:

```ts
import { createCausl } from '@causl/causl-wasm-ts'
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm() // once, at app init (§7)

const graph = createCausl() // the wasm engine, synchronously; a throw without the preload
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

### 2.3 Reaching the engine

There is one engine and one way in: preload the artefact, then construct. The
preload is **async at the call site** (`await preloadCauslWasm()`). If you need
to build a graph from **synchronous** code: a React render, an `xldatagrid`
cell, an SSR pass: use the §18A.12 preload-then-sync split in
[§7](#7-synchronous-construction--preload-once-build-sync-18a12), which hoists
the single unavoidable `await` to app init so the construction call itself has
zero `await`.

```ts
import { createCausl } from '@causl/causl-wasm-ts'
import { preloadCauslWasm, isCauslEngineUnavailable } from '@causl/causl-wasm-ts/wasm'

export async function boot() {
  try {
    await preloadCauslWasm()
    return createCausl()
  } catch (err) {
    if (isCauslEngineUnavailable(err)) {
      // This host cannot run the engine (CSP block, missing WasmGC,
      // pinned-but-unsupported bridge, fetch failure), or nothing was
      // preloaded. There is no second engine: decide here what to render.
      return null
    }
    throw err
  }
}
```

`WasmEngineUnavailableError` and `CauslWasmNotPreloadedError` carry a structured
`code` field so you can dispatch per failure mode
(`CAUSL_WASM_ENGINE_UNAVAILABLE`, `CAUSL_WASM_NOT_PRELOADED`); the codes and the
per-code dispatch are documented in
[`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) §3, whose table is the
one to trust. `CAUSL_WASM_CSP_BLOCKED` was named here in earlier revisions and
never existed: a CSP that forbids `'wasm-unsafe-eval'` surfaces as
`CAUSL_WASM_ENGINE_UNAVAILABLE` like every other host failure.
`isCauslEngineUnavailable` narrows the two construction codes without a cast
under `useUnknownInCatchVariables`. Nothing auto-falls-back, because there is
nothing to fall back to.

> **The two paths that used to live here are gone.** `loadWasmBackend()`
> survives as a determinism-gate / test shim rather than an adopter entry point,
> because the `backend` option that consumed its return value was removed at
> 0.5.0. So did `backend: 'auto'`, the auto-adapt migration that started a graph
> on the TS engine and moved it onto the wasm backend when a workload heuristic
> tripped: with one engine there is nothing to migrate between. Passing
> `backend`, `engine`, `fallbackToTs` or `fallbackToJs` throws
> `RemovedEngineOptionError` (`code: 'CAUSL_REMOVED_ENGINE_OPTION'`) on the
> *key*, not the value, so a spread `0.4.x` config throws too. Deleting the key
> is the whole fix. SPEC §18A.4/§18A.1 describe the target seam as
> "`backend: await loadWasmBackend()` passed to `createCausl`"; read that as the
> org-wide seam contract, and `preloadCauslWasm()` + `createCausl()` as how this
> package reaches it.
>
> **So do not write `loadWasmBackend` in application code, including in the
> vendoring and bridge-pinning shapes below.** It still resolves, which is the
> trap: the call succeeds, returns a backend, and then nothing consumes it, so
> the artefact options you passed are silently dropped and every graph you build
> uses whatever was preloaded instead. `preloadCauslWasm(options)` is the seam
> that installs them, and it takes the same `bridge`, `wasmBaseUrl`, `fetch` and
> `graphName`. Every example in §4 and in
> [`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) §2 is written on it.

### 2.4 Never let application logic know which engine it runs on

The byte-identity gate exists so the §12 surface is the whole contract. Your
model code: `input` / `derived` / `commit` / `read` / `subscribe`: is identical
against any conformant engine, which is exactly what let this package drop to
one without touching a call site. If a piece of application logic has to know
which engine it is running on, that is a bug: the only legitimate exception is
the `read()`-identity migration (§5), which you fix *once*, defensively, so it
is correct against any engine.

---

## 3. The wasm artefact placement (the producer/consumer split)

`causl-client` consumes a **placed** `.wasm` artefact. It does not build one. Per
**§18A.11**, the build-and-place tooling is two stdlib-only Python scripts in
`causl/causl-core-rs` (the producer side) and a webapp's CI/CD pipeline drives
them. The split:

| Side | Repo | Artefact | Tool |
| --- | --- | --- | --- |
| **Producer** | `causl/causl-core-rs` | builds + places the `.wasm` | `scripts/build_wasm.py`, `scripts/package_wasm.py` |
| **Consumer** | `causl/causl-wasm-ts` (you) | binds the placed `.wasm` over FFI | the `@causl/causl-wasm-ts/wasm` loader |

### 3.1 Producer side: the Python scripts (run by your pipeline)

These need a Rust toolchain (`cargo` + `wasm-pack` + `wasm-opt`); your *consuming*
pipeline does not: it only needs CPython stdlib to run `package_wasm.py`. The
full contract is in `causl-wasm`'s [`scripts/README.md`](https://git.opsite.ca/causl/causl-core-rs/blob/main/scripts/README.md).

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

### 3.2 Consumer side: vendor + verify the manifest

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

> **Vendored target: be precise.** The `.wasm` artefact vendored in *this repo*
> under `packages/core/wasm-pkg/gc-classic-bundler/` is a
> **`--target bundler`** build (webpack 5 / Vite 5 / esbuild via
> asset-pipeline loaders). The consumer-side **`node:fs` loader hook is shipped**
> (`packages/core/wasm/index.ts` resolves a placed `.wasm` through
> `node:fs`/`node:fs/promises`), and the producer **`--target nodejs`** build +
> placement (the `causl-wasm` Python scripts, §18A.11) is shipped on the engine
> side: that pairing satisfies the §18A.2 Node-target requirement (§18A.7
> Criterion 4, GO). When you wire a pure-Node service with the `--target nodejs`
> artefact, consume it as the `causl-wasm` `scripts/README.md` shows (synchronous
> `require`/`import` of the node glue) and bind it through the `BackendEngine`
> seam. For bundler builds the artefact resolves via the
> `new URL(..., import.meta.url)` path (§4.2).

---

## 4. The loader and the host-tier matrix

### 4.1 The host-tier bridges (§17.6)

The bridge picker (`detectBridge()`) was written to probe the host at module
load and select the most-capable artefact it supports. There is one artefact,
so it returns it:

| Bridge id | String strategy | When picked |
| --- | --- | --- |
| `wasmgc-classic` | `classic-strings`: UTF-16 fallback | Always. The universal WasmGC baseline; needs no `wasm:js-string` host support, so it instantiates on every WasmGC-capable host. |
| `wasmgc-builtins` | `js-string-builtins`: no-copy `wasm:js-string` | Never. Retired by causl/causl-core-rs#355: causl/causl-core-rs#210 measured its `wasm:js-string` imports as i32-typed where the W3C builtins are externref-typed, so it cannot bind on any host. Requesting it throws, and the throw names causl/causl-core-rs#358, the retype that would bring it back. |

There is no tier below that row. A host that cannot instantiate
`wasmgc-classic` gets a throw, not a TypeScript engine.

Pin the bridge explicitly when you want to state the dependency rather than
inherit it:

```ts
await preloadCauslWasm({ bridge: 'wasmgc-classic' })
```

### 4.2 The loader resolution shape

**Shipped today (bundler target).** The loader resolves the artefact via
`new URL('./pkg/<segment>/causl_engine_bridge_bg.wasm', import.meta.url)`: the
lowest common denominator across webpack 5 (`experiments.asyncWebAssembly`),
Vite 5 (`vite-plugin-wasm`), esbuild 0.20+ (`--loader:.wasm=file`), and Node
22+ ESM. Override the base URL for a CSP `connect-src` / CDN scenario:

```ts
await preloadCauslWasm({
  // Your own origin. A public CDN is not an option here: jsDelivr and unpkg
  // mirror npmjs, and this package is private to the Gitea registry, so it is
  // not on either of them.
  //
  // `wasmBaseUrl` names the PARENT of the bridge directory, and the loader
  // appends `gc-classic/causl_engine_bridge_bg.wasm` to it. The directory you
  // copy out of the package is called `gc-classic-bundler`, so vendoring it
  // means copying AND renaming:
  //
  //   cp -R node_modules/@causl/causl-wasm-ts/wasm-pkg/gc-classic-bundler \
  //         ./public/causl/<version>/gc-classic
  //
  // `computeImportsUrl` is required for any non-`file:` base, because the
  // content-addressed `snippets/<hash>/` directory cannot be enumerated over
  // HTTP. `docs/wasm-adoption-guide.md` §2 is the full recipe.
  wasmBaseUrl: 'https://assets.example.com/causl/<version>/',
  computeImportsUrl:
    'https://assets.example.com/causl/<version>/gc-classic/snippets/<crate-hash>/causl-compute-imports.js',
})
```

**Node target (§18A.2, shipped).** The `--target nodejs` glue instantiates the
wasm synchronously at `require`/`import` time, so the Node loader hook resolves
the placed artefact via **`node:fs`** with no async load shape: it works
identically in CJS and ESM. The consumer-side `node:fs` loader hook is shipped
(`packages/core/wasm/index.ts`), and it pairs with the producer `--target
nodejs` build the `causl-wasm` `scripts/README.md` "Consuming the packaged
artefact in Node" section describes: together they satisfy the §18A.2
Node-target requirement (§18A.7 Criterion 4, GO). The bundler path above is the
shape for browser/bundler builds, where the artefacts vendored in *this repo*
are `--target bundler`.

### 4.3 The FFI single-tick invariant: never `await` the commit entry (§18A.6)

The FFI commit entry point (`apply_commands` / the Rust `commit_batch` extern) is
a **synchronous** `#[wasm_bindgen]` call. The async surface you `await` is
the one-time artefact preload (`await preloadCauslWasm()`), not *committing*
through it.
A commit is one atomic tick (§3 Theorem 2 / §5 Phase A–H "no intermediate
time"). **Do not `await` a commit**: interleaving an `await` mid-commit would
break single-tick atomicity silently. `graph.commit(intent, tx => …)` is and
stays synchronous.

---

## 5. The pre-migration read audit (§18A.5 / §15.1 #1124)

This is the sweep to run over your codebase **before** you ship on the wasm
default. It is an audit, not a contract statement: what a wasm `read()`
actually returns is stated once, in
[`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md) §H1, measured on the
shipped artefact and pinned by
`packages/core/test/read-identity-contract-405.test.ts`. Read §H1 first; this
section tells you what to grep for once you have.

**A correction, and what it changes about the sweep.** Until
[#405](https://git.opsite.ca/causl/causl-wasm-ts/issues/405) this section said
a wasm `read()` of an object returns a fresh object per call, and called
reference identity the one breaking change the wasm path introduces. Both
claims were false, and the second one was the more expensive: it sent adopters
looking for reference-keyed memoisation, which is a performance concern, while
the hazard that actually corrupts data went unmentioned here. `read()` hands
back your **own live, unfrozen object**, so an in-place `rows.sort()` rewrites
committed state with no commit, no subscriber fire and nothing in `explain`.
**Audit for mutation first.** Memoisation second.

### 5.1 The repair that looks correct and silently does nothing

The mutation hazard itself is §H1's, with its wrong/right pair. What belongs
here is the step after it: what a migrator reaches for on finding
mutate-in-place code in an existing codebase. The obvious repair is to keep the
mutation and make it official by committing the value back. That commit is a
no-op.

```ts
// WRONG. The mutation already happened; this does not publish it.
const rows = graph.read(rowsNode)
rows.sort((a, b) => a.rank - b.rank)          // committed state already moved
graph.commit('sort-rows', (tx) => tx.set(rowsNode, rows))
// → commit.changedNodes is []. The input change token is Object.is over the
//   committed reference, so re-setting the SAME reference reuses its epoch
//   and reports nothing changed. Dependents never recompute: they keep
//   serving values derived from the pre-sort contents, indefinitely, while
//   read(rowsNode) shows the sorted array. Nothing errors.
```

```ts
// RIGHT. Copy first, mutate the copy, commit the copy.
const rows = graph.read(rowsNode)
const sorted = [...rows].sort((a, b) => a.rank - b.rank)
graph.commit('sort-rows', (tx) => tx.set(rowsNode, sorted))
// → commit.changedNodes contains the node, dependents recompute, subscribers
//   fire. This is the only shape that lands.
```

Both outcomes are pinned in `read-identity-contract-405.test.ts` under "the
repair that silently does nothing".

### 5.2 The pre-migration checklist

Audit, across your codebase, in this order.

**First, every mutation of a `read()` return.** This is the one that corrupts
data:

- `sort()`, `reverse()`, `push()`, `pop()`, `splice()`, `shift()`,
  `unshift()`, `fill()` and `copyWithin()` applied to a `read()` return. All
  mutate in place and all return something that reads like a new value;
- property assignment into a `read()` return, at any depth. Nothing the engine
  returns is frozen, at any depth, so nothing throws at the mutation site;
- `Object.assign(readReturn, patch)`, and any helper that takes a target and
  writes into it;
- handing a `read()` return to third-party code that sorts or normalises in
  place. A grid, a chart library and a table component all do this.

Replace each with copy-then-commit, as in 5.1. Deep-freezing values before you
commit them turns the silent corruption into a `TypeError` at the mutation
site, which is what you want in development.

**Second, memoisation keyed on the `read()` reference.** This does not corrupt
anything; it over-invalidates:

- every `React.memo(C, (prev, next) => prev.value === next.value)` whose
  equality compares a `read()` return;
- every `useMemo(() => transform(value), [value])` whose dependency array holds
  a `read()` return;
- any cache, `WeakMap`, or `===` check keyed on a `read()` reference held
  across a commit boundary.

The cost here is narrower than this section used to claim. A read of an
unchanged value returns the same reference, so these do not invalidate on every
commit. They invalidate on commits that recompute a **container-valued
derived** to a structurally equal result: the engine correctly reports the node
unchanged while the cached reference moves, so the memo re-runs for a value
that did not change. Migrate each to `graph.stats().nodeVersion(node)`, the
counter that stays put in exactly that case. §H1 carries the React spelling.

**There is no `useCauslCommit` and no `useEngineTelemetry`.** This section used
to prescribe both. `@causl/react` exports neither, and never has; reach the
counter through `graph.stats().nodeVersion(node)` and the commit clock through
`graph.now` or the `Commit` that `graph.commit()` returns. The gate in
`read-identity-contract-405.test.ts` now checks every `@causl/react` import in
these documents against the package's barrel.

**The runtime net.** A dev-only hazard warning is available behind
`createCausl({ enableH1HazardWarning: true })`: it records each `read()` return
as a `WeakRef` and emits one `console.warn` per survivor that outlived a commit
(opt-in, off by default, dead-code-eliminated in production builds). Holding a
read return across a commit is the shape **both** hazards take, so this net
catches candidates for either, and it is a candidate list rather than a verdict.

---

## 6. The performance ceiling (§18A.7)

Honesty about cost is a contract, not a footnote. State it in front of every
wasm-vs-js decision.

**The perf ceiling (SPEC §18A.7 Criterion 3).** Promotion was judged against
marshal-overhead ceilings for the JS↔WASM crossing, the cost of the boundary
separate from the engine's own work. The ceilings themselves and the dated
GO/RESOLVED record live in SPEC §18A.7; this guide deliberately does not
restate their numbers, because no measurement committed to this repository
reproduces them. Read the criterion as a governance record, not as a gate any
benchmark in this tree runs today.

**The standing wire tax.** Crossing the JS↔WASM boundary costs real time on
every commit, before the engine does any work. Earlier editions quoted a
specific FFI-tax multiplier against the pure-TypeScript engine here. That
figure traced to a measurement whose driver and outputs are not committed to
this workspace, and its comparison subject, the TS floor, was deleted at 0.5.0
(#279, #280), so nothing in this tree can re-check it and this guide no longer
asserts it. The measurements this repository does commit are the six cells in
`packages/core/bench/baseline.json`, captured on the shipped wasm engine;
read current costs there, and compare a fresh run against them with
`tsx packages/core/bench/compare-baseline.ts`. **The cost is named, not
hidden: and it is immaterial to the adopter UX** (see below).

**What this means for you, concretely:**

- **Perf is immaterial within the §14 RAIL budget.** The wasm path ships as the
  default for **complexity-elimination**, not performance: a single-engine
  roster, not a faster one. Per-commit wall-time stays inside the §14 RAIL
  responsiveness budget (all six RAIL cells PASS, §18A.7 Criterion 3
  GO/RESOLVED), which is the bar that matters for the adopter. The boundary tax
  and the engine-exec cost above are explicitly accepted as UX-immaterial: they
  are a cost you can see, not a regression you feel.
- **The wasm path is the real Rust engine, not a wrapper.** Every adopter
  operation resolves from Rust (the §18A.3 FFI lift landed, causl-wasm#170). It
  is the production substrate, not an opt-in experiment.
- **There is no per-graph opt to a TS floor.** `engine: 'js-ssot'` and
  `backend: 'js'` were removed at 0.5.0 and now throw
  `RemovedEngineOptionError`, and issue #279 deleted the closure they used to
  select. The §18A.7 Criterion-5 reference engine lives in
  `causl/causl-core-ts`, which is where you take a TypeScript value-of-record
  from if you need one.

**Promotion is governance: and it has happened.** The wasm engine became the
default when **all five** §18A.7 GO/NO-GO criteria passed: byte-identity (1),
full FFI surface (2, the §18A.3 lift landed), the §14 RAIL perf floor (3,
GO/RESOLVED), the Node target + a real-world adopter (4, `iasbuilt/xldatagrid`),
and the governance criterion (5): recorded by a **dated amendment** (the
2026-06-21 promote-default, causl-wasm#169). `rust-ssot` is the **unconditional
production default** (`DEFAULT_WASM_ENGINE_MODE = 'rust-ssot'`), with no
per-flush byte-compare oracle and no sticky-downgrade fail-safe (both removed per
§18A.8). The CI-blocking cross-backend determinism gate (§18A.1.1, 0-divergence
over 100,000 trials) is the sole conformance guarantee; a divergence is a
halt-before-merge condition, resolved by a governance revert, never an in-process
downgrade.

---

## 7. Synchronous construction: preload once, build sync (§18A.12)

Everything above `await`s the wasm backend at the **call site**
(`await preloadCauslWasm()` / `await createCauslWasm()`). That is a problem for the
consumers that build a graph from **synchronous** code: a React render, an
`xldatagrid` cell factory, a synchronous SSR pass: where there is no place to
put an `await`. **SPEC §18A.12** (shipped 2026-06-19 in `causl-client` and in the
fork) makes the wasm engine **synchronous from the consumer's perspective** by
splitting construction into a one-time async *preload* and a fully synchronous
*factory*.

### 7.1 Why one `await` is unavoidable: and where it goes

The wasm artefacts are ~630 KB. A synchronous `new WebAssembly.Module(bytes)` on
a module that large is **spec-prohibited on a browser main thread**, so the
**COMPILE** step (`await WebAssembly.compile`) plus the two dynamic `import()`s
(the `_bg.js` sidecar and the `causl-compute-imports.js` snippet) must stay
async. But **INSTANTIATE** (`new WebAssembly.Instance(module, imports)`) is a
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
| `createCausl(opts?)` | sync | `@causl/causl-wasm-ts` | The **default** factory, and since 0.5.0 construct-or-throw. Routes to the real wasm engine synchronously once `@causl/causl-wasm-ts/wasm` has been preloaded (via `preloadCauslWasm()`) for the default bridge; with no preload it throws during construction, so there is no partially-built graph and no async window. |
| `createCauslWasm(opts?)` | **async** | `@causl/causl-wasm-ts/wasm` | The retained async wasm factory. Re-expressed as exactly `preloadCauslWasm(opts)` ∘ `createCauslWasmSync(handle, opts)`: one instantiate codepath, provably `preload ∘ sync`, zero drift. Use it where an `await` at the call site is fine. |
| `createCauslWasmSync(handle?, create?)` | **sync** | `@causl/causl-wasm-ts/wasm` | The fully-synchronous wasm factory. Zero `await`. Use it at sync render/hook/SSR sites: **after** a one-time preload. |

`preloadCauslWasm()` (async compile-once) lives on the `@causl/causl-wasm-ts/wasm`
subpath alongside the two wasm factories, keeping the wasm bundle out of the main
barrel. **`createCauslTs` is not a factory in this package at all**: epic #31 /
issue #34 un-exported it from the public `@causl/core` barrel (§8), the
§18A.13.1 capability-fallback wiring was withdrawn at 0.5.0, and issue #279
deleted the declaration together with `commitInternal`, the structural facade
and the `injectedBackend` seam. The §18A.3 FFI structural lift has **landed**
(causl/causl-core-rs#170), so every adopter operation resolves from Rust and the
literal zero-TS core is done rather than deferred.

### 7.3 The pattern: `preloadCauslWasm()` once, `createCauslWasmSync()` everywhere

`await preloadCauslWasm(opts?)` **once** at app/init. It compiles and caches the
`WebAssembly.Module` + sidecar + compute-imports snippet (keyed by bridge), pays
the dynamic imports, and is **idempotent**: concurrent calls share one compile;
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
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'

await preloadCauslWasm() // compiles + caches the Module/sidecar/snippet; idempotent
```

```tsx
// AnyComponent.tsx — a synchronous React render. No `await` here.
import { createCauslWasmSync } from '@causl/causl-wasm-ts/wasm'

function buildGraph() {
  const graph = createCauslWasmSync()   // FULLY SYNCHRONOUS — new WebAssembly.Instance, zero await
  const a = graph.input('a', 1)
  const sum = graph.derived('sum', (get) => get(a) + 1)
  return graph
}
```

The commit entry stays synchronous (§4.3): §18A.12 only moves
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
import { createCauslWasmSync, CauslWasmNotPreloadedError } from '@causl/causl-wasm-ts/wasm'

try {
  const graph = createCauslWasmSync()         // throws if no preload completed for this bridge
} catch (err) {
  if (err instanceof CauslWasmNotPreloadedError) {
    // You forgot the one-time `await preloadCauslWasm()` at app init.
  }
  throw err
}
```

There is no way to make that site degrade instead of throwing.
`{ fallbackToTs: true }` used to hand back a `Graph` built on an internal
TypeScript floor; it was **removed at 0.5.0**, and passing it now throws
`RemovedEngineOptionError` (`code: 'CAUSL_REMOVED_ENGINE_OPTION'`):

```ts
// Removed at 0.5.0. This throws RemovedEngineOptionError; it does not degrade.
const graph = createCauslWasmSync(undefined, { fallbackToTs: true })
```

The key went rather than being quietly ignored because the floor it named is
gone: issue #279 deleted `createCauslTs` and the closure around it, so honouring
it would mean substituting an engine this distribution does not ship. Order your
init so the preload resolves first, and treat the throw as your
unsupported-host branch (§8).

### 7.5 Node vs browser

On Node / SSR the `--target nodejs` glue (§18A.2) is **already synchronous** at
require-time (`readFileSync` + `new WebAssembly.Module` + `new
WebAssembly.Instance` at module-eval), so `createCauslWasmSync` works **without**
a prior `await`: server render stays synchronous. The browser **bundler** target
is where the one-time `await preloadCauslWasm()` is load-bearing: it must complete
**before the first render** that constructs a wasm graph. That ordering is also
what gives SSR↔CSR hydration parity (no engine is constructed mid-render in an
unresolved-promise state). Skip the preload and `createCauslWasmSync` throws: it
never silently blocks and never degrades.

> **Packaging note (cross-ref §18A.11).** The sync factory needs the
> `causl-compute-imports.js` snippet placed next to the `.wasm`/`_bg.js` in
> `wasm-pkg/<bridge>/`; `package_wasm.py` places it. No Rust regeneration is
> required: the nodejs glue is already sync and the bundler `_bg.js` already
> exports the `__wbg_set_wasm` re-point seam §18A.12 instantiates against. A
> build-parity CI assertion pins both sync seams so a wasm-pack/wasm-bindgen
> upgrade that drops either fails loud.

---

## 8. The single-engine surface of causl-client (§18A.13)

> **Shipped for *this* distribution.** One engine, no floor, no fallback, and
> since issue #279 no TypeScript engine left in the tree to fall back to.

A dated **§18A.13** amendment took `causl-client`: and **only** `causl-client`;
to the **wasm engine as its sole public engine** and **removed `createCauslTs`
from this package's public barrel**. SPEC **§18A.13.1 (2026-06-23)** briefly
reopened a capability fallback on the implicit path; that reversal was withdrawn
at 0.5.0 and the closure it named has since been deleted. State the boundaries
plainly:

- **Scope is `causl-client` only.** The fork `causl/causl-core-ts`
  **keeps** the dual-engine TS floor and a **public `createCauslTs`**: it stays
  the §18A.1.1 differential-test oracle, the benchmark repo, and the source of the
  authoritative Rust→wasm loader ported here. **The fork is never wasm-only.**
  Say the TypeScript engine was removed *from causl-client*, not *from causl*.
- **It is a governance decision that deliberately bypassed the §18A.7 GO/NO-GO
  gate for `causl-client`, and says so**: it does *not* claim the criteria are
  met. The driver is **complexity-elimination** (shedding the dual-engine
  maintenance burden), **not** performance; the §17.6 boundary tax and the
  per-commit median (§6 above) are explicitly accepted as UX-immaterial within
  the §14 RAIL budget for this enterprise-only distribution. Perf is never a gate
  or an argument for or against the wasm engine here.

It was executed **wire-before-cut** (an ordering constraint, so the repo was never
left with zero working engine), and the public cut was the **last** step:

1. **WIRE**: ported the fork's real Rust→wasm loader + sidecar wiring into
   `causl-client`. (The `.wasm`/`_bg.js` artefacts are vendored here; the
   compute-imports snippet is placed via `package_wasm.py`.)
2. **FLIP + SYNC**: `createCausl()` **routes to the wasm engine** synchronously
   once preloaded, using exactly the §7 `preloadCauslWasm()` +
   `createCauslWasmSync()` split as the mechanism. Sync consumers (e.g.
   `xldatagrid`'s synchronous `createCausl()` sites) keep calling `createCausl()`
   **unchanged** and transparently get wasm: no async refactor of the call sites.
   Since 0.5.0 the one-time `await preloadCauslWasm()` at boot is a hard
   prerequisite rather than a recommendation.
3. **CUT**: removed `createCauslTs` from the public `@causl/core` barrel.
   Adopters can no longer pick the pure-TS engine directly in this package.

**Status: honest and dated.** *Shipped:* the §7 sync split, the vendored bundler
artefacts, the loader port (step 1), the `createCausl`→wasm routing + sync
preload (step 2), and the public `createCauslTs` removal from the barrel
(step 3). *Shipped at 0.5.0 (issue #280):* the **withdrawal** of §18A.13.1's
implicit-path capability fallback, and the removal of `engine`, `backend`,
`fallbackToTs` and `fallbackToJs`, which now throw `RemovedEngineOptionError`.
*Shipped by issue #279:* the literal **zero-TS core**, deleting `createCauslTs`,
`commitInternal`, the structural facade and the `injectedBackend` seam from the
source tree. The §18A.3 FFI lift landed first (causl/causl-core-rs#170), which is
what made the deletion a deletion rather than a rewrite: under `rust-ssot` no
adopter operation was reaching the TypeScript closure any more.

**Why the fallback went, and what it costs.** §18A.13.1 spent roughly six weeks
partially restoring the §17.6 Commitment 14 "fall-through to the TS engine" host
fallback for the implicit `createCausl()` path: on a host where the engine
could not **instantiate** (a host below the declared floor; the floor is stated
once on `WASM_HOST_FLOOR` in `packages/core/src/wasm-registry.ts`, as corrected
by causl/causl-wasm-ts#426) `createCausl()` degraded to the internal TypeScript
engine loudly, with a one-time `console.warn` and `onCauslCapabilityFallback`
telemetry. It is withdrawn because the two engines **disagree** on a §18A.1.1
MUST-be-identical surface (issue #272, in-place mutation of a committed value),
and a fallback that answers differently from the engine it stands in for is worse
than no fallback. So §18A.7 Criterion 5 ("TS-engine floor maintained") is now
sunset for this package rather than partly re-extended, and every path fails the
same way: `createCausl()`, `createCauslWasm()` and `createCauslWasmSync()` all
throw `CAUSL_WASM_ENGINE_UNAVAILABLE` on such a host, with no flag that restores
a degrade. `onCauslCapabilityFallback` stays exported, `@deprecated` and never
firing, until 0.6.0. The accepted cost is a **dropped host tier**: those hosts
hard-fail at construction, and your application decides what to render.

The full TS floor stays **in force for the fork**. The §18A.1.1 byte-identity
proof survives the strip because it lives there (`causl/causl-core-ts` keeps both
engines) plus a frozen golden-vector corpus captured before the cut, which is
what this package pins its conformance against now that it has nothing to compare
in process.

---

## See also

- [`SPEC.md` §18A](../SPEC.md): the engine contract (the governing source
  for everything above): §18A.1 equivalence, §18A.2 Node target, §18A.4 thin TS
  API, §18A.5 read-identity, §18A.6 FFI atomicity, §18A.7 GO/NO-GO criteria,
  §18A.10 topology, §18A.11 Python tooling, §18A.12 synchronous construction
  (preload + sync factory), §18A.13 the `causl-client` wasm-only amendment,
  §18A.13.1 the implicit-path TS capability fallback and its 0.5.0 withdrawal.
- [`packages/core/wasm/README.md`](../packages/core/wasm/README.md): the
  `@causl/causl-wasm-ts/wasm` entry point: cost shape, host requirements, CSP, bundler
  interop, the H1 callout, the `WasmBackendUnavailableError` codes.
- [`docs/wasm-adoption-guide.md`](./wasm-adoption-guide.md): preload / SRI
  posture, dynamic-import vendoring, the five structured fallback codes, and the
  full H1 read-identity migration walkthrough.
- `causl/causl-core-rs` [`scripts/README.md`](https://git.opsite.ca/causl/causl-core-rs/blob/main/scripts/README.md)
 : the producer-side `build_wasm.py` / `package_wasm.py` contract this guide
  consumes.
