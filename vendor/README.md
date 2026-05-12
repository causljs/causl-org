# `causl-org/vendor/` — vendored runtime assets

This directory contains the static, third-party and first-party JavaScript
assets that the causl-org site loads at runtime. Everything here is
committed verbatim; there is **no install-time fetch and no CDN dependency**
at page-load time.

The freshness and integrity of every file is tracked in
[`MANIFEST.json`](./MANIFEST.json) by SHA256, and a CI gate
(`scripts/check-vendor-manifest.sh`) fails any PR that modifies a vendored
file without re-running the refresh script.

## Layout

```
causl-org/vendor/
├── MANIFEST.json                       # per-package version, files, SHA256
├── README.md                           # this file
├── @causl/
│   ├── core/                           # @causl/core dist (multi-entry: index, internal, testing, wasm)
│   ├── devtools/                       # @causl/devtools dist (single entry)
│   └── formula/                        # @causl/formula dist (single entry)
└── prismjs/                            # PrismJS 1.30.0 components for the site syntax highlighter
    └── README.md                       # Prism-specific notes (theme, language list)
```

## Vendored packages

The four packages tracked in `MANIFEST.json`:

| Package           | Canonical source                                                                            | What is vendored                          |
| ----------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@causl/core`     | `packages/core/dist/` (built locally via `tsup`)                                            | `index`, `internal`, `testing`, `wasm` entries + emitted chunks + sourcemaps |
| `@causl/devtools` | `packages/devtools/dist/`                                                                   | `index.js` + sourcemap                    |
| `@causl/formula`  | `packages/formula/dist/`                                                                    | `index.js` + sourcemap                    |
| `prismjs`         | `https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/<name>.min.js` (npm `prismjs@1.30.0`) | core + 10 language components             |

The three `@causl/*` packages are vendored from the local workspace build
output rather than from the npm registry — they are workspace packages and
the causl-org site is shipped against the in-repo build, not a published
version. This keeps the site preview in lockstep with the trunk monorepo.

`prismjs` is vendored from jsdelivr; the theme is hand-authored against the
site contrast-pair token system and lives in `causl-org/css/syntax.css` (see
`causl-org/vendor/prismjs/README.md`).

## Refreshing

A single source-of-truth script lives at the repo root:

```bash
scripts/refresh-vendor.sh
```

It will:

1. Build `@causl/core`, `@causl/devtools`, `@causl/formula` via
   `pnpm build --filter @causl/<pkg>`.
2. Copy each package's `dist/` into `causl-org/vendor/@causl/<pkg>/` (after
   wiping the destination so removed files don't linger).
3. Re-download every Prism component listed in the current `MANIFEST.json`
   for `prismjs` from jsdelivr at the pinned version.
4. Recompute SHA256 for every vendored file via `shasum -a 256`.
5. Rewrite `MANIFEST.json` with the new SHAs, a fresh `generatedAt` ISO
   timestamp, and the current `HEAD` git SHA as `generatedFrom`.

Run it whenever you ship a PR that changes a vendored package's source.

## Threat model

The vendor directory is committed and serves user-facing JavaScript directly
from `causl-org.github.io`. The threat model is **detection, not
prevention**:

- **Vendored files are committed** to the repo. They are *not* fetched at
  install time; whoever pulls the repo sees exactly the bytes that were
  committed. There is no install-step network round-trip that could be
  hijacked.
- **Tampering is detectable.** Every vendored file has a SHA256 in
  `MANIFEST.json`. The CI gate at `scripts/check-vendor-manifest.sh`
  recomputes every SHA on every PR and fails if any file's SHA does not
  match its `MANIFEST.json` entry. A reviewer who sees the CI gate
  failing knows that:
  - either the contributor edited a vendored file directly (which is not
    allowed — vendored files are generated, not source), or
  - the contributor ran `refresh-vendor.sh` and forgot to commit the
    updated `MANIFEST.json` (the script regenerates both together, so
    this should not happen if the script is used).
- **The manifest itself is reviewer-gated.** A malicious PR that swaps a
  vendored file *and* updates its SHA in `MANIFEST.json` will pass the CI
  gate. Detection at that point falls back to ordinary code review: the
  manifest diff is visible, the `generatedFrom` git SHA can be cross-
  referenced against trunk, and any change to vendored bytes will appear as
  a diff in the file itself.
- **Provenance is recorded.** Each manifest entry records `generatedFrom`
  (the git SHA of the monorepo at the time `refresh-vendor.sh` was run) and
  `generatedAt` (ISO timestamp). Reviewers can cross-check that
  `generatedFrom` is a real commit on the trunk branch.

The gate's value is **drift detection**, not cryptographic isolation: it
catches the common case of someone hand-editing a vendored file (which
would silently desync the site from the canonical source build) and the
common case of someone bumping a Prism version without re-pinning the
hash.

## Known follow-ups

- **Sourcemaps (`*.js.map`) are currently shipped.** Each vendored
  `@causl/*` entry ships its sourcemap alongside the minified output. For
  the public site this is intentional today — it makes stack traces in the
  browser console useful when debugging the demo embedded on causl-org.
  For a production-grade site the sourcemaps would be either stripped
  before vendoring or served from a non-vendored path with restricted
  visibility. **Decision pending**: keep / strip / split. Track this in a
  follow-up issue if and when causl-org moves out of preview state.
