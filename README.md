# causl-org

## Published package

**This repository publishes no npm package.**

The causl packages are published from:

| repository | package |
|---|---|
| `causl-core-rs` | `@causl/core-rs` — the Rust engine (WebAssembly) |
| `causl-core-ts` | `@causl/core-ts` — the TypeScript engine |
| `causl-client-ts` | `@causl/client-ts` — the TypeScript client, plus the satellite packages |
| `causl-check` | `@causl/checker` and its per-platform binaries |

Registry: Gitea npm registry — `https://git.opsite.ca/api/packages/causl/npm/`

> Naming follows the scheme in [`causl-client-ts` / `docs/repo-naming-decision.md`](https://git.opsite.ca/causl/causl-client-ts/src/branch/main/docs/repo-naming-decision.md): **engines are named by substrate** (`causl-core-rs`, `causl-core-ts`), **clients by consumer language** (`causl-client-ts`, future `causl-client-cpp`).


> Source for [causl.org](https://causl.org) — the public-facing
> documentation, playground, spreadsheet demo, benchmark dashboard, and
> brand assets for the Causl state-engine project.

This repository is **the website**, not the engine. The engine, the
WASM port, the static checker, and the benchmark harness each live in
their own repository under the [`causljs`](https://github.com/causljs)
GitHub organisation. The role of this repo is to be the human-readable
front door: landing page, getting-started + tutorial + usage guides,
generated API reference, two live in-browser demos (playground +
spreadsheet), and the benchmark dashboard.

---

## Development access

This repository's primary remote is **GitHub** (`github.com/causljs/causl-org`); it is mirrored to the self-hosted Gitea. The private `@causl` / `@iasbuilt` npm packages, however, are served by the **Gitea** registry at `git.opsite.ca`, so installing them needs a Gitea account and token even though the source lives on GitHub.

### Clone

```bash
git clone https://github.com/causljs/causl-org.git
```

### Private packages (`@causl/*`, `@iasbuilt/*`)

These scopes are served by Gitea's npm registry, not npmjs — needed whether you install this repo's dependencies or consume its published packages elsewhere. Create a token at **git.opsite.ca → Settings → Applications → Generate New Token** with the `read:package` scope, export it, and add the registry lines to your `~/.npmrc` (or a repo-root `.npmrc`):

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

Then install as usual — `pnpm install` (or `npm install`) resolves `@causl/*` and `@iasbuilt/*` from Gitea.

### Releases & published versions

- Releases / tags: https://github.com/causljs/causl-org/releases
- Published package versions: https://git.opsite.ca/causl/-/packages

---

## What is Causl?

Causl is a state engine for applications whose model is a live graph
of facts whose derivations cascade. The eight commitments — atomic
commit, automatic dependency tracking, deterministic dynamic-dep
cleanup, glitch-free diamond, denotational semantic foundation,
composite statechart, strict model/controller/engine layering, and
pre-runtime race detection — live in the canonical specification at
[`causljs/causl-ts/SPEC.md`](https://github.com/causljs/causl-ts/blob/main/SPEC.md).

The landing page at `causl.org` is the short-form version of that
story; the docs site (`causl.org/documentation`) is the longer one.

---

## The causljs/* repos (cross-org topology)

Causl is split across nine repositories under the
[`causljs`](https://github.com/causljs) org, each owning one concern —
there is **no** `causljs/causl` parent monorepo. The split keeps CI
fast, lets the Rust and TypeScript halves move at independent cadences,
and lets adopters depend only on the surface they need.

The one-line truth the whole topology rests on: **`rust-ssot` (the
`causl-wasm` Rust→WebAssembly engine) is the unconditional production
default for the WASM path** (since 2026-06-21, all five SPEC §18A.7
GO/NO-GO criteria GO). `causl-client` ships wasm as its sole
default/public engine and is **wasm-default with a TS
capability-fallback** — implicit `createCausl()` degrades *loudly* to a
retained internal `createCauslTs` on a WasmGC-unavailable host
(§18A.13.1), while explicit `createCauslWasm()` / `engine:'rust-ssot'`
fails loud. The pure-TS `causl-ts` engine is the **open-source floor /
§12 conformance reference**, not the production engine.

| Repo                                                                            | Role                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [`causljs/causl-wasm`](https://github.com/causljs/causl-wasm)                   | **The Rust engine source of truth.** Owns `tools/engine-rs-core` (the from-scratch Rust engine — generational `NodeId{slot,gen}`, `BTreeMap`-keyed JSON values, seven-named-struct cells), `tools/engine-rs-bridge` (the JS↔WASM bridge), the §18A.3 FFI surface, the byte-identity gate's Rust side, **and** the stdlib-only CPython build/package tooling (`scripts/build_wasm.py` + `scripts/package_wasm.py`, §18A.11). `rust-ssot` is the unconditional default here. |
| [`causljs/causl-client`](https://github.com/causljs/causl-client)               | **The thin TS API consumer.** The §18A.4 thin TypeScript binding over the `causl-wasm` FFI (publishes `@causl/core` + adapter packages `@causl/react` / `@causl/formula` / `@causl/sync` / `@causl/devtools` / `@causl/persistence` / `@causl/migration-check`). Implements the §12 `Graph` facade by delegating to the wasm engine; ships **no** Rust source and **no** build tooling. Wasm-default with a TS capability-fallback (§18A.13.1). Named adopters: `iasbuilt/xldatagrid`, `iasbuilt/webapp`. |
| [`causljs/causl-ts`](https://github.com/causljs/causl-ts)                       | **The OSS pure-TypeScript floor / §12 conformance reference** — `@causl/core` + adapter packages on the public npm distribution, where the pure-TS engine is the default. It is the open-source floor, **not** the production engine (the Enterprise/production engine is `causl-wasm` via `causl-client`). |
| [`causljs/causl-ts-wasm-engine`](https://github.com/causljs/causl-ts-wasm-engine) | **The dual-engine differential reference (the fork).** Retains `causl-ts` (the §13.8 unconditional TS floor) as its default (`DEFAULT_WASM_ENGINE_MODE = 'js-ssot'`) and *adds* a real-Rust differential leg as the §18A.1.1 byte-identity oracle; also hosts `@causl/benchmarks`. It does **not** flip to rust-ssot — the production cutover happened in `causl-client`. "Not where you start for production." |
| [`causljs/causl-bench`](https://github.com/causljs/causl-bench)                 | The cross-library benchmark suite. Compares causl against Jotai / RTK / MobX across the SPEC-derived scenario taxonomy; emits the JSON that powers the dashboard on this site. (Distinct from the in-fork `@causl/benchmarks` causl-ts-vs-wasm suite.) |
| [`causljs/causl-check`](https://github.com/causljs/causl-check)                 | The Rust-backed static-analysis half: `causl-check` (twelve-pass IR linter), `causl-enumerate` (SPEC §16.4 bounded state-space enumerator), the Apalache differential runner, and the TLA+ corpus. The static half of SPEC §17 pre-runtime race detection. |
| [`causljs/causl-server`](https://github.com/causljs/causl-server)               | A prospective **Enterprise** server layer above the single-writer OSS engine (client↔server transport, plus permissions and version-control concerns). **Under redesign** — the earlier sketch (a PolicyGate permissions layer and a git-like commit VCS) is being re-thought from scratch and is not an active roadmap item. |
| [`causljs/causl-org`](https://github.com/causljs/causl-org)                     | **This repo.** Static site source (HTML + CSS + JS) for `causl.org`, brand assets, the playground and spreadsheet demos, the generated TypeDoc API reference, the benchmark dashboard front-end, the hand-written docs, and a dedicated [Enterprise section](./pages/documentation/enterprise/) for the wasm/causl-client depth. |
| [`causljs/causl-org-srv`](https://github.com/causljs/causl-org-srv)             | The tiny stdlib-Python static-site server used during local development for the demos in this repo. |

---

## Wasm-engine architecture: rust-ssot is the production default

The production engine is the **real Rust engine** in
`causljs/causl-wasm` — `engine-rs-core`, a from-scratch Rust engine
(not a transliteration of the TS engine, §18A.4/§18A.9) compiled to
WebAssembly and reached over FFI through the `engine-rs-bridge`. As of
**2026-06-21** all five SPEC §18A.7 GO/NO-GO criteria are GO
([`causl-wasm#169`](https://github.com/causljs/causl-wasm/issues/169)),
so `rust-ssot` is the unconditional default for the WASM path:
`DEFAULT_WASM_ENGINE_MODE = 'rust-ssot'`. The §18A.8 fail-safe-removal
amendment removed the per-flush TS-vs-Rust byte-compare oracle and the
K=1 sticky-downgrade — the Rust `commit_batch` post-state is applied
unconditionally, validated by the cross-backend determinism gate at
0-byte divergence over 100,000 trials.

The §18A.3 FFI structural lift has **landed**
([`causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170)):
every adopter operation — commit / read / subscribe / derived plus the
structural surface (dependencies, dependents, stats, commit-log,
explain, exportModel, readAt / snapshotAt, subscribeCommits) — resolves
from the Rust engine. The only JS in the hot path is the user's own
`derived()` compute lambda, which runs in JS over the bridge callback
by design.

`causl-client` is **wasm-default with a TS capability-fallback**, not
strictly "wasm-only":

- The implicit `createCausl()` factory routes to the wasm engine
  (rust-ssot) and, on a host where the WasmGC engine cannot instantiate
  (Safari < 18 / macOS < 15, policy-pinned pre-119 Chromium/WebView2,
  Node ≤ 20), degrades **loudly** to the retained internal
  `createCauslTs` (one-time `console.warn` + telemetry, never silent —
  SPEC §18A.13.1). The WasmGC capability probe itself is still a
  placeholder (`#691`), so the auto-degrade is wired in design, not yet
  a fully-runtime-proven probe.
- The **explicit** `createCauslWasm()` / `createCauslWasmSync()` /
  `engine:'rust-ssot'` factories still **fail loud**
  (`CAUSL_WASM_ENGINE_UNAVAILABLE`) — a consumer that explicitly asked
  for wasm must never silently run on JS.
- `createCauslTs` is **retained internally** (un-exported from the
  public barrel) as the §12 conformance reference and the implicit-path
  fallback; deleting it outright is **dropped from near-term scope** by
  §18A.13.1.

The adopter-facing how-to for the **Enterprise-tier** wasm path —
building and vendoring a pinned, checksummed `.wasm` with `causl-wasm`'s
CPython-stdlib tooling (`build_wasm.py` / `package_wasm.py`, SPEC
§18A.11, `--target nodejs` shipped), and reaching it from a TS/Node app
through the `@causl/core/wasm` seam — lives in the
[Enterprise docs section](./pages/documentation/enterprise/)
(`pages/documentation/enterprise/`), with pages on the
[two-engine architecture](./pages/documentation/enterprise/two-engine-architecture/),
[integrating causl-client](./pages/documentation/enterprise/integrating-causl-client/),
and [wasm performance status](./pages/documentation/enterprise/wasm-performance/).

The pure-TS `causl-ts` engine is the **open-source floor / §12
conformance reference** on the public npm distribution; the wasm engine
is the Enterprise production default via `causl-client`.

---

## The `CAUSL_TS_SOURCE` selector

`causl-bench` ships its root `package.json` with no `pnpm.overrides`
block, so the registry is the default resolver and the
`bench — install + smoke` CI gate stays green on a bare runner.
Linking against a local checkout of either TypeScript engine is
opt-in via the `CAUSL_TS_SOURCE` env var, which
`tools/select-causl-source.mjs` reads to rewrite `pnpm.overrides`:

```sh
CAUSL_TS_SOURCE=upstream     pnpm install   # links against ../causl-ts
CAUSL_TS_SOURCE=wasm-engine  pnpm install   # links against ../causl-ts-wasm-engine
```

The dashboard on this site (`/benchmarks/`) consumes the JSON the
bench harness emits; the `CAUSL_TS_SOURCE` toggle is what lets the
dashboard's `causl-ts` and `causl-wasm` series carry comparable
numbers from the same run.

---

## What landed recently

Work that has landed across the org, in rough reverse-chronological
order:

- **causl-wasm — rust-ssot promoted to the unconditional default
  (2026-06-21).** All five §18A.7 GO/NO-GO criteria GO
  ([`causl-wasm#169`](https://github.com/causljs/causl-wasm/issues/169));
  `DEFAULT_WASM_ENGINE_MODE = 'rust-ssot'`, the per-flush byte-compare
  oracle and K=1 sticky-downgrade removed (§18A.8).
- **causl-wasm — the §18A.3 deep FFI lift landed**
  ([`causl-wasm#170`](https://github.com/causljs/causl-wasm/issues/170)):
  the four projection reads (read_at, export, subscribeCommits, explain)
  plus read/now/structural-query all answer from Rust, so every adopter
  op resolves from Rust.
- **causl-wasm — ChangeTokens `u16`→`u32` ceiling lifted**
  ([`causl-wasm#175`](https://github.com/causljs/causl-wasm/pull/175)):
  single commits over ~8191 nodes now work via a payload-len
  sentinel-escape; sub-ceiling records stay byte-identical.
- **causl-wasm — dead serde JSON value-pool channel deleted**
  ([`causl-wasm#174`](https://github.com/causljs/causl-wasm/pull/174)):
  the D1 oracle (`[NaN,+Inf,-Inf,1]`) is now an exact byte round-trip on
  the production serde-free path.
- **causl-client — §18A.13.1 capability fallback shipped (2026-06-23).**
  `createCauslTs` is retained (not deleted) and wired as the implicit
  `createCausl()` path's loud WasmGC-unavailable fallback; the literal
  zero-TS core is dropped from near-term scope.
- **causl-ts-wasm-engine (the fork) — the differential gate now drives
  REAL Rust** ([`#46`](https://github.com/causljs/causl-ts-wasm-engine/pull/46)):
  the cross-backend byte-identity gate runs the real Rust engine against
  `createCauslTs()` as oracle (no longer a TS-vs-TS shim), 0-byte
  divergence at 1k default / 100k nightly. The fork keeps `js-ssot` as
  its default and adds the Rust leg.
- **causl-check** — the twelve-pass IR linter, `causl-enumerate`
  bounded enumerator, Apalache differential runner, and TLA+ corpus.
- **causl-org** (this repo) — dashboard with auto-adaptive Y-axis,
  mouse-drag rescale, wheel-zoom / drag-pan charts, honest skip-box
  surface for libraries that can't run a given scenario; codeblock
  pipeline that pre-renders the wrapper into the static HTML site-wide;
  brand-spec consolidation on the geometric Causl mark. This pass
  re-synced the topology + engine narrative to the rust-ssot-default
  reality and regenerated the TypeDoc API reference.

---

## Repo layout

```
causl-org/
├── index.html                  Landing page
├── 404.html                    Fallback
├── CNAME                       causl.org
├── css/                        Site CSS, syntax highlight, topbar, playground
├── js/                         Topbar, codeblock-wrapper, playground runner,
│                               sandbox runner, contrast audit, footer
├── img/                        Brand mark + supporting imagery
├── fonts/                      Self-hosted brand typeface (Inter + IBM Plex Mono)
├── vendor/                     Pinned third-party assets
├── docs/brand/                 Brand specification + asset originals
└── pages/
    ├── playground/             Monaco-editor + live @causl/core graph
    ├── spreadsheet/            Phase-3 100-cell diamond demo (React 19, esm.sh)
    ├── benchmarks/             Dashboard (history.json + dashboard.js)
    ├── brand/                  Brand spec, public-facing
    └── documentation/
        ├── api/                Generated TypeDoc output
        ├── getting-started/
        ├── tutorial/
        ├── usage/
        ├── best-practices/
        ├── enterprise/         Enterprise tier: wasm engine + causl-client
        │                       (two-engine-architecture, integrating-causl-client,
        │                       wasm-performance)
        └── faq/
```

The site is intentionally static. There is no framework, no build
step, no module bundler — every page is hand-authored HTML that loads
the CSS and JS in `css/` and `js/` directly. The two interactive
demos load React 19 and `@causl/core` from
[`esm.sh`](https://esm.sh) at runtime, so they exercise exactly what
an adopter installs.

---

## Build and deploy

There is no build. Deploy is GitHub Pages directly out of the
repository root, driven by [`.github/workflows/static.yml`](./.github/workflows/static.yml):

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

The workflow uploads the entire repository as the Pages artefact and
invokes `actions/deploy-pages@v5`. The `CNAME` file in the repo root
points the GitHub-Pages-hosted site at `causl.org`.

To preview locally, any static-file server works:

```sh
# from causl-org-srv (sibling repo) — the canonical dev server
npx @causljs/causl-org-srv

# or, anything that serves the repo root with directory indexes
python3 -m http.server 8000
```

The two interactive demos require the dev server to serve the
`/playground/` and `/spreadsheet/` directories with their relative
asset paths intact; the GitHub Pages deploy preserves the same
layout.

---

## Browser support

See [`BROWSER_SUPPORT.md`](./BROWSER_SUPPORT.md). Short version:
evergreen Chromium / Firefox / Safari over the last two major
releases; the playground requires Monaco's baseline (ES2022 + the
shared-array-buffer-less worker shape).

---

## License

MIT — see [`LICENSE`](./LICENSE).

Copyright (c) 2026 Roman Goldmann.
