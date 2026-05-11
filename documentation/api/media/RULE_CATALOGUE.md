# Migration Rule Catalogue (v0.1)

> **Status.** Initial draft. The format and the first set of rule IDs are the contract; the per-rule predicates and tests will be filled in by the open Adoption Epic F PRs (#197, #198) once they adopt this catalogue. The drift detector (`@causl/migration-check`) consumes this document; the migration guides (`docs/migration/from-{jotai,mobx,redux}.md`) reference it by rule ID.
>
> **Voice.** First person, as the team's representative.

---

## What this catalogue is for

I'm publishing this catalogue because Epic F's three PRs in flight (#197 migration guides, #198 drift detector, #199 validation procedure) currently disagree on:

- Where each rule lives (guide bullet vs detector predicate vs validation check).
- What severity means.
- How a guide reader's LLM identifies which rule a given pattern violates.

That disagreement is the failure mode the catalogue eliminates. From this commit forward, every drift-detector rule has a stable `RULE_ID`, every migration guide cites those rule IDs in its "before/after" examples, and the validation procedure cross-references the catalogue when reporting findings.

If a future PR introduces a rule, the rule ID is allocated here first, the guide section is written second, the detector implementation is written third, and the validation suite picks both up automatically. That ordering is binding.

---

## Rule ID format

```
<source>-<two-digit-number>
```

- **`source`** — `J` (Jotai), `M` (MobX), `R` (Redux/RTK), or `S` (cross-source / causl-idiomatic).
- **`number`** — sequential within the source, zero-padded to two digits. Once allocated, the number is permanent — even if the rule is deprecated. Reserve gaps for related rules (e.g. `J-10`–`J-19` for atom-shape rules) so future additions stay in adjacent ranges.

Examples:

- `J-01` — first Jotai-source rule.
- `M-12` — twelfth MobX-source rule.
- `R-03` — third Redux-source rule.
- `S-04` — fourth cross-source / causl-idiomatic rule.

---

## Per-rule schema

Every rule in the catalogue carries this shape:

```yaml
id: <RULE_ID>
status: draft | accepted | superseded:<RULE_ID> | deprecated
severity: critical | important | nice-to-have
title: <short title — fits in a CLI table row>
predicate: <one-sentence description of when this rule fires>
spec_ref: <SPEC.md anchor, e.g. "§5", "§9.1 row N", "§13">
guide_section: <docs/migration/from-X.md heading, or 'cross-source'>
detector_test: <packages/migration-check/test/<id>.test.ts path>
since: <semver of @causl/migration-check that introduced the rule>
example_before: |
  // Pattern in the source library
example_after: |
  // Idiomatic causl replacement
rationale: |
  Why this matters; what regression it prevents.
```

The catalogue itself ships as a versioned YAML file (`packages/migration-check/rules.yaml`) consumed by the detector. This document is the human-readable mirror; the YAML is the contract.

---

## Initial rule allocations (draft)

These IDs are **reserved** for the Epic F PRs to fill in. The detector PR (#198) writes the predicates and tests; the guide PR (#197) writes the before/after examples and rationale.

### Jotai → causl (J-NN)

| ID | Severity | Title | Predicate (sketch) |
| --- | --- | --- | --- |
| `J-01` | critical | `atom(initial)` → `graph.input(id, initial)` | An `atom()` call with a non-function argument. |
| `J-02` | critical | `atom((get) => ...)` → `graph.derived(id, compute)` | An `atom()` call with a single function argument. |
| `J-03` | critical | `atomFamily(...)` → `useCauslFamily(...)` (Adoption Epic A) | An `atomFamily()` import or call. |
| `J-04` | important | `atomWithStorage(key, initial)` → `persistedInput(graph, key, initial, opts)` | An `atomWithStorage()` import or call. |
| `J-05` | critical | `useAtomValue(atom)` → `useCausl((g) => g.read(node))` | A `useAtomValue` import or call. |
| `J-06` | critical | `useSetAtom(atom)` → typed `useDispatch<Msg>()` (no ambient setter) | A `useSetAtom` import or call. |
| `J-07` | important | `loadable(atom)` → `useCauslSuspense` *or* `useCausl` with tag narrowing | A `loadable()` import or call. |
| `J-08` | important | `Provider` scope → `<CauslProvider graph={...} update={...}>` | A `<Provider>` element from `jotai`. |
| `J-09` | nice-to-have | atom written to *outside* a React component | A `useSetAtom` ref captured in a closure invoked from an effect or timeout. |

### MobX → causl (M-NN)

| ID | Severity | Title | Predicate (sketch) |
| --- | --- | --- | --- |
| `M-01` | critical | `makeAutoObservable(this)` → explicit `graph.input` registrations | A class constructor that calls `makeAutoObservable`. |
| `M-02` | critical | `@computed` getter → `graph.derived` | A `@computed`-decorated getter or `computed(() => ...)`. |
| `M-03` | critical | `@observable` field → `graph.input` | An `@observable`-decorated class field. |
| `M-04` | important | `runInAction(() => { ... })` → single `graph.commit(intent, tx => { ... })` | A `runInAction` block containing two or more property assignments. |
| `M-05` | important | `reaction(track, effect)` → `graph.subscribe(node, observer)` | A `reaction` import or call. |
| `M-06` | nice-to-have | `autorun(() => ...)` → `graph.subscribe` *or* a derived node observed once | An `autorun` import or call. |

### Redux / RTK → causl (R-NN)

| ID | Severity | Title | Predicate (sketch) |
| --- | --- | --- | --- |
| `R-01` | critical | `createSlice` reducers with multiple actions → typed `Msg` union + `update : Msg → Model → Commit` | A `createSlice` call with a `reducers` object. |
| `R-02` | critical | `useSelector(state => ...)` → `useCausl((g) => g.read(node))` | A `useSelector` import or call. |
| `R-03` | critical | `useDispatch()` callback → typed `useDispatch<Msg>()` | A `useDispatch` import or call from `react-redux`. |
| `R-04` | important | `createAsyncThunk` → `@causl/sync` `resource(graph, key, loader)` | A `createAsyncThunk` import or call. |
| `R-05` | important | `createSelector(...)` memoized → `graph.derived` (engine memoizes by default) | A `createSelector` import or call. |
| `R-06` | nice-to-have | `extraReducers` matching `pending|fulfilled|rejected` → resource state-tag narrowing | An `extraReducers` builder containing `addCase` for `*.pending`. |

### Cross-source / causl-idiomatic (S-NN)

These rules apply regardless of the source library — they catch common LLM-migration mistakes.

| ID | Severity | Title | Predicate (sketch) |
| --- | --- | --- | --- |
| `S-01` | critical | Multiple sequential mutations where one `commit` would do | Two or more `setX(); setY();` calls in immediate succession (or a `runInAction` block with multiple assignments) outside a `commit`. |
| `S-02` | critical | `update` returns the graph instead of a new model | Function annotated `Update<Msg, Model>` whose body returns the `graph` argument. |
| `S-03` | critical | Asymmetric `tx.set` / `g.read` (read inside commit via `g.read` instead of `tx.get`) | A `g.read(...)` call inside a `commit` callback's `tx => { ... }` body. |
| `S-04` | important | `useEffect` cascade where a derived would suffice | A `useEffect` whose dependency array contains a causl-read value AND whose body sets a different causl input. |
| `S-05` | important | Stale-closure dispatcher (closure captures graph from a prior render) | A `dispatch`/setter reference captured in a closure not re-bound across renders. |
| `S-06` | important | Untyped `Msg` union (string-typed actions) | `dispatch('foo')` or `dispatch({ type: 'foo' })` without a discriminated `Msg` union type annotation. |
| `S-07` | important | `useState`/`useReducer` for state that should be a `graph.input`/`derived` | A `useState` whose value is read by another component via context or prop-drilling — the canonical signal that it should be lifted into the graph. |
| `S-08` | nice-to-have | Imports from a deferred/non-existent symbol | Imports of `useCauslSuspense`, `persistedInput`, `useCauslFamily`, or other phantom symbols from packages whose corresponding Adoption epic hasn't shipped. |
| `S-09` | critical | Codemod-style transformation comments | A `// TODO(causl-migrate)` or similar marker indicating the LLM left a manual step undone. |

---

## Severity meanings

| Severity | Effect on `npx causl-migration-check` |
| --- | --- |
| `critical` | Exit code 1 — fails CI. The migrated code violates a causl semantic guarantee or imports a non-existent surface. |
| `important` | Exit code 0 with a warning summary. The migrated code is structurally valid but loses an idiomatic causl property (e.g. transactional batching). |
| `nice-to-have` | Exit code 0 with an info note. The migrated code is fine; the rule flags an opportunity. |

The exit-code contract is binding. A CI pipeline integrating `causl-migration-check` at PR-time can rely on `critical` to block merge.

---

## How the catalogue evolves

- **Adding a rule.** Open a PR that (a) appends a row to the table above, (b) adds the YAML entry to `packages/migration-check/rules.yaml`, (c) adds the failing-then-fixed test pair to `packages/migration-check/test/`, and (d) — if the rule is source-specific — updates `docs/migration/from-<source>.md` with the before/after example. All four must land together.
- **Bumping a rule's severity.** A breaking change to consumers' CI exit codes. Requires a major version bump on `@causl/migration-check` and an entry in the changelog naming the rule and the rationale.
- **Deprecating a rule.** Mark `status: deprecated` in the YAML; keep the row in this document with a strikethrough and a `Superseded by: <new-id>` note. Never reuse the rule ID.
- **Schema-version bumps.** This document and `rules.yaml` share a schema version (currently `0.1`). When the schema changes (e.g. adding a new field to every rule), bump both.

---

## What this catalogue is *not*

- Not a codemod definition. The team committed in Epic F to LLM-driven migration, not jscodeshift transformations. Rules describe *predicates over migrated code*, not transformations from source to target.
- Not a complete list of patterns the source libraries support. Coverage starts at the foot-guns and grows as user reports come in.
- Not a substitute for the migration guides. The guides teach; the catalogue audits. Both are required.
