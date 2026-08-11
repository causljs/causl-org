# causl-org

> Source for [causl.org](https://causl.org): the public-facing
> documentation, playground, spreadsheet demo, benchmark dashboard,
> and brand assets for the Causl state-engine project.

This repository is **the website**, not the engine. The Rust engine,
the TypeScript client, the static checker, and the benchmark harness
each live in their own repository, most of them on the self-hosted
Gitea at `git.opsite.ca/causl` rather than on GitHub. The role of this
repo is to be the human-readable front door: landing page,
getting-started and tutorial and usage guides, generated API
reference, two live in-browser demos (playground and spreadsheet), and
the benchmark dashboard.

---

## Published packages

**This repository publishes no npm package.** The packages come from
the engine and client repos:

| repository | package | latest published | registry |
|---|---|---|---|
| `causl-core-rs` | `@causl/core-rs` (the Rust engine, compiled to WebAssembly) | 0.5.1 | Gitea |
| `causl-core-ts` | `@causl/core-ts` (the TypeScript engine) | never published | Gitea |
| `causl-wasm-ts` | `@causl/causl-wasm-ts` (the TypeScript client) plus its satellite packages | 0.5.0 | Gitea |
| `causl-ts` | `@causlts/core` (the OSS pure-TypeScript engine) | 0.3.3 | public npmjs |
| `causl-check` | `@causl/checker` and its per-platform binaries | **not published yet** | Gitea when it ships |

Naming follows the scheme in
[`causl-wasm-ts` / `docs/repo-naming-decision.md`](https://git.opsite.ca/causl/causl-wasm-ts/src/branch/main/docs/repo-naming-decision.md):
**engines are named by substrate** (`causl-core-rs`, `causl-core-ts`),
**clients by consumer language** (`causl-wasm-ts`, future
`causl-client-cpp`).

`@causl/wasm` and `@causl/checker` are **not** published. If you find
either name in an install snippet on this site or elsewhere, that
snippet is wrong.

### `@causl/core` is a live hazard, not a package we ship

`@causl/core` has **zero versions** on the Gitea registry. It does
resolve on public npmjs, at 0.3.0 through 0.3.3, to a **different**
package: the retired TypeScript engine. So a stale pin, or an
`.npmrc` missing the `@causl:registry=` line, installs successfully
and silently gets the wrong package instead of failing. Treat every
`@causl/core` install or import instruction you find as a bug to fix.

The one place the name is still legitimate is inside this repo's own
demos, where `@causl/core` is a bare specifier that an importmap
resolves to the committed build under `vendor/@causl/core/`. That
never touches a registry. See "Repo layout" below.

### Development access

The maintained remote for this repository is **Gitea**
(`git.opsite.ca/causl/causl-org`). GitHub
(`github.com/causljs/causl-org`) is the copy GitHub Pages builds
`causl.org` from, and I sync it downstream after landing work here.

```bash
git clone https://git.opsite.ca/causl/causl-org.git
```

The private `@causl/*` and `@iasbuilt/*` scopes are served by Gitea's
npm registry, never by npmjs. The old Verdaccio host
`iasbuilt-npm.opsite.ca` is **dead**; any `.npmrc` snippet naming it
is wrong. Create a token at **git.opsite.ca → Settings →
Applications → Generate New Token** with the `read:package` scope,
export it, and add the registry lines to your `~/.npmrc` (or a
repo-root `.npmrc`):

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

The `@causl:registry=` line is the one that matters most: without it,
`@causl/core` silently resolves to the wrong package on npmjs rather
than failing. Published versions are listed at
<https://git.opsite.ca/causl/-/packages>.

---

## What is Causl?

Causl is a state engine for applications whose model is a live graph
of facts whose derivations cascade. The eight commitments (atomic
commit, automatic dependency tracking, deterministic dynamic-dep
cleanup, glitch-free diamond, denotational semantic foundation,
composite statechart, strict model/controller/engine layering, and
pre-runtime race detection) are specified in `SPEC.md`.

`SPEC.md` is **no longer byte-identical across repos**, so cite the
copy you mean. The OSS surface lives at
[`causljs/causl-ts/SPEC.md`](https://github.com/causljs/causl-ts/blob/main/SPEC.md);
that copy carries no §18A at all. The wasm-path chapters (§18A and its
sub-sections, quoted throughout this README) live in
[`causl-wasm-ts/SPEC.md`](https://git.opsite.ca/causl/causl-wasm-ts/src/branch/main/SPEC.md),
and the `causl-core-ts` copy is a third, shorter variant.

The landing page at `causl.org` is the short-form version of that
story; the docs site at `causl.org/pages/documentation/` is the
longer one.

---

## The causl repos (cross-org topology)

Causl is split across nine repositories, each owning one concern.
There is **no** parent monorepo. The split keeps CI fast, lets the
Rust and TypeScript halves move at independent cadences, and lets
adopters depend only on the surface they need.

Most of the org lives on the self-hosted Gitea at
`git.opsite.ca/causl`. Only two repos are on GitHub: `causl-ts` (the
open-source engine) and `causl-org` (this repo, whose GitHub copy is
what GitHub Pages serves).

The 2026-07-27 rename is fully executed and the old names are
301-redirects: `causl-client` → `causl-wasm-ts`, `causl-wasm` →
`causl-core-rs`, `causl-ts-wasm-engine` → `causl-core-ts`. There is no
repo called `causl-wasm-rs` and there never was.

The one-line truth the topology rests on: **the Rust engine in
`causl-core-rs` is the only engine `causl-wasm-ts` ships.**
`createCausl()` returns that engine or throws. `causl-ts` is the
open-source floor and §12 conformance reference, not the production
engine.

Every repository marked **Gitea** below is private. Those links resolve
only for accounts with access to `git.opsite.ca`; to everyone else they
return 404, so I keep the repository and issue names readable as text on
the public site rather than linking them there. Only `causljs/causl-ts`
and `causljs/causl-org` are public.

| Repo | Host | Role |
|---|---|---|
| [`causl-core-rs`](https://git.opsite.ca/causl/causl-core-rs) | Gitea | **The Rust engine, source of truth.** Owns `tools/engine-rs-core` (a from-scratch Rust engine: generational `NodeId{slot,gen}`, JSON values, seven named-struct cells), `tools/engine-rs-bridge` (the JS↔WASM bridge), the §18A.3 FFI surface, the byte-identity gate's Rust side, and the stdlib-only CPython build tooling (`scripts/build_wasm.py`, `scripts/package_wasm.py`, §18A.11). Formerly `causl-wasm`. |
| [`causl-wasm-ts`](https://git.opsite.ca/causl/causl-wasm-ts) | Gitea | **The thin TS API consumer.** The §18A.4 thin TypeScript binding over the `causl-core-rs` FFI, publishing `@causl/causl-wasm-ts` plus the adapters `@causl/react`, `@causl/formula`, `@causl/sync`, `@causl/devtools`, `@causl/persistence`, `@causl/migration-check`. Implements the §12 `Graph` facade by delegating to the wasm engine. Ships **no** Rust source, **no** build tooling, and **no** TypeScript engine. Named adopters: `iasbuilt/xldatagrid`, `iasbuilt/webapp`. Formerly `causl-client`. |
| [`causl-core-ts`](https://git.opsite.ca/causl/causl-core-ts) | Gitea | **The differential oracle, the dual-engine floor, and the benchmark host.** Keeps the §13.8 TypeScript floor as its default (`DEFAULT_WASM_ENGINE_MODE = 'js-ssot'`) and adds a real-Rust differential leg as the §18A.1.1 byte-identity oracle. Also hosts `@causl/benchmarks`. `causl-wasm-ts` pins it by commit SHA and runs 5,000 differential trials per PR. Never published to any registry. Not where you start for production. Formerly `causl-ts-wasm-engine`. |
| [`causljs/causl-ts`](https://github.com/causljs/causl-ts) | GitHub | **The OSS pure-TypeScript floor and §12 conformance reference**, published to public npmjs as `@causlts/core`. The open-source floor, **not** the production engine. |
| [`causl-bench`](https://git.opsite.ca/causl/causl-bench) | Gitea | The cross-library benchmark suite. Compares causl against Jotai, Redux Toolkit, and MobX across the SPEC-derived scenario taxonomy, and emits the JSON that powers the dashboard on this site. Distinct from the `@causl/benchmarks` causl-ts-vs-wasm suite in `causl-core-ts`. |
| [`causl-check`](https://git.opsite.ca/causl/causl-check) | Gitea | The Rust-backed static-analysis half: `causl-check` (twelve-pass IR linter), `causl-enumerate` (§16.4 bounded state-space enumerator), the Apalache differential runner, and the TLA+ corpus. The static half of §17 pre-runtime race detection. Nothing published yet. |
| [`causl-server`](https://git.opsite.ca/causl/causl-server) | Gitea | A prospective **Enterprise** server layer above the single-writer engine (client↔server transport, plus permissions and version-control concerns). **Under redesign**: the earlier sketch (a PolicyGate permissions layer and a git-like commit VCS) is being re-thought from scratch and is not an active roadmap item. |
| [`causl-org`](https://git.opsite.ca/causl/causl-org) | Gitea (maintained) + [GitHub](https://github.com/causljs/causl-org) (Pages source) | **This repo.** Static site source (HTML, CSS, JS) for `causl.org`, brand assets, the playground and spreadsheet demos, the generated TypeDoc API reference, the benchmark dashboard front-end and its publish pipeline, the hand-written docs, and a dedicated [Enterprise section](./pages/documentation/enterprise/) for the wasm depth. |
| [`causl-org-srv`](https://git.opsite.ca/causl/causl-org-srv) | Gitea | The tiny stdlib-Python static-site server used during local development for the demos in this repo. Python only, no npm package. |

---

## Wasm-engine architecture: one engine, construct-or-throw

The production engine is the **real Rust engine** in `causl-core-rs`:
`engine-rs-core`, a from-scratch Rust engine (not a transliteration of
the TS engine, §18A.4 and §18A.9) compiled to WebAssembly and reached
over FFI through `engine-rs-bridge`. It was promoted to the
unconditional WASM-path default on **2026-06-21**, when all five
§18A.7 GO/NO-GO criteria went GO. The §18A.8 fail-safe-removal
amendment then removed the per-flush TS-vs-Rust byte-compare oracle
and the K=1 sticky downgrade, so the Rust `commit_batch` post-state is
applied unconditionally, validated by the cross-backend determinism
gate at 0-byte divergence over 100,000 trials.

The §18A.3 FFI structural lift has landed: every adopter operation
(commit, read, subscribe, derived, plus the structural surface of
dependencies, dependents, stats, commit-log, explain, `exportModel`,
`readAt` / `snapshotAt`, `subscribeCommits`) resolves from the Rust
engine. The only JS in the hot path is the user's own `derived()`
compute lambda, which runs in JS over the bridge callback by design.

**There is no TypeScript fallback in `causl-wasm-ts`.** Anything you
read claiming otherwise is stale:

- **§18A.13.1, the implicit `createCausl()` capability fallback, was
  WITHDRAWN at 0.5.0.** The SPEC heading says so and adds "Read this
  section as a dated record, not as a live obligation." I withdrew it
  for two reasons. The fallback engine and the primary *disagreed*
  (`causl-wasm-ts#272`: in-place mutation of a committed value, on a
  §18A.1.1 MUST-be-identical surface), and a fallback that disagrees
  with the primary is worse than no fallback. The implicit path was
  also the accident path: 0.4.0 warned on it, 0.5.0 throws.
- **`createCausl()` is construct-or-throw**, two statements in
  `packages/core/src/graph.ts`.
- **`createCauslTs` is deleted from source.** `git grep createCauslTs`
  over `packages/*/src/**` returns zero hits. It survives only in
  tests asserting its absence and in dated SPEC records.

The live boot contract: `await preloadCauslWasm()` once at init (the
one async seam), then synchronous `createCausl()` or
`createCauslWasmSync()` anywhere, with zero `await` per render.
`createCauslWasm()` is retained as `preload ∘ sync`.

Branch failures on `error.code`, never on `instanceof`:

- `CAUSL_WASM_ENGINE_UNAVAILABLE`: the `/wasm` subpath was never
  imported, or the WasmGC engine cannot instantiate on this host.
- `CAUSL_WASM_NOT_PRELOADED`: it was imported, but
  `preloadCauslWasm()` never resolved.

**Host floor** (`packages/core/src/wasm-registry.ts`): Safari
**18.2**, Chromium **119**, Firefox **120**, Node **22**. The
governing requirement is **typed function references**, established by
feature-bisecting the shipped artefact in `#426`. The artefact
declares **zero** WasmGC struct, array, or rec-group types, so
"WasmGC heap types" is not the requirement. The retired floor that
this README used to print (Safari 18, a macOS-15 pairing, a Node
ceiling of 20) was wrong on three counts. Nobody has run the artefact
on a real boundary host, so treat these as engine release-note claims
rather than as our own measurement.

`detectBridge()` is **no longer a placeholder**: `#426` wired it to a
real probe, and `#691` is closed as a live concern. Exactly one bridge
ships, **`gc-classic`**; `gc-builtins` was deleted in
`causl-core-rs#355`. Bridge ids are `gc-classic` and `gc-builtins`,
never `wasmgc-classic` or `wasmgc-builtins`.

Two more contracts worth knowing before you read the docs pages:

- Multi-instance isolation is solved by `engine_id` multiplexing, one
  `WebAssembly.Instance` per process, verified isolated at N=16.
- `read()` reference identity is **not** guaranteed across commits
  (§15.1), and the engine is not uniformly fresh either: a
  `ValueHandleCache` retains the original adopter reference, so
  identity is stable on a cache hit and fresh only on decode paths.
  The break is intermittent, which is harder to catch than a uniform
  one.

The adopter-facing how-to for the **Enterprise-tier** wasm path
(building and vendoring a pinned, checksummed `.wasm` with
`causl-core-rs`'s CPython-stdlib tooling, §18A.11, `--target nodejs`
shipped, then reaching it from a TS/Node app through the
`@causl/causl-wasm-ts/wasm` seam) lives in the
[Enterprise docs section](./pages/documentation/enterprise/), with
pages on the
[two-engine architecture](./pages/documentation/enterprise/two-engine-architecture/),
[integrating the client](./pages/documentation/enterprise/integrating-causl-client/),
and [wasm performance status](./pages/documentation/enterprise/wasm-performance/).

---

## The `CAUSL_TS_SOURCE` selector

`causl-bench` ships its root `package.json` with no `pnpm.overrides`
block, so the registry is the default resolver and the
`bench: install + smoke` CI gate stays green on a bare runner.
Linking against a local checkout of either TypeScript engine is
opt-in via the `CAUSL_TS_SOURCE` env var, which
`tools/select-causl-source.mjs` reads to rewrite `pnpm.overrides`.

That script lives in **`causl-bench`**, not in this repository. There
is no `tools/` directory here.

```sh
CAUSL_TS_SOURCE=upstream     pnpm install   # links against ../causl-ts
CAUSL_TS_SOURCE=wasm-engine  pnpm install   # links against ../causl-ts-wasm-engine
```

The `wasm-engine` path string still spells the pre-rename directory
name. The repo it points at is `causl-core-ts`; the env value and the
relative path have not been re-spelled yet.

The selector picks between the two **TypeScript** engines, so it is
what makes the dashboard's `causl-ts` series comparable across runs.
It does **not** produce the `causl-wasm` series: that one comes from
the `causl-wasm-ts` client running on the `causl-core-rs` engine, and
carries an attested engine binary rather than a linked TS checkout.

---

## What landed recently

Work that has landed across the org, in reverse-chronological order:

- **causl-org (this repo): one attested `causl-wasm` series on the
  dashboard.** I deleted the withdrawn `causl-wasm` (124 samples) and
  `causl-wasm-all` (95 samples) series from
  `pages/benchmarks/history.json` outright, and renamed the attested
  `causl-wasm-ts` series (217 samples) to `causl-wasm`. The previous
  harness published a `causl-wasm` column whose engine label was
  *asserted rather than observed*: the column labelled "wasm" was the
  TypeScript engine. `causl-bench#110` deleted that generator, which
  retracts nothing on its own, so the retraction had to happen here.
  I deleted rather than relabelled, because relabelling would attach a
  Rust-engine claim to TypeScript-engine measurements. Losing the
  historical records is accepted and intended.
- **causl-bench: the 2026-08-11 sweep, and the engine hold-out
  lifted.** 420 cells (380 ok, 31 inapplicable, 9 skipped) on Apple
  M5 / darwin-arm64 / Node v26.5.1, 20 reps, subprocess-per-cell
  isolation, forced GC between reps. The `causl-wasm-ts` runner is now
  **ranked** rather than held out, measuring
  `@causl/causl-wasm-ts@0.3.7` on the `gc-classic`
  `causl_engine_bridge_bg.wasm` binary. State the caveat rather than
  bury it: `confidence.lowPct` is **45%** (171 of 380 ok cells),
  driven by dispersion, drift, warmup truncation, and machine load.
  Low-confidence cells are excluded from `ranking`.
- **causl-core-rs: `#331` is genuinely fixed, and `#392` is its
  successor.** `linear-chain` from 1000 to 10000 went from N^1.932 on
  0.3.6 to **N^1.041** on 0.3.7, a 14.6× fall in the quadratic
  coefficient with 6.9% surviving. What remains is
  [`causl-core-rs#392`](https://git.opsite.ca/causl/causl-core-rs/issues/392),
  **open and untouched**: a residual per-commit O(live cells) clone in
  `ReentrantSnapshot::from_state()`, costing about **115 ns per
  untouched derived node per commit**. The `mux-ballast` scenario
  isolates it, with byte-identical `stepOps` at all three scales and
  only the derived-node count moving: causl grows **5.09×** while
  MobX, Jotai, Redux Toolkit, and causl-ts stay flat within 10%.
- **causl-wasm-ts 0.5.0: the §18A.13.1 capability fallback was
  withdrawn, and `createCauslTs` was deleted from source.** The
  implicit `createCausl()` path no longer degrades to a TypeScript
  engine on a WasmGC-unavailable host; it throws. The dropped host
  tier is accepted in writing.
- **causl-wasm-ts: `detectBridge()` became a real probe, and the host
  floor got established by bisect (`#426`).** The floor is Safari
  18.2 / Chromium 119 / Firefox 120 / Node 22, on typed function
  references. `#691` (the placeholder probe) is closed.
- **causl-core-rs: the `gc-builtins` bridge was deleted (`#355`), and
  the serde bridge was retired.** One bridge ships, `gc-classic`. Only
  a dead `legacy_commit.rs` surface still calls `serde_wasm_bindgen`,
  so any claim measured "against the production serde-json bridge
  artefact" describes an artefact that no longer ships.
- **The org-wide repo and package rename (2026-07-27).**
  `causl-wasm` → `causl-core-rs`, `causl-client` → `causl-wasm-ts`,
  `causl-ts-wasm-engine` → `causl-core-ts`, with matching package
  renames and 301-redirects on every old repo path.
- **causl-core-ts: the differential gate drives REAL Rust.** The
  cross-backend byte-identity gate runs the real Rust engine against
  the TypeScript floor as oracle (no longer a TS-vs-TS shim), at
  0-byte divergence over 1k trials by default and 100k nightly. The
  fork keeps `js-ssot` as its own default and adds the Rust leg; the
  production cutover happened in `causl-wasm-ts`, not here.
- **causl-check**: the twelve-pass IR linter, the `causl-enumerate`
  bounded enumerator, the Apalache differential runner, and the TLA+
  corpus. Nothing published yet.
- **causl-org (this repo), earlier passes**: dashboard with
  auto-adaptive Y-axis, mouse-drag rescale, wheel-zoom and drag-pan
  charts, and an honest skip-box surface for libraries that cannot run
  a given scenario; a codeblock pipeline that pre-renders the wrapper
  into the static HTML site-wide; brand-spec consolidation on the
  geometric Causl mark; and the `import-run.mjs` publish pipeline that
  refuses any sweep that is not archived, clean, and unforced.

---

## Repo layout

```
causl-org/
├── .github/workflows/static.yml  The only workflow: GitHub Pages deploy
├── index.html                    Landing page
├── 404.html                      Fallback
├── CNAME                         causl.org
├── README.md                     This file
├── LICENSE                       MIT
├── BROWSER_SUPPORT.md            Browser baseline (the authority on it)
├── .gitignore
├── css/                          site, syntax, topbar, playground,
│                                 causl-typedoc (5 files)
├── js/                           topbar, footer, codeblock, playground,
│                                 sandbox-runner, contrast-audit (6 files)
├── img/                          causl-mark.svg, brand-reference-board.png
├── fonts/                        Self-hosted Inter + IBM Plex Mono woff2
├── docs/brand/                   Brand specification + .pptx original
├── vendor/                       Committed runtime assets the pages execute
│   ├── MANIFEST.json             Per-file SHA256 + build provenance
│   ├── README.md
│   ├── @causl/                   FIRST-party builds the live demos run:
│   │                             core/, client-ts/, devtools/, formula/
│   └── prismjs/                  PrismJS 1.30.0 components (third-party)
└── pages/
    ├── playground/               Monaco REPL over the vendored @causl/core
    ├── spreadsheet/              100-cell diamond demo (React 19 from esm.sh)
    ├── benchmarks/
    │   ├── index.html            Dashboard, with the latest run pre-rendered
    │   ├── dashboard.js          Chart + table rendering
    │   ├── dashboard.css
    │   ├── history.json          Every published series
    │   ├── history.sample.json   Small sample shown before the full fetch
    │   ├── import-run.mjs        Import one archived causl-bench sweep
    │   ├── import-run.test.mjs   Its tests
    │   ├── render-latest.mjs     Pre-render the latest run into index.html
    │   ├── regen-history-sample.mjs
    │   └── v0.9.0/               Frozen v0.9.0 article + 15 SVG charts
    ├── brand/                    Brand spec, public-facing
    └── documentation/
        ├── api/                  Generated TypeDoc output
        ├── getting-started/
        ├── tutorial/
        ├── usage/
        ├── best-practices/
        ├── enterprise/           Enterprise tier: the wasm engine and
        │                         causl-wasm-ts (two-engine-architecture,
        │                         integrating-causl-client, wasm-performance)
        └── faq/
```

`vendor/` is **not** "pinned third-party assets". Only `vendor/prismjs/`
is third-party. `vendor/@causl/` holds first-party `@causl/*` builds
copied out of the client repo's `dist/`, and those are the exact bytes
the live demos execute. `vendor/MANIFEST.json` records a SHA256 per
file plus the `generatedFrom` commit; the refresh and check scripts it
names live in the client monorepo, not here.

The site is intentionally static. There is no framework, no build
step, and no module bundler: every page is hand-authored HTML that
loads the CSS and JS in `css/` and `js/` directly.

The two interactive demos load **React 19 and ReactDOM 19 from
[`esm.sh`](https://esm.sh)** at runtime. They do **not** load
`@causl/*` from esm.sh under normal operation. The bare specifiers
`@causl/core`, `@causl/core/internal`, `@causl/core/testing`,
`@causl/core/wasm`, `@causl/devtools`, and `@causl/formula` resolve
through a page-local `<script type="importmap">` to the committed
build under `vendor/@causl/`; the esm.sh URL is a **fallback**, tried
only if that dynamic `import()` fails. `js/sandbox-runner.js` builds
the same importmap for the sandboxed iframe. This was deliberate:
esm.sh could not resolve some transitive deps reliably, and vendoring
also keeps the demos in lockstep with the in-repo build rather than
with whatever a registry last published.

---

## Build and deploy

There is no build, and there is **no CI validation of any kind**. The
only workflow is
[`.github/workflows/static.yml`](./.github/workflows/static.yml)
(checkout → upload-pages-artifact → deploy-pages):

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

The workflow uploads the entire repository as the Pages artefact and
invokes `actions/deploy-pages@v5`. The `CNAME` file in the repo root
points the GitHub-Pages-hosted site at `causl.org`. Nothing will catch
a mistake in the content, so verify changes by hand.

Note the split: I maintain this repository on Gitea, but Pages builds
from the GitHub copy, so a change is not live on `causl.org` until it
has been synced to `github.com/causljs/causl-org`.

To preview locally, any static-file server works:

```sh
# the canonical dev server, from the causl-org-srv sibling repo.
# It is a stdlib-Python script, not an npm package.
python3 ../causl-org-srv/server.py     # defaults to port 8081

# or anything that serves the repo root with directory indexes
python3 -m http.server 8000
```

The two interactive demos need the server to serve
`/pages/playground/` and `/pages/spreadsheet/` with their relative
asset paths intact, because the importmap resolves `@causl/*` at
`../../vendor/@causl/...`. The GitHub Pages deploy preserves the same
layout.

Site URLs all carry the `/pages/` prefix, which is easy to get wrong:
the docs site is `causl.org/pages/documentation/`, the dashboard is
`causl.org/pages/benchmarks/`, and the demos are
`causl.org/pages/playground/` and `causl.org/pages/spreadsheet/`.
`js/topbar.js` holds the canonical link list.

---

## Browser support

[`BROWSER_SUPPORT.md`](./BROWSER_SUPPORT.md) is the authority. Its
floor, which is the highest version any feature the site uses
requires, is **Safari 16.4**, **Chrome / Edge 105**, and **Firefox
121**. The binding features are `<script type="importmap">`,
`backdrop-filter` with the `-webkit-` prefix, and dynamic `import()`.
Below the floor the importmap is ignored and the demos fall back to
their esm.sh URLs, which still work.

That is the floor for **this website**. It is not the floor for the
**engine**, which is higher: Safari 18.2, Chromium 119, Firefox 120,
Node 22, as described under "Wasm-engine architecture" above. A
browser can render every page here and still be unable to instantiate
the wasm engine.

---

## License

MIT. See [`LICENSE`](./LICENSE).

Copyright (c) 2026 Roman Goldmann.
