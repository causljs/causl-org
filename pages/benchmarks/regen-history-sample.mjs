#!/usr/bin/env node
// Regenerate history.sample.json from history.json.
//
// Purpose:
//   history.sample.json is a preload/fallback stub used by dashboard.js
//   when a mirror serves a 404 (or stale) history.json. Because the
//   stub must match the live shape, this script keeps it in sync by
//   slicing the latest entries off the source-of-truth history.json.
//
// Rule:
//   stub = history.json.slice(-3)
//
//   The last 3 HistoryEntries cover every render path currently used
//   by the dashboard (OK samples across all libraries, skipped[] rows,
//   typed-skip rows, bytes-distribution fields). Three entries is
//   enough to exercise the time-series renderer without bloating the
//   stub.
//
// Usage:
//   node pages/benchmarks/regen-history-sample.mjs
//
// CI:
//   Run this on every change to pages/benchmarks/history.json so the
//   stub never drifts again (see issue #14).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const srcPath = join(here, 'history.json');
const dstPath = join(here, 'history.sample.json');

const SAMPLE_SIZE = 3;

const src = JSON.parse(readFileSync(srcPath, 'utf8'));
if (!Array.isArray(src)) {
  throw new Error(`expected ${srcPath} to be a JSON array, got ${typeof src}`);
}
if (src.length === 0) {
  throw new Error(`${srcPath} is empty; refusing to write an empty stub`);
}

const stub = src.slice(-SAMPLE_SIZE);

// Pretty-print with 2-space indent + trailing newline to match
// editor-conventional JSON formatting and produce clean diffs.
writeFileSync(dstPath, JSON.stringify(stub, null, 2) + '\n');

console.log(
  `wrote ${dstPath}: ${stub.length} entr${stub.length === 1 ? 'y' : 'ies'} ` +
  `(from ${src.length} in history.json)`,
);
