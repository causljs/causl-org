# causl-org

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

Causl was split out of a single monorepo into seven repositories that
each own one concern. The split keeps CI fast, lets the Rust and
TypeScript halves move at independent cadences, and lets adopters
depend only on the surface they need.

| Repo                                                                            | Role                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [`causljs/causl-ts`](https://github.com/causljs/causl-ts)                       | The TypeScript engine + adapter packages: `@causl/core`, `@causl/react`, `@causl/formula`, `@causl/sync`, `@causl/devtools`, `@causl/devtools-bridge`, `@causl/persistence`, `@causl/checker` (npm wrapper for the Rust linter), `@causl/bench` scenario taxonomy, `@causl/migration-check`. |
| [`causljs/causl-wasm`](https://github.com/causljs/causl-wasm)                   | The Rust engine port + its single consolidated WASM bridge. Hosts `engine-rs-core` (pure-algorithm `no_std + alloc` crate carrying the SPEC §16.4.1 `State` / `Action` / `Event` / `Commit` types and `transition_phased`) and the active bridge cdylib that exposes it to JS. |
| [`causljs/causl-ts-wasm-engine`](https://github.com/causljs/causl-ts-wasm-engine) | The TypeScript-engine fork whose intent is to default to the WASM substrate, wired through the consolidated `@causljs/causl-wasm` bridge. Where `causl-ts` keeps the JS engine as the SSOT and treats WASM as an opt-in backend, this fork is the staging ground for inverting that default — the `DEFAULT_WASM_ENGINE_MODE` flip (`'js-ssot'` → `'rust-ssot'`) is the fork's defining cutover, but the shipped constant is still `'js-ssot'` and the flip stays gated behind the §18A.7 criteria (per its README). |
| [`causljs/causl-bench`](https://github.com/causljs/causl-bench)                 | The cross-library benchmark suite. Compares causl-ts / causl-ts-wasm-engine / Jotai / RTK / MobX across the SPEC-derived scenario taxonomy; emits the JSON that powers the dashboard on this site. Honours the `CAUSL_TS_SOURCE` env var (see below) so a single run can A/B the two TypeScript-side engines. |
| [`causljs/causl-check`](https://github.com/causljs/causl-check)                 | The Rust-backed static-analysis half: `causl-check` (twelve-pass IR linter), `causl-enumerate` (SPEC §16.4 bounded state-space enumerator), the Apalache differential runner, the EPIC-7 TLA+ corpus, and the Tier-3 Apalache S-row corpus. RFCs 0001 (adopter race classes) and 0002 (federated race detection across `causljs/*`) live here. |
| [`causljs/causl-org`](https://github.com/causljs/causl-org)                     | **This repo.** Static site source (HTML + CSS + JS) for `causl.org`, brand assets, the playground and spreadsheet demos, the generated TypeDoc API reference, the benchmark dashboard front-end, and the hand-written docs (getting-started, tutorial, usage, best-practices, FAQ). |
| [`causljs/causl-org-srv`](https://github.com/causljs/causl-org-srv)             | The tiny static-site server used during local development for the demos in this repo. Was previously vendored into `causl-ts/tools/causl-org-srv/`; lives standalone now. |

---

## Wasm-engine zero-boundary architecture

The Rust engine port in `causljs/causl-wasm` has converged on a
single-bridge story. Two pieces of history are worth knowing:

1. **Bridge consolidation (PR #74).** The legacy two-cdylib design —
   `engine-rs-bridge-serde` (the universal-fallback serde-wasm-bindgen
   crate) plus `engine-rs-bridge-gc` (the WasmGC + `wasm:js-string`
   crate that shipped two artefacts) — was deleted in
   [`causl-wasm#74`](https://github.com/causljs/causl-wasm/pull/74) in
   favour of a single consolidated bridge. The Tier-1/2/3 host matrix
   that older docs referenced lives behind feature flags in that one
   bridge now, not as separate crates.
2. **`epic/1` — zero-boundary migration.** The hot-path traversal
   modules (`mutate`, `recompute`, `publish`, `kahn::drain`) were
   migrated to a `&mut dyn CellAccess` trait object that abstracts the
   cell-storage backing. The migration lets the Rust engine talk to
   either a flat-vector cell store (current) or a future
   externally-owned cell pool (for WasmGC + JS-side ownership) without
   re-stamping the algorithm code. The PoC landed in
   [`causl-wasm#76`](https://github.com/causljs/causl-wasm/pull/76),
   the four follow-ups in `#79`/`#80`/`#81`/`#82`, and the
   value-pool optimisation for `DispatchMsg` payloads in `#77`.

The practical consequence for adopters is that the TS-side surface
the `wasm-engine` fork imports (`loadWasmBackend()` → consolidated
bridge → `engine-rs-core`) does not change as the bridge internals
evolve. The byte-identity cross-bridge gate that older releases
referenced still holds; it just runs against one bridge now.

The adopter-facing how-to for the **Enterprise-tier** wasm path —
building and vendoring a pinned, checksummed `.wasm` with `causl-wasm`'s
CPython-stdlib tooling, and reaching it from an app through the
`@causl/core/wasm` seam — lives in the
[Enterprise docs section](./pages/documentation/enterprise/)
(`pages/documentation/enterprise/`), with pages on the
[two-engine architecture](./pages/documentation/enterprise/two-engine-architecture/),
[integrating causl-client](./pages/documentation/enterprise/integrating-causl-client/),
and [wasm performance status](./pages/documentation/enterprise/wasm-performance/).
Those guides keep **shipped today** and **planned (§…)** strictly
separated:

- The `@causl/core/wasm` seam ships today — the loader
  (`loadWasmBackend()`), bridge picker, and the Phase-1 `WasmBackend`.
  But that `WasmBackend` is a TS engine wrapped in the FFI shape, **not
  a Rust engine** — so wall-time today is ~0% off the TS floor, and the
  Rust-engine perf win is gated post-0.9.0 work.
- On the producer side, `causl-wasm`'s `build_wasm.py` /
  `package_wasm.py` tooling ships its `--target nodejs` build and
  checksummed artefact placement today (SPEC §18A.11).
- On the consumer side, the only artefacts vendored in `causl-client`
  today are `--target bundler` builds (Vite / webpack 5 / esbuild). The
  Node-target consumer **`node:fs` loader hook is planned, not yet
  merged** — SPEC §18A.2 names it "the missing piece," and it remains
  ungated under §18A.7 Criterion 4 (Node target + real-world adoption).
  Until it lands, the placed `.wasm` is resolved through the
  bundler `new URL(..., import.meta.url)` path rather than a `node:fs`
  read — and at the Phase-1 stage the loader never calls
  `WebAssembly.instantiate` at all, so the artefact is referenced for
  forward-compat resolution but not executed at runtime.

The pure-TS engine remains the default, open-source floor; the wasm
engine is the opt-in Enterprise alternative, not a default or
replacement.

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

Work that has landed across the org since the split, in rough
reverse-chronological order:

- **causl-check** — RFC 0001 (adopter-defined race classes, Phase 2
  loader + SARIF integration), RFC 0002 (federated race detection
  across `causljs/*` repos), the resource-origin-bound lint pass, the
  `causl-check-replay` SARIF counterexample tool, and the Tier-3
  Apalache TLA+ corpus for the SPEC.async §9.1.1 S-rows (`spec_s1.tla`
  / `spec_s2.tla` / `spec_s3.tla`).
- **causl-wasm** — `epic/1` zero-boundary migration to `&mut dyn
  CellAccess` across the hot-path traversal modules; deletion of the
  two legacy bridge cdylibs (PR #74) in favour of one consolidated
  bridge; split CI workflow (fast main, heavy release verification).
- **causl-ts-wasm-engine** — the TS-engine fork staging the
  WASM-substrate default (the `'rust-ssot'` cutover wiring is exercised
  end-to-end, but the shipped `DEFAULT_WASM_ENGINE_MODE` is still
  `'js-ssot'`, gated behind §18A.7); consolidated-bridge wiring through
  `loadWasmBackend()`; `graph.snapshotBlob()` / `hydrateBlob(blob)`
  bulk-serialisation boundary API (throwing stub, pending the
  causl-wasm side of the contract in #85); per-PR bundle-budget
  comment workflow; the `causl/no-graph-upcast` S-3 lint gate.
- **causl-bench** — `CAUSL_TS_SOURCE` engine-selector + the bench-row
  property suite + dispatching `backend='wasm'` to the actual
  `WasmBackend` constructor (the Phase-1 TS-engine-wrapped backend, not
  a mock); zero-boundary scenario `run()` bodies for the first ten
  taxonomy entries; functional workspace scaffold.
- **causl-org-srv** — extracted to standalone repo; previously lived
  at `causl-ts/tools/causl-org-srv/`.
- **causl-org** (this repo) — dashboard with auto-adaptive Y-axis,
  mouse-drag rescale, wheel-zoom / drag-pan charts, 0-anchored
  baseline, honest skip-box surface for libraries that can't run a
  given scenario; codeblock pipeline that pre-renders the wrapper
  into the static HTML site-wide and preserves TypeDoc-baked syntax
  tokens; brand-spec consolidation on the geometric Causl mark.
- **All seven repos** — CI parity pre-commit hooks (`pre-commit ↔ CI
  parity` PRs across `causl-ts`, `causl-wasm`, `causl-check`,
  `causl-bench`, `causl-ts-wasm-engine`), so a `git commit` runs the
  same gate union the CI workflow does.

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
