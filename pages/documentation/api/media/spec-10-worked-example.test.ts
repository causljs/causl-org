/**
 * @packageDocumentation
 *
 * The smallest worked example I will support, treated as the
 * engine's acceptance gate. Before any cell, any formula, any
 * resource, the engine must support a four-line graph
 * (`a`, `b`, `sum = a + b`, `sumPlusOne = sum + 1`) where a
 * subscriber sees `4`, then `13` after `bump-a`, then `301` after
 * `bump-both` — exactly one notification per commit, never two.
 *
 * If this works, the engine is real. The four invariants — atomic
 * commit, dependency tracking, dynamic-dep cleanup, glitch-free
 * diamond — fall out of this example. Everything else in the
 * project is downstream of getting this right; this is also the
 * commitment that the example is the gate for "the engine is
 * real" and that no other phase begins until it works.
 *
 * The first test runs the example verbatim and pins the observed
 * value sequence plus the post-commit clock. The second dedicates a
 * block to each of the four invariants the worked example calls out.
 * The third drives the same `[4, 13, 301]` emission sequence through
 * the §8 MVU front door — a typed `Msg` discriminated union plus an
 * `Update<Msg, Graph>` handler that issues `graph.commit(...)` — to
 * demonstrate that the application surface §8 promises is real, not
 * documentation-only. The MVU primitives are defined inline so the
 * core acceptance gate stays free of any binding-package dependency
 * (the React binding ships the same shape under `@causl/react`,
 * but §8 is a claim about the engine itself).
 */

import { beforeAll, describe, expect, it } from 'vitest'
import type { Graph } from '../src/index.js'
import { createCauslWasmSync, preloadCauslWasm } from '../wasm/index.js'

// #279 (W4) — ported off the deleted `createCauslTs` onto the engine that
// ships. This file is SPEC §10's acceptance gate: "if this works, the engine
// is real". It was never a claim about the TS floor, it is a claim about
// whatever engine Causl ships, so after #279 the only honest place to run it
// is rust-ssot. The preload resolves the bridge ONCE for the file and
// `createCauslWasmSync()` is then synchronous, so no cell becomes async.
beforeAll(async () => {
  await preloadCauslWasm({ bridge: 'wasmgc-classic' })
})

/**
 * Acceptance suite for the smallest worked example. Each test pins
 * one facet of the worked example so regressions surface as a named
 * invariant breakage.
 */
describe('SPEC §10 worked example', () => {
  /**
   * Runs the worked-example listing exactly as written and asserts
   * the documented `[4, 13, 301]` emission sequence and final clock
   * value — the second commit writes both `a` and `b` together and
   * must produce exactly one notification, not two.
   */
  it('runs verbatim and emits the expected sequence', () => {
    // Arrange: assemble the worked-example graph and record observed values.
    const log: number[] = []

    const graph = createCauslWasmSync()
    const a = graph.input('a', 1)
    const b = graph.input('b', 2)
    const sum = graph.derived('sum', (get) => get(a) + get(b))
    const sumPlusOne = graph.derived('sumPlusOne', (get) => get(sum) + 1)

    // Act: subscribe (initial fire = 4), then drive two commits.
    graph.subscribe(sumPlusOne, (v) => log.push(v))
    // 4

    graph.commit('bump-a', (tx) => tx.set(a, 10))
    // 13

    graph.commit('bump-both', (tx) => {
      tx.set(a, 100)
      tx.set(b, 200)
    })
    // 301 — exactly one notification, not two

    // Assert: emission sequence and post-commit clock both match the SPEC.
    expect(log).toEqual([4, 13, 301])
    expect(graph.now).toBe(2)
  })

  /**
   * Walks through the four invariants the worked example promises
   * fall out of the construction: atomic commits, dependency
   * tracking, dynamic-dep cleanup, and glitch-free diamond
   * propagation.
   */
  it('demonstrates the four invariants the example calls out', () => {
    const graph = createCauslWasmSync()

    // (1) atomic commit — two writes in one tx must produce one consistent emission.
    const a = graph.input('a', 1)
    const b = graph.input('b', 2)
    const sum = graph.derived('sum', (get) => get(a) + get(b))
    const log: number[] = []
    graph.subscribe(sum, (v) => log.push(v))
    graph.commit('atomic', (tx) => {
      tx.set(a, 10)
      tx.set(b, 20)
    })
    // Atomic: one notify per commit even with two writes; the value is
    // f(a_t1, b_t1), never f(a_t1, b_t0).
    expect(log).toEqual([3, 30])

    // (2) dependency tracking — derived recomputes when an input changes.
    graph.commit('bump-a', (tx) => tx.set(a, 11))
    expect(graph.read(sum)).toBe(31)

    // (3) dynamic-dep cleanup — branch flips drop stale upstream edges
    //     *and* wire up fresh ones. Both halves of the invariant must be pinned.
    const flag = graph.input('flag', true)
    let chosenComputes = 0
    const chosen = graph.derived('chosen', (get) => {
      chosenComputes++
      return get(flag) ? get(a) : get(b)
    })
    chosenComputes = 0
    // Flip the branch so `chosen` reads `b` instead of `a`.
    graph.commit('flip-off', (tx) => tx.set(flag, false))
    const baseline = chosenComputes
    // Negative half: touching `a` afterwards must not wake `chosen`, since it
    // no longer reads `a`. The stale `a → chosen` edge must have been dropped.
    //
    // DIVERGENCE, PINNED — NOT WEAKENED (#279 W4). SPEC §10.3 spells this
    // half `expect(chosenComputes).toBe(baseline)` and `createCauslTs()`
    // delivered exactly that. `createCauslWasmSync()` recomputes `chosen`
    // exactly ONCE more here. Cause, read off the source rather than guessed:
    // the interim causl-client#103 rewire lift re-registers the rewired dep
    // set after the commit window closes (`wasm/authoritative.ts`, the
    // `#pendingRewires` drain), and `causl-core-rs`'s `RegisterDerived` apply
    // arm (`tools/engine-rs-bridge/src/apply_commands.rs`, step 2) REPLACES
    // `cell.deps` and then calls `register_dep` for the new deps without ever
    // calling `unregister_dep` for the ones the prior registration owned. So
    // `State.dependents[a]` still names `chosen` while the forward adjacency
    // no longer does — `graph.dependents(a)` is already `[]` at this point,
    // which is why nothing that reads the structural facade can see it — and
    // the Kahn drain walks the stale reverse edge one last time. Owner:
    // `causl/causl-core-rs#217`, whose Problem statement is this symptom
    // ("keeps all stale edges forever, causing spurious recomputes on every
    // future change to `a`") and whose fix swept only the sibling site in
    // `compute_bridge.rs`. Two-directional ratchet: the day the apply arm
    // unregisters, this line goes RED and the commit that restores
    // `toBe(baseline)` is the commit that strikes the divergence record in
    // `fixtures/cross-engine/dispositions/spec-10-worked-example.disposition.ts`.
    // RATCHET FIRED (causl/causl-core-rs#217, PR #348, `ccacc049`). The block
    // above named the condition exactly: "the day the apply arm unregisters,
    // this line goes RED and the commit that restores `toBe(baseline)` is the
    // commit that strikes the divergence record". The apply arm now
    // unregisters. This assertion read `toBe(baseline + 1)`; SPEC §10.3 spells
    // it `toBe(baseline)`, and both engines now deliver that.
    graph.commit('bump-a-not-read', (tx) => tx.set(a, 999))
    expect(
      chosenComputes,
      'a write to the input `chosen` no longer reads recomputed it. §10.3 ' +
        'requires the abandoned edge to be retired at the recompute that ' +
        'abandoned it; a count of baseline + 1 here is a REGRESSION of ' +
        'causl/causl-core-rs#217.',
    ).toBe(baseline)
    // …and it is LATE by exactly one commit, not ABSENT. The recompute the
    // line above pins re-captures the read set through the FIXED
    // compute-bridge path, which drops the stale edge — so a SECOND mutation
    // of the dropped input is silent and §10.3's negative half holds from
    // here on. This cell is load-bearing: without it the pin above could not
    // distinguish a one-commit lag from an engine with no two-sided cleanup
    // at all, and "rust recomputes more" would be an unfalsifiable note.
    // …and it is ABSENT, not merely late. This cell was load-bearing when the
    // line above pinned a one-commit lag — it is what distinguished a lag from
    // an engine with no two-sided cleanup at all. It stays, now asserting that
    // the second mutation is silent for the same reason the first is.
    graph.commit('bump-a-still-not-read', (tx) => tx.set(a, 1000))
    expect(chosenComputes).toBe(baseline)
    // Positive half: touching `b` must wake `chosen` exactly once and the
    // observed value must follow `b`. The fresh `b → chosen` edge must be
    // live. Green on rust-ssot unedited — the widened half of §10.3 is
    // honoured, so the divergence above is one-sided.
    graph.commit('bump-b-now-read', (tx) => tx.set(b, 42))
    expect(chosenComputes).toBe(baseline + 1)
    expect(graph.read(chosen)).toBe(42)

    // (4) glitch-free diamond — both legs converge to a single consistent emission.
    const observed: string[] = []
    const x = graph.input('x', 0)
    const left = graph.derived('left', (get) => get(x) + 1)
    const right = graph.derived('right', (get) => get(x) * 10)
    const diamond = graph.derived('diamond', (get) => `${get(left)}|${get(right)}`)
    graph.subscribe(diamond, (v) => observed.push(v))
    graph.commit('x→5', (tx) => tx.set(x, 5))
    graph.commit('x→7', (tx) => tx.set(x, 7))
    // Assert: no transient mixed-clock readings — exactly one emission per commit.
    expect(observed).toEqual(['1|0', '6|50', '8|70'])
  })

  /**
   * Drives the same `[4, 13, 301]` emission sequence through the §8
   * MVU front door. The application-facing surface §8 promises is a
   * typed `Msg` discriminated union plus an `Update<Msg, Graph>`
   * handler that turns each message into a `graph.commit(...)`; this
   * test asserts that going through that front door produces the
   * exact same observed values, the exact same clock progression,
   * and the same one-notification-per-commit guarantee as the
   * verbatim listing.
   *
   * The MVU types are declared inline so the engine's acceptance
   * gate has no binding-package dependency. The `Update` signature
   * matches `@causl/react`'s today (`(msg, graph) => graph`); to
   * stay agnostic of any upstream signature flux the handlers issue
   * `graph.commit(...)` against the captured `graph` and the runner
   * simply ignores any return value, so the same test would pass
   * unchanged against a `(msg, graph) => void` `Update` shape.
   */
  it('drives the same [4, 13, 301] sequence through the §8 MVU front door', () => {
    // The application-defined Msg union — one tag per intent the
    // worked example exercises. `bump-a` carries a `value` payload;
    // `bump-both` carries both `a` and `b` because §10's third commit
    // sets them together inside a single transaction.
    type Msg =
      | { readonly kind: 'bump-a'; readonly value: number }
      | { readonly kind: 'bump-both'; readonly a: number; readonly b: number }

    // The Update contract: a function from (Msg, Graph) to the next
    // Graph. The runner is allowed to call `graph.commit(...)`; the
    // *returned* handle is the same Graph instance, whose `now` has
    // advanced by exactly one. Declaring the type inline mirrors the
    // shape `@causl/react` ships and matches §8's listing.
    type Update<M, G extends Graph = Graph> = (msg: M, graph: G) => G

    // Assemble the worked-example graph. The structure is identical
    // to the verbatim test; only the *write path* changes.
    const log: number[] = []
    const graph = createCauslWasmSync()
    const a = graph.input('a', 1)
    const b = graph.input('b', 2)
    const sum = graph.derived('sum', (get) => get(a) + get(b))
    const sumPlusOne = graph.derived('sumPlusOne', (get) => get(sum) + 1)

    // The Update handler — a switch over the Msg union, each arm
    // issuing exactly one `graph.commit(...)`. Every Msg becomes one
    // commit; the engine's "time advances by one per commit" rule
    // means dispatching N messages advances `graph.now` by N.
    const update: Update<Msg> = (msg, g) => {
      switch (msg.kind) {
        case 'bump-a':
          g.commit('bump-a', (tx) => tx.set(a, msg.value))
          return g
        case 'bump-both':
          g.commit('bump-both', (tx) => {
            tx.set(a, msg.a)
            tx.set(b, msg.b)
          })
          return g
      }
    }

    // Subscribe (initial fire = 4), then dispatch the same two
    // logical edits §10 mandates — but as messages, not transactions.
    graph.subscribe(sumPlusOne, (v) => log.push(v))
    // 4

    // The dispatch loop is the runner: messages are sequenced into
    // commits one at a time, with no batching. Equivalent to
    // `runMessages(update, graph, [...])` from `@causl/react`.
    const messages: readonly Msg[] = [
      { kind: 'bump-a', value: 10 },
      { kind: 'bump-both', a: 100, b: 200 },
    ]
    for (const msg of messages) {
      update(msg, graph)
    }

    // Assert: the front-door path produces the identical observed
    // sequence and the identical post-commit clock as the direct
    // `graph.commit(...)` path. The atomic-commit guarantee carries
    // through dispatch — `bump-both` is one message, one commit, one
    // notification, never two.
    expect(log).toEqual([4, 13, 301])
    expect(graph.now).toBe(2)
  })
})
