# Changelog

All notable changes to this repository land here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Versioning policy

This package is on a `0.x` line and follows
[Semantic Versioning](https://semver.org/) **now**, not "once the first
stable release ships". SemVer §4 permits a `0.x` project to change
anything at any time; this project does not take that permission.
`^0.y.z` resolves `>=0.y.z <0.(y+1).0`, so a consumer on a caret range
takes every patch silently and cannot take a minor without editing a
manifest. What that range can and cannot absorb is what the three rules
below are written against.

- **Patch — `0.y.Z`.** No observable surface moves. Bug fixes,
  performance work, and engine republishes whose semantics are
  unchanged. A `^0.y.z` install takes these silently, and for a patch
  that is the intended behaviour. `0.3.7` is the worked example: it
  swapped the vendored Rust engine for one without a quadratic drain
  and moved no surface at all.
- **Minor — `0.Y.0`.** Some observable surface moves. A minor is the
  smallest step a caret range cannot take silently, so every change an
  adopter could notice without reading our source lands here rather
  than in a patch — *including* changes that would be MAJOR after 1.0.
- **Major — `X.0.0`.** Reserved for the 1.0 line; under `0.x` we do not
  cut one. A change that would be major after 1.0 ships as a minor,
  says so in its own entry, and carries a numbered migration section.

### What a minor means for the cutoff relation

The value-equality relation that decides whether a derived's dependents
recompute is a public surface, even though no signature names it.
Adopters observe it through `Commit.changedNodes`, the Phase-G/H fire
sets, `simulate().derivedDiff`, `stats().nodeVersion`, `explain()`,
`commitLog` entries, `onObserverError` counts,
`nodeMeta().computedAt` / `contributedAt`, and fire attribution. It is
therefore versioned, and SPEC §5.1 Amendment 8's versioning clause is
the rule:

- **Refinement — minor.** No two values that previously compared
  unequal now compare equal; more nodes reach `changedNodes` and never
  fewer. A refinement MUST ship with a **measured** recompute-volume
  delta in its own entry — a count on a named fan-out, or wall-clock
  ms/commit — because the cost of a refinement is paid on every commit
  by every adopter, and an unpriced refinement is a performance
  regression with no number attached to it.
- **Coarsening — major, and not shipped under `0.x`.** Some pair that
  previously compared unequal now compares equal. A coarsening lets
  `read()` serve a value a later commit already replaced, which is the
  defect class this project exists to close. It does not ship behind a
  caret range and it does not ship in a `0.x` minor either.

A refinement is never a patch. It moves the surfaces listed above, so
the minor rule applies to it by construction and a caret consumer is
made to opt in.

### What is not versioned

`packages/core/src` module layout, the `./internal` subpath, test
fixtures and corpora, and the engine build metadata under
`causl.engine.*` in `packages/core/package.json`. The vendored Rust
engine has its own version line — `@causl/core-rs` — which is not this
package's; replacing it without moving an observable surface is a patch
here (see `[0.3.7]`).

### Satellite packages

`@causl/persistence`, `devtools`, `devtools-bridge`, `migration-check`,
`react`, `sync`, `formula` and `hypothesis` each version on their own
`0.x` line under the same three rules. Two clarifications they need and
this package does not:

- **A tool's findings are part of its surface.**
  `@causl/migration-check` exits non-zero on a `critical` finding and
  `docs/migration/RULE_CATALOGUE.md` tells consumer CI it may block a
  merge on that exit code. Adding a `critical` rule therefore moves an
  observable surface: it is a minor, never a patch.
- **A rule that turns a *correct* tree red is a defect, not a minor.**
  Picking a version number does not license one. `S-10`, the pre-0.4.0
  subscription-seam-workaround detector #266 specified, was built,
  measured and then **not shipped** for exactly this reason:
  `scanFile(file, source)` is the whole predicate contract and nothing
  in the package reads a manifest or a lockfile, so the rule can see
  that a tree carries the workaround but not that the tree is on
  `>=0.4.0`. A consumer still pinned below 0.4.0 — where the workaround
  is load-bearing and the code is right — would fail a `critical`
  check. `S-09` remains the highest allocated ID and `S-10` stays free
  on purpose: an ID that names nothing is worse than an unused one.
  Enforcement of the #266 / D16 migration step stays with the release
  note and the tracked blocking edge to `xldatagrid/xldatagrid#1699`.

### Reconstructed entries

`[0.2.1]` and `[0.3.0]`–`[0.3.7]` were written on 2026-08-03, after the
fact, from the `packages/core/package.json` version-bump commits and
from registry metadata: no entry was written at release time, and only
`v0.2.0`, `v0.2.1` and `v0.3.1` were ever tagged. Each section names
the commit it was reconstructed from so the reading can be re-checked.
Dates are publication dates where a registry records one and
bump-commit dates otherwise; both are stated wherever they differ.

## [Unreleased]

### Decided — the value domain through 1.0 (#260)

- **Closures stay in the adopter-facing value domain (#260, SPEC §5.1
  Amendment 8).** The repository held three incompatible positions on
  whether a node value may legitimately hold a closure. The one that
  wins is the shipped one — `packages/core/src/value-domain.ts`, *"an
  input may legitimately hold a callback/bigint"*. The
  `JsonRoundtrippable` SemVer-major narrowing scheduled at
  `docs/epic-1483/CONSTRAINTS.md` and `docs/epic-1133/PLAN.md` is
  **withdrawn as scheduled**; both lines now cite Amendment 8, and no
  type-level bound that would refuse a closure lands in 0.4.0 or 1.0.
  Adopters passing closures into `derived(...)` keep doing so. What
  the constraint should instead be *named* — a bound written for the
  engine value domain (JSON plus the tagged-container bridge) rather
  than for JSON, which as literally written would also refuse the
  `Set` / `Map` / `Date` / `Temporal` the bridge marshals correctly
  today — and the type-level disposition of `undefined` / `bigint` /
  `symbol` / `function` are #270's; only the direction is decided
  here.
- **SPEC §5.1 Amendment 8 — the permitted quotients for computation
  elision (#260).** Amendment 7's equality relation decides two
  things: whether to *notify*, and whether to *skip recomputing* a
  derived's transitive dependents. Only the first was ever authorised
  by SPEC text. Amendment 8 names the second, enumerates the
  quotients the relation is permitted to have for a value taking the
  structural own-property walk, declares that list **closed**, and
  records that the relation is a lossy quotient rather than a
  congruence. It also states a SemVer policy for the relation itself —
  refinement is minor and must carry a measured recompute-volume
  delta, coarsening is major — because a consumer observes it through
  `Commit.changedNodes` and the Phase-G/H fire sets. The quotients are
  gated by measurement, not by prose:
  `packages/core/test/spec-amendment-8-quotients-gate-260.test.ts`
  runs the shipped canonicaliser on a pair of values per entry.
  **Clause 1 shipped with #258** and no longer carries its
  `NOT YET CONFORMANT` disclosure. A node whose value carries
  something outside the JSON projection is excluded from computation
  elision and recomputes — with one qualification the clause states:
  the exclusion is conditional on an opaque slot having MOVED, by
  `Object.is`, so a memoised closure still gets its cutoff.
  `packages/core/test/spec-amendment-8-engine-claims-260.test.ts`
  used to fail if the disclosure was dropped before the engine
  conformed; it now fails if the engine starts eliding again.
- **The `TAG_OPAQUE` arm and the congruence gate (#258, EPIC #255
  T3).** `contentHashMarker`'s terminal arm used to emit `TAG_NULL`
  for `bigint` / `symbol` / `function`, so a container holding any of
  the three was byte-identical to one holding a literal `null`, and
  its object arm had no host-type guard, so a `RegExp` hashed as
  whatever own properties it exposed (`lastIndex`, and nothing else).
  The engine then elided the recompute of every transitive dependent
  and `read()` served the pre-swap value indefinitely — the
  xldatagrid#1696 shape. Three changes, all JavaScript, zero Rust
  edits:
  - **`TAG_OPAQUE`** with `KIND_OBJECT` / `KIND_BIGINT` /
    `KIND_SYMBOL` / `KIND_SYMBOL_REG` / `KIND_FUNCTION`. A `bigint`
    hashes BY VALUE (its decimal text, not a `Number` coercion, which
    would leave two bigints one apart across 2^53 colliding) and a
    REGISTERED symbol by `Symbol.keyFor`; the other three carry no
    payload, because a closure body is not a value. Marker length is
    unchanged at 52 characters, and every pure-JSON and tagged digest
    is byte-identical to the frozen corpus.
  - **A D04-narrowed host allowlist** — `RegExp`, `Error`, `Promise`,
    `WeakMap`, `WeakSet`, probed by `Object.prototype.toString` so a
    cross-realm value takes the same branch its same-realm twin does.
    An ordinary class instance keeps the structural own-enumerable
    walk. The opaque record is a PREFIX on the value's ordinary
    object record rather than a replacement, so an `Error`'s own
    `message` still separates two errors.
  - **The projection-order fix.** `contentHashMarker` now projects
    through `encodeTaggedPreservingOpaque`, so one co-resident `Date`
    no longer launders a `RegExp` into `{}` before the traversal sees
    it. The value path's `encodeTagged` is byte-unchanged.

  **Behaviour change, adopter-visible.** A derived whose value carries
  a `function`, `symbol`, `bigint`, `RegExp`, `Error`, `Promise`,
  `WeakMap` or `WeakSet` is no longer cut off when that payload is a
  different reference than it was — its dependents recompute. This is
  a REFINEMENT in the SPEC §5.1 Amendment 8 sense (more nodes reach
  `changedNodes`, never fewer). It is deliberately not the blanket
  "an opaque-carrying value is always changed": the refusal is
  conditional on `Object.is` over the opaque slots, so the canonical
  `useMemo(() => [rule(limit)], [limit])` consumer, whose payload is
  the same reference on every recompute, keeps its cutoff. If yours
  mints a fresh closure per compute, memoise it or expect the
  downstream cone. Nothing reference-keyed reaches the MARKER — #302's
  option (a), withdrawn because every marker is interned into a
  monotonic append-only arena — so the interned set stays bounded by
  the distinct values rather than by the commit count.

  The gate is on the `createCauslTs` floor. A `rust-ssot` graph
  compares markers inside the engine, so carrying the verdict across
  the bridge is a separate arm; the two engines' `changedNodes` agree
  today wherever the digest alone decides it (`bigint`, registered
  `symbol`) and diverge where the gate does (a swapped closure, a
  swapped `RegExp`).
- **The bare-instance clause — direction: REFINEMENT, minor (#258, EPIC
  #255 T3).** The `TAG_OPAQUE` arm's sixth member is a SHAPE rather than
  a type: a value the structural walk can read **nothing** out of is
  excluded from computation elision exactly as an allowlisted host type
  is (`KIND_BARE_INSTANCE`, `packages/core/wasm/opaque-domain.ts`). An
  allowlist cannot enumerate it, because an adopter can write one —
  `class OpaqueTag { readonly #witness }` emits the empty record for
  every instance and its dependents starve for the same reason `/a/`'s
  do. This is a **refinement** in the SPEC §5.1 Amendment 8 sense (more
  nodes reach `changedNodes`, never fewer) and therefore a **minor**
  change under that amendment's versioning clause, and it now carries
  the three things that clause requires and the clause shipped without:
  the narrowed quotient row (row 2 no longer covers a value the walk
  reads nothing out of), this direction entry, and a measured
  recompute-volume **count**. On the same 103-derived grid fan-out the
  #269 delta used: a commit moving the container across a value with at
  least one readable own property — a class instance with own fields,
  `{}`, `Object.create(null)` — costs **0** dependent recomputes, and a
  commit moving it across a bare instance costs **101**, so the
  refinement costs **+101 dependent recomputes per commit that moves
  such a value**. `packages/core/test/spec-amendment-8-engine-claims-260.test.ts`
  re-derives both arms on every run.

  **Three shapes, not one — two of them were reported as reproduced
  stale reads and are closed here.** "Reads nothing out of it" is a
  claim about READABILITY, and the clause originally implemented
  property EXISTENCE plus a prototype test that asked a weaker question
  than it documented. Both gaps let a value collide AND keep its
  cutoff, which is EPIC #255's own defect class:
  - `hasPlainObjectPrototype` documented *"does the chain END at the
    object root"* and implemented *"is the chain at most two links
    long"*. A value whose prototype is an arbitrary **null-prototype
    bag** — `Object.create(Object.assign(Object.create(null), {role}))`
    — satisfied the weaker test, so `bag('admin')` and `bag('guest')`
    were reported plain, hashed identically, and a dependent reading
    `.role` served `'admin'` for the rest of the process. The chain root
    is now identified by an intrinsic-signature test that is still
    realm-safe (D06 intact: a cross-realm `{}` keeps its cutoff).
  - An own **non-enumerable or symbol ACCESSOR** is a key the walk
    provably cannot read — the hidden and symbol sections fold the
    two-byte `TAG_ACCESSOR` descriptor record and never call the getter
    (deliberately, for determinism / idempotence / totality) — yet under
    the existence test such a value had a non-empty own-key set and was
    not classified. `Object.defineProperty(this, 'v', {get, enumerable:
    false})` in a constructor is one line from the `#private` shape the
    clause covers and got the opposite verdict.

  Both were verified to reproduce identically on `origin/main`, so they
  are pre-existing holes the clause did not close rather than damage it
  did. `{}`, `Object.create(null)`, a cross-realm `{}` and every class
  instance carrying own fields keep their cutoff — the narrowing is not
  the blanket "all non-plain objects" form D04 rejected.
- **A tagged type behind a hidden or symbol key is now tag-encoded
  (#258 follow-up).** `hasTaggedTypes` descends into array elements and
  own **enumerable** string keys only, so it could not see a `Set` /
  `Map` / `Date` / `Temporal` parked behind a non-enumerable or symbol
  key — the two domains #269 taught the walk to read. The un-projected
  value then arrived at the object arm as something with a non-plain
  prototype and no readable own key, i.e. as a bare instance, so the tag
  table's own types were classified **opaque** and their whole dependent
  cone recomputed on every commit while still **colliding** across
  contents. `{ s: new Set(['x']) }` and `{ [sym]: new Set(['x']) }` are
  the same value to an adopter and got opposite cutoff behaviour,
  decided by the key domain and documented nowhere. The projection is
  now re-asked at the descriptor seam (`hashOwnDescriptorSlot`), which
  is the one place a value enters the walk without having been offered
  to the top-level probe: both spellings now measure **0** dependent
  recomputes on the fan-out above, and their markers separate across
  contents. Direction: a **refinement** for the contents (a pair that
  used to collide now separates) and a **de-pessimisation** for the
  cutoff. Amendment 8's quotient row 8 is unchanged — a value with a
  tagged container reachable by the enumerable walk is still projected
  whole, and that pass still re-erases the hidden and symbol domains
  for it.
- **Four of those quotients are closed, not permitted (#260 + #269).**
  Amendment 8 was drafted against the canonicaliser as it stood before
  #269 and listed five permitted quotients. #269 closed four of them —
  `undefined` ≡ `null` inside a container, non-enumerable own
  properties of plain objects, symbol-keyed own properties, and array
  holes are all **observed** now — so the amendment records those four
  as superseded and enumerates the survivors instead. For an adopter
  this is a strengthening in the refinement direction: four value
  distinctions that used to be invisible to the cutoff now reach
  `changedNodes`, and a derived that differs from its predecessor only
  in one of them no longer serves a stale value out of `read()`.
  **What the refinement costs, measured rather than asserted.** The
  versioning clause makes a refinement minor *and* requires it to ship
  a measured recompute-volume delta, so this one is priced instead of
  being the first exemption from its own rule. On a 103-derived grid
  fan-out (one memoised container → `visibleColumns` → 100 cell
  deriveds → one summary): a commit that moves the container across a
  pair the relation still conflates costs **0** dependent recomputes,
  and a commit that moves it across any one of the four pairs #269
  newly distinguishes costs **101**. The delta is therefore **+101
  dependent recomputes per affected commit**, up from 0, and it is
  paid only by commits whose derived container differs in exactly one
  of those four ways. The count is re-derived on every test run by
  `packages/core/test/spec-amendment-8-engine-claims-260.test.ts`,
  which fails if the figures in SPEC.md stop matching it. Own-key
  order stays permitted and stays deliberate (cross-engine parity with
  the Rust object arm). The list of survivors also grew: re-measuring
  the whole walk for the four closures turned up prototype identity,
  property attributes other than enumerability, accessors read as their
  value, and structure sharing, all of which were quotients before #269
  and none of which the first draft named.

### Breaking changes (this release)

- **`docs-site/` removed (#666, breaking).** The Vue/VitePress doc site
  (`docs-site/`) is deleted. Adopters who bookmarked `docs-site`-served
  URLs (playground, spreadsheet, rendered SPEC docs) need to update
  bookmarks:
  - `/playground` → `causl-org/playground/index.html` (same URL on
    causl.org once deployed)
  - `/spreadsheet` → `causl-org/spreadsheet/index.html`
  - `/docs/*` → the `docs/` directory in the repo root; rendered SPEC
    docs are no longer hosted by the static site package.

  `pnpm-workspace.yaml` no longer includes the `docs-site` entry, so
  `pnpm install` no longer installs Vue, Vitepress, or the Mermaid plugin.

- **A cycle behind a non-enumerable own property now refuses the commit
  (#269, breaking).** #269 put own non-enumerable string keys and own
  symbol keys inside the content-hash domain. A container that is
  reachable from itself only through such a key was previously invisible
  to the traversal and hashed cleanly; it now raises the typed
  `CyclicValueError` from `contentHashMarker`, exactly as a cycle
  through a visible key always has. A value that committed before can
  therefore abort a commit. The remedy is the same one the visible-key
  cycle has always had: break the cycle before publishing, or keep the
  self-reference out of the committed value. Gated at
  `packages/core/test/content-hash-observational-fidelity-269.test.ts`.

### Changed

- **The content hash folds an own ACCESSOR by its descriptor and never
  calls it (#269).** The hidden-key and symbol-key sections #269 added
  first read `obj[k]`, which invoked adopter getters on the commit path
  and cost the marker three properties it advertises. An `Error`'s
  `stack` is an own **non-enumerable accessor**, so the digest absorbed
  the formatted V8 stack — absolute filesystem paths, the line and
  column of the `new Error(...)` site, and the process-global mutable
  `Error.stackTraceLimit`. Two `new Error('same')` built on different
  source lines took **different** markers, an `Error`-carrying derived
  spuriously entered `changedNodes` and re-fired its whole transitive
  dependent subtree, and two processes on different machines disagreed
  about one logical value. A getter that does not memoise made
  `contentHashMarker(v) === contentHashMarker(v)` **false** for an
  unchanged `v`, which voids the `CONTENT_HASH` intern-table bound
  ("bounded by the distinct values, not the commit count") and grows the
  Rust intern table once per commit. An adopter getter that threw
  escaped `contentHashMarker` on the publish path — after the compute
  returned — as a bare host exception with none of this engine's error
  classes on it, rolling the commit back.

  Those two sections now read `Object.getOwnPropertyDescriptor`: a data
  descriptor folds its `value` (byte-identical to before), an accessor
  folds a fixed two-byte record carrying only whether a getter and a
  setter are present. The relation is a pure, total, side-effect-free
  function of the value's current state again, and the property stays
  inside the hash domain — an object with a hidden accessor is still
  separated from one without it. **Direction: refinement** in the SPEC
  §5.1 Amendment 8 sense — a hidden accessor returning `1` and a hidden
  data property holding `1` no longer reach one verdict, so more nodes
  reach `changedNodes` and never fewer. An own **enumerable** accessor
  is still invoked; that predates #269 and cannot be closed in
  `content-hash.ts` alone, because `hasTaggedTypes` / `encodeTagged`
  walk own enumerable values before the traversal starts. It is recorded
  as a named residual in the module header and gated in the same test
  file.

### Added

- **`JsonValue` tagged union in `engine-rs-core` (#1078).** The SPEC
  §16.4.1 / WASM epic #680 canonical six-arm closed enum
  (`Null` / `Bool(bool)` / `Number(f64)` / `String(SmolStr)` /
  `Array(Vec<Self>)` / `Object(BTreeMap<SmolStr, Self>)`) replaces the
  pre-#1078 `serde_json::Value` alias that PR #1076 (Sub-A) deferred
  pending the cross-backend determinism gate (#1065). `Object` uses
  `BTreeMap` so field iteration is sorted-by-key — the SPEC §15.1
  replay-determinism invariant. `String(SmolStr)` provides
  small-string optimisation (up to 23 bytes inline, no heap traffic)
  for the hot transition / commit path. Custom Serialize/Deserialize
  impls preserve the integer-vs-float wire discrimination
  (`1` round-trips as `1`, not `1.0`) and emit `null` for non-finite
  `f64` (`NaN`, `±Inf`) matching JS `JSON.stringify` rules. The
  cross-backend determinism gate at
  `packages/core/test/properties/cross-backend-determinism.property.test.ts`
  passes 5 canonical seeds × 1000 trials × 2 backends = 10 000
  trial-comparisons with **zero byte differences** before AND after
  the swap. `From<serde_json::Value>` and `From<JsonValue>` interop
  impls keep call-site migration mechanical (`.into()` on the
  existing `serde_json::json!` literals). `Action::DispatchMsg::payload`,
  `ResolutionKind::Settle::value`, and the `feature = "future"`-gated
  `ConflictResolutionRecord` / `ResourceState<T>` / `ConflictEvent` /
  `ResourceEvent` value slots all carry the new type.
- **WASM-backed engine EPIC #680 — Phase-1 closeout (#1063, closes
  #1061, #689, #680).** The keystone substrate work is in. Every
  TS-side scaffolding piece (BackendEngine interface #681, pluggable
  Bridge #691, lazy-load loader #684, cross-backend determinism gate
  #685, migration round-trip #687, bundle hygiene #689, host-tier
  matrix #690, auto-adapt heuristic #686, React typed-array hook
  #688, statechart reducers #698, formula IR #697) plus Phase-1's
  engine work (engine-rs-core types #1067 Sub-A, serde bridge
  wiring #1062 Sub-B, GC bridge wiring #1064 Sub-C, real
  `BackendEngine` loader + cross-backend gate firing #1065 Sub-D)
  ships in a single integrated stack. Sub-E closeout adds:
    1. **Full canonical-seed parity at 10 000 trials.** 5 canonical
       seeds × 1000 trials × 2 backends = 10 000 cross-backend
       determinism trial-comparisons, 0 byte differences. The new
       `Sub-E closeout` describe block in
       `packages/core/test/properties/cross-backend-determinism.property.test.ts`
       runs each canonical seed through 1000 hermetic
       (graphName-distinct) JS/WASM engine pairs and asserts
       byte-equal IR after every command. `transition_js(s, a) ==
       transition_wasm(s, a)` byte-identical on every cell.
    2. **Per-bridge size-limit cells activated.** Three new entries
       in `package.json#size-limit` gate the wasm-pkg artefacts:
       `serde-json` ≤ 200 KB raw, `gc-builtins` ≤ 110 KB raw,
       `gc-classic` ≤ 120 KB raw. 8-byte WASM-preamble stubs ship
       at `packages/core/wasm-pkg/<bridge>/engine_rs_bg.wasm` so
       the cells gate today; `pnpm wasm:build` replaces the stubs
       with real artefacts and the caps bite from that point on.
       Closes the residual scope of #689.
    3. **Phase-1 perf measurement captured.** New
       `docs/wasm/phase-1-perf.md` reports pre vs post-Phase-1
       numbers on `causl × equality-cutoff × 10000` plus the 9
       microbench cells, anchored against the Eich/Horwat panel
       projection (`~0.7 ms addressable → ~3.0× post-WASM gap`)
       with honest framing: the TS-side wave (#669 / #907 / #905 /
       #1036) closed most of the EPIC-opening 1.24 ms gap before a
       single byte of WASM shipped, the Phase-1 wrapper is
       semantic-preserving (~0% delta vs TS-only — the correct
       result), and the real perf win lands when a Rust-driven
       commit pipeline replaces the wrapper. SPEC §17 commitment
       13's 3.0×–8.0× band stays the contract; "projection held"
       on commitment 14's host-tier matrix.
    4. **Epic #680 closed.** All sub-tasks (#681, #682, #683, #684,
       #685, #686, #687, #688, #689, #690, #691, #692, #693, #694,
       #695, #696, #697, #698, #1006, #1061, #1062, #1063, #1064,
       #1065, #1067) are MERGED. The WASM-backed engine substrate
       is shipped; the next perf wave that swaps the wrapper for a
       Rust commit pipeline opens under a fresh EPIC.

- **SPEC §17 commitment 14 + WASM adoption guide (#690).** Adds the
  fourteenth SPEC §17 commitment (host-tier substrate compatibility,
  DESIGN-DISCIPLINE) and the SPEC §17.6 elaboration: a three-tier
  host-substrate matrix (`wasmgc-builtins` for Chromium 131+ /
  Firefox 130+ / Node 22.6+; `wasmgc-classic` for Safari 18.2+;
  `serde-json` universal baseline) plus a documented fall-through
  fallback to the TS engine via `WasmBackendUnavailableError`. No
  supported host is silently stranded. Adds the adopter-facing guide
  `docs/wasm-adoption-guide.md` covering preload + Subresource
  Integrity (SRI) posture, dynamic-import patterns for vendoring the
  WASM artefacts from a self-hosted CDN, the five structured `code`
  values on `WasmBackendUnavailableError`, and short-circuit paths
  for SSR / `backend: 'js'` callers. Cross-links the new commitment
  from §17.5's closing-paragraph forecast and appends the row to the
  SPEC §19 amendment trail. Documentation only — no behavioural
  change; the loader skeleton from PR #1031 already implements the
  contract §17.6 names.

- **React playground (`causl-org/playground/`) (#666).** Ports the
  Vue/Monaco REPL to a React 19 `createRoot` app embedded in a static
  HTML page under `causl-org/`. Loads Monaco `0.52.2` and `@causl/core`
  from CDN at runtime — no build step. The SPEC §10 worked example is
  pre-loaded; supports run, reset, and a console shim that captures
  `console.log` / `error` / `warn` to the output pane.

- **React spreadsheet demo (`causl-org/spreadsheet/`) (#666).** Ports
  the Vue §16 Phase 3 100-cell diamond demo to React 19. Loads
  `@causl/core`, `@causl/formula`, and `@causl/devtools` from esm.sh.
  Columns A–D with 10 rows plus E1 summary; editable column A inputs;
  live `replaceMany` formula editing; `whyUpdated` introspection; commit
  log (most recent 20 entries). Exposes `window.demo` for console
  experimentation, matching the original Vue version.

## [0.6.0] - 2026-08-10

An error-taxonomy release (causl/causl-wasm-ts#498). Minor per the rule
above: it adds a public export and moves a throw identity an adopter can
branch on, and after 1.0 the identity move would be MAJOR, so the entry
carries a migration section.

Closures stay in the adopter-facing value domain exactly as **SPEC §5.1
Amendment 8** decided at 0.4.0. Nothing in this release touches the
value domain or the cutoff relation; every change below is about which
error class a misuse raises.

### Added

- **`InvalidNodeHandleError`** (`kind: 'InvalidNodeHandle'`, fields
  `derivedId` and `received`), raised when a derived's `compute(get)`
  calls `get` with a value that is not a live node handle. The commonest
  producer is a self-referential registration: the handle for the node
  being registered does not exist until `derived()` returns, so a
  compute closing over its own binding reads `undefined` during the
  eager first evaluation. Every compute-facing accessor now vets its
  argument before the `.id` dereference: the registration drivers, the
  SPEC 15.1 verify accessors, the bridged Phase-D recompute accessors,
  and both `readAt` definitional-recompute accessors. The primitive echo
  in the error message is capped at 40 characters, so a mistaken
  two-megabyte string argument does not become a two-megabyte log line.

### Changed

- **Throw identity for non-node `get` arguments (would be MAJOR after
  1.0).** Before this release, `get(undefined)` and `get(null)` escaped
  as a raw host `TypeError` wrapped in a generic `DerivedComputeError`,
  and every other non-node argument (a plain object, a bare id string,
  a number, an object with a non-string `id`) surfaced as
  `UnknownNodeError` for whatever its stray `.id` property held. All of
  these now raise `InvalidNodeHandleError`.

  Migration:

  1. Code branching on `kind === 'DerivedCompute'` to detect the
     self-referential-registration `TypeError` (a workaround, since the
     wrapper also covers genuine compute bugs) branches on
     `kind === 'InvalidNodeHandle'` instead.
  2. Code branching on `kind === 'UnknownNode'` around `derived()` or
     `commit()` to catch a malformed handle (as opposed to a genuinely
     unregistered id read through a real handle) branches on
     `kind === 'InvalidNodeHandle'` instead. Reads of a real handle
     whose id is unregistered still raise `UnknownNodeError`.
- **`readAt` definitional recomputes join the normalisation contract.**
  A compute body's own throw during a `readAt(derived, t)` recompute
  (the path for a node the retention window holds no row for) now wraps
  as `DerivedComputeError` carrying the original as `cause`, as it
  already did on the registration and Phase-D seams. Previously the raw
  host error escaped `readAt` untyped.

## [0.5.0] - 2026-08-04

**The TypeScript engine stops being reachable.** `createCausl()` returns the
Rust/WASM engine or it throws; the two documented options that pinned the
pure-TypeScript floor — `engine: 'js-ssot'` and `backend: 'js'` — no longer
exist, and neither does the §18A.13.1 capability fallback that silently
substituted the floor on a host where WasmGC could not instantiate. This is a
breaking release on a `0.x` line, which the Versioning policy above says ships
as a minor with its own entry and a numbered migration section. It has both.

**Why now, and what it was like before.** Measured on
`causl/causl-wasm-ts#273`: a `createCausl()` with no `preloadCauslWasm()`
constructed a working graph, on the TS floor, with **zero** `console.warn`,
zero telemetry markers and zero `CauslCapabilityFallbackEvent`s. It was the
only route to the floor with no signal at all, and it was also the route most
likely to be reached by accident — a project whose tests omit the preload and
whose production preloads had the two disagree, with the *tests* on the wrong
engine. 0.4.0 made that path warn. 0.5.0 makes it throw.

**Does anything about the value domain change? No — but read the next
subsection before you conclude your subscriber counts cannot move.** Closures
stay in the adopter-facing value domain exactly as **SPEC §5.1 Amendment 8**
decided at 0.4.0, and no quotient is added or removed here. The *definition*
of the cutoff relation (§5.1 Amendment 7) is untouched by this release. What
moves in 0.5.0 is *which engine runs your graph* — and the two shipped engines
do not implement that definition identically, so "the definition is unchanged"
is **not** the same claim as "nothing you observe changes". Two places where
they meet are worth stating.

The first was already known: `causl/causl-wasm-ts#272` established that the
floor and `rust-ssot` **disagree** on in-place mutation of a committed value, a
§18A.1.1 MUST-be-identical surface. That divergence is why the floor is being
withdrawn rather than kept as a safety net — a fallback engine that answers
differently from the primary is worse than no fallback. The floor half of it
is owned by `causl/causl-core-ts#58`, which stays open; this release does not
fix the divergence, it removes the way an adopter of *this* package reached
the wrong side of it by accident.

### Fixed after disclosure — `rust-ssot` no longer fires a subscriber with an unchanged value after a dependency flip

An earlier draft of this entry disclosed this as a defect shipping with the
release, and the section said *"if the engine half lands before this version is
published, this subsection is the note that says so."* It landed. This is that
note.

**SPEC §5.1 Amendment 7** is normative: *a derived node counts as changed in
Phase D **iff** its recomputed value differs from its previous value under the
canonical value-equality relation.* The `rust-ssot` engine did not satisfy that
"iff" after a derivation rewired its dependency set. The floor did — and 0.5.0
removes the floor, so an adopter coming off it would have met this for the first
time on upgrade. That is why it was disclosed rather than deferred.

```ts
const flag = g.input('flag', 0), a = g.input('a', 1), b = g.input('b', 2)
const d = g.derived('d', (get) => (get(flag) === 0 ? get(a) : get(b)))
g.read(d)
g.subscribe(d, (v) => seen.push(v))
g.commit('flip', (tx) => tx.set(flag, 1)); g.read(d)
g.commit('bump-unread-a', (tx) => tx.set(a, 101)); g.read(d)
```

Measured on the artefact this release vendors, both engines, all four
observables:

| | `seen` | `changedNodes` | `dependencies(d)` | `dependents(a)` |
|---|---|---|---|---|
| **before** (engine) | `[1, 2, 2]` | `["a", "d"]` | `["b","flag"]` | `[]` |
| **after** (engine) | `[1, 2]` | `["a"]` | `["b","flag"]` | `[]` |
| **after** (floor) | `[1, 2]` | `["a"]` | `["b","flag"]` | `[]` |

The third fire is gone and `d` no longer enters the commit's changed set, so
nothing reading `Commit.changedNodes` — devtools, persistence, sync — inherits a
false positive any more.

**What it was.** Two bugs in `Cmd::RegisterDerived`, the only dep-set carrier on
the cmd wire, so a client-side dynamic-dep flip arrives there as a fresh record
over the same `(slot, gen)`. It registered the new dep set but never retired the
edges it replaced, so the structural facade moved while the map the scheduler
walks kept the stale edge — that is why writing `a` reached `d` at all, while
`dependents(a)` correctly reported `[]`. And it reseeded the cell's
`last_value`/`computed`, so the first publish after a rewire compared against
nothing and reported the node changed however little moved. Fixed upstream in
[`causl/causl-core-rs#217`](https://git.opsite.ca/causl/causl-core-rs/issues/217)
(PR #348, `ccacc049`).

**Wire format.** The fix needed a carrier for a value-neutral row that still has
a dep delta, so `WIRE_VERSION` moved 1 → 2 with a new tag-11
`DerivedDepsFlipped`. Payload byte-identical to tag-6; the delta reaches the
decoder without the row conferring changed-ness. This release vendors the
rebuilt artefact and decodes the new tag, so it is a coordinated pair — an older
decoder against this engine would keep a stale dep mirror, which the version
bump makes loud rather than silent.

**Not the same defect** as §5.1 Amendment 7's disclosed container-cutoff
non-conformance, which runs the other way (the *floor* over-notifies on
containers) and belongs to `causl/causl-core-ts#58`. That one is unchanged.

## Breaking changes

Every row is removed from the published type surface, not merely made inert.
`tsc` names each affected call site.

| removed | published via | what to do instead |
|---|---|---|
| `CreateCauslOptions.engine` (`'js-ssot' \| 'rust-ssot'`) | main barrel | Drop it. `rust-ssot` is the only engine; `preloadCauslWasm()` once at init is how you get it. There is no replacement for `'js-ssot'` — see migration step 3. |
| `CreateCauslOptions.backend` (`'js' \| 'auto'`) | main barrel | Drop it. It was already silently ignored: the only read of `options.backend` anywhere in `src/` was the `'auto'` deprecation warning, and `backend: 'js'` returned a **wasm** graph whenever a module was preloaded — the documented opposite. |
| `WasmEngineMode` | `/wasm` subpath | Nothing to replace. Every construct is `rust-ssot`. |
| `DEFAULT_WASM_ENGINE_MODE` | `/wasm` subpath | Nothing to replace. Read `causlEngineOf(graph).mode` if you need to report what ran. |
| `resolveWasmEngineMode` | `/wasm` subpath | Nothing to replace. Its fail-closed `RangeError` on an unrecognised `engine` value went with the option it validated. |
| `WasmBackendOptions.engine` | `/wasm` subpath | Drop it. |
| `AuthoritativeWasmOptions.fallbackToTs` | `/wasm` subpath | Nothing to replace. `catch` the `WasmEngineUnavailableError` and decide what your application should do on a host that cannot run the engine. |
| `AuthoritativeWasmOptions.fallbackToJs` (fork-compat alias) | `/wasm` subpath | As above. |
| `createCausl()` returning a TS-floor graph | main barrel | It throws. See **The failure contract**. |
| `InvalidInjectedBackendError` | main barrel | Nothing to replace, and nothing to change: no code path in any published version of this package could throw it after the seam it guarded went. Delete the `catch` arm or the `instanceof` test if you wrote one. See migration step 10. |
| `activateAutoMigrationBackend` | `/wasm` subpath | `loadWasmBackend()`, which this function forwarded to with no behaviour of its own. See migration step 11. |

One row is a **type widening** rather than a removal, but it breaks call
sites the same way and `tsc` names them the same way, so it belongs here:

| widened | published via | what to do instead |
|---|---|---|
| `CauslWasmNotPreloadedError.bridge`: `BridgeId` → `BridgeId \| undefined` | `/wasm` subpath | The `'<none-preloaded>'` sentinel is gone (see **The most-read error in the release printed a remedy that rejects**, below), and `undefined` is the honest value on the common row — nothing preloaded, no bridge pinned. This breaks the recovery the error's own message teaches: under `exactOptionalPropertyTypes` (this repo's own setting), `preloadCauslWasm({ bridge: err.bridge })` is now `TS2379`, because `PreloadOptions.bridge` is `bridge?: BridgeId` and does not admit `undefined`. Branch instead: `err.bridge === undefined ? preloadCauslWasm() : preloadCauslWasm({ bridge: err.bridge })`. The no-argument form is the correct remedy on that row anyway — it runs `detectBridge()` for you. |

Deprecated, still exported, and **never firing** — deleted in `0.6.0`:

| kept | why it is not deleted here | what to do instead |
|---|---|---|
| `onCauslCapabilityFallback` | Deleting the hook in the same release that starts throwing would hand an adopter who registered a listener and no `catch` a build error on top of a behaviour change. It stays registerable and is never invoked. | `catch` the throw from `createCausl()` and branch on `error.code`, which carries every distinction the event used to. `isCauslEngineUnavailable` narrows it, and both it and `CauslEngineErrorCode` are exported from the main barrel as of this release. Migration step 7 is the worked form. |
| `CauslCapabilityFallbackEvent`, `CauslTsFallbackReason` | The types the hook's callback names. | `CauslEngineErrorCode`, the `code` union on the thrown error, also on the main barrel. |
| `CauslEngineMode`'s `'js-ssot'` member | No graph reports it any more. The member stays declared so an adopter's exhaustive `switch` over the union keeps compiling. | Branch on `'ts-floor'`, per migration step 6. That is the only mode still reported for a `Graph` this subpath did not build. |
| `CauslTsFloorReason`'s `'wasm-fallback'` member | Same: its only producer was the `fallbackToTs` soft path. | `'unattributed'`, which is now the only value anything produces (`packages/core/wasm/index.ts:3554` is the sole `tsFloorReason:` producer in the tree). |
| `CreateCauslOptions.adaptThresholds` | Inert. Its only trigger was `backend: 'auto'`. Kept beside `AdaptThresholds` / `shouldMigrate` / `DEFAULT_THRESHOLDS`, which remain exported. | Nothing replaces it. Drop the option. |

Those five rows and the **first nine** removals above cover every export EPIC
[`causl/causl-wasm-ts#275`](https://git.opsite.ca/causl/causl-wasm-ts/issues/275)
§2b names, and each row now carries its replacement. The last two removals are
not from §2b: they are orphans the campaign created and did not collect, and
the subsection below is their entry. Two of the EPIC's
descriptions do not match what shipped, and I record the difference here rather
than leaving a reader to reconcile the two:

- §2b's fate column says `onCauslCapabilityFallback` is **removed**. It is not.
  [`#280`](https://git.opsite.ca/causl/causl-wasm-ts/issues/280) decided
  keep-registered-never-firing at the flip with deletion at `0.6.0`, and that is
  what the code does: `packages/core/src/wasm-registry.ts:266` still exports the
  hook, tagged `@deprecated Since 0.5.0`. The EPIC's §3.3 records the same
  decision and defers to #280; its §2b table was never amended to match.
- `WasmEngineMode` left the **published** surface, not the source.
  `packages/core/wasm/index.ts:378` still declares it, narrowed to
  `type WasmEngineMode = 'rust-ssot'`, and it is absent from the export list of
  the built `dist/wasm.d.ts`. Nothing an adopter can name changed; the note is
  for whoever greps the source and wonders whether the removal landed.

### Two orphans the campaign left standing, collected here (#404)

`InvalidInjectedBackendError` was retained on purpose and by a stated argument.
[`#279`](https://git.opsite.ca/causl/causl-wasm-ts/issues/279) item 4 says
leaving the class exported is what kept its deletion non-breaking, because
dropping it would move the tsup exported-name set, and it handed the removal to
W5. W5 is
[`#280`](https://git.opsite.ca/causl/causl-wasm-ts/issues/280), which closed
with the class still exported, so
[`#404`](https://git.opsite.ca/causl/causl-wasm-ts/issues/404) inherited a
removal with no owner.

The premise the retention rested on is spent, and the way to see that is to
measure against the artefact an adopter can install rather than against
unpublished `main`. The private registry holds `0.3.6` and `0.3.7` and nothing
later, so `0.3.7` is the only baseline in existence. Diffed name for name
through the TypeScript checker, over the built declaration of each declared
subpath:

```text
dist/index.d.ts   0.3.7  94  ->  105    removed: (none)
dist/wasm.d.ts    0.3.7  50  ->   58    removed: DEFAULT_WASM_ENGINE_MODE,
                                                 WasmEngineMode,
                                                 resolveWasmEngineMode
```

Three names have already left the `/wasm` subpath since the last thing anybody
can `npm install`, so the next publish is a breaking export-set change whichever
way this class goes. Retaining it bought an adopter nothing and cost them a
`catch` arm that can never run: after #279 slice S12 unit U7 deleted
`assertValidInjectedBackend` with the `src/injected-backend.ts` seam it
validated, the engine became a required constructor parameter whose one
in-package call site refuses an absent engine ahead of the call with its own
`WasmEngineUnavailableError`. Zero throw sites, and no test that could reach
one.

`activateAutoMigrationBackend` is the same shape, and I found it by measuring
rather than by reading the inventory. It is a `/wasm` re-export with no
behaviour of its own: it forwards to `loadWasmBackend` and exists only so the
auto-adapt wrapper could reach the loader without naming `loadWasmBackend` in a
consumer's main bundle chunk (SPEC §14.2). Its one caller was
`packages/core/src/auto-adapt-wrapper.ts`, which this release deletes along with
the `backend: 'auto'` option that drove it. No call site survives anywhere in
the repository, the test suite included, so the indirection guards a bundle
nothing names.

Those two are the whole of it, and that is measured rather than assumed. Every
error class on the main barrel and the `/wasm` subpath has at least one live
construct site except `CauslError`, which is the abstract `instanceof` root and
is thrown by nothing by design; every other exported runtime value has at least
one in-package caller or one test that reaches it.

**Dropped host tier.** Hosts on which the WasmGC engine cannot instantiate —
Safari &lt; 18 / macOS &lt; 15, policy-pinned pre-119 Chromium/WebView2, Node
&le; 20 — now hard-fail at `createCausl()`. This is a decided cost, not an
oversight (EPIC `causl/causl-wasm-ts#275` §5). One caveat, stated plainly
because the release note is where an adopter will look for it:
`DISTRIBUTION.md` records that the runtime WasmGC capability **probe is still a
placeholder** (`detectBridge()` returns the `wasmgc-classic` baseline
unconditionally), so the WasmGC-unavailable row of the contract below is
**specified, not observed**. What you will actually meet on such a host is the
instantiate failure surfacing through the same class and the same `code`.

> **Correction (2026-08-09, causl/causl-wasm-ts#426).** The tier list above
> was this release's hypothesis and two of its three rows understate the
> floor. The floor is now declared once, on `WASM_HOST_FLOOR` in
> `packages/core/src/wasm-registry.ts`, with its measured basis (the shipped
> artefact requires typed function references, so Safari 18.0-18.1 and Node
> 21 also refuse, and the macOS pairing carried no information), and
> `detectBridge()` is no longer the placeholder this paragraph describes: it
> probes, and refuses below-floor hosts with the floor named. The paragraph
> above is kept as the dated record of what 0.5.0 said.

## The failure contract

`createCausl()` is **synchronous** and throws **during construction, before any
`Graph` is returned** — there is no partially-built graph, no async window, and
no later lifecycle point at which the failure surfaces. Four cases:

| condition | class | `code` |
|---|---|---|
| `@causl/causl-wasm-ts/wasm` never imported in this process | `WasmEngineUnavailableError` (main-bundle twin, `src/wasm-registry.ts`) | `CAUSL_WASM_ENGINE_UNAVAILABLE` |
| subpath imported, `preloadCauslWasm()` never resolved | `CauslWasmNotPreloadedError` (`/wasm` subpath) | `CAUSL_WASM_NOT_PRELOADED` |
| subpath imported and preloaded, WasmGC cannot instantiate | `WasmEngineUnavailableError` (`/wasm` subpath) | `CAUSL_WASM_ENGINE_UNAVAILABLE` |
| the options bag still carries `engine`, `backend`, `fallbackToTs` or `fallbackToJs` | `RemovedEngineOptionError` (main barrel) | `CAUSL_REMOVED_ENGINE_OPTION` |

The first three name `preloadCauslWasm()` in the message; the fourth names
every removed key it found on the bag.

Row 4 is the **one throw this release adds**, and it is the one an upgrade
meets first. It is not a host failure — it means a `0.4.x` options bag
survived the upgrade — and it fires on the *key*, not the value, so
`{ engine: undefined }` (what spreading an old config produces) throws too.
The same check guards `loadAuthoritativeWasm()` and `loadWasmBackend()`.
Deleting the key is always the fix; see migration step 5.

**Branch on `error.code`, never on `instanceof`.** Rows 1 and 3 deliberately
share a `code`: from the main bundle's position "the subpath was never
imported" and "this host cannot run the engine" are indistinguishable — the
module that owns the bridge registry was never loaded, so there is nothing to
interrogate — and `CAUSL_WASM_ENGINE_UNAVAILABLE` is already the documented
stable discriminant for that family. The remedy difference is carried in the
**message**. Row 1 is thrown by a leak-free twin class in the main bundle,
which *cannot* extend the `/wasm` class: `createCausl` lives in
`dist/index.js`, which must not name a `@causl/causl-wasm-ts/wasm` symbol
(the bundle-no-wasm-leak gate). So `err instanceof WasmEngineUnavailableError`
imported from `/wasm` is **false** for row 1 and true for row 3. One
`switch (err.code)` covers all three.

No new error class was minted, and no second declaration of
`CAUSL_WASM_NOT_PRELOADED` exists: two classes carrying one `code` would break
`instanceof` for everyone already catching the first.

**Both twins now sit on the tagged-identity root.** `WasmEngineUnavailableError`
extends `CauslError` on the `/wasm` side as well as in the main bundle, where it
used to extend a plain `Error`. The handler this package's own docs teach,
`catch (e) { if (e instanceof CauslError) render(e); else throw e }`, therefore
handled the not-preloaded row and *rethrew* on the never-imported one. The two
classes stay distinct, because the main bundle must not name a
`@causl/causl-wasm-ts/wasm` symbol: sharing a root is not sharing an identity,
and `err.code` is still the discriminant that spans the seam.

```ts
import { preloadCauslWasm } from '@causl/causl-wasm-ts/wasm'
import { createCausl, isCauslEngineUnavailable } from '@causl/causl-wasm-ts'

await preloadCauslWasm()          // ONCE, at app init

try {
  const graph = createCausl()     // synchronous forever after
} catch (err) {
  if (!isCauslEngineUnavailable(err)) throw err
  // Narrowed: `err.code` is the `CauslEngineErrorCode` union, not `string`,
  // and no cast was needed to get here. Both are exported from the main
  // barrel as of this release.
  switch (err.code) {
    case 'CAUSL_WASM_NOT_PRELOADED':      // fix the boot ordering
    case 'CAUSL_WASM_ENGINE_UNAVAILABLE': // import the subpath, or the host cannot run it
      report(err)
      break
  }
}
```

The guard is the migration's spelling, and it is new here. `tsconfig`'s
`useUnknownInCatchVariables` makes `err` an `unknown`, and until this release
nothing in the main barrel named this error family — not the class, not the
`code` literals, not a guard — so the only way to branch was
`(err as { code?: string }).code`, an unchecked cast against an unexported
string. That is what this example used to print. `instanceof` cannot replace it
either: row 1 is raised by the main bundle, row 3 by the subpath, and they are
necessarily different classes because the main bundle must never name a
`@causl/causl-wasm-ts/wasm` symbol. The guard reads the `code`, so it spans the
seam that `instanceof` cannot.

### Fixed before release — what the adversarial review turned up

Five reviewers read this release cold, and what they found was concentrated in
the surfaces a green suite does not exercise: shipped prose, and the error path
nothing constructs. All of the below is fixed in the release it describes.

**The removed engine options were removed from the TYPE only.** `engine`,
`backend`, `fallbackToTs` and `fallbackToJs` were deleted from
`CreateCauslOptions` and `AuthoritativeWasmOptions` and still ACCEPTED at
runtime, returning a working `rust-ssot` graph with no warning and no throw.
Excess-property checking was the only thing that ever refused them, and it
fires exclusively on an object literal written straight into the call — a
variable, a bag typed `CreateCauslOptions`, a config parsed from JSON, a spread
of a `0.4.x` options object, an `as any`, or any JavaScript caller sailed
through. So the compile-time removal covered the callers least likely to have
pinned an engine and missed the ones who did it on purpose: the silent engine
swap this release exists to abolish, one option name over. They now throw
`RemovedEngineOptionError` (`code: 'CAUSL_REMOVED_ENGINE_OPTION'`) naming every
removed key on the bag. `{ engine: undefined }` throws too — that is what a
spread of a `0.4.x` config produces, and the KEY is what died. And
`engine: 'nonsense'` is refused again: `0.5.0` had regressed BELOW `0.4.x`
here, because the `RangeError` that validated the value was deleted along with
the option it validated.

**The most-read error in the release printed a remedy that rejects.** On the
common row — nothing preloaded, no bridge pinned — `CauslWasmNotPreloadedError`
substituted a `'<none-preloaded>'` sentinel into its own copy-paste line, so
adopters were handed `await preloadCauslWasm({ bridge: '<none-preloaded>' })`.
Running it fails with a DIFFERENT error pointing at
`/wasm/pkg/%3Cnone-preloaded%3E/…`, sending the reader into artefact-vendoring
when the correct fix was a bare `await preloadCauslWasm()`. The sentinel is
gone; `error.bridge` is now `undefined` on that row, which is the honest shape,
and the remedy is the no-argument form that runs `detectBridge()` for you.

**One error message contradicted itself in three paragraphs.** The base
`WasmEngineUnavailableError` header said the engine was *"explicitly
requested"* and that a TS fallback was being *"refused"* — both `0.4.x`-era,
both falsified by this release, and the same message's trailer said outright
that there is no fallback as of `0.5.0`. An adopter reading paragraph 1 went
looking for the flag that turns the refusal off. The header no longer claims
either. The *"the artefact was not resolvable or not instantiable on THIS
host"* paragraph is now conditional and the not-preloaded row opts out of it:
on that row nothing has been asked of the artefact and it is very probably
fine. And the instantiate arm no longer opens `createCauslWasmSync():` — the
registry's re-label repairs only the not-preloaded subclass, so a bare
`createCausl()` caller was reading the name of a factory they never called.

**`isCauslWasmPreloaded()` is `true` on a host where `createCausl()` throws.**
That pairing is deliberate and the rationale comment explaining it was stale —
it still described the capability degrade that `#280` deleted. The sentinel
resolves so the failure lands at the construct site naming the host, instead of
routing the caller down the not-preloaded branch and telling someone whose host
cannot run WasmGC to `await preloadCauslWasm()`, which they already did. The
predicate answers *"has a preload resolved for this bridge"*, which is exactly
true; it is not, and never was, a prediction that construction will succeed.

**A per-call `batchedFlush` was dropped by both synchronous factories** while
the async `createCauslWasm()` honoured it. Before `#280` the sync path
re-threaded it under `createOpts.engine !== undefined`; removing the `engine`
option removed the one arm that did. Nothing caught it because the neighbouring
per-call option `commitHistoryCap` kept working, and because no observable
behaviour depends on the window — `rust-ssot` crosses the wire per commit and
never consults it. Threaded back on the retention caps' terms: per-call wins,
omitted inherits the preload's baked window. This changes no engine behaviour;
it removes an option that was accepted and ignored, which is the same defect as
the first item above in a quieter register.

**Four shipped READMEs taught a removed option.** `packages/core/README.md`,
`packages/react/README.md`, `packages/core/wasm/README.md` and
`packages/core/wasm-pkg/README.md` (all four are in a published `files` array)
offered `{ fallbackToTs: true }` as the remedy for a failure this release makes
permanent, and named `JsFallbackBackend`, a module `#280` deleted. Worse, the
core Quick Start threw on line 3 as shipped: it called a bare `createCausl()`
with no preload. Every snippet in all four was executed and fixed.

### The `wasmgc-builtins` bridge is retired, and asking for it now throws

`preloadCauslWasm({ bridge })`, `loadWasmBackend({ bridge })` and the exported
`wasmUrlFor(bridge, base)` **throw** `WasmEngineUnavailableError`
(`CAUSL_WASM_ENGINE_UNAVAILABLE`) for `'wasmgc-builtins'`, and for the two
other spellings that named the same bytes, `'gc-builtins'` and
`'gc-builtins-bundler'`. There is no type change: `BridgeId` no longer
advertises the id, but it stays assignable, so this is a **runtime** behaviour
change on an argument these three entry points previously accepted. If you pin
a bridge, check which one; omitting `{ bridge }` picks the shipped
`wasmgc-classic` and is unaffected.

The reason is measured rather than editorial.
[`causl/causl-core-rs#210`](https://git.opsite.ca/causl/causl-core-rs/issues/210)
found the shipped gc-builtins binary declaring its `wasm:js-string` imports
`i32`-typed, `length : (i32) -> i32`, `intoCharCodeArray : (i32, i32, i32) ->
i32`, where the W3C js-string builtins are externref-typed. An i32-typed
import can never type-match a builtin, so `WebAssembly.compile(bytes, {
builtins: ['js-string'] })` refuses the artefact on **every** host, and always
did. Rebuilding does not help: the wasm-bindgen externref transform rewrites
only wasm-bindgen's own descriptor-driven ABI and never a hand-written
`#[link(wasm_import_module = "wasm:js-string")]` block, so every build of those
sources ships the imports i32-typed by construction. The engine repository
dropped the bridge from its build matrix on that finding;
[`causl/causl-core-rs#355`](https://git.opsite.ca/causl/causl-core-rs/issues/355)
removed the vendored tree, the build row and the artefact-path mapping from
this package.

It **throws** rather than 404s because the two are not the same diagnosis. The
previous behaviour resolved a well-formed URL for a tree that is not built, not
vendored and not servable, so the adopter was handed a missing-file miss and a
CDN to go and inspect, a deployment problem they could not fix, because there
is nothing to serve. The refusal names the measurement, both issues, and the
bridge that works. It also names
[`causl/causl-core-rs#358`](https://git.opsite.ca/causl/causl-core-rs/issues/358),
the ABI retype that would make the tier loadable again: a refusal that only
says no tells its reader the door is shut and nothing about who can open it.
An id this loader has never heard of still resolves by mirroring its segment,
forward compatibility is not the same case as a bridge that was measured and
withdrawn.

### Retention at the default cap answers `evicted` instead of serving a live value as history

At the default `commitHistoryCap` of 0, `readAt` and `snapshotAt` now answer
`evicted` for every node at every GraphTime, instead of serving a value off a
frozen genesis row (`causl/causl-wasm-ts#279`, slice S12 unit U4b). This changes
behaviour on the configuration an adopter gets by writing nothing, so it needs
reading even though no type moved and no error is thrown.

**SPEC §5.1 Phase F.6** runs iff `commitHistoryCap > 0` and states that with cap
0 the retention chain is dead state; **SPEC §5.1 Amendment 2** makes 0 the
default and says adopters using `readAt` / `snapshotAt` must explicitly opt in.
A graph that opted into nothing therefore has no retained row at any GraphTime,
and `evicted` is the only admissible discriminant. The engine's retention chain
has always answered exactly that. This package was not asking it, and was
answering from a TypeScript ring instead.

Measured on `a` with `dbl = a * 2` over two commits, at every `t` including one
tick past `now`:

| surface | before | after |
| --- | --- | --- |
| `readAt(input, t)` | `evicted { oldestRetainedTime: 0 }` | `evicted { oldestRetainedTime: now }` |
| `readAt(derived, t)` | `retained { value: 40, time: 0 }` | `evicted { oldestRetainedTime: now }` |
| `snapshotAt(t)` | `retained { time: 0, inputs: {} }` | `evicted { oldestRetainedTime: now }` |

The middle row is the one to act on. `40` was the derived's CURRENT value,
returned for every `t`, with a `time: 0` stamp on it: a live cell read through a
dead chain and presented as history, and an adopter branching on `status ===
'retained'` had no way to tell. Setting `snapshotRetentionCap` without
`commitHistoryCap` changed which fabrication you got rather than fixing it: at
`{ commitHistoryCap: 0, snapshotRetentionCap: 5 }` the same reads returned every
node's REGISTRATION value, and `snapshotAt(now)` handed back the graph as it
stood before the first commit.

Retention at `{ commitHistoryCap: > 0, snapshotRetentionCap: 0 }` is
deliberately unchanged and still answers from this package's own ring; that
asymmetric pair carries a separately measured engine divergence which this
release does not move.

### `createCauslWasm` reads the retention caps from `create: {}` as well

`createCauslWasm({ create: { commitHistoryCap: 1000, snapshotRetentionCap: 1000 } })`
now builds a graph with retention. It used to build a graph with none, and say
nothing about it (`causl/causl-wasm-ts#411`).

`createCauslWasm` is the only factory with two options bags: a loader bag at the
top level, and `create: CreateCauslOptions` inside it. Both bags declare the two
caps and only the top-level one was read. The per-graph window resolved from the
loader bag with `create` already destructured away, and the construct then
stripped the raw cap fields off `create` and rewrote them from that window, so a
cap written only in `create` was first unread and then erased, on both halves of
the graph at once. Measured on `wasmgc-classic`, four commits on one input:

| constructed with | before | after |
| --- | --- | --- |
| `{ …caps }` | log 4 rows, `readAt(a, 1)` `retained { 2, time 1 }` | unchanged |
| `{ create: { …caps } }` | log 0 rows, `readAt(a, 1)` `evicted` | log 4 rows, `readAt(a, 1)` `retained { 2, time 1 }` |

That second reading is byte-identical to passing no caps at all, which is what
makes it worse after the cap-0 change above rather than merely untidy: a reader
who has just been told to pass `commitHistoryCap`, and who passes it in the
options bag they were already holding, gets `evicted` on every historical read
and reads that as "retention is broken" rather than as "the option did not
take".

I made the option work rather than refusing it. `CreateCauslOptions` is the
declared type of the `create` parameter and it declares both caps;
`createCauslWasmSync(handle, { …caps })` and `createCausl({ …caps })` have
always read them from exactly that bag. Refusing here would have made one option
answer three ways across three doors onto one engine. When both bags name a cap,
`create` wins per field and a field it omits inherits the loader bag's value,
which is the rule `batchedFlush` already follows across the same two bags. The
TSDoc on both caps now lists every accepted shape, so the rule is on hover
rather than in a release note.

Two test helpers were hiding this, and both are fixed. The `#252` retention
helper wrote the caps at BOTH sites in every cell, and the cross-engine
live-capture helper spread its scenario's construction options into both bags
as well, so in each case the top-level copy answered for the inner one and no
cell could observe the single-site case. Each now passes them once, to `create`.
With the helpers fixed and the fix reverted, 11 cells in the retention file go
red instead of none, including the four captured cap-parameterised sweeps that
were comparing two engines while unable to see the option under test.

### Bundle size — a measured before/after pair, not a claim

Deleting an engine that shipped in the main bundle makes it smaller, and for
most of this line's history the repository had no way to say by how much:
`packages/core/bench/baseline.json` held `null` in every cell — "NOT
MEASURED", not "measured, no regression" — and the only thing gating it was
the `bench-gate.yml` sitting under `ci/parked/`. That is no
longer the shipping state: all **six** cells now carry captured numbers with
their provenance (commit, source digest, runtime) and a recorded
quiescence gate (`(load1 - 1) / cores <= 0.2`, checked before *and* after each
run, samples discarded unwritten if either reading fails), and
`bench/baseline.test.ts` + `bench/baseline-captured.test.ts` gate them from
the ordinary suite. `causl/causl-wasm-ts#282` records the bundle drop as a
captured pair instead — `tools/size-budget/runs/{before,after}.json`, with
`DELTA.md` regenerated from them by `pnpm size:capture --delta`.

| cell | before (`664db77`) | after | delta | cap |
|---|---:|---:|---:|---:|
| `@causl/causl-wasm-ts (full import)` | 20.49 kB | **19.56 kB** | −0.93 kB (−4.5%) | 30 KB |
| `@causl/causl-wasm-ts (createCausl-only)` | 18.52 kB | **17.6 kB** | −0.93 kB (−5.0%) | 26 KB |
| `@causl/causl-wasm-ts/wasm` | 21.04 kB | **20.57 kB** | −0.47 kB (−2.2%) | 32 KB |
| `wasm bridge — gc-builtins (raw)` | 727.5 kB | 727.5 kB | ±0 — control held | 756 KiB |
| `wasm bridge — gc-classic (raw)` | 725.25 kB | 725.25 kB | ±0 — control held | 756 KiB |

`before` is `664db77`, the last commit at which `engine: 'js-ssot'`,
`backend: 'js'` and `fallbackToTs` still exist. The two raw `.wasm` cells are a
CONTROL, not a measurement: they gate a Rust artefact that deleting TypeScript
cannot move, and both runs record its sha256 so a mismatch reads as a re-vendor
rather than as engine attribution. Both held, on identical digests.

**No ceiling moves here.** The caps are the 2026-08-03 SPEC §14.2.1
written-consensus band (`causl/causl-wasm-ts#352`); lowering one to spend this
drop is a fresh written-consensus decision, not a side effect of a release that
happened to shrink the bundle.

### The gate that keeps the engine unreachable

`packages/core/test/ts-engine-surface-gate-282.test.ts` runs on every `main` PR
(`test:gates`, after `build`) and asserts the property this release is about:
**an adopter has no way to ask for the TypeScript engine.** It is taken over the
BUILT artefacts the four subpaths in `packages/core/package.json` resolve to,
with the TypeScript type checker rather than a text pattern.

The distinction matters because `CauslEngineIdentity.engine` is still exported,
still called `engine`, and is not a selector — it REPORTS which engine ran your
graph. A gate matching the member name would fire on it. This one walks the
parameter graph of every exported callable and asks what is reachable on the way
**in**, so a report is not a finding and a re-added option is, at any depth and
through any subpath.

Three declarations still name `'js-ssot'` on the reachable surface —
`CauslCapabilityFallbackEvent.fallbackEngine`, `CauslEngineMode`'s member, and
the `mode: 'js-ssot'` arm of `CauslEngineIdentity`. All three are inert, all
three are on the way out, and the gate pins them with the reason each is held.
That pinned list is `0.6.0`'s work order, and it fails in **both** directions: a
fourth is a selector coming back, a missing one is a union member deleted inside
its own deprecation window.

## Migration

1. **Add `await preloadCauslWasm()` once at app init, before the first
   `createCausl()`. Required for everyone, and with the engine fix below it is
   now the whole upgrade for most adopters — the disclosed fire-count change is
   gone, so nothing changes at runtime when no line of yours does.** Import it
   from `@causl/causl-wasm-ts/wasm`.
   If your app already
   does this, `createCausl()` behaves exactly as it did. If it does not, every
   `createCausl()` now throws — which is the point: before this release those
   calls were silently building a different engine from the one your production
   preload built.
2. **Do the same in your test setup, and do it in a global setup file rather
   than per test.** This is where the defect actually bit: a suite that omits
   the preload was running the TypeScript floor while production ran
   `rust-ssot`, and `causl/causl-wasm-ts#272` shows the two disagree on
   in-place mutation of a committed value. A suite that starts throwing here
   was already testing the wrong engine.
3. **Delete `engine: 'js-ssot'` and `backend: 'js'`. Required for anyone who
   passes either; there is no replacement.** Both selected the pure-TypeScript
   floor, and this package no longer ships one as an adopter-selectable engine.
   If you need a TypeScript value-of-record engine, it lives in
   `causl/causl-core-ts`, which is now its only owner in the organisation. If
   you were passing `backend: 'js'` expecting the floor, note that you were
   **not** getting it whenever a module was preloaded — that option had been
   silently ignored since `causl/causl-wasm-ts#122`.
4. **Delete `engine: 'rust-ssot'`. Required for anyone who passes it; the
   behaviour is now the default.** Pinning it was how you asked for
   fail-loud-instead-of-degrade. Every `createCausl()` is that now.
5. **Delete `{ fallbackToTs: true }` / `{ fallbackToJs: true }` and replace them
   with a `catch`. Required for anyone who passes either.** They opted you into
   a soft path that returned a pure-TypeScript graph when the wasm path failed.
   Honouring them against an engine that no longer exists would reintroduce
   exactly the silent-divergence hole this release closes, so the properties are
   **removed from the published types** — `tsc` names every call site that still
   passes one. They are also **refused at runtime**, which is the part a
   plain-JavaScript caller feels: leaving `{ fallbackToTs: true }` in place does
   **not** make it inert, it makes the construction throw
   `RemovedEngineOptionError` (`code: 'CAUSL_REMOVED_ENGINE_OPTION'`). Note
   which way round that is, because it is the opposite of "inert":

   ```js
   await preloadCauslWasm()

   createCausl()                        // OK — graph built
   createCausl({ fallbackToTs: true })  // THROWS RemovedEngineOptionError
   ```

   Dropping the key is what makes it succeed; keeping it is the only thing that
   fails. That is deliberate — accepting a key that used to select a different
   engine, and silently ignoring it, would run your graph on an engine you did
   not ask for, which is the hole this release exists to close. The same refusal
   guards `loadAuthoritativeWasm()` and `loadWasmBackend()`. Decide what an
   unsupported host should do — a rendered error, a degraded read-only view, a
   bug report — and write it in the `catch`.
6. **Re-check anything that reads `causlEngineOf(graph)`. Required only for
   code that branches on `.mode` or `.tsFloorReason`.** `mode: 'js-ssot'` and
   `tsFloorReason: 'wasm-fallback'` are no longer produced by anything, and
   both are deleted in `0.6.0`. `mode: 'ts-floor'` with
   `tsFloorReason: 'unattributed'` is still what you get for a `Graph` this
   subpath did not build. A branch that treated `'js-ssot'` as "TypeScript is
   running" should become a branch on `'ts-floor'`.
7. **Replace `onCauslCapabilityFallback` with a `catch`. Optional in 0.5.0,
   required by 0.6.0.** The hook still registers and never fires, so a listener
   is now a silent no-op rather than a compile error. Everything it used to
   report arrives as a thrown error carrying the same distinctions on
   `error.code` and in the message.
8. **If you support a host on the dropped tier, decide deliberately. Required
   only for adopters shipping to Safari &lt; 18 / macOS &lt; 15, policy-pinned
   pre-119 Chromium/WebView2, or Node &le; 20.** Those hosts no longer get a
   working graph. There is no flag that restores the old behaviour, and that is
   the decision `causl/causl-wasm-ts#275` §5 records: the fallback engine
   disagreed with the primary, so shipping it was shipping a second set of
   answers to the same question.
   *(Correction, 2026-08-09, causl/causl-wasm-ts#426: the tier named here
   understates the floor; the corrected, single-source floor is
   `WASM_HOST_FLOOR` in `packages/core/src/wasm-registry.ts`, and Safari
   18.0-18.1 and Node 21 are also below it.)*
9. **Re-check every `readAt` / `snapshotAt` call site against the caps the graph
   it runs on was built with. Required for anyone who calls either without
   setting `commitHistoryCap`.** Code that branches on `status === 'retained'`
   now takes the `evicted` arm on a default-cap graph. There is no type change
   and no throw, so the compiler will not find these for you: grep for `readAt(`
   and `snapshotAt(` and check the construction options of the graph each one is
   called on.

   - If you want history, opt in: `createCausl({ commitHistoryCap: 1000,
     snapshotRetentionCap: 1000 })`. Retention behaviour at any positive
     `commitHistoryCap` is unchanged by this release.
   - If you were relying on the old default-cap answer, you were reading present
     state through a historical API. `read(node)` and `snapshot()` are the
     surfaces for that, and both are unaffected.
10. **Delete any `catch` arm or `instanceof` test naming
    `InvalidInjectedBackendError`. Required only for anyone who imports the
    name, and it is a compile fix with no behaviour behind it.** The class is
    gone from the main barrel, so `tsc` names every import. Nothing else needs
    to change: the arm was already dead code in every published version, because
    the validator that threw it went with the injection seam it validated and
    the construction failure it described is now raised as
    `WasmEngineUnavailableError` before the constructor is reached. If it was
    your only reason to import from `@causl/causl-wasm-ts`'s error catalogue,
    delete the import.
11. **Replace `activateAutoMigrationBackend(options)` with
    `loadWasmBackend(options)`. Required only for anyone who calls it, which we
    believe is nobody.** Both come from `@causl/causl-wasm-ts/wasm`, the
    signature is identical, and the alias forwarded to `loadWasmBackend`
    unchanged. It was never an adopter entry point: it existed so the auto-adapt
    wrapper this release deletes could reach the loader without pulling the
    `loadWasmBackend` identifier into a consumer's main bundle chunk. If you are
    writing new code, note that `loadWasmBackend` is a determinism-gate surface
    rather than a graph factory; `createCausl()` and `createCauslWasm()` are the
    two supported ways to build a `Graph`.

## [0.4.0] - 2026-08-03

Released as `@causl/causl-wasm-ts@0.4.0`. The prose below is the source text of
`.changeset/mighty-jars-obey.md`, copied across at release time as
`.changeset/README.md` requires — `changeset version` consumes and deletes the
changeset file, so this section is the only surviving copy.

**Do closures stay in the value domain?** Yes. A derived may return, or contain, a closure and
0.4.0 does not deprecate that — what changes is that such a value is no longer silently treated as
equal to a different one. **SPEC §5.1 Amendment 8** is the decision that made this call: it
enumerates the permitted quotients for computation elision as a CLOSED list, and the arm added
here is a refinement of that relation, not a new licence to elide. So there is no deprecation lint
coming for closures in derived values; the obligation that does land on adopters is memoisation
for grid-sized values (migration step 3 below), which is a performance obligation rather than an
API one.

**Behaviour change — the derived-value cutoff relation is now a congruence, and observable
notification counts move with it.** Until 0.4.0 the engine compared a derived's new value against
its old one with a structural content hash that could not represent functions, `RegExp`, `Error`,
class instances, symbols or bigints — every such value collapsed into one equivalence class — and
then used that verdict for a second job the relation was never sound for: **skipping the recompute
of every node derived transitively from it**. Downstream nodes then served a pre-swap value from
`read()` indefinitely, and never repaired, because the skip also froze the dependency set
(EPIC #255 §1; the reproduction needs no functions at all — a `RegExp` payload starves its
dependent identically). 0.4.0 refuses compute elision for a node whose value carries such a slot
(#302 option (c), the congruence gate), so `read()` stops lying — **and the price is that every
count and timestamp derived from "did this node change" moves for those nodes: subscriber fire
counts, `Commit.changedNodes`, `simulate().derivedDiff`, `stats().nodeVersion`, `explain()`,
`commitLog()` entries, `onObserverError` invocation counts, `nodeMeta().computedAt` /
`nodeMeta().contributedAt`, and which commit a fire is attributed to — together with the
recompute volume itself, because a derivation that mints a fresh closure on every run now
propagates on every commit instead of cutting off.** All nine surfaces and the extra recomputes
are the same fact seen from nine angles, not a footnote to it: if your subscriber counts moved
after this upgrade, this paragraph is the explanation, and it is not a bug.

`stats().nodeVersion` is the one to check first. `src/telemetry.ts` documents it as *"the
load-bearing memoisation surface for adopters who can no longer rely on `read()` reference
identity"* — it is the counter this project instructs adopters to key their caches on, so a cache
keyed on it will invalidate on commits where it previously did not.

## What moves

- **Deriveds carrying functions, `RegExp`, `Error` or class instances start firing where they were
  silent.** They were not "cut off"; they were invisible to the relation.
- **Two structurally-equal class instances now compare unequal.** This is deliberate
  over-notification (EPIC #255 D04), not an oversight: the alternative is a relation that cannot
  tell two distinct instances apart, which is the defect being closed.
- **The refusal is conditional on a slot having actually moved.** `derivedValueChanged` asks
  `opaqueSlotsChanged` (`packages/core/wasm/content-hash.ts`), which compares the two operand lists
  slot-by-slot under `Object.is`. A derivation that returns the *same* closure reference on every
  recompute still cuts off. This is the mechanism that makes memoisation work, and it is why
  migration step 3 below is worth doing.
- **Both engines move together.** The verdict is minted by one shared JS predicate; the `rust-ssot`
  leg, whose elision decision is made inside Rust from the marker alone, asks the same predicate at
  publish time and folds the answer into the marker (`wasm/authoritative.ts`, `opaqueGateMarker`).
  `changedNodes` and the Phase-G fire set stay a §18A.1.1 MUST-be-identical surface.

### The relation, stated once

> The value-equality relation is strictly refined — no two values that previously compared unequal
> now compare equal. Notification counts and commit attribution move: a subscriber may fire on
> commits it did not fire on before, and observers with a bounded fire budget (`transient: true`,
> self-unsubscribing observers) will spend that budget on a different commit and may therefore miss
> a later change they previously received.

That last clause is the one direction of this change that **removes** a notification, and it is why
this is a minor and not a patch. `transient: true` is a genuine one-shot: `src/graph.ts` records
that Phase G adds the entry to the engine's `pendingTransientDrops` set after firing, and the set is
drained at the end of the commit. A newly un-suppressed fire consumes the budget, so a later change
that previously reached the observer is never delivered. No library feature is required to hit this
— any observer that unsubscribes itself on first fire has the same shape.

## What it costs

Two things are true and they point in different directions, so both are stated.

**The recompute-volume shape is known.** Refusing elision costs one extra recompute per
opaque-carrying hop per upstream change, and it is absorbed at the first plain-data boundary,
because the next hop's value is ordinary structure and re-hashes identically. It is not a
re-render cascade. Consumers whose closures are memoised keep steady-state cutoff outright — the
slot reference does not move, so `opaqueSlotsChanged` answers `false` and the node is elided
exactly as before. That is a statement about a **count**, and a count is not a cost.

**The wall-clock cost was not resolved on the reference host, and no per-commit figure is claimed
for this release.** What exists is `packages/core/bench/baseline.json`, a quiet-host capture of the
integrated tree (Apple M5, 10 cores, node v26.5.1, quiescence gate `(load1 - 1) / cores <= 0.2`
checked before *and* after the run — this capture read **0.0315 before and 0.0370 after**, against
that 0.2 ceiling):

| cell | role | p50 | within-run rme | move vs previous capture |
|---|---|---|---|---|
| `contentHashMarker — 5000-row × 12-field pure JSON` | regression control | 17.4146 ms | 0.42% | **−0.86%** |
| `contentHashMarker — 30 ColumnDef × 4 fn slots` | merge gate | 0.067958 ms | 0.33% | **+0.87%** |

Every one of the six cells moved less than 1% in this capture, which no previous capture of this
file has managed. The merge gate is inside the EPIC's `< 2%`, and the control envelope — the widest
move among the cells this release cannot have touched, counting only controls whose own margin of
error is narrower than the 2% being resolved — was **+0.86%**.

**That is a weaker statement than it looks, and the reason is worth more than the numbers.** The
diff between this capture and the one before it is *comment text in the harness*, so every delta in
the table above is host noise by construction. An earlier attempt at the same capture, on the same
bytes, with `(load1 - 1) / cores` reading **0.02–0.07 and passing the gate both times**, moved the
merge cell **+9.59%** — and was refused. The difference between the two runs was the 5-minute load
average (4.5 versus 2.2), which the quiescence gate does not look at. So:

- **The gate does not bound this cell.** An 8.7 percentage-point swing sat entirely inside a
  passing quiescence check. A 68-microsecond measurement on a machine that was busy five minutes
  ago is not protected by a 1-minute average.
- **A tight control envelope is not an attribution.** On the refused run the control that sets the
  envelope moved +0.43% while the merge cell moved +9.59% — the two cells differ by 260× in
  absolute duration and do not share a between-capture spread. `bench/regression-gate.ts` now
  refuses to draw that inference in either direction.
- The **committed capture history** of the closure-carrying cell reads 0.070250 / 0.067750 /
  0.071500 / 0.067541 / 0.067375 / 0.067958 ms — a **6.1% span** across six captures, wider than
  the 2% criterion asserted against it. The pure-JSON cell spans 18.0443 / 17.5089 / 17.6649 /
  17.6236 / 17.5658 / 17.4146 ms, **3.6%**.
- **Three back-to-back runs on this host against byte-identical sources**, with no code change
  between them, gave 0.071041 / 0.071417 / 0.072583 ms for the closure cell (**2.2% span**) and
  17.9621 / 18.1604 / 18.3149 ms for the pure-JSON cell (**2.0% span**). The third run's after-gate
  reading was 0.2083, marginally over the 0.2 ceiling, and is recorded rather than dropped.

So the honest reading is: **2% is resolvable within a single capture** (rme 0.33% and 0.42%) **and
is not resolvable between two** on this host, for either cell. The `+0.87%` above is not evidence
that this release costs nothing; it is the absence of evidence that it costs something, measured on
a cell whose own between-capture spread is three times the threshold. Nothing in this section
should be read as a certified figure.

**Erratum — do not trust commit `5f7cfa1`'s message.** That commit ("re-capture the bench baseline
at 0.4.0") certified its run as taken *"on a quiet host (load1 1.75, metric 0.075 against the 0.2
ceiling, checked before and after)"* and reported `5000-row × 12-field pure JSON  17.6236 ->
17.4067  −1.23%`. Neither figure is in the artefact it committed. That capture recorded **load1
2.0498 / metric 0.10498 before and 2.27539 / 0.127539 after** — 1.7× the quoted load, rising 11%
across the run, still under the ceiling but nowhere near the quoted pair, which is the arithmetic
mean of the *superseded* capture's readings. And it recorded the pure-JSON control at **17.5658 ms,
−0.33%**; `17.4067` appears nowhere in the tree, and −1.23% overstates the recorded move by 3.7×.
Both numbers were hand-copied from a console scrollback of a run that had been discarded. An
inaccurate provenance note is worse than none, because it is what a later reader trusts instead of
re-measuring — so `bench/capture-baseline.ts` now **emits** that stanza (quiescence readings,
per-cell deltas, envelope) from the same objects it writes to disk, and prints it only after the
write succeeds. A figure in a future release commit that the artefact does not contain has to be
typed in on purpose.

An earlier version of this section carried the same defect one step further back: its table quoted
the **`0.3.6` capture on `main`** (17.6236 ms / 0.48% / −0.23% and 0.067541 ms / 0.37% / −5.54%),
not the capture this release ships. The table above is the committed `baseline.json`.

**And neither cell is ms/commit.** Both measure `contentHashMarker` per call — a commit/marshal-path
cost, not a whole commit — and they are engine-independent by construction, since both engines mint
the marker from the same JS function. The four graph-scenario cells in the same file are labelled
`js-ssot floor` and do not cover `rust-ssot` at all. **No per-commit wall-clock figure for either
engine on the motivating fan-out was resolved for this release, and none is claimed here.**

The figures that used to be quoted for that fan-out — 12.3 ms/commit (`rust-ssot`) and 24.2
ms/commit (`js-ssot`) at 10,000 rows on `visibleColumns → {validationResults, footerAggregates}`
— measured a **pre-0.3.7 engine and the withdrawn identity-ticket design**, not the congruence gate
that shipped. They are recorded here as history and are **not** carried forward as current. If
per-commit cost matters for your workload, measure it on your workload: the shape above says where
to look, and `packages/core/bench/` is the harness.

## Engine-parity repairs in the same release (#279)

The congruence gate above is one of **two** bodies of adopter-visible change in this release. This is
the other, and it is disclosed here rather than deferred because 0.4.0 had not been tagged or
published when it landed — the tarball an adopter will install contains both, so the release note
owes both. See `.changeset/README.md`, "A version that is cut but not published is amended, not
superseded", for the rule that decided that.

#279 took the test suite off `createCauslTs`: 117 files that had been asserting against the pure-TS
floor now drive `rust-ssot` — the production default for any graph built after `preloadCauslWasm()`,
or by `createCauslWasm()` / `createCauslWasmSync()`, or with `engine: 'rust-ssot'`. Ten defects fell
out, each one a place where the authoritative engine answered differently from the floor on a surface
SPEC §18A.1.1 says the two MUST agree on. Every repair moves `rust-ssot` **towards** the floor; not
one of them moves the floor.

That direction does not make them invisible, and this section does not pretend otherwise. "We made it
match the other engine" is still a change to whoever shipped against the engine that existed — and
the engine that existed is `0.3.7`'s. Each item below was checked present in the `0.3.7` tree
(`6f1d7f3`, the commit that release was cut from), so each is a real delta against the last artefact
on the registry rather than a repair to code no one ever ran. **Adopters who stayed on
`createCauslTs()` or `engine: 'js-ssot'` see nothing in this section**, because the floor already
behaved this way in every case.

None of these is a change to the value-equality relation, so Amendment 8's refinement/coarsening axis
does not apply to them. The plain minor rule does — "some observable surface moves" — and 0.4.0 is
already a minor for the reason the section above gives, so nothing here changes the number.

### 1. A `Commit` from `rust-ssot` is frozen, as it always was on the floor

`commit()` and `hydrate()` return an `Object.freeze`d record whose `changedNodes` array is frozen
too. On `0.3.7`'s `rust-ssot` neither was: under an injected authoritative backend the record handed
back is minted by the engine, not by the TS Phase E, and the engine skipped the SPEC §5.1 freeze that
Phase E applies — *"frozen identically here whether the caller is `commit`, `hydrate`, or any future
privileged caller"*.

**Expect:** `c.mine = 1` or `c.changedNodes.push('x')` — in a `subscribeCommits` observer, in a
devtools shim, in a test helper that decorates the record before asserting on it — now throws
`TypeError: … is not extensible` under module strict mode where it used to succeed.

**Do:** copy before you write. `{ ...c, mine: 1 }`, `[...c.changedNodes]`.

**And do not reach for `freezeOffInProd`, because it does not do what the name suggests here.** That
flag governs only the **inner** `changedNodes` array. The `Commit` record itself is frozen
**unconditionally**, on both engines, and no option turns that off — the floor has behaved that way
for as long as `freezeIfDev` has existed, and this release makes `rust-ssot` agree. An adopter who
finds the flag while looking for a way to unblock a build will find it unblocks half the problem.

### 2. `graph.read(input)` inside a `commit` body returns the value `tx.set` staged

SPEC §10's worked example is `tx.set(n, g.read(n) + 1)`. On `0.3.7`'s `rust-ssot` that read resolved
through `injectedBackend.read(id)`, which serves the **committed** cell, while the write had been
staged on the entry — so the body read the pre-commit value:

    g.commit('inc', (tx) => { tx.set(n, 1); g.read(n) })   // 0 on rust-ssot, 1 on the floor

The staging structure exists on both engines (the Rust core carries the same per-cell
`last_staged_at`), so this was a read-seam that skipped the probe, not a missing feature.

**Expect:** any commit body that writes an input and then reads it back now sees its own write. Two
accumulating `tx.set(n, g.read(n) + 1)` calls in one body land `+2` where they landed `+1`.

**Do:** nothing, if you wrote against the SPEC. If you compensated for the stale read — carrying your
own running total across the body, or splitting one logical update into two commits to force the
value through — **remove the compensation, because it now double-counts.** This is the one item in
this section that changes a *value* rather than a count, so it is the one worth grepping for: `read(`
inside a `commit(` callback.

### 3. A throwing `subscribeCommits` observer is reported instead of dropped

Phase-H commit-observer faults now reach `onObserverError` with `source: 'commit-subscriber'` and the
published commit's `time`, which is what SPEC §5.1 Amendment 5 (report-and-continue) and §12's
`ObserverErrorContext` already specified and the floor already did. On `0.3.7`'s `rust-ssot` the
`catch` arm was empty, with a comment recording that the throw was dropped.

**Expect:** with no handler configured, the default sink runs
`console.error('[causl] observer threw (commit-subscriber @ t=…):', error)`. A build that was silent
starts logging, once per throwing observer per commit. The commit itself is unaffected — it had
already settled — and a throwing handler still cannot trap the pipeline.

**Do:** if the volume matters, pass `onObserverError` at construction; a no-op handler restores the
silence as a decision rather than as an accident. What this is **not** is a reason to defer the
upgrade: the throws were always happening and were always losing work, and this release is the first
time you can see them.

### 4. `stats().commitObservers` counts live registrations again

`EngineTelemetry.commitObservers` is documented as the count of live `subscribeCommits(observer)`
registrations. Under `rust-ssot` with the rebuilt commit channel present, the facade hands the
observer to the engine and never touches the TS `Set` the counter read — so the field was a **constant
`0`** however many observers were live, while the floor reported the true count for the same program.

**Expect:** it reports the union, and moves off `0`.

**Do:** re-check any leak assertion, dashboard threshold or alert keyed on this field. An
`expect(stats().commitObservers).toBe(0)` written against a wasm graph passed for the wrong reason
and now fails for the right one — see migration step 7.

### 5. `graph.commitLog` is reachable from a `derived` again, and stops poisoning `read()`

Registering a plain `derived(id, get => get(graph.commitLog))` — the §11 inspection shape — used to
mint a phantom **input** slot for the engine-owned commit-log id, because the engine defaults an
unrecognised dep to one. After that single registration the facade's `has()` check flipped, the
documented fallback to the TS closure stopped happening, and `graph.read(graph.commitLog)` resolved
an unmaterialised Rust cell as `null` — **permanently, for the life of the graph** — while
`stats().retainedCommits` went on reporting the log was there. Measured on `wasmgc-classic` with
`commitHistoryCap: 1000`: `[]` before the derived registers, `null` immediately after, `null` across
every later commit. The compute lambda itself was handed `null` on every recompute, which is a
`TypeError` for any body that reads `.length`.

**Expect:** the lambda receives the bounded `readonly Commit[]` window, and `read(graph.commitLog)`
keeps returning it.

**Do:** nothing. If you avoided deriving from `commitLog` because it returned `null`, or read the log
only through `commitLog()`, both paths now agree and the avoidance can go.

### 6. `explain()` reports the derivation for `commit-metadata` nodes and the engine-owned `commitLog`

Same phantom-slot cause, on the structural-query surface. Measured on
`commitMetadataDerived('cm', get => get(a))`: the floor reports `{ via: 'derived', value: 1, deps:
['a'] }` and `0.3.7`'s `rust-ssot` reported `{ via: 'input', value: null, deps: [] }` — the engine
answering for a node it held no registration for.

**Expect:** the two engines agree, and the `rust-ssot` answer changes shape for exactly these nodes.

**Do:** re-record any snapshot or golden file that captured `explain()` output for a
`commit-metadata` node or for `commitLog` on a wasm graph. It was capturing the defect.

### 7. `assertDeterministicCompute` actually runs on the `rust-ssot` recompute path

This is the item that can take a build that was green to red, so it is stated at length.

The SPEC §15.1 invariant gate lives in the TS `computeDerived`, which a **mirrored** derived skips
entirely: the wasm engine owns the Phase-D recompute and calls the adopter's lambda back across the
FFI. So with the flag on, the floor checked every recompute while `rust-ssot` checked only
registration. A non-deterministic compute — one reading `Date.now()`, `Math.random()`, or a mutable
module-level cell — passed silently on the wasm engine for as long as the flag has existed. The gate
now runs on that path too, by the same second-call-equality strategy the TS gate uses: capture what
the first pass read, re-run against a replaying accessor, compare under `Object.is`.

**Expect:** `NonDeterministicComputeError` thrown at the recompute, on the engine, where nothing was
thrown before. **Enabling a check that never ran is a behaviour change even when the check is
right**, and this release does not claim otherwise.

**Do:** first, note the blast radius — `assertDeterministicCompute` is **opt-in and defaults to
`false`**, so no adopter is exposed who has not asked for it, and it is documented as a development
aid rather than a production setting. If your CI turns it on and now fails, the failure is real: the
lambda it names is non-deterministic, and every cutoff verdict ever taken on that node was taken on a
value that could not be reproduced. Fix the lambda. Turning the flag off restores the previous
behaviour, and with it the previous silence about the defect.

**Cost, stated as a count and not as a time:** with the flag on, a bridged recompute now runs the
adopter's lambda **twice**, which is what the floor has always done with the flag on. No wall-clock
figure is claimed for it; "What it costs" above explains why this release does not claim one.

### 8. Disposing a derived retires that derived — and the DISPOSE wire record grew from 8 to 12 bytes

The FFI `Dispose` record carried the raw slot integer alone. Inputs and deriveds share the slot
space and are told apart **only** by generation, so disposing a derived at `(slot 0, gen 1)` resolved
engine-side to `(slot 0, gen 0)` and retired the colliding **input**; the next commit that wrote it
failed with `Engine(NodeDisposed { slot: 0 })`. The encoder now emits the full `(slot, gen)` pair
(causl/causl-core-rs#205), a 12-byte record where it was 8.

**Expect:** `dispose()` on a derived stops retiring an unrelated input.

**Do — and this is the one install-shaped item in the section.** The wire format is normally not a
versioned surface here (see "What is not versioned" above), and the engine's decoder accepts **both**
widths, so the widening is compatible against any engine carrying causl-core-rs#205 — which the
vendored engine in this tarball does. It is not compatible *backwards*. If you override the artefact
location with `preloadCauslWasm({ wasmBaseUrl })` and self-host a `.wasm` copied out of a `0.3.x`
install, **take the artefact this release ships**; a pre-#205 engine will reject the wider record.
Adopters who let the package resolve its own artefact need do nothing.

## Consumer source changes

No API changed shape, so nothing in this release forces a source edit to keep compiling. That is
**not** the same as nothing to do. One consumer action is **unconditionally mandatory** — migration
step 2, because a consumer still carrying the pre-0.4.0 subscription-seam workaround double-fires hop
1 against this release. Six more (steps 5–10) are mandatory **conditionally**: each names the
population it binds and says plainly that everyone outside it has nothing to do. Everyone else needs
no source change but does need to read both "What moves" and "Engine-parity repairs" above — nine
observable surfaces move under the first and eight more under the second, and not one of them
announces itself at the call site.

### Installing alongside `@causl/persistence`, `@causl/devtools`, `@causl/devtools-bridge`

Those three declare `@causl/causl-wasm-ts` as a **`peerDependency`**, and `pnpm publish` rewrites
their `workspace:*` range to the **exact** core version at the moment they were published. So a
satellite tarball published against `0.3.x` declares a peer of `0.3.x`, and installing it beside
`0.4.0` is an `ERESOLVE` on npm 7+ or an unmet-peer warning on pnpm — a resolution failure, not a
runtime one. **If your install resolves the satellites to versions published before this release,
that is the cause.** Take satellite versions published at or after `0.4.0`.

This is a release-process obligation on us, not work for an adopter, and `.changeset/README.md`
now records it as a required manual step: the six satellites are in the changesets `ignore` list —
so that one core minor cannot mint six unintended `1.0.0` tags — which also means changesets never
bumps them, and the publish workflow skips any package whose version is already on the registry.
Three of the six are in that publish list. `[0.3.4]` below records the same bump being done by hand
for the same reason.

## Migration

1. **Upgrade `@causl/causl-wasm-ts` to `0.4.0`.** That is the package name — the shipping name since
   the rename. `@causl/core` has zero versions in the registry and adopting it is not possible;
   any instruction naming `@causl/core@0.4.0` means this package.
2. **Revert `xldatagrid/xldatagrid` PR #1695 in the same train. Required, not optional.** #1695 is
   the subscription-seam workaround for the notification half of this defect
   (`xldatagrid/xldatagrid#1690`), and it is in that repository's `main`. Against 0.4.0 the engine
   now delivers the notification itself, so leaving the workaround in place **double-fires hop 1**.
   The residual defect the workaround could never reach — `xldatagrid/xldatagrid#1696`, transitive
   dependents serving a stale value from `read()` — is what 0.4.0 closes, which is why the two must
   land together (EPIC #255 D16).
3. **Memoise the closures you pass into derived values. Required for grid-sized values; optional
   below that.** This is where the recompute-volume consequence lands or does not. A derivation that
   rebuilds `validators` / `aggregate` closures on every run now propagates on every commit; a
   memoised one keeps steady-state cutoff, because `opaqueSlotsChanged` compares slot references
   under `Object.is`. On a small value the extra recompute is not worth the ceremony — on a
   grid-sized one it is the difference this release is measured by. It is already the documented
   xldatagrid pattern. Where memoisation is not available, `derived(id, compute, { key })` (#267)
   substitutes a marker-expressible projection as the subject of the cutoff and removes the
   `O(|value|)` traversal outright — but note that a projection which itself returns an opaque value
   refuses elision exactly as an unprojected one does (#302). Slower, never stale.
4. **Audit `transient: true` and self-unsubscribing subscriptions on opaque-carrying nodes.** Per
   the relation statement above, a one-shot's budget can now be spent on an earlier commit, so a
   later change it used to catch is never delivered. This is the only direction in which this
   release delivers *fewer* notifications than 0.3.x.

Steps 5–10 cover "Engine-parity repairs" above. Every one of them is `rust-ssot`-only: if every graph
you build is `createCauslTs()` or `engine: 'js-ssot'`, stop at step 4.

5. **Grep for `read(` inside a `commit(` body, and delete any compensation for the stale read.
   Required for anyone who has one; nothing to do otherwise.** On `rust-ssot` a read-back of an input
   the same body just staged returned the pre-commit value; it now returns the staged one, per SPEC
   §10. Code that carried its own running total across the body, or split one logical update into two
   commits to force the value through, **now double-counts**. This is the only step in the list that
   changes a result rather than a count, which is why it is first.
6. **Stop writing to the `Commit` you are handed. Required for anyone who does; nothing to do
   otherwise.** The record and its `changedNodes` are frozen on `rust-ssot` now, as on the floor, so
   `c.mine = 1` / `c.changedNodes.push(…)` throws under module strict mode. Copy instead:
   `{ ...c, mine: 1 }`, `[...c.changedNodes]`. `experimentalFlags: { freezeOffInProd: true }` relaxes
   only the inner array — the record itself is frozen unconditionally on both engines and there is no
   flag for it.
7. **Re-check what your test suite asserts about a wasm graph's introspection surfaces. Required for
   anyone holding such an assertion or golden file.** Two of them moved and both used to be wrong:
   `stats().commitObservers` was a constant `0` under `rust-ssot` and now counts live registrations,
   and `explain()` on a `commit-metadata` node or on `commitLog` reported `via: 'input', value: null,
   deps: []` and now reports the derivation. An assertion or snapshot that captured either was
   capturing the defect; re-record it.
8. **Decide what a throwing `subscribeCommits` observer should do, instead of inheriting the
   decision. Optional, but make it deliberately.** Those throws now reach `onObserverError`, and with
   no handler configured the default sink writes one `console.error` per throwing observer per
   commit — so a previously-silent production build acquires log volume. Passing a no-op
   `onObserverError` restores the silence as a choice. Do not treat the noise as a reason to stay on
   0.3.x: the throws were always happening and were always losing the observer's work.
9. **If you self-host the `.wasm` artefact, take this release's. Required for anyone passing
   `wasmBaseUrl` to `preloadCauslWasm()`; nothing to do otherwise.** The DISPOSE wire record widened
   from 8 to 12 bytes to carry the node generation (causl-core-rs#205), without which disposing a
   derived retired a colliding input. An engine artefact predating #205 rejects the wider record.
   The engine vendored in this tarball carries it.
10. **If your build sets `experimentalFlags: { assertDeterministicCompute: true }`, expect it to
    start failing on `rust-ssot`. Required only if that flag is on; the flag defaults to `false`.**
    The SPEC §15.1 gate never ran on the wasm recompute path and now does, so a non-deterministic
    compute that passed silently there throws `NonDeterministicComputeError`. A build that goes red
    here has a real defect: fix the lambda rather than the flag. Turning the flag off restores the
    old behaviour and the old silence.

## [0.3.7] - 2026-08-01

Published as `@causl/causl-wasm-ts@0.3.7` to the Gitea npm registry
(`git.opsite.ca/api/packages/causl/npm`) at 2026-08-01T23:07:37Z. Cut
from `release` @ `6f1d7f31`, which never reached `main` — `main`
carried `0.3.6` until #266 reconciled it. Not tagged.

### Changed

- **The vendored Rust engine is republished at `@causl/core-rs@0.3.6`,
  carrying `causl/causl-core-rs#331`'s Phase-D drain fix.** The release
  job's vendor step was repinned from `@causl/core-rs@0.3.5` to
  `0.3.6`; the pin is what selects the engine that ships, because the
  publish job replaced the committed `wasm-pkg/` tree from the tarball
  it fetched. Engine bytes,
  `gc-classic-bundler/causl_engine_bridge_bg.wasm`, sha-256:

  | version | digest |
  | --- | --- |
  | 0.3.5 (retired) | `e6883840b1dd393760a75df263a52e521ba4182bd4e7b48d5c17ca62a6c3d3db` |
  | 0.3.6 (shipped) | `ab4b62c123e57f6e9a435cba3bf4cd5dc7b9ad3f5ead9d9da46a99dd7a095d75` |

  The retired digest is the one `causl-bench` quarantined as pre-fix.

  **A patch, deliberately.** No public surface moves here, so a
  `^0.3.6` range install takes it silently — which for a drain fix is
  the intended behaviour, and is exactly what the patch rule in this
  file's versioning policy is for. The cutoff-semantics change that
  earns a minor ships separately.

  The vendor step this release repinned has since been **removed**
  (#306). The publish job no longer overwrites the committed
  `wasm-pkg/` tree from a tarball, so from the next release on the
  bytes that ship are the bytes in the tree, gated against the
  provenance record embedded in them.

## [0.3.6] - 2026-07-27

Published as `@causl/causl-wasm-ts@0.3.6` to the Gitea npm registry at
2026-07-27T07:31:50Z, from the manifest bump at `39fb2378`
(2026-07-10). The seventeen-day gap is the two renames below: the
number was cut as `@causl/core` and published under the third name the
package has had. Not tagged, and not on npmjs.com — 0.3.3 is the last
version there.

### Changed

- **Renamed twice, published once.** `@causl/core` → `@causl/client-ts`
  (#288), then `@causl/client-ts` → `@causl/causl-wasm-ts` (#291). The
  engine package was renamed `@causl/wasm` → `@causl/core-rs` in the
  same pass. A consumer resolving `@causl/core` does not see this
  release or any after it.
- **Distribution moved to the Gitea npm registry and Verdaccio was
  retired.** `@causl/*` now resolves from
  `git.opsite.ca/api/packages/causl/npm`, privately.
- **The committed WASM engine was rebuilt** from the engine crate
  (`gc-classic` 726.5 KB raw / 203.6 KB brotli, `gc-builtins` 729.0 KB
  / 204.4 KB, both inside their caps), and the vendor pin moved to
  `@causl/wasm@0.3.4`. That version ships only the `gc-classic` bridge
  and `package.json#files` had already narrowed to it, so the stale
  two-tree vendor loop could no longer be satisfied.

### Fixed

- The Critical/High engine and bridge sweep merged between 0.3.5 and
  this release: the `p2`…`p2e` rounds, `causljs/causl-ts` #98 and
  #133–#164, plus their engine companions.

## [0.3.5] - 2026-07-07

Published to the (now retired) private npm registry as
`@causl/core@0.3.5`, from `release` @ `76321938`. **`main` never
carried this version** — its manifest went 0.3.4 → 0.3.6 directly, the
same release-branch drift that later stranded 0.3.7. Not on npmjs.com,
not tagged.

### Fixed

- **The cycle's Critical + High fixes across the Rust engine
  (`causl-wasm` #203–#234) and the TS/WASM bridge (`causl-client`
  #100–#132)**, built from the local crate so the tarball carries the
  fixed engine on both bridge trees.

### Changed

- **WASM size caps raised** from 716 → 730 KB raw and 201 → 205 KB
  brotli on both bridges (SPEC §14.2.1 written-consensus bump). The
  accumulated hardening measured `gc-builtins` 744 823 B raw /
  208 342 B brotli and `gc-classic` 742 419 B raw / 207 794 B brotli —
  roughly 11 KB raw and 2.5 KB brotli over the prior caps. The growth
  is the cost of the correctness fixes, not bloat.

## [0.3.4] - 2026-07-06

Published to the private npm registry as `@causl/core@0.3.4`, from
`0baeafc9`. Not on npmjs.com, not tagged.

### Changed

- Vendor pin moved to `@causl/wasm@0.3.3`.
- `packages/core/README.md` states what this package is: the thin
  TypeScript API over the Rust→WASM engine, not the engine itself.
- Satellite manifests bumped so the private-registry run published new
  artefacts instead of skipping versions already present.

## [0.3.3] - 2026-07-05

Published as `@causl/core@0.3.3` to npmjs.com at 2026-07-06T21:46:36Z
and to the private registry, from `310e42aa`. **This is the last
version published under the name `@causl/core`**: npmjs.com carries
0.3.0–0.3.3 and nothing after. Not tagged.

### Added

- **`.github/workflows/release-publish.yml`** — the last hop of the
  cross-repo release chain, firing on push to `release`. It pins pnpm
  from the root `packageManager` field (unspecified-version drift is
  the failure mode that had broken the WASM pipeline), writes a scoped
  CI `.npmrc`, vendors the prebuilt engine with
  `npm pack @causl/wasm@0.3.2` rather than compiling Rust in CI, builds
  every workspace package, and refuses to publish unless
  `npm pack --dry-run` lists the `wasm-pkg` bundler `.wasm` — the guard
  against the wasm-less tarball 0.3.2 had fixed by hand. Publishes are
  idempotent: a version already on the registry is skipped, so re-runs
  are safe.

## [0.3.2] - 2026-07-04

Published as `@causl/core@0.3.2` to npmjs.com at 2026-07-06T18:45:48Z
and to the private registry, from `928f663c`. Not tagged. The 47 days
between 0.3.1 and this release are where the Rust engine was wired in
and made the default; the headline entries follow.

### Added

- **The authoritative Rust→WASM engine, as the unconditional default.**
  The real authoritative loader was wired into the client, `createCausl`
  flipped to the WASM engine when preloaded, `DEFAULT_WASM_ENGINE_MODE`
  became `rust-ssot`, and the TS oracle plus the sticky-downgrade path
  were retired. `createCauslTs` was cut from the public surface and
  then retained as the SPEC §18A.13.1 capability-triggered fallback.
- **The SPEC §18A.3 FFI structural lift.** Structural reads,
  `readAt` / `snapshotAt`, `exportModel`, `subscribeCommits` and
  `explain` all resolve from Rust externs under `rust-ssot`, and the
  Rust commit post-state is promoted to canonical at the flush
  boundary.
- **Multi-instance isolation** through `engine_id` multiplexing: one
  shared WASM instance with a per-engine handler registry, replacing
  the fail-closed at-most-one-authoritative-instance stopgap.
- **The frozen golden byte-identity corpus**, ported into this
  repository so the cross-bridge digest gate runs here.
- **`DISTRIBUTION.md`** and SPEC §18A.10's WASM-only topology.

### Fixed

- **The published tarball omitted the WASM binary entirely.** The
  `wasm-pack`-generated `.gitignore: *` stripped the artefacts out of
  `npm pack`, so the loader could not resolve the Rust engine on a
  consumer host and adopters needed a `link:` / `file:` override.
  `wasm-pkg/<segment>-bundler` is now on the `files` allowlist, with an
  empty `.npmignore` in each bundler directory. This is what makes the
  version a release rather than a bump: from here, the engine installs
  from a registry.

## [0.3.1] - 2026-05-18

Tagged `v0.3.1` (`35448cc1`). Published as `@causl/core@0.3.1` to
npmjs.com at 2026-05-19T03:20:23Z, from `770aa8f7`.

### Fixed

- **The `./testing` subpath was missing from the published tarball**
  (`causljs/causl-ts#28`). `glitchDetector`, `recomputeCounter` and
  `derivedDeps` were wired into `tsup.config.ts` and
  `package.json#exports` in the tree, but 0.3.0's tarball was cut
  before that landed, so consumers typechecking against the registry
  copy could not resolve `@causl/core/testing` without a sibling
  checkout. This release exists to republish metadata and tarball with
  the subpath present.

### Added

- `causl/no-graph-upcast`, closing the third S-3 lint gate
  (`causljs/causl-ts#9`).
- A centralised bundle-budget reference page and the per-PR
  bundle-budget comment workflow.
- MIT licence and attribution.

## [0.3.0] - 2026-05-17

Published as `@causl/core@0.3.0` to npmjs.com at 2026-05-17T17:36:57Z,
from `5a798efb` — the first public release under the `@causl` scope.
Not tagged.

### Changed

- **Breaking: the npm scope moved `@causljs/*` → `@causl/*`, and
  publishing moved from GitHub Packages to npmjs.com.** GitHub Packages
  requires a scope to match the owning organisation, which is what had
  forced the temporary `@causljs` rename; owning `@causl` on npmjs.com
  removed the constraint. 354 references were rewritten — package
  names, imports, lockfile, docs, configs — the CLI binary
  `causljs-migration-check` became `causl-migration-check`, and
  `publishConfig.registry` was dropped from every published package.

  A minor rather than a patch, under this file's versioning policy: the
  name an adopter installs is the most observable surface there is.

  **Migration.** Replace `@causljs/` with `@causl/` in dependencies and
  imports, move to `@causl/core@^0.3.0`, and drop any `.npmrc` registry
  binding for the `@causljs` scope. No token or registry configuration
  is needed after that.

## [0.2.1] - 2026-05-17

Tagged `v0.2.1` (`82b1a6c5`), from `bc6a2323`. Published as
`@causljs/core@0.2.1` — the `@causljs` scope existed only to satisfy
GitHub Packages' owner-must-match-scope rule. Verified absent from
npmjs.com: nothing before `@causl/core@0.3.0` is there.

### Added

- **`invariant` option on `graph.input`** (`causljs/causl-ts#1`). An
  optional runtime callback that fires in the commit staging phase
  (Phase A.7) and rolls the entire commit back atomically on violation,
  surfacing as the typed `InvariantViolationError extends CauslError`
  carrying `{ nodeId, value, cause }`. Motivated by
  `iasbuilt/xldatagrid#103`: an edited numeric grid cell stored the raw
  DOM string into a field typed `number`, and downstream aggregations
  did string concatenation and emitted astronomical totals. The
  existing structural invariants could not see it — the top-level type
  of the value was correct and only a deep field had drifted. One
  invariant per node, composition is the caller's job; synchronous only
  (a returned Promise is ignored, because the engine cannot await it
  without breaking atomicity); the initial value is not validated at
  registration.

## [0.2.0] - 2026-05-16

First versioned release of the `@causl/*` TypeScript-only bundle.
Ships as a GitHub Release (`v0.2.0`) with four `.tgz` tarball assets
attached, plus the unminified per-package tree committed under
`release/` at this tag for audit traceability.

### Added

- `tools/release/release.py` — Python script that bundles the minimum
  viable per-package npm tree, narrows `package.json#exports` to the
  main barrel, resolves `workspace:*` cross-deps to `^0.2.0`, strips
  source maps + map-URL trailers, and optionally re-minifies each
  emitted `.js` via `esbuild --minify` (`--minify` flag) and emits a
  `.tgz` per package (`--tarballs` flag).
- `tools/release/README.md` — detailed build-pipeline docs.
- `## Tools` section in the root `README.md` — repo-wide tool
  inventory with one-line role descriptions linking to per-tool
  READMEs.
- `release/` tree at the v0.2.0 tag — committed un-minified copy
  matching the source `packages/*/dist/`. Lets reviewers diff the
  shipped tarballs against a known reference.
- `"sideEffects": false` on `@causl/core`, `@causl/sync`,
  `@causl/react`, `@causl/formula` package.json files. Enables
  bundler tree-shaking; downstream apps that import a subset of the
  barrel pay only for what they use.
- Root `.gitignore` carve-out for `release/packages/*/dist/` so script
  re-runs can re-stage cleanly with plain `git add release/` (the
  global `dist/` rule otherwise blocks parent-excluded re-inclusion).

### Changed

- Source `packages/{core,sync,react,formula}/package.json` versions
  bumped from `0.0.0` / `0.1.0` → `0.2.0`. Root `package.json`
  bumped from `0.0.0` → `0.2.0`. Source-of-truth versions now align
  with the published v0.2.0 release.

### Release contents

| Package | Runtime (brotli q11, minified) | + Types | npm tarball |
| --- | ---: | ---: | ---: |
| `@causl/core` | **14.36 KiB** | 47.50 KiB | 76 KiB |
| `@causl/sync` | 2.40 KiB | 2.38 KiB | 9 KiB |
| `@causl/react` | 1.75 KiB | 12.73 KiB | 20 KiB |
| `@causl/formula` | 2.96 KiB | 9.22 KiB | 16 KiB |
| **TOTAL** | **21.46 KiB** | 71.83 KiB | 121 KiB |

### Excluded from v0.2.0

- All WASM artefacts (`@causl/causl-wasm-ts/wasm` subpath; the `gc-builtins`,
  `gc-classic`, and `serde` bridge cdylibs under
  `packages/core/wasm-pkg/`). Tracked separately under the
  Zero-boundary WASM engine epic (#1558).
- `@causl/checker` (+ native Linux/macOS/Windows x64/arm64 binary
  shards).
- `@causl/devtools`, `@causl/devtools-bridge`, `@causl/hypothesis`,
  `@causl/migration-check`, `@causl/persistence`,
  `@causl/sync-testing-internal`.
- The `./internal` and `./testing` subpath exports on `@causl/core`;
  the `./resource` and `./conflict` exports on `@causl/sync`.

Adopters who need any of the above install from the source workspace.

### Breaking changes

- **`commitHistoryCap` default flipped from 1000 to 0** (#716,
  semver-major). `createCausl()` (no options) now constructs an
  engine with `commitHistoryCap: 0` and `snapshotRetentionCap: 0`;
  Phases F / F.4 / F.6 are skipped per §5.1 Amendment 1 (#715), so
  `graph.commitLog` stays empty and `graph.readAt` / `graph.snapshotAt`
  resolve only at genesis. Adopters who depend on the prior 1000-row
  in-memory log must opt back in:

  ```ts
  createCausl({ commitHistoryCap: 1000, snapshotRetentionCap: 50 })
  ```

  The change is observably equivalent to the prior cap=1000 default
  for any engine without a `commitLog` consumer, by construction of
  the §5.1 Amendment 1 gates. `subscribeCommits` is unaffected — it
  fires through Phase H independently of the cap. Long-run-1M heap
  evidence (#710) was gathered with the heap-slope helper added in
  PR #728. The migration recipe is the two-line `createCausl({ … })`
  call above; the `docs/migration/cap-zero-default.md` this entry used
  to point at is an `iasbuilt/causl` path that never came across with
  the fork — no commit in this repository has ever added or removed it,
  and it was the only dead relative link in this file.
  SPEC §5.1 Amendment 2 ships in the same change.

  **Filed here, not under `[Unreleased]`, because it shipped here.**
  This entry sat under `[Unreleased]` from the fork until #266 moved it.
  `DEFAULT_COMMIT_HISTORY_CAP` is `0` at this repository's root commit
  (`6b0dc751`, 2026-05-11) and `0` at the `v0.2.0` tag —
  `git show v0.2.0:packages/core/src/graph.ts`, line 497 — so the flipped
  default has been in every version this package has ever published, and
  0.2.0 is the first of them. It is therefore neither unreleased nor
  available to ride inside a later minor. It is not reverted either:
  restoring a 1000-entry default log after two and a half months of
  shipping without one would itself be the breaking change, and would
  hand back the unbounded-heap growth `#715` / `#716` removed. The
  `[Unreleased]` placement was a misfiling inherited from
  `iasbuilt/causl`'s CHANGELOG: the entry is already there, verbatim,
  in `CHANGELOG.md` at the `v0.2.0` tag.

## Pre-0.2.0 — inherited from the predecessor monorepo (unversioned)

Everything below this line arrived with the fork from `iasbuilt/causl`
on 2026-05-11 and cites that tracker's numbers, not this one's. It was
present verbatim in `CHANGELOG.md` at the `v0.2.0` tag, filed under
`[Unreleased]`, which is where it stayed until #266 moved the released
sections above it. None of it has ever been mapped onto a version of
this package's line; it is kept for provenance. A bare `#N` here
resolves against `iasbuilt/causl`.

`[Unreleased]` above still holds entries of the same vintage — the
`#1126` known-limitation and the `#666` docs-site / playground items.
Separating those is not #266's work and they are left where they are.

### Changed — type surface

- **`Commit.originatedAt` typing tightened from optional to explicit
  `GraphTime | undefined`** (#760, #703 Win 5 follow-up). The field
  was previously declared `originatedAt?: GraphTime` and conditionally
  spread onto the published `Commit` record at four sites in
  `graph.ts` (Phase E commit assembly, Phase F history append, the
  `simulate` prediction, and the #704 empty-derivation freeze fast
  path), plus a fifth site in the `subscribeReads` initial-fire
  fabrication. The conditional spread produced two V8 hidden classes
  the moment the first `hydrate` landed, sending every commit
  subscriber's `c.originatedAt` access megamorphic and rippling
  through `subscribeCommits` / `commitLog` consumers. The field is
  now always-set on the assembled record (the explicit `| undefined`
  admits the no-tag case under `exactOptionalPropertyTypes: true`),
  so regular and hydrate-issued commits share one hidden class. The
  parallel adjustment to `IRCommit.originatedAt` (`number | undefined`,
  still optional on the wire) keeps the in-memory `commitHistory`
  rows on the same monomorphic shape; serialized exports continue
  to omit the key on regular commits. **This is a typing-only shift
  for adopters reading `commit.originatedAt`** — the runtime value is
  byte-identical (still `GraphTime` on hydrate-issued commits, still
  `undefined` on regular commits); only consumers that constructed
  `Commit` literals in tests need to add an explicit
  `originatedAt: undefined` slot. The prior `c.originatedAt !== undefined`
  branching pattern still distinguishes the two at the call site.
  This is the public-API counterpart to the `DerivedEntry.tag`
  monomorphization shipped in PR #735 (deferred from #703 Win 5
  when both changes were the same revision).

### Added — `causl-enumerator` SPEC §16.4.1 follow-ons (Phase 8 wave-41..50)

This stanza captures the second wave of `causl-enumerator` work,
landed after the `wave-31..40` closeout below. After this wave,
**every** named §16.4.1 type and surface has a real implementation;
the Phase-8 audit umbrella (#564) is closed.

- **`NodeId` / `ObserverId` / `ResourceId` newtypes** (#648 closes
  #642). Replaces three `pub type X = String` aliases with
  `#[serde(transparent)]` newtypes carrying `From<String>` /
  `From<&str>` / `Display` / `AsRef<str>` / `Borrow<str>` impls.
  Wire format unchanged. Type-discipline at API boundaries: a
  function taking `&NodeId` cannot be passed an `ObserverId` by
  mistake.
- **`Bound.linter` widens from `bool` to `causl_check::Bounds`**
  (#650 closes #644). The placeholder bool is replaced with the
  actual bounds-record (`max_nodes` / `max_commits` / etc.). Wire-
  format compat via untagged-enum deserializer: legacy
  `linter: true` payloads map to `Bounds::spec_defaults()`,
  `linter: false` to `Bounds::unbounded()`.
- **`VisitedKey` superseded** (#649 closes #645). SPEC §16.4.1's
  three-coordinate `VisitedKey { state_hash, pending_signature,
  msg_queue_depth }` predates wave-29's full-State hash. The
  bare `StateHash` already captures `pending_signature` and
  `msg_queue_depth` implicitly. SPEC.md updated to match the
  shipped implementation; documentation close, no code change.
- **`transition_phased` SPEC signature alignment + per-action
  bodies + BFS integration** (#652–#656 closes #643). Five
  sequenced slices:
  1. **Slice 1** (#652) — signature alignment from `(prev,
     action, phases) -> Result<State, TransitionError>` to SPEC's
     `(s, a) -> Result<(State, Vec<(PhaseStep, State)>),
     RaceClass>` plus the Tick body (`[RetentionTick,
     ResolveUnblocked]`). `TransitionError` removed.
  2. **Slice 2** (#653) — Subscribe / Unsubscribe / Dispose
     bodies (each one phase: `NotifyObservers` /
     `NotifyObserversObserved` / `RetentionTick` respectively).
  3. **Slice 3** (#654) — BeginFetch / ResolvePending /
     DispatchMsg bodies.
  4. **Slice 4** (#655) — Commit body (three-phase walk:
     `StageWrites → AppendCommit → ResolveUnblocked`).
  5. **Slice 5** (#656) — BFS integration: both
     `enumerate_with_script` call sites route through
     `transition_phased`, populating `Step.phases` from the
     walker output.

  The load-bearing contract `transition_phased(s, a).0 ==
  transition(s, a, &model)` is verified per-arm so the
  visited-set hash and BFS branching are byte-identical to the
  pre-#643 BFS.
- **`retention_buf` push on every Commit** (#658 closes #657).
  Pre-this-PR the field was defined per SPEC §16.4.1 line 1581
  but never written. Both `transition` (one-shot) and
  `transition_phased` (during AppendCommit) now push the commit
  id to `retention_buf` with K=1024 drop-oldest cap.
- **`Step.events` populated from typed `Event` emissions** (#661
  closes #659). `transition_phased` extends to return
  `(State, Vec<(PhaseStep, State)>, Vec<Event>)`. Per-arm
  emissions: `Commit` → `Event::CommitAppended { time, intent }`;
  `BeginFetch` → `Event::ResourcePhase { resource, phase: "loading" }`;
  `ResolvePending` → `Event::ResourcePhase { resource, phase:
  "loaded" }`. Other arms emit empty Vec. BFS plumbs through to
  `Step.events`. Subscribe's `Event::Notify` is deferred until
  v2 derived-recompute integration.
- **#646 partial: high-branching tier3 wall-clock regression
  gate** (#651). A regression test exercising tier3 with 8-input
  branching factor 9, asserting termination inside a 60s budget.
  The full #646 scope (empirical RSS measurement → cap retuning)
  is deferred per the research-agent recommendation pending
  adopter feedback.
- **Module-level docs refresh** (#662). `transition.rs` and
  `lib.rs` top-level docstrings refreshed from "v1 skeleton" to
  current state. No code change.

After this wave, `cargo test -p causl-enumerator --no-fail-fast`
runs **42 binaries green, 0 failures**. The only open Phase-8
follow-on is #646 (perf-tuning, optional).

### Added — `causl-enumerator` SPEC §16.4.1 closeout (Phase 8 wave-31..40)

This stanza summarizes the bounded-enumerator's SPEC §16.4.1 type-
fidelity closeout. After it, `State` carries all 10 SPEC fields
backed by `im::*` for cheap structural-shared clones, every
`Action` arm in `transition.rs` writes the field SPEC names for it,
the BFS calls the canonical `Oracle::check(s, prev, a)` surface
instead of the deprecated `evaluate(state, trace)` adapter, and
adopters can pass a deterministic `Script` prefix to drive the BFS
through a recorded counterexample.

- **`State` 7-field expansion + `im::*`** (#633). `State` was 3
  fields (`now`, `inputs`, `pending`); now ten per SPEC §16.4.1
  lines 1575–1587: `derived_cache`, `last_write_time`,
  `retention_buf`, `commit_log`, `observers`, `disposed`,
  `resource_fleet`, `pending_pipeline`. The new collection-typed
  fields use `im::OrdMap` / `im::OrdSet` / `im::Vector` so BFS
  successor `State::clone()` is O(log n) shared-structure instead
  of an O(n) deep copy. `State::hash()` participates over every new
  field; serde round-trips byte-stably.
- **`transition.rs` action arms wired** (#635, #636). Every
  `Action` variant now mutates the SPEC field it owns:
  `Commit` → `commit_log` + `last_write_time`; `Dispose` →
  `disposed`; `Subscribe` → `observers`; `Unsubscribe` →
  removes the observer from every set; `BeginFetch` →
  `resource_fleet[r] = Loading`; `ResolvePending` →
  `resource_fleet[r] = Loaded`; `DispatchMsg` → `pending_pipeline`.
  The wave-32 BFS diagnostic now reflects real per-state collection
  growth instead of always-zero.
- **BFS migrates to `Oracle::check`** (#637). The BFS in
  `lib.rs::enumerate` previously called the deprecated
  `Oracle::evaluate(state, trace) -> Option<RaceClass>` adapter.
  Per SPEC §16.4.1 lines 1722–1725 the canonical surface is
  `check(s, prev: Option<&State>, a) -> Vec<RaceClass>`. The BFS
  now calls `check` directly: `prev=None` for the s_0 evaluation,
  `prev=Some(&pre_state)` for transitions. Result: oracles see
  the real pre-transition `State` (impossible via the adapter)
  and a single transition can surface multiple `RaceClass` arms.
  `Step.races` is populated from the check result.
- **`Trace.steps: im::Vector<Step>`** (#639). Closes the BFS-clone
  cost at the data-structure level. `trace.clone()` was O(depth);
  with `im::Vector`'s persistent RRB-tree backbone it's O(log
  depth). The wave-32 frontier cap (#634) becomes belt-and-braces
  rather than load-bearing. Wire format unchanged — `im::Vector`
  serializes as a JSON array.
- **`Step.events: Vec<Event>` + `Step.state_after: Option<StateHash>`**
  (#632, #638). Two SPEC type closeouts: `events` widens from
  string discriminator to the typed three-arm `Event` enum
  (`Notify` / `CommitAppended` / `ResourcePhase`); `state_after`
  becomes optional so a future phased walker can record `None`
  when a transition errors mid-pipeline.
- **`enumerate_with_script(model, bound, script, oracles)`**
  (#640). The SPEC §16.4.1 canonical entry point lands as a new
  function; legacy `enumerate(model, bound, oracles)` becomes a
  sugar wrapper passing `Script::default()`. Adopters who want to
  pin the BFS to a deterministic action prefix (the
  hypothesis-replay surface, the apalache differential's recorded
  counterexample) call the canonical function with their `Script`.
  The script-walk fires oracles on every step and seeds the BFS
  frontier with the post-script `(state, trace)` pair.
- **`Script` + `PendingResolution` + `ResolutionKind`** (#628).
  Three SPEC §16.4.1 types absent from the Rust crate after nine
  prior #570 waves. Pure additive; no signature breakage.
- **wave-32 BFS memory ceilings + `log4rs` diagnostics** (#634).
  Hard caps on `frontier`, `traces_recorded`, and `races` — every
  cap fires `bounded_out: true` for the §16.4.1 honesty contract.
  `causl-enumerate` initializes `log4rs` at startup, writing
  `causl_enumerator::bfs` diagnostics to stderr (every 100k
  transitions + on every termination, with `reason=` field).
  Reapplied cleanly on top of the State expansion after the
  pre-State original was reverted (#626) for breaking `main`.
- **`#570a` mapping invariant validation + Apalache CI workflow**
  (#627). `tools/enumerator/diff/tests/mapping_invariants_resolve.rs`
  is the regression gate that every `(model, invariant)` tuple in
  `mapping.toml` resolves to a real INVARIANT/THEOREM definition.
  `ci/parked/apalache-diff.yml` runs the differential
  binary on PR + nightly cron and uploads
  `docs/apalache-diff-report.md` as an artifact.
- **`causl-check --source <path>` per-site comment suppression CLI**
  (#629). The wave-24 library API
  (`parse_suppressions` / `SuppressionTable` /
  `apply_suppression_table`) had no operator-facing knob.
  `--source <path>` (repeatable) reads the file, runs the per-site
  `// @causl-allow:RuleId — reason: ...` magic-comment parser, and
  applies the resulting suppression table to the report before
  exit-code computation and SARIF emission. Two arg forms:
  `--source <path>` (URI = path) and `--source <path>=<uri>`
  (alias). A missing path is exit 2; malformed magic comments
  surface as `causl/missing-suppression-reason` violations.
- **`causl-check` cycle-pass determinism fix** (#631). The cycle
  detector's DFS root was picked by iterating `HashMap::keys()`,
  which Rust randomizes per-process. Same model produced
  `Violation.node = "c"` ~60% of runs and `"d"` ~40%, false-
  positiving the SPEC §16A.2 `--replay` verdict-determinism gate.
  Fix: sort `derived_ids` lexicographically before iterating.
  `replay_compares_set_not_order` previously flaked at 40%; now
  0/30 across loop runs.
- **`#589` worker-pool acceptance gate** (#630). Pins the five
  SPEC §16.4 contracts (persistent JSON-RPC pool, compute-body
  registry, `Date.now`/`Math.random`/`crypto.randomUUID`/
  `performance.now` sandbox, no silent `MockWorkerPool` fallback,
  1% double-check sampler) at the public-API level so a future
  wave that breaks any one fails this gate before the per-feature
  test does.

### Added — tooling consumers (Phase 8)

This section calls out changes that affect downstream tooling
consumers — IR readers, SARIF pipelines, audit script authors, CLI
integrators — separately from end-user-facing engine and adapter
changes. Per #584's A17-8 audit recommendation, these are the
changes a consumer of the IR / checker / audit machinery
specifically needs to know about.

- **CauslModel IR — SPEC §16.2.1.1/2 documented** (#569). The
  shipped Schema-3 IR shape is now codified in SPEC.md verbatim:
  six IREvent variants (subscribe, subscribe-callback, unsubscribe,
  dispose, read, tx-set), seven-field CauslModel top-level
  (`schema | time | nodes | commits | events | scopes | bridges`),
  full IRSubscribe / IRDispose / IRRead / IRTxSet field shapes
  with serde rename rules. The `spec-ir-parity.test.ts` gate
  (`@causl/core`) trips at PR time when SPEC text drifts from
  source.
- **`@causl/sync`: `whyUpdated` / `whyNotUpdated` decoders +
  `RESOURCE_UPDATE_REASONS`** (#577). Closed seven-arm enumeration
  per SPEC.async §11.1: `fetch-begin | fetch-resolved | fetch-stale
  | fetch-rejected | invalidated | failed | dep-changed`. Decode
  a `CommitForDecoding` + pre/post-state pair into the matching
  reason. `whyNotUpdated` returns `'no-dep-overlap' |
  'object-is-deduped' | null`.
- **`@causl/hypothesis`: SPEC §16.5.1 surface expanded** (#571).
  New: `hypothesis(name, body)` factory returning
  `NamedHypothesis<S>`; `holds(p).until(q)` / `holds(p).weakUntil(q)`
  builder; `fromPredicate(name, p)` factory. Semantic fixes:
  `afterCommit` now evaluates at the immediate successor of each
  commit (was: every step after first commit); `eventually` returns
  three-valued `'unknown'` when the trace was truncated by a bound
  (new optional `Trace.bounded` field).
- **`tools/checker` Rust public surface — new types** (#591).
  Added `PhysicalLocation`, `Region`, `SuppressionStatus`, and
  `rule_id_for_kind` exports. `Violation` gains three optional
  fields (`physical_location`, `suggested_fix`, `suppression_status`)
  flowing through to SARIF as `locations[]`/`fixes[]`/`suppressions[]`.
  All serde-skipped when unset — pre-#591 wire format preserved.
- **`causl-check` CLI — new flags** (#572, #592). Adds
  `--suppress <rule-id>=<reason>` (repeatable) for programmatic
  per-rule suppression and `--replay <report-path>` for verdict-
  determinism. Suppressions surface in SARIF and don't fail the
  exit-code gate. Replay exits 3 on divergence (vs 1 active or 2
  CLI error). Justification is required on every suppression.
- **Audit infrastructure — `pnpm audit:commitments`** (#565, #579).
  Five MECHANICAL audit predicates now run on every PR (was 1
  silently broken pre-#565): commitment 1 (two-primitive IrNode),
  10 (schema lockstep), 11 (race-row witness presence — regex
  widened to match uppercase identifiers), 15 (adapter exhaustiveness
  fixtures), 17 (§10 worked-example fixtures). The 20-row
  commitment ledger lives at `docs/commitment-audit.md`.

### Added
- `@causl/core`: `graph.simulate(intent, run): SimulateResult` — the
  SPEC §5 dry-run API. Predicts what `commit(intent, run)` would do
  without committing: runs the staging + recompute pipeline against a
  transient view, captures the would-be `Commit` plus the staged-input
  / derived-recompute diffs, then unconditionally restores every byte
  the pipeline mutated. `now` does not advance, the commit log is not
  appended to, no per-node or per-commit subscriber fires; engine state
  after return is byte-identical to the pre-call moment. Errors that
  would have escaped `commit` (`NotAnInputNodeError`,
  `UnknownNodeError`, `NodeDisposedError`, `StaleTxError`, plus
  user-thrown exceptions out of the `run` callback or from inside a
  derivation compute) surface on the `'failed'` arm of the
  discriminated `SimulateResult` rather than throw — the only throw is
  `CommitInProgressError` on re-entry. Closes #367.

### Added — review-fix sweep
- `@causl/core`: `subscribeCommits(observer)` (SPEC §11), an
  `onObserverError` hook on `createCausl({...})`, a configurable
  `commitHistoryCap`, and `exportModel()` returning the CauslModel
  IR.
- `@causl/formula`: `FormulaResult` discriminated union (`value` |
  `error`); `FormulaError` with kinds `div-by-zero`, `unresolved-ref`,
  `non-numeric`, `unknown-function`, `argument-error`, `propagated`.
- `@causl/sync`: full `Conflict` lifecycle — `resolve(id, payload)`,
  `ignore(id)`, `supersede(id, by)` with subscriber-visible status flips.
- `@causl/devtools`: `WhyResult.reason` tagged enum; `replaceMany()`
  for batched live-derivation edits.
- `@causl/react`: `useCauslShallow(selector)` — shallow-equality
  hook for object/array selectors; `shallowEqual` helper.
- Property-test seed reproduction: `CAUSL_FUZZ_SEED=<n> pnpm test:run`.
- Husky pre-commit + GitHub Actions CI shape adapted from webapp.

### Changed
- **Engine scheduler** — replaced the O(graph_size) dirty walk with an
  O(|affected|) topological recompute backed by a maintained reverse-dep
  graph (SPEC §14 correctness).
- **Spreadsheet diamond demo** — D = C × B (was C − B, which was
  algebraically constant in A and therefore a useless glitch test).
- **`whyUpdated` / `whyNotUpdated`** — primary output is the structured
  `reason` tag; the human `because` string is now derived rather than
  authoritative.
- **Property test atomicity** — replaced impl-self-compare assertion
  with an external oracle (independent sum recomputation).
- **TypeScript paths** — hoisted into `tsconfig.base.json`, removed
  from per-package configs.
- **`Provider.update`** — typed `Update<Msg, Graph> | undefined` to
  cooperate with `exactOptionalPropertyTypes`.

### Fixed
- Observer thrown errors are no longer silently swallowed — they fire
  through `onObserverError` (default: `console.error`).
- Formula divide-by-zero now produces a tagged `div-by-zero` error
  rather than silently returning 0.
- Formula non-numeric coercion no longer throws inside a `compute`
  (which used to tear down the entire commit) — it surfaces as a
  tagged `non-numeric` error.

### Removed
- `void X` lint silencers across tests and `parser.ts` (replaced with
  no-capture form `g.derived(...)` or removed dead variables).
- `commitHistory` undocumented hard-coded 10k cap (now `commitHistoryCap`,
  default 1000).
- `graph.clearCommitHistory()` — fired `commitLog` subscribers outside a
  commit boundary (§5 violation, #387) and had no production caller
  (#401). Long-lived processes that want zero retention pass
  `commitHistoryCap: 0` (or `1`) at construction; the cap is the only
  memory-hygiene knob.

## Phase 0 — Spec & monorepo bootstrap

The 53 implementation PRs landing the SPEC.md commitments. See the
PR list in the GitHub repo for the per-issue history.
