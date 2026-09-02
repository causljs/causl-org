#!/usr/bin/env node
// Publishability gate for the causl.org static site.
//
// The site is plain files served straight from the repository root, so the
// only thing standing between a bad commit and a broken page is a check that
// reads the tree the way the host will. This script is that check. It runs on
// every push and pull request, and it also runs locally: `node
// scripts/check-site.mjs` from the repository root.
//
// It enforces three things, each of which has already broken the live site at
// least once.
//
//   1. `.nojekyll` exists whenever a publishable file's basename starts with
//      an underscore. The host runs Jekyll unless that file is present, and
//      Jekyll drops every underscore-prefixed path. The whole TypeDoc API
//      reference is named `_causl_*.html`, so without `.nojekyll` the entire
//      class, interface, function, type and variable reference returns 404
//      while the index that links to it returns 200. The links look fine and
//      the pages are gone.
//
//   2. `CNAME` still names the custom domain. Lose it and the site moves to
//      the default host domain, taking every inbound link with it.
//
//   3. Every internal href and src resolves to a file that actually exists.
//      This is what catches a renamed page: the API reference was regenerated
//      once under new file names, and nothing but a reader clicking a link
//      would have noticed if the navigation had been left pointing at the old
//      ones. Several pages outside the reference still point at the old names
//      today, which is exactly the failure this catches. Those, and fifty-odd
//      others already live, are frozen in `scripts/site-link-baseline.txt`;
//      read the note at the top of that file for why they are recorded rather
//      than fixed here, and note that the gate fails on a stale entry as
//      readily as on a new break, so the list can only shrink.
//
// It deliberately does NOT check external links, and it does not check that a
// `#fragment` names a real anchor. External links fail for reasons that have
// nothing to do with the commit under test, and a gate that goes red on
// somebody else's outage teaches people to ignore it. Fragments are worth
// checking and simply are not checked yet, so do not read a green run as
// saying every anchor lands.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, posix, basename } from 'node:path';

const root = resolve(process.argv[2] ?? '.');

// Directories that are never published, so nothing in them is a link target
// and nothing in them gets scanned.
const SKIP_DIRS = new Set(['.git', '.github', '.gitea', 'node_modules', 'scripts']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const files = walk(root);
const relFiles = files.map((f) => relative(root, f).split(/[\\/]/).join('/'));
const fileSet = new Set(relFiles);

const failures = [];
const notes = [];

// ---------------------------------------------------------------- 1. nojekyll
const underscored = relFiles.filter((f) => basename(f).startsWith('_'));
if (underscored.length > 0) {
  if (!fileSet.has('.nojekyll')) {
    failures.push(
      `.nojekyll is missing, and ${underscored.length} publishable file(s) have an ` +
        `underscore-prefixed name, for example ${underscored[0]}. Jekyll drops every one ` +
        `of those, so they would 404 on the live site while the pages linking to them ` +
        `return 200. Add an empty .nojekyll at the repository root.`,
    );
  } else {
    notes.push(`.nojekyll present, covering ${underscored.length} underscore-prefixed file(s)`);
  }
} else {
  notes.push('no underscore-prefixed publishable files, so .nojekyll is not load-bearing here');
}

// -------------------------------------------------------------------- 2. CNAME
const EXPECTED_DOMAIN = 'causl.org';
if (!fileSet.has('CNAME')) {
  failures.push(`CNAME is missing. Without it the site stops answering on ${EXPECTED_DOMAIN}.`);
} else {
  const cname = readFileSync(join(root, 'CNAME'), 'utf8').trim();
  if (cname !== EXPECTED_DOMAIN) {
    failures.push(`CNAME reads ${JSON.stringify(cname)}, and it has to read ${JSON.stringify(EXPECTED_DOMAIN)}.`);
  } else {
    notes.push(`CNAME names ${EXPECTED_DOMAIN}`);
  }
}

// ------------------------------------------------------------ 3. internal links
const htmlFiles = relFiles.filter((f) => f.endsWith('.html'));
const LINK_RE = /(?:href|src)\s*=\s*"([^"]*)"/gi;

// A scheme-bearing, protocol-relative, fragment-only or non-navigational
// target is somebody else's problem, not this repository's.
function isExternal(raw) {
  return (
    raw === '' ||
    raw.startsWith('#') ||
    raw.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(raw)
  );
}

function decodeTarget(raw) {
  const noEntities = raw.replace(/&amp;/g, '&');
  const noFragment = noEntities.split('#')[0].split('?')[0];
  try {
    return decodeURIComponent(noFragment);
  } catch {
    return noFragment;
  }
}

let checkedLinks = 0;
const broken = [];

for (const htmlFile of htmlFiles) {
  const source = readFileSync(join(root, htmlFile), 'utf8');
  const seen = new Set();
  for (const match of source.matchAll(LINK_RE)) {
    const raw = match[1].trim();
    if (isExternal(raw)) continue;
    const target = decodeTarget(raw);
    if (target === '') continue; // was a bare fragment or query on the same page
    if (seen.has(target)) continue;
    seen.add(target);
    checkedLinks += 1;

    // Root-absolute targets resolve against the site root; everything else
    // against the directory of the page holding the link. That mirrors how
    // the host serves them.
    const resolved = target.startsWith('/')
      ? posix.normalize(target.slice(1))
      : posix.normalize(posix.join(posix.dirname(htmlFile), target));

    if (resolved.startsWith('..')) {
      broken.push(`${htmlFile} -> ${raw} (escapes the site root)`);
      continue;
    }

    // A directory target, written with or without the trailing slash, is
    // served as its index.html.
    const candidates =
      resolved === '' || resolved === '.'
        ? ['index.html']
        : [resolved, `${resolved}/index.html`, posix.join(resolved, 'index.html')];

    const hit = candidates.some((c) => {
      const clean = c.replace(/\/+$/, '');
      if (fileSet.has(clean)) return true;
      const asDir = join(root, clean);
      return existsSync(asDir) && statSync(asDir).isDirectory() && fileSet.has(`${clean}/index.html`);
    });

    if (!hit) broken.push(`${htmlFile} -> ${raw}`);
  }
}

// The site did not arrive at this gate clean: it carries dead internal links
// that predate the gate, most of them inside TypeDoc-generated pages whose
// real fix belongs upstream in the source repository's docs. Freezing that set
// in a baseline is what lets the gate be strict about everything else starting
// today. The baseline can only ever shrink: a link that is fixed but left in
// the file fails the gate just as loudly as a new break, so the list cannot
// quietly outlive the debt it records.
const BASELINE_PATH = 'scripts/site-link-baseline.txt';
const baselineFile = join(root, BASELINE_PATH);
const baseline = new Set(
  existsSync(baselineFile)
    ? readFileSync(baselineFile, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'))
    : [],
);

const brokenSet = new Set(broken);
const regressions = broken.filter((b) => !baseline.has(b));
const stale = [...baseline].filter((b) => !brokenSet.has(b)).sort();

if (regressions.length > 0) {
  failures.push(
    `${regressions.length} internal link(s) point at something that is not in the tree:\n` +
      regressions.map((b) => `    ${b}`).join('\n') +
      `\n  Either point the link at a page that exists, or remove it. Do not add it to ` +
      `${BASELINE_PATH}: that file records the debt this gate inherited, and it only shrinks.`,
  );
}

if (stale.length > 0) {
  failures.push(
    `${stale.length} entr(y/ies) in ${BASELINE_PATH} name a link that now resolves. ` +
      `Delete these lines so the file keeps telling the truth:\n` +
      stale.map((b) => `    ${b}`).join('\n'),
  );
}

if (regressions.length === 0 && stale.length === 0) {
  notes.push(
    `${checkedLinks} internal link(s) across ${htmlFiles.length} page(s) checked, ` +
      `${broken.length} still broken and all of them recorded in ${BASELINE_PATH}`,
  );
}

// ----------------------------------------------------------------------- report
for (const note of notes) console.log(`ok    ${note}`);

if (failures.length > 0) {
  console.error('');
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${notes.length} checks passed.`);
