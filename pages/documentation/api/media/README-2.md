# Parked workflows

These files are a design record, not jobs. Nothing here runs, and nothing here
can be picked up by accident: `ci/parked/` is not a workflow root that any forge
reads.

## Why they are here rather than in a `.github/` directory

This repository is on Gitea at `git.opsite.ca`. Gitea reads `.gitea/workflows/`
**exclusively** once that directory exists, and ignores the legacy `.github/`
root entirely. causl/causl-core-rs hit that first in its #345: two workflows sat
in the ignored root and neither ever executed, with no error and no red run,
just absence. causl/causl-wasm-ts#409 moved this repository's nine live
workflows for the same reason.

Parking files in the ignored root left them one `git mv` away from a root that
does get read, and left the repository carrying a forge-compatibility directory
that says nothing true about where the code lives. So I removed `.github/`
outright and moved the parked files here.

`tools/audit/check-workflow-paths.ts` now enforces the absence of `.github/`
rather than scanning it for offenders. That is the stronger invariant: a scan of
a directory that is not there returns an empty list, and an empty list reads
exactly like a clean one, which is the vacuity the #461 audit was written to
catch. The gate keeps `misplacedWorkflows` exported and tested against scratch
fixtures, so the detector is provably intact rather than merely unreachable.

## What is parked, and why

The thirteen workflows here were parked in 2025-09, when hosted Actions runners
became unavailable for the org (PR #725). `docs/ci.md` documents what each one
carried. The disablement is mechanical rather than semantic: the files are
intact, and reviving one means moving it into `.gitea/workflows/` and reconciling
it against the paths that survived the repo split.

Do not move one back without reading it first. Several reference directories
that left in the split (`tools/enumerator/`, `tools/apalache-diff/`), so they
would be red on every run from the moment they were revived.

## Where a lane's status lives

Not here. Whether a lane fires is a forge setting plus that lane's own run
history, and a copy of the answer in this file would be a mutable fact recorded
once, with nothing able to notice when it changed. This section used to carry
exactly that copy: it said nothing ran in either root, which was true while the
Actions unit was switched off on `causl/causl-wasm-ts` and on
`causl/causl-core-rs` from 2026-08-04 through 2026-08-07, and it outlived the
outage (causl/causl-wasm-ts#468). `docs/ci.md` carries the reading, dated.

Every gate this repository has also runs locally, and that is unaffected either
way. `CONTRIBUTING.md` lists the commands, and `docs/ci.md` says which workflow
carries which of them.

## Where the forge-UI files went

`CODEOWNERS` and `PULL_REQUEST_TEMPLATE.md` now live in `.gitea/`. Gitea reads
both from there, and they were never read by the Actions runner, so the move
changes nothing about how review routing behaves.
