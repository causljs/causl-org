/**
 * The bundle-budget ceilings README quotes must be the ones the gate
 * enforces (issue #308, folded in).
 *
 * `README.md`'s *Bundle-budget status* section is the only place an
 * adopter reads a number without running `pnpm size`. It said the
 * `@causl/causl-wasm-ts/wasm` cell was capped at **13 KB** and was "still
 * over" it. Both halves were inherited from `causljs/causl-ts` — its #39,
 * *"chore(size): tighten @causl/core/wasm budget 13 KB → 6 KB"*, and its
 * #22, *"Bundle-budget overage: @causl/core (createCausl-only) +502 B;
 * @causl/core/wasm +3.52 kB"* — and neither survived the move. The
 * §14.2.2 leading-ceiling reconciliation put that cell at 20 KB in
 * `tools/size-budget/js-budget.cjs`, and it measures under it.
 *
 * Repointing the dead issue link without correcting the number would have
 * left a false claim behind a correct link, so the number is pinned here:
 * every ceiling README prints must equal the js-budget SSOT.
 *
 * RED before the fix: README quoted 13 KB for a cell the SSOT caps at
 * 20 KB.
 *
 * `js-budget-contract.test.mjs` binds the SSOT to `.size-limit.cjs` and to
 * the measured bundle; this file binds it to the prose. The chain is
 * README → SSOT → size-limit cell → built artefact, with no free link.
 */

import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { jsCeilings } = require(join(repoRoot, 'tools', 'size-budget', 'js-budget.cjs'))
const { RUNS_DIR } = require(join(repoRoot, 'tools', 'size-budget', 'w7-cells.cjs'))

const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')

/**
 * How README names each SSOT cell in its bundle-budget bullets. Keyed by
 * the SSOT cell name so a renamed cell fails loudly here rather than
 * silently dropping out of the check.
 *
 * The values used to be label SUFFIXES (`(full import)`), because
 * `.size-limit.cjs` keyed four of its five cells by the retired
 * `@causl/core` specifier while README already used the current one, so
 * there was no whole string both sides shared — SPEC §14.2.2 recorded
 * exactly that and deferred the rename. #282 landed the rename, so these
 * are now the FULL cell names and the binding is total.
 */
const README_LABELS = {
  '@causl/causl-wasm-ts (full import)': '@causl/causl-wasm-ts (full import)',
  '@causl/causl-wasm-ts (createCausl-only)': '@causl/causl-wasm-ts (createCausl-only)',
  '@causl/causl-wasm-ts/wasm (Phase-1 loader + WasmBackend wrapper)':
    '@causl/causl-wasm-ts/wasm (Phase-1 loader + WasmBackend wrapper)',
}

// `- \`@causl/…\` (label) ≤ **20 KB**` — the ceiling README prints.
const CEILING_IN_BULLET = /≤\s*\*\*([\d.]+)\s*KB\*\*/

test('README names every js-budget cell in its bundle-budget bullets', () => {
  assert.deepEqual(
    Object.keys(README_LABELS).sort(),
    Object.keys(jsCeilings).sort(),
    'the js-budget SSOT and this test disagree about which cells exist',
  )
})

/**
 * README writes the specifier in backticks and the label outside them —
 * `` - `@causl/causl-wasm-ts` (full import) … `` — so stripping backticks is
 * what lets the whole cell name be matched verbatim.
 */
function bulletFor(label) {
  return readme
    .split('\n')
    .find((line) => line.trimStart().startsWith('- ') && line.replace(/`/g, '').includes(label))
}

for (const [cell, label] of Object.entries(README_LABELS)) {
  test(`[${cell}] README prints the js-budget ceiling, not an inherited one`, () => {
    const bullet = bulletFor(label)
    assert.ok(bullet, `no README bundle-budget bullet mentions '${label}'`)

    const printed = CEILING_IN_BULLET.exec(bullet)
    assert.ok(printed, `README bullet for '${label}' prints no '≤ **N KB**' ceiling:\n${bullet}`)

    assert.equal(
      `${printed[1]} KB`,
      jsCeilings[cell],
      `README says ${printed[1]} KB for '${cell}'; ` +
        `tools/size-budget/js-budget.cjs says ${jsCeilings[cell]}`,
    )
  })
}

/**
 * README's over/under claim must be the MEASURED one, in both directions.
 *
 * This test used to assert one direction only — that no README line describes a
 * cell as over its ceiling — on the stated ground that "`pnpm size` exits 0 on
 * this tree". That was true when it was written (#308 measured
 * 17.7 / 15.69 / 19.75 kB at `fa92be9`) and stopped being true while the test
 * stayed green, because it never read a measurement: it asserted a remembered
 * fact about the gate. The result was a test that FORBADE README from telling
 * the truth once a cell went over.
 *
 * It now reads the committed #282 capture and enforces whichever direction the
 * capture records. Green-when-green is the original assertion, unchanged;
 * red-when-red is new, and is the half that was missing.
 */
const referencePath = join(repoRoot, RUNS_DIR, 'reference.json')

test('README\'s over/under claim is the captured one, in both directions', () => {
  assert.ok(
    existsSync(referencePath),
    `no committed capture at ${RUNS_DIR}/reference.json to read the measured ` +
      'state from — see tools/size-budget/__tests__/w7-capture.test.mjs',
  )
  const capture = JSON.parse(readFileSync(referencePath, 'utf8'))
  const failing = capture.cells.filter((c) => !c.passed)

  const linesMatching = (re) =>
    readme
      .split('\n')
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => re.test(line))
      .map(([n, line]) => `README.md:${n}  ${line.trim()}`)

  if (failing.length === 0) {
    // The original assertion, verbatim in effect: prose that claims a red gate
    // sends a reader looking for one that is not there.
    const stale = readme
      .split('\n')
      .map((line, i) => [i + 1, line])
      .filter(
        ([, line]) =>
          /\bsize\b|\bceiling\b|bundle[- ]budget/i.test(line) &&
          /\bstill (over|red)\b|\bknown-red\b|\bover the .{0,24}ceiling\b/i.test(line),
      )
    assert.deepEqual(
      stale.map(([n, line]) => `README.md:${n}  ${line.trim()}`),
      [],
      'the committed capture records every cell under its ceiling, but README ' +
        'still describes one as over',
    )
    // Per cell, not only per prose pattern. The inherited regex above requires
    // the literal `over the … ceiling`, so `over its ceiling` slipped past it.
    // Deliberately PRESENT-tense only: a bullet is allowed — and #352's is
    // required — to record that a cell *was* over before a band amendment. What
    // it may not do is assert a breach that the capture does not show.
    const PRESENT_TENSE_BREACH =
      /\bover its (?:\d[\d.]*\s?KB\s)?ceiling\b|\bstill over\b|\b(?:is|remains|sits)\s(?:currently\s)?(?:\*\*)?[\d.]*\s?(?:KB\s)?over\b/i
    for (const cell of capture.cells) {
      const bullet = bulletFor(cell.name)
      if (!bullet) continue
      assert.ok(
        !PRESENT_TENSE_BREACH.test(bullet.replace(/`/g, '')),
        `the committed capture records '${cell.name}' at ${cell.measuredBytes} B under its ` +
          `${cell.limitBytes} B ceiling, but README's bullet asserts a current breach:\n${bullet}`,
      )
    }
    return
  }

  // The missing direction. A cell IS over, so README must say so — naming the
  // cell and the gap — and must not simultaneously claim the gate is green.
  for (const cell of failing) {
    const bullet = bulletFor(cell.name)
    assert.ok(bullet, `no README bundle-budget bullet names the over-ceiling cell '${cell.name}'`)
    assert.match(
      bullet,
      /\bover\b/i,
      `the committed capture records '${cell.name}' at ${cell.measuredBytes} B against a ` +
        `${cell.limitBytes} B ceiling, but README's bullet does not say it is over:\n${bullet}`,
    )
    const gapKB = String(Number((cell.overByBytes / 1000).toFixed(2)))
    assert.ok(
      bullet.replace(/`/g, '').includes(gapKB),
      `README's bullet for '${cell.name}' does not print the measured gap of ${gapKB} KB:\n${bullet}`,
    )
  }
  assert.deepEqual(
    linesMatching(/`?pnpm size`?[^.\n]{0,60}\bexits 0\b|bundle budget gates green/i),
    [],
    'a cell is over its ceiling in the committed capture, yet README still claims ' +
      '`pnpm size` exits 0 / the budget gates green',
  )
})
