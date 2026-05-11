# `causl-check` coverage

Annotated companion to [`SPEC.md` §9.1](../SPEC.md#91-where-each-race-class-is-caught) and §16.

This page is kept current per release. It records, for each row in
SPEC §9.1, what `causl-check` actually covers today, what it does
not, and which mechanism (if any) verifies the rest.

**Status (v1):** what the static IR linter covers today. The bounded
enumerator described in SPEC §16.2 is deferred ([#272][i272] closed
not-planned, EPIC [#282][i282]). The 90% target in §16.1 is a v1.x
commitment; v1 ships at the coverage documented below. Any wording
on this page that sounds like state-space enumeration ("exhaustive
within bounds", "replay over a snapshot") is wrong — `causl-check`
is a one-shot static linter over the exported IR. It never executes
a derived's compute, never simulates async resolution, and never
reaches a "second graph" to compare against.

## §9.1 catalogue annotated

| Race class | SPEC layer | Checker coverage |
| --- | --- | --- |
| Concurrent engine mutations (two writers racing to advance time) | API design (compile-time-equivalent) | **N/A.** No public construct exists for the violation, so the checker has nothing to verify here. |
| Reading a not-yet-loaded resource value | Compile-time | **N/A.** TypeScript catches this; the checker echoes the model unchanged. |
| Reading a partially-parsed formula | Compile-time | **N/A.** Same as above. |
| Reading a committed-but-not-yet-published snapshot | API design | **N/A.** No construct exists. |
| Diamond glitches | Semantic | **Pre-flight, partial.** The checker flags one structural smell — a derived listed in `changedNodes` whose static `deps` are not. It does not compute `derived(t) = f(deps(t))` (the IR carries no compute closure — see [`tools/checker/src/ir.rs`](../tools/checker/src/ir.rs) `IrDerived`) and it does not enumerate the reachable state space. State-space enumeration is deferred to the v1.x bounded enumerator ([#282][i282]); glitch-freedom proper remains a §15 `fast-check` property in v1 (see `packages/core/test/properties/glitch-freedom.test.ts`). |
| Stale-async (fetch resolves after dep changed) | Runtime (statechart guard) | **Pre-flight, partial.** The checker validates that a model containing a Resource node has a state tag in the legal `idle/loading/loaded/stale/errored` set; it does NOT replay async timing — that is the job of the §15 `fast-check` suite. |
| Dynamic-dependency cleanup | Pre-deploy fuzz | **Pre-flight, partial.** The checker compares each derived's `deps` to its declared `conditionalDeps`; orphans are reported. The IR cannot enumerate all possible runtime branches, so this remains *probabilistic-with-bounds*. |
| Cycle in a derivation graph | Runtime (first-commit) | **Pre-flight, exhaustive.** The static cycle detector ([`tools/checker/src/cycle.rs`](../tools/checker/src/cycle.rs)) walks the declared edges of the IR's derived sub-graph and reports the first cycle path. It is exhaustive over edges *the IR records*; conditional branches the engine has not yet observed are out of scope. |
| Two app-level Msgs producing inconsistent intermediate state | Application-side | **Out of scope.** The checker treats `update` as opaque. The property-test recipe an adopter writes themselves lives in [`docs/application-side-property-tests.md`](application-side-property-tests.md). |
| Multi-user write-write race | Future epic | **Out of scope.** |

## What each pass actually does

The shipped passes ([`tools/checker/src/check.rs`](../tools/checker/src/check.rs)), in run order:

| Pass | What it checks | How |
| --- | --- | --- |
| `Schema` | `schema == 1`. Short-circuits the rest of the suite on mismatch. | Single integer compare. |
| `Bounds` | `nodes ≤ max_nodes`, `commits ≤ max_commits`. Short-circuits on overflow rather than make a soundness claim it cannot honour. | Two length compares. |
| `UnknownDep` | Every `deps` and `conditionalDeps` entry of every derived references a known node id. | Set-membership over the node-id set. |
| `Cycle` | No cycle exists in the declared edges of the derived sub-graph. | Iterative DFS in `cycle.rs`. |
| `Determinism` | `changedNodes ⊆ knownNodeIds` for every commit in the log. | Set-membership over the node-id set. **Not a replay.** No second graph; no captured snapshot. The pass is named `Determinism` because it would belong under §16.2's determinism invariant if a bounded enumerator ever lands; today it is a foreign-key check over the commit log. |
| `Monotonic` | Commit times are strictly increasing. | One linear scan. |
| `GlitchPropagation` | A derived listed in `changedNodes` has at least one of its static `deps` in the same commit's `changedNodes`. | One linear scan over commits. **Not a denotational check.** The IR has no compute closure, so the pass cannot evaluate `derived(t) = f(deps(t))`. It is a structural smell only; the source comment in `check.rs` says so explicitly. |
| `OrphanDep` | No derived has itself in its declared `deps`. | One linear scan over derived nodes. |

Every pass runs once, top-to-bottom, against the snapshot the JS side
exports via `graph.exportModel()`. There is no enumeration loop.
There is no fixpoint. There is no oracle graph.

## False-positive rate (target)

I track the rate per release and publish it here. v0 baseline:

- **0** false positives observed against the `@causl/core` Phase 1
  test suite, the Phase 3 spreadsheet demo, and the Phase 4 async demo.
- The `bound-exceeded` finding is informational (not a violation of
  the engine) but counts toward the report's exit code 1; tests that
  exceed the configured bounds opt-out by raising `--max-nodes`.

| Release | Models checked | Reports run | Violations | False positives |
| --- | --- | --- | --- | --- |
| v0.0.0 (initial) | 3 (core, formula demo, sync demo) | 3 | 0 | 0 |

## Coverage % against §9.1

The 90% target in SPEC §16.1 is a v1.x commitment, not a v1 claim.
v1 ships at roughly 50% of the §9.1 catalogue:

- 5 of 10 §9.1 rows are addressed (those marked **N/A** and **Pre-flight**) — i.e. ~50%.
- 4 rows remain explicitly out-of-scope or deferred to the §15 property suite.
- 1 row (multi-user) is a future-epic concern.

[#272][i272]'s closure note frames this as "~60% with a clear path to
6–7 via cheap extensions" — meaning the cheap-extension PRs ([#286][i286]
IR extension, [#289][i289] async-resolution, [#293][i293] Msg-dispatch)
would lift coverage to roughly 60–70% if landed; the static linter as
shipped is at 5/10. Both numbers are reconciled against the actual pass
list above; pick whichever framing is clearer in context.

## What guards the rest

The checker does not verify glitch-freedom or replay determinism. The
§15 property suite does, against random commit traces under `fast-check`:

| Invariant | Static linter coverage | Property-test coverage |
| --- | --- | --- |
| Glitch-freedom (diamond) | n/a (one structural smell only — `GlitchPropagation` pass) | `packages/core/test/properties/glitch-freedom.test.ts` — `fast-check` 1000 trials per CI run |
| Cycle reachability | exhaustive over declared IR edges (`Cycle` pass) | `packages/core/test/properties/cycle-completeness.test.ts` — covers conditional branches the IR did not capture |
| Dynamic-dep cleanup | `deps` vs `conditionalDeps` orphan smell only | `packages/core/test/properties/dynamic-deps.test.ts` — `fast-check` 1000 trials |
| Stale-async | n/a (state-tag membership only) | `fast-check` 1000 trials in the async suite |
| Determinism (replay) | n/a (`changedNodes ⊆ knownNodeIds` set-membership only — `Determinism` pass) | `packages/core/test/properties/replay-determinism.test.ts` ([#278][i278]) — two-graph byte-equal replay under `fc.commands` |

Bounded model checking — the §16.2 enumeration of orderings, branches,
and reachable states with per-state invariant assertions — is deferred
to the v1.x epic ([#282][i282]). It is not part of v1. Where this page
or SPEC §16 once read "exhaustive within bounds", read "static linter
plus property tests" until [#282][i282] lands.

## Where this page is referenced

- `SPEC.md` §16.6 acceptance criterion: "A documented 'what we cover
  and what we don't' page lives in the repo, with the false-positive
  rate reported per release."
- `docs/ci.md` failure modes section.

[i272]: https://github.com/iasbuilt/causl/issues/272
[i278]: https://github.com/iasbuilt/causl/issues/278
[i282]: https://github.com/iasbuilt/causl/issues/282
[i286]: https://github.com/iasbuilt/causl/issues/286
[i289]: https://github.com/iasbuilt/causl/issues/289
[i293]: https://github.com/iasbuilt/causl/issues/293
