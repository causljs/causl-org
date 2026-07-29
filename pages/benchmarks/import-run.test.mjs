#!/usr/bin/env node
// Tests for import-run.mjs — one per refusal, because a publish gate nobody
// has watched refuse something is not a gate.
//
// This repository has no test runner wired into CI (`.github/workflows/
// static.yml` only deploys). Run it by hand:
//
//   node --test pages/benchmarks/import-run.test.mjs
//
// Every case below drives the real script as a subprocess and asserts on its
// exit code and on the sentence it printed, so a refusal that stops naming its
// reason fails here rather than going quiet.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, 'import-run.mjs');

const INTEGRITY = {
  combined: 'a'.repeat(64),
  cells: 'b'.repeat(64),
  runners: 'c'.repeat(64),
  measurements: 'd'.repeat(64),
};
const RUN_ID = '20260728T000000Z-deadbeef-abcd1234';

/** A publishable aggregate: the smallest document that clears every gate. */
function aggregate() {
  return {
    schemaVersion: 2,
    combinedAt: '2026-07-28T00:00:00.000Z',
    homogeneity: { forced: false, axes: { commit: 'deadbeef', node: 'v26.5.0', reps: 20 } },
    runners: {
      'causl-ts': {
        library: { name: '@causlts/core', version: '0.3.3' },
        engine: 'js-ssot',
        engineAttested: true,
        os: 'darwin',
        arch: 'arm64',
        cpuModel: 'M5',
        node: 'v26.5.0',
      },
    },
    cells: [
      {
        runner: 'causl-ts',
        scenario: 'linear-chain',
        scale: 1000,
        outcome: 'ok',
        medianMs: 0.5,
        samples: [0.48, 0.49, 0.5, 0.51, 0.52],
        cov: 0.04,
        ci95Ms: [0.48, 0.52],
        confidence: 'high',
        lowConfidenceReasons: [],
        recomputes: 1000,
        reps: 20,
        peakRssMb: 100,
        steadyState: { reached: true },
        engine: 'js-ssot',
        engineAttested: true,
        engineSource: 'cell',
      },
    ],
    ranking: [],
    integrity: INTEGRITY,
  };
}

/** Writes a workspace and runs the importer over `combined`, always --dry-run. */
function run(combined, { archiveIntegrity = INTEGRITY, extraArgs = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'import-run-'));
  try {
    writeFileSync(join(dir, 'combined.json'), JSON.stringify(combined));
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({ schemaVersion: 2, runs: [{ runId: RUN_ID, integrity: archiveIntegrity, commit: 'deadbeef' }] }),
    );
    writeFileSync(join(dir, 'history.json'), JSON.stringify([]));
    const r = spawnSync(
      process.execPath,
      [
        SCRIPT,
        '--combined', join(dir, 'combined.json'),
        '--archive', dir,
        '--history', join(dir, 'history.json'),
        '--dry-run',
        ...extraArgs,
      ],
      { encoding: 'utf8' },
    );
    return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a clean archived run imports', () => {
  const r = run(aggregate());
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, new RegExp(RUN_ID));
  assert.match(r.out, /1 ok · 0 not-ok/);
});

test('an unarchived run is refused, and the refusal says how many runs the archive holds', () => {
  const r = run(aggregate(), { archiveIntegrity: { ...INTEGRITY, combined: '0'.repeat(64) } });
  assert.equal(r.code, 1);
  assert.match(r.err, /not a citable artefact/);
  assert.match(r.err, /archive holds 1 run\(s\)/);
});

test('a dirty tree is refused and the runner is named', () => {
  const a = aggregate();
  a.cells[0].dirtyTree = true;
  const r = run(a);
  assert.equal(r.code, 1);
  assert.match(r.err, /dirty tree/);
  assert.match(r.err, /causl-ts/);
});

test('a forced merge is refused and the reason given is quoted back', () => {
  const a = aggregate();
  a.homogeneity.forced = true;
  a.homogeneity.reason = 'two hosts';
  const r = run(a);
  assert.equal(r.code, 1);
  assert.match(r.err, /FORCED/);
  assert.match(r.err, /two hosts/);
});

test('a failed cell is refused and named', () => {
  const a = aggregate();
  a.cells[0].outcome = 'failed';
  const r = run(a);
  assert.equal(r.code, 1);
  assert.match(r.err, /causl-ts\/linear-chain@1000/);
});

test('a sweep with cells but no ok cell is refused — measuring nothing is not a run', () => {
  const a = aggregate();
  a.cells[0].outcome = 'skipped';
  a.cells[0].reason = 'over budget';
  const r = run(a);
  assert.equal(r.code, 1);
  assert.match(r.err, /none of them is `ok`/);
});

test('a run measured on a busy machine is refused, and the refusal counts the cells', () => {
  const a = aggregate();
  // Nine cells, five of them taken under contention — a simple majority.
  a.cells = Array.from({ length: 9 }, (_, i) => ({
    ...aggregate().cells[0],
    scenario: `s${i}`,
    machineLoad: { cores: 10, loadAvg1m: i < 5 ? 4.2 : 1.1, contentionPerCore: i < 5 ? 0.32 : 0.11, quiet: i >= 5 },
  }));
  const r = run(a);
  assert.equal(r.code, 1);
  assert.match(r.err, /5 of 9 measured cells record `machineLoad\.quiet: false`/);
  assert.match(r.err, /median load average 4\.2/);
});

test('an exact half measured under contention is not a majority, so it passes', () => {
  const a = aggregate();
  a.cells = Array.from({ length: 10 }, (_, i) => ({
    ...aggregate().cells[0],
    scenario: `s${i}`,
    machineLoad: { cores: 10, loadAvg1m: i < 5 ? 4.2 : 1.1, contentionPerCore: i < 5 ? 0.32 : 0.11, quiet: i >= 5 },
  }));
  const r = run(a);
  assert.equal(r.code, 0, r.err);
});

test('a run that ranks none of its comparable groups is refused', () => {
  const a = aggregate();
  a.ranking = [
    { scenario: 'linear-chain', scale: 1000, entries: [{ runner: 'causl-ts', rank: 1 }] },
    { scenario: 'diamond', scale: 1000, entries: [] },
  ];
  const r = run(a);
  assert.equal(r.code, 1);
  assert.match(r.err, /ranks 0 of 2 comparable group\(s\)/);
});

test('groups the work-equivalence gate excluded are not counted against the run', () => {
  const a = aggregate();
  a.ranking = [
    // One real comparison…
    { scenario: 'linear-chain', scale: 1000, entries: [{ runner: 'causl-ts', rank: 1 }, { runner: 'mobx', rank: 2 }] },
    // …and one the equivalence gate held out, which is a correct refusal about
    // scenario semantics and says nothing about how noisy the run was.
    { scenario: 'adversarial-fanin-100', scale: 1000, entries: [], exclusionReason: 'the shapes are unrelated' },
  ];
  const r = run(a);
  assert.equal(r.code, 0, r.err);
  assert.doesNotMatch(r.err, /ranks 1 of 2/);
});

test('an unknown flag is a usage error, not a silently-ignored no-op', () => {
  const r = run(aggregate(), { extraArgs: ['--refuse-low-confidance'] });
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown flag\(s\): --refuse-low-confidance/);
});

test('p95 comes off the recorded samples rather than being modelled', () => {
  const a = aggregate();
  a.cells[0].samples = [1, 2, 3, 4, 100];
  const dir = mkdtempSync(join(tmpdir(), 'import-run-'));
  try {
    writeFileSync(join(dir, 'combined.json'), JSON.stringify(a));
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({ schemaVersion: 2, runs: [{ runId: RUN_ID, integrity: INTEGRITY, commit: 'deadbeef' }] }),
    );
    const history = join(dir, 'history.json');
    writeFileSync(history, JSON.stringify([]));
    const r = spawnSync(
      process.execPath,
      [SCRIPT, '--combined', join(dir, 'combined.json'), '--archive', dir, '--history', history],
      { encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    const written = JSON.parse(spawnSync('cat', [history], { encoding: 'utf8' }).stdout);
    assert.equal(written[0].samples[0].p95Ms, 100);
    // The legacy heap field is carried as null rather than filled with RSS.
    assert.equal(written[0].samples[0].peakHeapMb, null);
    assert.equal(written[0].samples[0].peakRssMb, 100);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a not-ok cell never carries `attested`, because that field is the withdrawal marker', () => {
  // In this dataset `attested: false` marks the 304 retracted causl-wasm
  // records — numbers produced by an engine other than the one they were
  // labelled with. A cell that produced no number has nothing to attest, and
  // reusing the same field value would let a filter count skipped cells as
  // withdrawn ones.
  const a = aggregate();
  a.cells.push({
    runner: 'causl-wasm-ts',
    scenario: 'mixed-editor-60s-seed42-50k',
    scale: 10000,
    outcome: 'skipped',
    reason: 'projected cost exceeds the cell budget',
    engine: 'rust-ssot',
    engineAttested: false,
  });
  const dir = mkdtempSync(join(tmpdir(), 'import-run-'));
  try {
    writeFileSync(join(dir, 'combined.json'), JSON.stringify(a));
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({ schemaVersion: 2, runs: [{ runId: RUN_ID, integrity: INTEGRITY, commit: 'deadbeef' }] }),
    );
    const history = join(dir, 'history.json');
    writeFileSync(history, JSON.stringify([]));
    const r = spawnSync(
      process.execPath,
      [SCRIPT, '--combined', join(dir, 'combined.json'), '--archive', dir, '--history', history],
      { encoding: 'utf8' },
    );
    assert.equal(r.status, 0, r.stderr);
    const written = JSON.parse(readFileSync(history, 'utf8'));
    const row = written[0].skipped[0];
    assert.equal(Object.hasOwn(row, 'attested'), false, 'a not-ok row must not carry `attested`');
    assert.equal(row.engineAttested, false);
    assert.equal(row.outcome, 'skipped');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('re-importing the same run replaces its entry instead of appending a duplicate', () => {
  const dir = mkdtempSync(join(tmpdir(), 'import-run-'));
  try {
    writeFileSync(join(dir, 'combined.json'), JSON.stringify(aggregate()));
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({ schemaVersion: 2, runs: [{ runId: RUN_ID, integrity: INTEGRITY, commit: 'deadbeef' }] }),
    );
    const history = join(dir, 'history.json');
    writeFileSync(history, JSON.stringify([]));
    const args = [SCRIPT, '--combined', join(dir, 'combined.json'), '--archive', dir, '--history', history];
    for (let i = 0; i < 2; i++) {
      const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    }
    const written = JSON.parse(spawnSync('cat', [history], { encoding: 'utf8' }).stdout);
    assert.equal(written.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
