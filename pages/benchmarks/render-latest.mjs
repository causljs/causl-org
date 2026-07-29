#!/usr/bin/env node
// Render the latest imported sweep into index.html as static HTML.
//
//   node pages/benchmarks/render-latest.mjs [--history <path>] [--page <path>] [--check]
//
// Reads the last entry in `history.json` — which `import-run.mjs` put there
// from an ARCHIVED causl-bench run — and rewrites everything between
//
//   <!-- GENERATED:attested-engines:BEGIN -->
//   <!-- GENERATED:attested-engines:END -->
//
// in `index.html`. `--check` renders and compares without writing, exiting 1 if
// the page is out of date, so a reviewer can tell a stale section from a fresh
// one without reading the diff.
//
// ## Why this is generated into the page and not fetched at page load
//
// The panel this section replaces fetched its numbers from a URL in another
// repository. That repository moved, the URL began returning 404, and the panel
// rendered `Failed to load dual-engine.json: HTTP 404` to every visitor for
// months without anyone noticing. Static generated HTML is checked in, shows up
// in a diff, renders with JavaScript disabled, and cannot 404.
//
// ## Why causl-wasm-ts gets its own table
//
// `runners/aggregate.mjs` in causl-bench rules on the engine build each
// document recorded, and prints, of a runner below the floor:
//
//   "Their cells are measured, published and accounted for in `ranking[].absent`
//    with `excludedBy: "engine-build"`. They are not ranked against other
//    libraries, and no chart may compare them."
//
// So the held-out runner is published in full and never appears in a table with
// another runner in it. That is not a presentational choice; putting the two
// side by side with a ratio column is the exact defect the withdrawn panel
// above shipped. When the upstream release lands and the hold-out lifts, this
// script emits the merged comparison with no edit to the page.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const EXIT = { OK: 0, STALE: 1, USAGE: 2, REFUSED: 3 };

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? undefined : argv[i + 1];
};
const has = (n) => argv.includes(`--${n}`);

const KNOWN = new Set(['history', 'page', 'check', 'help']);
const unknown = argv.filter((a) => a.startsWith('--')).map((a) => a.slice(2)).filter((a) => !KNOWN.has(a));
if (unknown.length) {
  console.error(`unknown flag(s): ${unknown.map((u) => `--${u}`).join(', ')}`);
  console.error(`known flags: ${[...KNOWN].map((k) => `--${k}`).join(' ')}`);
  process.exit(EXIT.USAGE);
}
if (has('help')) {
  console.error('usage: node pages/benchmarks/render-latest.mjs [--history <path>] [--page <path>] [--check]');
  process.exit(EXIT.USAGE);
}

const historyPath = resolve(flag('history') ?? join(here, 'history.json'));
const pagePath = resolve(flag('page') ?? join(here, 'index.html'));

const BEGIN = '<!-- GENERATED:attested-engines:BEGIN -->';
const END = '<!-- GENERATED:attested-engines:END -->';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Enough significant figures to be re-derivable, never more than the
 *  measurement supports. Sub-millisecond medians need the decimals; a
 *  1692 ms median does not. */
function ms(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toFixed(0);
  if (n >= 10) return n.toFixed(2);
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(4);
}

function pct(n) {
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—';
}

/** `high` / `low` as a chip, because a median without its confidence is the
 *  same number whether or not anybody should quote it. */
function confChip(c) {
  if (c === 'high') return '<span class="conf conf-high">high</span>';
  if (c === 'low') return '<span class="conf conf-low">low</span>';
  return '<span class="conf">—</span>';
}

const CELL_KEY = (s) => `${s.scenario}@${s.scale}`;

// ---------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------

const history = JSON.parse(readFileSync(historyPath, 'utf8'));
if (!Array.isArray(history) || history.length === 0) {
  console.error(`refused: ${historyPath} holds no runs`);
  process.exit(EXIT.REFUSED);
}

const run = history[history.length - 1];
if (!run.runId) {
  console.error(
    `refused: the last entry in ${historyPath} carries no runId, so it did not come through\n` +
      '         import-run.mjs and is not known to be archived. Nothing generated.',
  );
  process.exit(EXIT.REFUSED);
}

const samples = run.samples ?? [];
const skipped = run.skipped ?? [];
const allRunners = [...new Set([...samples, ...skipped].map((s) => s.library))].sort();

/** A runner is held out when every one of its measured cells is. The
 *  aggregator rules per document, so this is a read of its verdict, not a
 *  second opinion. */
const heldOutRunners = new Set(
  allRunners.filter((r) => {
    const own = samples.filter((s) => s.library === r);
    return own.length > 0 && own.every((s) => s.rankable === false);
  }),
);
const rankableRunners = allRunners.filter((r) => !heldOutRunners.has(r));

const okBy = new Map();
for (const s of samples) okBy.set(`${s.library}/${CELL_KEY(s)}`, s);
const notOkBy = new Map();
for (const s of skipped) notOkBy.set(`${s.library}/${CELL_KEY(s)}`, s);

const cellKeys = [...new Set([...samples, ...skipped].map(CELL_KEY))].sort((a, b) => {
  const [as, asc] = a.split('@');
  const [bs, bsc] = b.split('@');
  return as === bs ? Number(asc) - Number(bsc) : as < bs ? -1 : 1;
});

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------

function head() {
  const libs = Object.entries(run.libraries ?? {})
    .map(([id, v]) => `<li><code>${esc(id)}</code> &rarr; <code>${esc(v.package)}@${esc(v.version)}</code>` +
      (v.engine ? ` · engine <code>${esc(v.engine)}</code>${v.engineAttested ? ' <span class="conf conf-high">attested</span>' : ''}` : '') +
      '</li>')
    .join('\n        ');
  const h = run.host ?? {};
  return `  <div class="section-head">
      <div>
        <div class="section-kicker">Re-measured &mdash; ${esc((run.capturedAt ?? '').slice(0, 10))}</div>
        <h2 id="attested-engines-title">Every cell, and which engine actually ran it.</h2>
      </div>
      <p class="lead">
        One archived <code>causl-bench</code> sweep, reported in full: ${samples.length} measured cells and
        ${skipped.length} that produced no number, across ${allRunners.length} runners. Each causl cell carries a
        runtime attestation of the engine that executed the graph that was timed, so the engine label is an
        observation rather than a configuration flag &mdash; which is the specific failure the withdrawn panel
        above was built on.
      </p>
    </div>

    <div class="status-callout" role="note">
      <p style="margin:0 0 .5rem"><strong>Provenance.</strong></p>
      <ul style="margin:0">
        <li>run <code>${esc(run.runId)}</code>, captured <code>${esc(run.capturedAt)}</code></li>
        <li>host <code>${esc(h.cpuModel)}</code> · <code>${esc(h.os)}/${esc(h.arch)}</code> · node <code>${esc(h.node)}</code></li>
        ${libs}
      </ul>
      <p style="margin:.6rem 0 0">
        The full aggregate, its four integrity digests and the per-runner inputs are archived in
        <code>causl-bench</code> under <code>runners/archive/${esc(run.runId)}/</code>. The raw rows behind every
        table below are in <a href="./history.json"><code>history.json</code></a>.
      </p>
    </div>
`;
}

/** The comparison. Read off the aggregator's own `ranking`, never re-derived. */
function comparison() {
  const groups = (run.ranking ?? []).filter((g) => (g.entries ?? []).length > 0);
  if (groups.length === 0) {
    return `    <h3>Cross-library comparison</h3>
    <p>The aggregator published no ranked group for this run, so there is no comparison to show.
       That is reported rather than hidden: a sweep that measures cells and ranks nothing is as
       empty as one that measures nothing.</p>
`;
  }

  const cols = rankableRunners;
  const rows = groups
    .map((g) => {
      const byRunner = new Map((g.entries ?? []).map((e) => [e.runner, e]));
      const winner = (g.entries ?? []).find((e) => e.rank === 1);
      const tied = (g.entries ?? []).filter((e) => e.rank === 1).length > 1;
      const cells = cols
        .map((r) => {
          const e = byRunner.get(r);
          if (!e) {
            const na = notOkBy.get(`${r}/${g.scenario}@${g.scale}`);
            return `<td class="num absent" title="${esc(na?.reason ?? 'not ranked in this group')}">${esc(na?.outcome ?? '—')}</td>`;
          }
          const s = okBy.get(`${r}/${g.scenario}@${g.scale}`);
          const best = e.rank === 1 ? ' best' : '';
          return `<td class="num${best}">${ms(e.medianMs ?? s?.medianMs)}${s ? ` ${confChip(s.confidence)}` : ''}</td>`;
        })
        .join('');
      const verdict = tied
        ? '<span class="conf">tied</span>'
        : winner
          ? `<code>${esc(winner.runner)}</code>`
          : '<span class="conf">withheld</span>';
      return `        <tr><th scope="row"><code>${esc(g.scenario)}</code> @ ${esc(g.scale)}</th>${cells}<td>${verdict}</td></tr>`;
    })
    .join('\n');

  const held = [...heldOutRunners].map((r) => `<code>${esc(r)}</code>`).join(', ');
  return `    <h3>Cross-library comparison &mdash; ${cols.length} runners, ${groups.length} ranked groups</h3>
    <p>
      Median wall-time in milliseconds for one step on a world built fresh for that step. Fastest in each row is
      marked; rows whose winner falls inside the tie band read <em>tied</em>, and rows the aggregator refused to
      crown read <em>withheld</em>. Rank comes from the aggregate, not from sorting these medians &mdash; it
      applies the tie band and the work-equivalence exclusions, and a table that sorted for itself would quietly
      disagree with both.
    </p>
    ${held ? `<p><strong>${held} is not in this table.</strong> See the section below for why, and for its numbers.</p>` : ''}
    <div style="overflow-x:auto">
      <table class="results-table">
        <thead>
          <tr><th scope="col">Cell</th>${cols.map((c) => `<th scope="col"><code>${esc(c)}</code></th>`).join('')}<th scope="col">fastest</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
`;
}

/** The held-out runner, alone. No other runner appears in this table. */
function heldOut() {
  if (heldOutRunners.size === 0) return '';
  const floors = run.engineFloor?.held ?? [];
  return [...heldOutRunners]
    .map((r) => {
      const own = samples.filter((s) => s.library === r);
      const ownSkipped = skipped.filter((s) => s.library === r);
      const ruling = floors.find((f) => f.runner === r);
      const rows = own
        .map(
          (s) =>
            `        <tr><th scope="row"><code>${esc(s.scenario)}</code> @ ${esc(s.scale)}</th>` +
            `<td class="num">${ms(s.medianMs)}</td>` +
            `<td class="num">${Array.isArray(s.ci95Ms) ? `${ms(s.ci95Ms[0])}&ndash;${ms(s.ci95Ms[1])}` : '—'}</td>` +
            `<td class="num">${pct(s.cov)}</td>` +
            `<td>${confChip(s.confidence)}</td>` +
            `<td class="num">${s.recomputes ?? '—'}</td>` +
            `<td class="num">${Number.isFinite(s.peakRssMb) ? s.peakRssMb.toFixed(1) : '—'}</td></tr>`,
        )
        .join('\n');
      return `    <h3 id="held-out-${esc(r)}"><code>${esc(r)}</code> &mdash; measured, published, not compared</h3>
    <div class="status-callout" role="note">
      <p style="margin:0 0 .5rem"><strong>These numbers are real measurements of a real Rust engine, and they are
        deliberately not placed beside any other runner.</strong></p>
      <p style="margin:0 0 .5rem">
        ${ruling ? esc(ruling.reason) : 'The published engine build is below the floor this repository declares for it.'}
      </p>
      <p style="margin:0">
        <code>causl-bench</code>'s aggregator states the consequence directly: cells from a runner below the floor
        are <em>&ldquo;measured, published and accounted for in <code>ranking[].absent</code>&hellip; not ranked
        against other libraries, and no chart may compare them.&rdquo;</em> This is not a low-confidence verdict and
        more repetitions will not lift it &mdash; the artefact is what it is until the release lands. The fix is
        <a href="https://git.opsite.ca/causl/causl-core-rs/issues/331">causl-core-rs#331</a>, awaiting a republish at
        <a href="https://git.opsite.ca/causl/causl-wasm-ts/issues/294">causl-wasm-ts#294</a>. When that ships, these
        rows join the table above.
      </p>
    </div>
    <p>${own.length} measured cells, ${ownSkipped.length} that produced no number.</p>
    <div style="overflow-x:auto">
      <table class="results-table">
        <thead>
          <tr><th scope="col">Cell</th><th scope="col">median (ms)</th><th scope="col">95% interval</th>
              <th scope="col">CoV</th><th scope="col">confidence</th><th scope="col">recomputes</th>
              <th scope="col">peak RSS (MB)</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
`;
    })
    .join('\n');
}

/** Full results, one collapsible block per runner. Per-runner rather than
 *  per-scenario so the held-out runner's rows never share a table with
 *  anybody else's. */
function fullResults() {
  const blocks = allRunners
    .map((r) => {
      const own = cellKeys
        .map((k) => okBy.get(`${r}/${k}`) ?? notOkBy.get(`${r}/${k}`))
        .filter(Boolean);
      const ok = own.filter((s) => !s.status);
      const rows = own
        .map((s) => {
          if (s.status === 'SKIP') {
            return `        <tr class="row-absent"><th scope="row"><code>${esc(s.scenario)}</code> @ ${esc(s.scale)}</th>` +
              `<td colspan="6"><strong>${esc(s.outcome)}</strong> &mdash; ${esc(s.reason ?? 'no reason recorded')}</td></tr>`;
          }
          return `        <tr><th scope="row"><code>${esc(s.scenario)}</code> @ ${esc(s.scale)}</th>` +
            `<td class="num">${ms(s.medianMs)}</td>` +
            `<td class="num">${ms(s.p95Ms)}</td>` +
            `<td class="num">${Array.isArray(s.ci95Ms) ? `${ms(s.ci95Ms[0])}&ndash;${ms(s.ci95Ms[1])}` : '—'}</td>` +
            `<td class="num">${pct(s.cov)}</td>` +
            `<td>${confChip(s.confidence)}</td>` +
            `<td class="num">${s.recomputes ?? '—'}</td></tr>`;
        })
        .join('\n');
      const lib = run.libraries?.[r];
      return `    <details class="status-callout">
      <summary><strong><code>${esc(r)}</code></strong> &mdash; ${ok.length} measured, ${own.length - ok.length} not measured${lib ? ` · <code>${esc(lib.package)}@${esc(lib.version)}</code>` : ''}${heldOutRunners.has(r) ? ' · <em>held out of ranking</em>' : ''}</summary>
      <div style="overflow-x:auto">
        <table class="results-table">
          <thead>
            <tr><th scope="col">Cell</th><th scope="col">median (ms)</th><th scope="col">p95 (ms)</th>
                <th scope="col">95% interval</th><th scope="col">CoV</th><th scope="col">confidence</th>
                <th scope="col">recomputes</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>
    </details>`;
    })
    .join('\n');

  const low = samples.filter((s) => s.confidence === 'low').length;
  return `    <h3>Full results &mdash; every cell, every runner</h3>
    <p>
      One block per runner, ${cellKeys.length} cells each. <code>p95</code> is the 95th percentile of the
      repetitions the runner kept, not a model fitted to the median. ${low} of ${samples.length} measured cells
      declare themselves low-confidence; the chip on each row says which, and a low-confidence median is a number
      whose own driver says not to quote it.
    </p>
${blocks}
`;
}

// ---------------------------------------------------------------------------
// splice
// ---------------------------------------------------------------------------

const section = `${BEGIN}
  <section class="page section" id="attested-engines" aria-labelledby="attested-engines-title">
${head()}
${comparison()}
${heldOut()}
${fullResults()}  </section>
  ${END}`;

const page = readFileSync(pagePath, 'utf8');
const b = page.indexOf(BEGIN);
const e = page.indexOf(END);
if (b === -1 || e === -1 || e < b) {
  console.error(`refused: ${pagePath} has no GENERATED:attested-engines markers to write between`);
  process.exit(EXIT.REFUSED);
}

const next = page.slice(0, b) + section + page.slice(e + END.length);

if (has('check')) {
  if (next === page) {
    console.log(`up to date — ${pagePath} matches ${run.runId}`);
    process.exit(EXIT.OK);
  }
  console.error(`STALE — ${pagePath} does not match the latest run (${run.runId}). Re-run without --check.`);
  process.exit(EXIT.STALE);
}

writeFileSync(pagePath, next);
console.log(`run       ${run.runId}`);
console.log(`runners   ${allRunners.join(', ')}`);
console.log(`held out  ${heldOutRunners.size ? [...heldOutRunners].join(', ') : 'none'}`);
console.log(`ranked    ${(run.ranking ?? []).filter((g) => (g.entries ?? []).length > 0).length} group(s)`);
console.log(`cells     ${samples.length} measured · ${skipped.length} not measured`);
console.log(`\nwrote ${pagePath}`);
