#!/usr/bin/env node
/**
 * Bare-`#N` reference gate — a bare issue reference in this repository's
 * shipped text means THIS repository's tracker (issue #308).
 *
 * ─── Why this exists ────────────────────────────────────────────────────
 *
 * This repository is the third link in a chain of moves:
 *
 *   github.com/iasbuilt/causl   (predecessor monorepo, #1 … #1500-ish)
 *     → github.com/causljs/causl-ts   (the TypeScript fork, #1 … #46)
 *       → git.opsite.ca/causl/causl-wasm-ts   (here, #1 … #313 and counting)
 *
 * Text moved down that chain, the numbers in it did not. Two failure modes
 * result, and this gate catches both:
 *
 *   1. **Dangles.** `#689` and `#691` were cited as live in `graph.ts`,
 *      `DISTRIBUTION.md`, `README.md` and `.gitea/workflows/wasm.yml`.
 *      They are `iasbuilt/causl` numbers; they 404 from every tracker that
 *      is still reachable. A reader following one gets nothing.
 *   2. **Collisions — the worse case.** The predecessor trackers restarted
 *      at 1, so a low fork number lands on a real but *unrelated* issue
 *      here. A dangle 404s and a reader knows something is wrong; a
 *      collision resolves, reads as authoritative, and is wrong. Two live
 *      examples, both found by this gate:
 *
 *        `README.md` cited `#22` for a bundle-budget overage.
 *        `causljs/causl-ts#22` is *"Bundle-budget overage: @causl/core
 *        (createCausl-only) +502 B; @causl/core/wasm +3.52 kB"*;
 *        `causl/causl-wasm-ts#22` is *"Node.js CI/CD packaging &
 *        deployment scripts (wasm integration kit)"*, closed 2026-06-22.
 *        A reader following it lands on packaging scripts and concludes
 *        the budget note is stale — the exact opposite of the truth,
 *        which is that there is no overage at all (`tools/size-budget/
 *        js-budget.cjs:63` caps the cell at 20 KB and `pnpm size` exits
 *        0). Two wrong beliefs from one resolving link.
 *
 *        `packages/core/wasm/{cmd-buf,tagged-types,value-buf}.ts` cite
 *        *"Tagged-type bridge (issue #28)"* five times, meaning the
 *        wasm-engine fork's #28 (Set/Map/Date/Temporal round-trip).
 *        `causl/causl-wasm-ts#28` is a closed PULL REQUEST, *"docs(spec):
 *        resolve §18A.7 Criterion 3 perf-floor as GO / RESOLVED"*. Same
 *        failure, in shipped source rather than a README — and invisible
 *        until `packages/core/wasm` entered SCOPE.
 *
 * Existence alone cannot catch a collision, so this gate also checks the
 * **kind** a citation claims. `PR #25` must be a pull request here and
 * `issue #15` must be an issue here — the fork's numbering disagrees with
 * ours on kind far more often than it agrees, so kind is a cheap, purely
 * offline detector for imported numbers that happen to be in range.
 *
 * ─── The two rules ──────────────────────────────────────────────────────
 *
 *   BARE_REF_OUT_OF_RANGE  a bare `#N` with N > the highest number this
 *                          repository has allocated. It cannot be ours.
 *   BARE_REF_WRONG_KIND    prose says `PR #N` / `issue #N` and N is the
 *                          other kind here.
 *
 * A reference is **not** bare, and is therefore exempt, when it names its
 * repository — `iasbuilt/causl#689`, `causl/causl-core-rs#170`, `cw#321` —
 * or when it is a markdown link whose target names another repository,
 * `[#1073](https://github.com/iasbuilt/causl/issues/1073)`. Both forms are
 * already used in this repository (`.gitea/workflows/cross-backend-fuzz
 * .yml:102`, `CONTRIBUTING.md:33`, `DISTRIBUTION.md:171`); they are what
 * "explicitly marked as an upstream reference" looks like here.
 *
 * ─── Compound references: the qualifier distributes over the run ─────────
 *
 * `cw#189/#190`, `causl/causl-core-rs#321/#323` and
 * `iasbuilt/xldatagrid#1253/#1285` all cite two numbers in one tracker with
 * one qualifier. That reading — the head names the repository, every number
 * in the run belongs to it — used to be an ACCIDENT of the lookbehind: `/`
 * sits in its excluded class, so a `#N` after a slash was exempt whatever
 * preceded the run. The accident cut both ways. In `#321/#323`, written
 * BARE, the `#323` was exempt too: one finding, never two, and the only way
 * to learn the tail was there at all was to qualify the head and watch
 * nothing change. Nothing in this repository was hiding behind that on the
 * day it was fixed (a run-aware pass and the old pass agree, finding for
 * finding, on all 27 files in scope), but `#22/#1073` would have been one
 * silent dangle, and `#22` alone is the collision in the header above.
 *
 * A run — `#N`, `#N/#M`, `#N/#M/#O` — is now matched WHOLE and judged by
 * its head. Qualified head: every number in it is exempt, as the writers of
 * the three forms above intended. Bare head: every number in it is checked.
 * A run yields at most ONE finding however many numbers offend, because the
 * unswept budget counts citations and `#883/#881` is one citation.
 *
 * ─── What this gate does NOT catch — the watermark decays ───────────────
 *
 * `BARE_REF_OUT_OF_RANGE` is a proxy, and it is a WEAKENING one. It fires
 * on `#N > highestNumber` because a number this repository has not minted
 * cannot be its own. Every number this repository mints therefore retires
 * a little of the rule: an upstream `#N` that read as a loud dangle
 * yesterday reads as a silent collision the day `#N` is allocated here.
 *
 * That is not hypothetical. Refreshing the snapshot for this change moved
 * `highestNumber` 313 → 318 and, in the same step, turned EIGHTEEN bare
 * `#318` citations — all of them `causl/causl-core-rs#318`, *"commit_log
 * lacks the cap / originatedAt / horizon parity …"*, in prose about
 * exactly that — from findings into silence. They were qualified in the
 * same commit rather than left to rot. It happened again at 318 → 339:
 * nine bare `causl/causl-core-rs#320` / `#321` / `#323` citations, on a
 * watermark move where #320, #321 and #323 are all real closed pull
 * requests HERE — nine dangles becoming nine collisions in one write.
 *
 * The 341 → 372 move (issue #369) is the third, and it is the one that
 * shows what the refusal is worth. Sixteen of the findings it would have
 * hidden were bare `#359`, `#360`, `#363`, `#366` and `#368`, imported
 * wholesale in `6b0dc75` from the predecessor monorepo and owned by
 * `iasbuilt/causl`. Every one of those five numbers is also a real pull
 * request opened HERE in August 2026, about a release train, a port
 * wave, a bundle gate, a registry switch and an engine pin, so
 * `--accept-hidden=359,360,363,366,368` would have recorded five
 * collisions as "ours, cited early" in the time it takes to type them.
 * `__tests__/issue-references.test.mjs` pins that set by hand now,
 * because an accepted number and a qualified citation look identical to
 * every other check in this file.
 *
 * The obligation that catches this is: **diff the finding set before and
 * after a refresh, and sweep what the refresh hid.** The READING is not
 * automatable — telling "our #318" from "theirs" is a judgement — but the
 * DIFF is, and leaving it to whoever happens to read this paragraph is how
 * it went unmade twice. {@link refreshDiff} makes it, and `--refresh`
 * refuses to write while it is non-empty. Two ways past the refusal, and
 * both are a decision somebody records:
 *
 *   - **qualify the site** (`causl/causl-core-rs#321`) — it stops being a
 *     finding under both watermarks, so the refresh hides nothing;
 *   - **`--accept-hidden=N,…`** — for a number that genuinely IS ours,
 *     cited before this repository minted it (`#328` in `differential-pr
 *     .yml`, PR #338). Every hidden number must be named; the accepted
 *     ones are recorded in `repo-numbers.json#acceptedAsOurs`, so the
 *     reading survives as a claim someone made and review can check.
 *
 * Neither route is reachable while the candidate watermark is missing:
 * both are keyed on the BAND the move opens, and a band with no upper
 * bound is empty for every finding, so the refusal that is supposed to
 * catch a decaying watermark used to walk straight past a missing one.
 * That is why the floor in "a zero has to prove it looked" is checked
 * before any of this, below.
 *
 * `snapshotAt`'s companion `previousHighestNumber` records the watermark
 * the current one was refreshed FROM, which is what lets
 * `__tests__/issue-references.test.mjs` re-run that diff on every CI run
 * instead of trusting that it was made once.
 *
 * Below the watermark only {@link CLAIMS_PULL} / {@link CLAIMS_ISSUE}
 * kind disagreement is left, and it only fires when the prose happens to
 * name a kind. So: this gate stops NEW dangles above the watermark and
 * catches the subset of collisions that misname a kind. It does not, and
 * cannot, certify that every `#N` below the watermark means this repo.
 *
 * ─── The unswept budget ─────────────────────────────────────────────────
 *
 * `unswept-budget.json` freezes the count of findings in files that #308
 * did not sweep. A file absent from it must be clean — asserted, not
 * merely stated, in `__tests__/issue-references.test.mjs`. A file listed
 * in it may not EXCEED its number, and today every number EQUALS its
 * file's count, so the slack is zero and one new bare `#N` anywhere in
 * scope is a failure.
 *
 * That last sentence is now CHECKED rather than asserted at the reader.
 * `__tests__/watermark-floor-465.test.mjs` measures the budget against the
 * tree and fails while this file claims zero slack and the two disagree,
 * because the claim had quietly drifted to a slack of 31: the budget
 * totalled 735 against 704 findings, and thirty-one new bare citations
 * could have landed across six files without turning the gate red
 * (causl/causl-wasm-ts#465). A freeze that nobody re-measures is headroom
 * with a freeze's name on it. The drift was banked back to 704, which is
 * the fix that makes the sentence true rather than the one that softens it.
 *
 * Dropping below a number is a notice, not a failure, so that a concurrent
 * edit which happens to delete a stale citation does not turn someone
 * else's green branch red:
 *
 *   node tools/reference-gate/check-issue-references.mjs --lower-budget
 *
 * banks those drops. It can only LOWER an existing number, never raise one
 * and never add a file. That is NOT on its own enough to keep the ratchet,
 * and this file used to claim it was: lowering every entry to zero is a
 * reset, and one empty scan lowers all 24 at once, reports `banked 24
 * drop(s)` and exits 0. What keeps the ratchet is the floor under the scan
 * that feeds it, below.
 *
 * ─── Refreshing the snapshot ────────────────────────────────────────────
 *
 *   GITEA_TOKEN=… node tools/reference-gate/check-issue-references.mjs --refresh
 *
 * `repo-numbers.json` records the highest number allocated and which of
 * them are pull requests. Gitea allocates issue and pull numbers from one
 * counter, so `1 … highestNumber` has no holes (re-verified at the 339
 * snapshot: 339 numbers, min 1, max 339, zero gaps, and no number at or
 * below the previous watermark changed kind). The snapshot only ever goes
 * stale UPWARD — a citation of a number minted after `snapshotAt` reports
 * as out of range and the message says to refresh. The refusal described
 * in the decay note above is what a refresh runs into; read it there.
 *
 * ─── The floors: a zero has to prove it looked ──────────────────────────
 *
 * Several checks in this file answer with an empty set when they cannot
 * look, and an empty set is also what a swept repository looks like. The
 * two readings are the same value downstream, which is why each one now
 * states a floor and refuses on its own behalf instead of returning
 * (causl/causl-wasm-ts#465):
 *
 *   - {@link requireWatermark}. `highestNumber` has to be a positive
 *     integer, checked where the rules READ it and not only where
 *     `--refresh` builds it. A 200 carrying `[]` (this forge's answer for
 *     a private repository read with an under-scoped token) made it
 *     `undefined`, and `JSON.stringify` DROPS an undefined value rather
 *     than writing `null`, so the snapshot reached disk with the key gone.
 *     Both rules, the gap check and the refresh refusal are comparisons
 *     against that number, and every one of them is empty for every input
 *     once it is missing: the measured run hid 724 findings, adjudicated
 *     none, printed `refreshed:` and exited 0.
 *   - {@link requireNonEmptyScan}, over each scoped entry. `readdirSync`
 *     throws on a MISSING directory, which is the case this file was
 *     written for; an existing and EMPTY one returns `[]`, and the note on
 *     SCOPE below names that hazard in as many words. The floor is per
 *     ENTRY rather than over the total, because two of the five scoped
 *     paths are single files and a whole-scan floor would never fire while
 *     those two survive an emptied `.gitea/workflows`.
 *   - A candidate watermark BELOW the committed one, refused immediately
 *     before the write. The snapshot only ever goes stale upward, so a
 *     watermark that moved DOWN is a partial answer rather than a smaller
 *     repository, and writing one would put the whole gap back in range in
 *     a single step.
 *
 * The rule and its wording are `packages/core/test/support/scan-refusal
 * .ts`, this repository's version of the same sentence for its TypeScript
 * side. It is restated here rather than imported because the pre-commit
 * hook runs this file with bare `node`.
 *
 * Exit code: 0 clean, 1 on any finding, 1 on any refusal above.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const repoRoot = resolve(here, '..', '..')

/**
 * The scope #308's Definition of done names: shipped documentation, the
 * shipped source of `@causl/core`, and the workflows.
 *
 * "The shipped source of `@causl/core`" is BOTH source roots, not just
 * `src`. `packages/core/tsup.config.ts:115-120` builds four entries and
 * one of them, `./wasm` → `dist/wasm.js`, is compiled from
 * `packages/core/wasm/index.ts`; `packages/core/package.json` exports it
 * and ships it. `packages/core/tsconfig.json` typechecks `wasm/**` and
 * `packages/core/package.json`'s `lint` script lints it — by every other
 * measure in this repository it is first-class shipped source.
 *
 * It was omitted here when the gate landed, and the omission was not
 * cosmetic: `packages/core/wasm/**` carries 162 findings, including the
 * `#28` collision below, which is the *worse* of the two failure modes
 * this file was written for. `tools/reference-gate/__tests__/issue-
 * references.test.mjs` now derives the shipped roots from tsup and fails
 * if a future entry point is added without extending this array, because
 * a scope that under-declares itself reports a total that means something
 * narrower than it says — which is worse than reporting nothing.
 */
export const SCOPE = [
  { kind: 'file', path: 'README.md' },
  { kind: 'file', path: 'DISTRIBUTION.md' },
  // causl/causl-wasm-ts#409 moved every workflow into `.gitea/workflows`,
  // the root Gitea actually reads. The legacy forge root has since been
  // removed outright, so there is no second directory to scan and no
  // empty-directory total to report. The directory named here can still be
  // emptied by the next move, and `listFiles()` refuses that rather than
  // counting it (causl/causl-wasm-ts#465).
  { kind: 'dir', path: '.gitea/workflows', extensions: ['.yml', '.yaml'] },
  { kind: 'dir', path: 'packages/core/src', extensions: ['.ts'] },
  { kind: 'dir', path: 'packages/core/wasm', extensions: ['.ts'] },
]

/**
 * The floor under every rule in this file: the watermark has to be a positive
 * integer, checked where the rules READ it and not only where it is built.
 *
 * `BARE_REF_OUT_OF_RANGE` is `n > snap.highestNumber` and the refresh refusal
 * is keyed on the band `from.highestNumber < n <= to.highestNumber`. Both
 * comparisons are `false` for every input the moment the number is missing, so
 * a snapshot with no watermark does not make the gate wrong in a way anybody
 * can see: it makes the gate answer "nothing found" to every question, which
 * is the one answer indistinguishable from a swept repository
 * (causl/causl-wasm-ts#465).
 *
 * Returns the watermark, so a caller can use it in the same expression that
 * validates it.
 *
 * @param snap - A snapshot, committed or candidate.
 * @param role - Which snapshot this is, in the words of whoever has to fix it.
 */
export function requireWatermark(snap, role) {
  const n = snap?.highestNumber
  if (Number.isInteger(n) && n > 0) return n
  // `String` rather than `JSON.stringify`, which renders NaN as `null` and
  // would name the wrong defect in the one message somebody reads.
  const shown = typeof n === 'string' ? JSON.stringify(n) : String(n)
  throw new Error(
    `REFUSING TO MEASURE: ${role} carries ` +
      (n === undefined ? 'no `highestNumber` at all' : `\`highestNumber\` ${shown}`) +
      ', which is not a positive integer. Every rule in this gate is keyed on ' +
      'that number, and every one of them is empty for every input once it is ' +
      'missing, so the gate reports a clean tree and a refresh reports success ' +
      'in the same step as it disarms itself. The cause to check first: a ' +
      '`--refresh` against a forge answer of `[]`, which is what this forge ' +
      'returns for a private repository read with an under-scoped token, and ' +
      'which `JSON.stringify` then writes out as a snapshot with the key gone.',
  )
}

/**
 * The other half of the same rule, for a scan rather than a number: a reading
 * of zero has to prove it looked.
 *
 * This is `requireNonEmptyScan` from `packages/core/test/support/scan-refusal
 * .ts`, restated rather than imported because that module is TypeScript and
 * this gate is a plain script the pre-commit hook runs with bare `node`. The
 * sentence and the `REFUSING TO MEASURE:` opener are kept verbatim so the two
 * copies read as one rule.
 *
 * @param found - The scan's results.
 * @param scan - `{ subject, how, certainly, likelyCause }`: what was scanned,
 *   the call that did the looking, why zero is a contradiction here, and the
 *   first thing to check when it fires.
 */
export function requireNonEmptyScan(found, scan) {
  if (found.length > 0) return found
  throw new Error(
    `REFUSING TO MEASURE: \`${scan.how}\` found nothing under ${scan.subject}. ` +
      `${scan.certainly}, so zero is not a reading of it, it is a scan that did ` +
      'not run. The two are the same empty set to everything downstream, which ' +
      'is why this refuses rather than returns.' +
      (scan.likelyCause === undefined
        ? ''
        : ` The cause to check first: ${scan.likelyCause}`),
  )
}

const snapshot = JSON.parse(
  readFileSync(join(here, 'repo-numbers.json'), 'utf8'),
)
// A disarmed snapshot on disk is a gate that reports success from its first
// line, so it is refused at load rather than at first use: nothing downstream
// of here, including `--lower-budget`, gets to run against one.
requireWatermark(snapshot, 'tools/reference-gate/repo-numbers.json')

const budget = JSON.parse(
  readFileSync(join(here, 'unswept-budget.json'), 'utf8'),
)

/**
 * `new Set(snapshot.pullNumbers)`, memoised per snapshot object — the kind
 * rule asks this question once per reference and `collectFindings` runs
 * over both watermarks on every `--refresh`.
 */
const pullSets = new WeakMap()
function pullsOf(snap) {
  let set = pullSets.get(snap)
  if (set === undefined) {
    set = new Set(snap.pullNumbers)
    pullSets.set(snap, set)
  }
  return set
}

// A reference RUN, matched whole: a head `#N` plus any `/#M` that follow it
// with nothing in between. The head is BARE when nothing that could name a
// repository precedes it — `owner/repo#N`, `repo#N` and `cw#321` all end in
// a word char, `/` or `-` immediately before the `#`, which the lookbehind
// rejects, and the same lookbehind is what stops a run's own `/#M` tail
// from being re-read as a fresh head. `\b` after the digits keeps hex-ish
// tokens (`#1a2b3c`) out. See "Compound references" in the header for why
// the tail is judged by the head rather than exempted on sight.
const REF_RUN = /(?<![A-Za-z0-9._/#-])#(\d+)\b((?:\/#\d+\b)*)/g

// `[#N](url)` where the url names some other owner/repo — an explicit
// upstream reference, exempt. Captures the span so the bare matcher's hit
// on the visible `#N` can be dropped.
const LINKED_REF = /\[#(\d+)\]\(\s*(\S+?)\s*\)/g

const REPO_IN_URL = /^(?:https?:\/\/)?[^/]+\/([^/]+)\/([^/]+)\/(?:issues|pull|pulls)\/\d+/

// The kind a citation claims, read off the text immediately before it.
// Markdown emphasis, a link's `[` and backticks may sit in between.
const CLAIMS_PULL = /\b(?:PRs?|pull\s+requests?)\s*[[`*(]*$/i
const CLAIMS_ISSUE = /\bissues?\s*[[`*(]*$/i

/**
 * Every file in scope, with a floor under each scoped entry.
 *
 * `readdirSync` on a MISSING directory throws, which is the case this function
 * was written for. An existing and EMPTY one returns `[]`, and so does a filter
 * that has stopped matching, and both of those reach the report as "0
 * finding(s) in scope" and exit 0. The note on SCOPE names that hazard: the
 * workflow root has already moved once (causl/causl-wasm-ts#409), and the
 * directory it moved TO is one `git mv` from being the empty one. So each
 * scoped entry now states its own floor and refuses on its own behalf
 * (causl/causl-wasm-ts#465).
 *
 * The floor is PER ENTRY, not only over the total. Two of the five scoped
 * paths are single files, so emptying all three directories still leaves a
 * total of two and a whole-scan floor would never fire.
 */
function listFiles() {
  const out = []
  for (const entry of SCOPE) {
    const abs = join(repoRoot, entry.path)
    if (entry.kind === 'file') {
      requireNonEmptyScan(existsSync(abs) ? [abs] : [], {
        subject: entry.path,
        how: `existsSync('${entry.path}')`,
        certainly: `${entry.path} is a scoped file of this repository and is committed`,
        likelyCause:
          'a rename that moved the file and left SCOPE naming the old path, which ' +
          'reports the file as carrying no citations rather than as absent',
      })
      out.push(abs)
      continue
    }
    const found = []
    const walk = (dir) => {
      for (const name of readdirSync(dir).sort()) {
        const child = join(dir, name)
        if (statSync(child).isDirectory()) {
          walk(child)
        } else if (entry.extensions.some((e) => name.endsWith(e))) {
          found.push(child)
        }
      }
    }
    walk(abs)
    requireNonEmptyScan(found, {
      subject: `${entry.path}/`,
      how: `readdirSync('${entry.path}') filtered to ${entry.extensions.join(', ')}`,
      certainly:
        `${entry.path} is a scoped source root of this repository and carries ` +
        'files the gate has counted findings in',
      likelyCause:
        'a `git mv` of the directory, or an extension the filter no longer names; ' +
        'both leave the path in place and report its whole contents as swept',
    })
    out.push(...found)
  }
  return requireNonEmptyScan(out, {
    subject: `the ${SCOPE.length} paths in SCOPE`,
    how: 'listFiles()',
    certainly: 'SCOPE names the shipped docs, both @causl/core source roots and the workflows',
    likelyCause: 'a SCOPE entry list that has been emptied or filtered down to nothing',
  })
}

/** `#1`, `#1 and #2`, `#1, #2 and #3` — the detail messages read as prose. */
function listRefs(numbers) {
  const refs = numbers.map((n) => `#${n}`)
  if (refs.length === 1) return refs[0]
  return `${refs.slice(0, -1).join(', ')} and ${refs[refs.length - 1]}`
}

/**
 * Every bare-reference finding in one line of text, as
 * `{ numbers, number, code, detail, column }`. `numbers` is every number in
 * the offending run and `number` is the first that offends, so a caller
 * looking for one number (`f.number === 689`) still sees a lone reference
 * and one looking for all of them (`f.numbers.includes(881)`) sees a
 * compound too.
 *
 * `snap` defaults to the committed snapshot. `--refresh` passes the
 * candidate one so the two finding sets can be diffed before it is written.
 */
export function findingsInLine(line, snap = snapshot) {
  // Checked HERE, where the out-of-range rule reads it, and not only where
  // `--refresh` builds it. A caller that hands this function a snapshot is
  // asking it a question; a snapshot with no watermark makes the answer `[]`
  // whatever the line says.
  requireWatermark(snap, 'the snapshot these rules are reading')

  const exemptSpans = []
  for (const m of line.matchAll(LINKED_REF)) {
    const url = REPO_IN_URL.exec(m[2])
    const namesAnotherRepo = url && `${url[1]}/${url[2]}` !== snap.repo
    if (namesAnotherRepo) {
      exemptSpans.push([m.index, m.index + m[0].length])
    }
  }

  const findings = []
  for (const m of line.matchAll(REF_RUN)) {
    if (exemptSpans.some(([lo, hi]) => m.index >= lo && m.index < hi)) continue

    const numbers = [
      Number(m[1]),
      ...[...m[2].matchAll(/\d+/g)].map((d) => Number(d[0])),
    ]

    const outOfRange = numbers.filter((n) => n > snap.highestNumber)
    if (outOfRange.length > 0) {
      findings.push({
        numbers,
        number: outOfRange[0],
        code: 'BARE_REF_OUT_OF_RANGE',
        column: m.index + 1,
        detail:
          `${listRefs(outOfRange)} ${outOfRange.length > 1 ? 'are' : 'is'} ` +
          `above the highest number ${snap.repo} had allocated on ` +
          `${snap.snapshotAt} (#${snap.highestNumber}). Either qualify the ` +
          `reference with the repository that owns it (e.g. ` +
          `iasbuilt/causl#${outOfRange[0]}) or refresh repo-numbers.json.`,
      })
      continue
    }

    const before = line.slice(0, m.index)
    const pulls = pullsOf(snap)
    const claimsPull = CLAIMS_PULL.test(before)
    const claimsIssue = !claimsPull && CLAIMS_ISSUE.test(before)
    if (!claimsPull && !claimsIssue) continue

    const wrong = numbers.filter((n) => pulls.has(n) !== claimsPull)
    if (wrong.length > 0) {
      findings.push({
        numbers,
        number: wrong[0],
        code: 'BARE_REF_WRONG_KIND',
        column: m.index + 1,
        detail: claimsPull
          ? `cited as a pull request, but ${snap.repo}${listRefs(wrong)} ` +
            `${wrong.length > 1 ? 'are issues' : 'is an issue'}.`
          : `cited as an issue, but ${snap.repo}${listRefs(wrong)} ` +
            `${wrong.length > 1 ? 'are pull requests' : 'is a pull request'}.`,
      })
    }
  }
  return findings
}

/** Every finding in scope, as `{ file, line, column, number, code, detail }`. */
export function collectFindings(snap = snapshot) {
  const findings = []
  for (const abs of listFiles()) {
    const rel = relative(repoRoot, abs).split(sep).join('/')
    const lines = readFileSync(abs, 'utf8').split('\n')
    lines.forEach((text, i) => {
      for (const f of findingsInLine(text, snap)) {
        findings.push({ file: rel, line: i + 1, ...f })
      }
    })
  }
  return findings
}

/** The identity of a finding across two watermarks: where it is, and why. */
const findingKey = (f) => `${f.file}:${f.line}:${f.column}:${f.code}`

/**
 * What moving from watermark `from` to watermark `to` does to the finding
 * set: `hidden` are findings that stop being reported, `revealed` are ones
 * that start. This is the diff the "watermark decays" note calls the
 * refresher's obligation. It answers only WHAT changed — whether a hidden
 * `#N` was ours all along or is an upstream number about to start colliding
 * silently is the reading nobody can automate.
 */
export function refreshDiff(from, to) {
  const before = collectFindings(from)
  const after = collectFindings(to)
  const afterKeys = new Set(after.map(findingKey))
  const beforeKeys = new Set(before.map(findingKey))
  return {
    before,
    after,
    hidden: before.filter((f) => !afterKeys.has(findingKey(f))),
    revealed: after.filter((f) => !beforeKeys.has(findingKey(f))),
  }
}

/**
 * The watermark the committed snapshot was last refreshed FROM, rebuilt as
 * a snapshot so {@link refreshDiff} can re-run that refresh's diff offline.
 *
 * `pullNumbers` is reconstructed by dropping everything above the old
 * watermark, which is exact as long as a number does not change kind after
 * it is allocated — it cannot here (Gitea never converts a merged pull
 * request into an issue), and the 318 → 339 refresh re-measured it: zero
 * numbers at or below 318 disagreed with the 318 snapshot on kind.
 */
export function previousSnapshot(snap = snapshot) {
  const previous = snap.previousHighestNumber
  if (typeof previous !== 'number') return undefined
  return {
    ...snap,
    highestNumber: previous,
    pullNumbers: snap.pullNumbers.filter((n) => n <= previous),
  }
}

/**
 * The numbers a finding would need adjudicated for the move `from` → `to`
 * to be allowed to hide it: the ones the move brings into range.
 */
export function numbersLegitimisedBy(finding, from, to) {
  return finding.numbers.filter(
    (n) => n > from.highestNumber && n <= to.highestNumber,
  )
}

/** `{ overBudget, underBudget }` — files whose finding count left its budget. */
export function reconcileWithBudget(findings) {
  const counts = new Map()
  for (const f of findings) counts.set(f.file, (counts.get(f.file) ?? 0) + 1)

  const overBudget = []
  for (const [file, actual] of [...counts].sort()) {
    const allowed = budget.files[file] ?? 0
    if (actual > allowed) overBudget.push({ file, actual, allowed })
  }

  const underBudget = []
  for (const [file, allowed] of Object.entries(budget.files).sort()) {
    const actual = counts.get(file) ?? 0
    if (actual < allowed) underBudget.push({ file, actual, allowed })
  }
  return { overBudget, underBudget }
}

/**
 * Bank every drop below budget, and ONLY drops. Raising a number, or
 * adding a file, is the defect this gate exists to stop — a command that
 * could do either would turn the ratchet into a rubber stamp, so this one
 * refuses (exit 1) while anything is over budget and writes nothing.
 */
function lowerBudget() {
  const findings = collectFindings()
  const { overBudget, underBudget } = reconcileWithBudget(findings)
  if (overBudget.length > 0) {
    process.stderr.write(
      `--lower-budget refuses: ${overBudget.length} file(s) are OVER budget. ` +
        'Sweep them, or qualify the references; the budget never rises.\n' +
        overBudget
          .map(({ file, actual, allowed }) => `  ${file}: ${actual} > ${allowed}\n`)
          .join(''),
    )
    return 1
  }
  if (underBudget.length === 0) {
    process.stdout.write('--lower-budget: nothing to bank; every file is at its number\n')
    return 0
  }
  const next = { ...budget, files: { ...budget.files } }
  for (const { file, actual } of underBudget) {
    process.stdout.write(`  ${file}: ${next.files[file]} → ${actual}\n`)
    next.files[file] = actual
  }
  writeFileSync(
    join(here, 'unswept-budget.json'),
    `${JSON.stringify(next, null, 2)}\n`,
  )
  process.stdout.write(`--lower-budget: banked ${underBudget.length} drop(s)\n`)
  return 0
}

function main() {
  if (process.argv.includes('--lower-budget')) {
    process.exit(lowerBudget())
  }

  if (process.argv.includes('--refresh')) {
    refreshSnapshot().then(
      (code) => process.exit(code),
      (err) => {
        process.stderr.write(`refresh failed: ${err.message}\n`)
        process.exit(1)
      },
    )
    return
  }

  const findings = collectFindings()
  const { overBudget, underBudget } = reconcileWithBudget(findings)

  const byFile = new Map()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }

  // A file that was already carrying hundreds of budgeted findings would
  // bury the one that broke it, so long listings are truncated.
  const MAX_LISTED = 25

  const overNames = new Set(overBudget.map((o) => o.file))
  for (const { file, actual, allowed } of overBudget) {
    process.stdout.write(
      `\n${file}: ${actual} unresolved bare reference(s), budget ${allowed}\n`,
    )
    const rows = byFile.get(file)
    for (const f of rows.slice(0, MAX_LISTED)) {
      process.stdout.write(
        `  ${file}:${f.line}:${f.column}  #${f.number}  ${f.code}\n` +
          `      ${f.detail}\n`,
      )
    }
    if (rows.length > MAX_LISTED) {
      process.stdout.write(
        `  … and ${rows.length - MAX_LISTED} more in ${file}\n`,
      )
    }
  }

  for (const { file, actual, allowed } of underBudget) {
    process.stdout.write(
      `notice: ${file} is now at ${actual} (budget ${allowed}) — ` +
        `lower it in tools/reference-gate/unswept-budget.json\n`,
    )
  }

  const budgeted = findings.length - findings.filter((f) => overNames.has(f.file)).length
  process.stdout.write(
    `\nreference-gate: ${findings.length} finding(s) in scope; ` +
      `${budgeted} within the unswept budget; ` +
      `${overBudget.length} file(s) over budget\n`,
  )

  process.exit(overBudget.length === 0 ? 0 : 1)
}

/** `--accept-hidden=320,328` → `Set { 320, 328 }`; absent → empty. */
export function parseAcceptHidden(argv) {
  const accepted = new Set()
  for (const arg of argv) {
    const m = /^--accept-hidden=(.*)$/.exec(arg)
    if (!m) continue
    for (const part of m[1].split(',')) {
      const n = Number(part.trim().replace(/^#/, ''))
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--accept-hidden: "${part.trim()}" is not an issue number`)
      }
      accepted.add(n)
    }
  }
  return accepted
}

/**
 * The refusal that keeps the decay note's obligation from depending on
 * whoever reads it. Returns `{ ok, hidden, revealed, unadjudicated,
 * adjudicated, report }` for the move `from` → `to`; `ok` is false while a
 * finding would be hidden that `accepted` does not name.
 *
 * Pure and offline, so `__tests__/issue-references.test.mjs` can drive it
 * over synthetic watermarks without a token or a network.
 */
export function refreshOutcome(from, to, accepted = new Set()) {
  // Both ends, before anything is diffed. This refusal is keyed on
  // `numbersLegitimisedBy`, which asks `n > from.highestNumber && n <=
  // to.highestNumber`; an upper bound that is not a number makes that band
  // empty for EVERY finding, so `unadjudicated` comes back empty however many
  // the move hid and `ok: true` lets `--refresh` write. The refusal that is
  // supposed to catch a decaying watermark cannot be the thing that walks past
  // a missing one (causl/causl-wasm-ts#465).
  requireWatermark(from, 'the watermark this refresh moves FROM')
  requireWatermark(to, 'the candidate snapshot this refresh would write')

  const { hidden, revealed } = refreshDiff(from, to)
  const needed = new Map()
  for (const f of hidden) {
    for (const n of numbersLegitimisedBy(f, from, to)) {
      if (!needed.has(n)) needed.set(n, [])
      needed.get(n).push(f)
    }
  }
  const unadjudicated = hidden.filter((f) =>
    numbersLegitimisedBy(f, from, to).some((n) => !accepted.has(n)),
  )
  const adjudicated = [...needed.keys()].filter((n) => accepted.has(n)).sort((a, b) => a - b)

  let report = ''
  if (unadjudicated.length > 0) {
    report =
      `--refresh refuses: moving the watermark #${from.highestNumber} → ` +
      `#${to.highestNumber} would hide ${unadjudicated.length} finding(s). ` +
      'A finding that stops being reported has not been answered — it has ' +
      'stopped being asked. Read each one:\n\n' +
      unadjudicated
        .map(
          (f) =>
            `  ${f.file}:${f.line}:${f.column}  ${listRefs(
              numbersLegitimisedBy(f, from, to),
            )}  ${f.code}\n`,
        )
        .join('') +
      '\nFor each: if the number belongs to another tracker, QUALIFY it in ' +
      'place\n(`causl/causl-core-rs#321`) and it stops being a finding under ' +
      'both watermarks.\nIf it is genuinely this repository\'s, cited before ' +
      'the number was minted,\nname it:\n\n' +
      `    --refresh --accept-hidden=${[...needed.keys()]
        .sort((a, b) => a - b)
        .join(',')}\n\n` +
      'Accepted numbers are recorded in repo-numbers.json#acceptedAsOurs.\n'
  }
  return { ok: unadjudicated.length === 0, hidden, revealed, unadjudicated, adjudicated, report }
}

async function refreshSnapshot() {
  const token = process.env.GITEA_TOKEN
  if (!token) throw new Error('set GITEA_TOKEN to refresh the snapshot')
  const accepted = parseAcceptHidden(process.argv)
  const numbers = new Map()
  for (const type of ['issues', 'pulls']) {
    for (let page = 1; ; page++) {
      const url =
        `${snapshot.apiBase}/repos/${snapshot.repo}/issues` +
        `?state=all&limit=50&type=${type}&page=${page}`
      const res = await fetch(url, {
        headers: { Authorization: `token ${token}` },
      })
      if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
      const batch = await res.json()
      if (batch.length === 0) break
      for (const row of batch) {
        numbers.set(row.number, row.pull_request ? 'pull' : 'issue')
      }
    }
  }
  const all = [...numbers.keys()].sort((a, b) => a - b)

  // The floor under the paging above, and it comes BEFORE the watermark is
  // computed. Every page answering `[]` leaves `all` empty, `all[all.length -
  // 1]` is then `undefined`, and `JSON.stringify` drops an `undefined` value
  // rather than writing `null`, so the snapshot goes to disk with no watermark
  // key at all and every rule keyed on it stops firing. A 200 carrying `[]` is
  // what this forge answers for a private repository read with an under-scoped
  // token, which is how this token has failed before.
  requireNonEmptyScan(all, {
    subject: snapshot.repo,
    how: `GET ${snapshot.apiBase}/repos/${snapshot.repo}/issues?state=all&type=issues|pulls`,
    certainly:
      `${snapshot.repo} has already allocated #1 … #${snapshot.highestNumber}, ` +
      'and a forge never un-allocates a number',
    likelyCause:
      'a token with no `read:issue` scope on a private repository, which this ' +
      'forge answers with 200 and an empty array rather than with 401 or 403',
  })

  const highestNumber = requireWatermark(
    { highestNumber: all[all.length - 1] },
    'the watermark this refresh read off the forge',
  )

  // The gate leans on "1 … highestNumber has no holes" — a hole would make
  // an in-range citation of a number nobody minted read as resolvable.
  const gaps = []
  for (let n = 1; n <= highestNumber; n++) if (!numbers.has(n)) gaps.push(n)
  if (gaps.length > 0) {
    throw new Error(
      `${snapshot.repo} reports ${gaps.length} unallocated number(s) at or below ` +
        `#${highestNumber} (${listRefs(gaps.slice(0, 10))}${gaps.length > 10 ? ', …' : ''}). ` +
        'The snapshot assumes one gapless counter; investigate before pinning it.',
    )
  }

  // Key order is CHOSEN, not inherited from the previous file: this snapshot
  // is read by people and `pullNumbers` is 150-odd lines long, so every
  // scalar goes above it. Anything a later change adds and this builder does
  // not know about is preserved, at the end.
  const ordered = {
    README:
      'REGENERATE WITH: node tools/reference-gate/check-issue-references.mjs ' +
      '--refresh — it refuses while the move would hide a finding; see ' +
      '"the watermark decays" in that file',
    repo: snapshot.repo,
    apiBase: snapshot.apiBase,
    snapshotAt: new Date().toISOString().slice(0, 10),
    // Only a real watermark MOVE closes the band behind it. A re-run that
    // mints nothing must not rewrite that history: otherwise `--refresh`
    // twice in a row would retire the standing check on the band the first
    // one opened, turning "the sweep held" into "nobody is asking".
    previousHighestNumber:
      highestNumber > snapshot.highestNumber
        ? snapshot.highestNumber
        : (snapshot.previousHighestNumber ?? snapshot.highestNumber),
    highestNumber,
    acceptedAsOurs: snapshot.acceptedAsOurs ?? [],
    pullNumbers: all.filter((n) => numbers.get(n) === 'pull'),
  }
  const next = {
    ...ordered,
    ...Object.fromEntries(
      Object.entries(snapshot).filter(([k]) => !(k in ordered)),
    ),
  }

  // Diff from the START of the band still open, not from today's watermark.
  // A refresh that moved 318 → 340 and left the band open owes the same
  // answer next time it runs, even if nothing new was minted in between —
  // otherwise a citation written INTO the open band after the fact could
  // never be adjudicated, because a 340 → 340 move hides nothing by
  // construction and `--accept-hidden` would have no work to attach to.
  const from = previousSnapshot(snapshot) ?? snapshot
  const outcome = refreshOutcome(from, next, accepted)
  if (!outcome.ok) {
    process.stderr.write(outcome.report)
    return 1
  }
  if (outcome.revealed.length > 0) {
    process.stdout.write(
      `notice: the refresh REVEALS ${outcome.revealed.length} finding(s) — a ` +
        'number that changed kind since the last snapshot:\n' +
        outcome.revealed
          .map((f) => `  ${f.file}:${f.line}:${f.column}  #${f.number}  ${f.code}\n`)
          .join(''),
    )
  }
  if (outcome.adjudicated.length > 0) {
    // Prune rather than accumulate. `acceptedAsOurs` is a standing claim that
    // somebody read a hidden finding and judged the number this repository's,
    // so it may only name numbers the RECORDED band still hides. A number the
    // watermark has since moved past is back in range and reports on its own,
    // so keeping it would claim adjudication over something nobody looked at.
    //
    // The union this replaces let entries survive their own band. #367 was
    // legitimised by the refresh to #372 and rode along into the refresh to
    // #422, where it is simply in range, and the gate's own test caught it.
    next.acceptedAsOurs = [
      ...new Set([...(snapshot.acceptedAsOurs ?? []), ...outcome.adjudicated]),
    ]
      .filter((n) => n > next.previousHighestNumber)
      .sort((a, b) => a - b)
  }

  // The last thing checked before the bytes go down, over the object that is
  // actually written rather than over the value it was built from. The
  // snapshot only ever goes stale UPWARD, so a candidate at or above the
  // committed watermark is the only shape a refresh can produce from a forge
  // that never un-allocates a number. A candidate BELOW it is a truncated
  // answer, and writing one would bring every number in the gap back into
  // range and retire the out-of-range rule over all of them at once.
  requireWatermark(next, 'the snapshot --refresh is about to write')
  if (next.highestNumber < snapshot.highestNumber) {
    throw new Error(
      `REFUSING TO WRITE: the refresh read #${next.highestNumber} as the highest ` +
        `number in ${snapshot.repo}, below the committed watermark ` +
        `#${snapshot.highestNumber}. A forge does not un-allocate numbers, so a ` +
        'watermark that moved DOWN is a partial answer rather than a smaller ' +
        `repository, and writing it would put #${next.highestNumber + 1} … ` +
        `#${snapshot.highestNumber} back in range in one step, silently. The cause ` +
        'to check first: a token that can read some of the tracker but not all of ' +
        'it, or paging that stopped early.',
    )
  }

  writeFileSync(
    join(here, 'repo-numbers.json'),
    `${JSON.stringify(next, null, 2)}\n`,
  )
  process.stdout.write(
    `refreshed: highestNumber ${snapshot.highestNumber} → ${next.highestNumber}` +
      ` (hid ${outcome.hidden.length}, revealed ${outcome.revealed.length}` +
      `${outcome.adjudicated.length > 0 ? `, accepted as ours ${listRefs(outcome.adjudicated)}` : ''})\n`,
  )
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  // A floor refusal is a verdict, so it exits 1 with its own sentence rather
  // than as an uncaught exception with a stack trace over it. `--refresh` has
  // its own handler, above, because it returns a promise; this catches the
  // synchronous arms, which is where `listFiles()` and the snapshot floor sit.
  try {
    main()
  } catch (err) {
    process.stderr.write(`${err.message}\n`)
    process.exit(1)
  }
}
