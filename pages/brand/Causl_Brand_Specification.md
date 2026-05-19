# Causl Brand Specification

## 1. Brand Definition

**Name:** Causl  
**Category:** Reactive transaction graph engine  
**Plain-English category:** State management for complex live systems  
**Primary tagline:** Transactional state for tangled dependency graphs.  
**Short promise:** Commit only consistency.  
**Developer hook:** Catch race conditions in the walls.

Causl is an open-source transactional, dependency-aware state engine for applications where ordinary UI state tools are not enough. It is for products where state is not merely a tree of values, but a live graph of canonical facts, derived values, constraints, formulas, async resources, user actions, external feeds, and collaborative edits.

The brand should feel hacker-native, technical, memorable, and slightly feral. It should not feel like a polished enterprise middleware product. Causl lives in the machinery. It finds hidden paths through the stack. It exposes stale writes, race conditions, derivation chains, and conflicts before users see inconsistent UI.

---

## 2. Brand Story

Modern application state often begins clean: a few values, a reducer, a couple of async calls. Then real product complexity arrives.

A room affects a floor. A floor affects a building. A formula references another sheet. A stale async result lands after a newer edit. A collaborator changes a dependency while the current user is viewing a derived total. A validation rule triggers a warning banner that depends on a named range that depends on an external feed. The state graph becomes a rat's nest.

Causl embraces that reality. It does not pretend application state is simple. It gives teams a transactional system for modeling live dependency graphs explicitly.

Canonical facts change inside transactions. Derived values recompute through a deterministic dependency graph. Observers see only committed snapshots. Async results are versioned so they cannot silently overwrite newer state. Conflicts become records that can be inspected, resolved, tested, and replayed.

The canonical visual expression of the brand is the **Causl mark**: an abstract geometric mark — seven graph nodes arrayed on a circle, with a cyan arc tracing the causal path from the top-right node counter-clockwise to the bottom node, and the bottom-right node painted in commit-red. The mark is the dependency graph reduced to its essential shape: nodes, propagation, and one highlighted commit point. The brand has no animal mascot; the mark itself carries the identity. The prose voice can still be slightly feral — technical, scrappy, hacker-native, comfortable describing a state graph as a "rat's nest in the walls" — but the brand is never illustrated as a creature. (Option B decision, issue #1263.)

**Brand narrative:**

> When application state turns into a rat's nest, Causl goes in. It follows every dependency, blocks stale writes, records conflicts, and commits only consistent snapshots.

---

## 3. Naming Rationale

### Stack

“Stack” immediately speaks to developers. It evokes:

- call stacks
- state stacks
- transaction stacks
- undo/redo stacks
- dependency layers
- server/client architecture
- React component trees
- debug traces
- event logs

### Rat

“Rat” gives the brand its edge. It evokes:

- cleverness
- persistence
- compactness
- underground systems
- hidden paths
- survival in hostile machinery
- scrappy open-source culture

The name is memorable because it is concrete. You can picture a Causl. You can draw it. You can make stickers. You can make error messages funny without weakening the technical promise.

### Preferred Styling

Use **Causl** in prose and logos.

Acceptable technical variants:

```text
causl
@causl/core
causl-server
```

Avoid:

```text
Causl
CAUSL
Stack-Rat
Stack Rat
```

---

## 4. Positioning

### Positioning Statement

**Causl is a transactional, dependency-aware state engine for applications that need deterministic recomputation, consistent snapshots, explainable derivations, stale async protection, and conflict-aware synchronization.**

### Target Users

Causl is for engineers building:

- spreadsheet-grade web applications
- CMMS and capital-planning software
- collaborative editing systems
- formula-heavy planning tools
- workflow engines
- Gantt/calendar/booking systems
- dependency-rich React applications
- Rust-backed synchronization platforms
- applications with undo/redo by semantic transaction
- applications where stale async results or transient UI glitches are unacceptable

### Competitive Frame

Causl is not simply a Redux alternative, MobX alternative, signal library, or GraphQL cache. It sits closer to a **reactive transaction graph**: a state engine that combines ideas from MVCC, incremental computation, spreadsheet recalculation, observable derivations, semantic transactions, and conflict records.

### Core Promise

> Causl lets developers model state as a live dependency graph while preserving transactional consistency and inspectability.

---

## 5. Message Architecture

### Primary Tagline

> Transactional state for tangled dependency graphs.

### Short Promise

> Commit only consistency.

### Developer Hook

> Catch race conditions in the walls.

### Technical Claim

> MVCC-inspired snapshots, deterministic recomputation, versioned async results, and first-class conflict records for complex application state.

### Emotional Claim

> Stop debugging ghosts in your state graph.

### One-Liner

> Causl is an open-source transactional state engine for live dependency graphs: deterministic recomputation, consistent snapshots, stale async protection, and first-class conflict records.

### README Intro

```md
Causl is a transactional, dependency-aware state management system for applications where ordinary UI state tools are not sufficient.

It models application state as a live graph of canonical facts, derived values, async resources, formulas, constraints, user interactions, and collaborative edits. Facts change inside transactions. Derived values recompute deterministically. Observers read only committed snapshots. Stale async results are blocked. Conflicts are first-class records.
```

---

## 6. Voice and Tone

Causl should sound like a serious systems tool with a sharp, slightly feral edge — written by engineers who have debugged broken state graphs at 2 a.m.

### Voice Attributes

| Attribute | Meaning |
|---|---|
| Precise | Explain the mechanism. Avoid vague magic language. |
| Hacker-native | Use developer vocabulary naturally: commit, trace, graph, stale, snapshot, conflict. |
| Forensic | The product reveals hidden causality and provenance. |
| Scrappy | Slightly feral, technically grounded, hard to kill — attitude without unseriousness. |
| Deterministic | The brand should repeatedly reinforce consistency, replayability, and testability. |

### Say This

- “Committed snapshot”
- “Stale async result blocked”
- “Derived through traceable dependencies”
- “Conflict captured as a record”
- “Deterministic recomputation”
- “Semantic transaction”

### Avoid This

- “Magical state management”
- “Just works”
- “The cutest state library”
- “RAT” jokes that evoke malware as the main message
- Pest/horror imagery

---

## 7. Visual Identity

### Visual Concept

The identity is built on two interlocking visual ideas:

1. **Graph:** dependency edges, nodes, formulas, propagation paths.
2. **Causal path:** a single arc tracing cause through derivation to commit — the open C of "Causl" reread as a directed graph closing on itself.

The canonical visual expression is the abstract Causl mark (see §11): seven graph nodes arrayed on a circle, with a cyan arc swept counter-clockwise from the top-right node to the bottom node, and the bottom-right node painted in commit-red. The mark is the dependency graph reduced to its essential shape — nodes, propagation, and one highlighted commit point — and is the only required brand symbol.

### Logo Direction

**Primary mark:** abstract geometric mark — 7-node graph + cyan causal arc + commit-red node (see §11 for geometry).
**Secondary motif:** directed graph edges and cyan propagation paths.
**Accent motif:** one commit-red node as the resolution point.
**Wordmark:** Causl in title case (capital C, lowercase remainder); never all-caps outside tiny metadata labels.

### Logo Usage

| Context | Recommended Usage |
|---|---|
| GitHub org avatar | Icon-only Causl mark on a dark plate |
| README header | Full lockup: mark + Causl wordmark + tagline |
| Favicon | Causl mark, rendered at 32px / 16px; the seven-node geometry survives at the small sizes |
| Devtools | Icon-only mark, with semantic colors driven by live graph state |
| Stickers | Mark + wordmark + tagline ("Commit only consistency.") on dark plate |

---

## 8. Color Scheme

The Causl palette is a dark terminal theme with semantic neon accents. Colors should not be decorative only; they should map to state concepts.

| Token | Hex | Role |
|---|---:|---|
| **Void Black** | `#070A0F` | Primary background, terminal darkness, hero surfaces |
| **Ink Black** | `#0B1118` | Secondary background, docs sections, app chrome |
| **Stack Slate** | `#101822` | Panels, cards, devtools surfaces, code blocks |
| **Rat Graphite** | `#2B333D` | Borders, disabled UI, inactive nodes, low-contrast surface chrome |
| **Snapshot Mist** | `#D7E6EA` | Primary text on dark backgrounds |
| **Trace Ash** | `#8FA2AA` | Secondary text, annotations, low-emphasis metadata |
| **Async Cyan** | `#11D9FF` | Live dependency edges, async resources, links, graph focus |
| **Commit Green** | `#A7FF18` | Successful commits, active snapshots, healthy graph state |
| **Copper Wire** | `#C8743D` | Machinery accents, structural lines, hardware/process motifs |
| **Conflict Amber** | `#FFB020` | Warnings, conflicts, unresolved branches, validation issues |
| **Rollback Red** | `#FF4D5E` | Errors, stale overwrites, failed transactions, destructive actions |
| **Mutation Violet** | `#7C4DFF` | Formula edits, experimental flows, mutation traces |
| **White** | `#FFFFFF` | High-contrast emergency text only; use sparingly |

### Semantic Rules

- **Cyan** means live edge, async flow, dependency trace, or selected graph path.
- **Green** means committed, valid, safe, or successful.
- **Amber** means conflict, validation warning, unresolved branch, or user attention required.
- **Red** means unsafe, stale, failed, rejected, destructive, or rolled back.
- **Violet** means mutation, formula activity, experimental operation, or transient edit mode.
- **Copper** is structural and brand-specific; use it for machinery motifs, hardware accents, and subtle structural lines.

### Suggested CSS Tokens

```css
:root {
  --causl-void: #070A0F;
  --causl-ink: #0B1118;
  --causl-slate: #101822;
  --causl-graphite: #2B333D;
  --causl-mist: #D7E6EA;
  --causl-ash: #8FA2AA;
  --causl-cyan: #11D9FF;
  --causl-green: #A7FF18;
  --causl-copper: #C8743D;
  --causl-amber: #FFB020;
  --causl-red: #FF4D5E;
  --causl-violet: #7C4DFF;
}
```

---

## 8.1 Contrast-Pair Token System

The hue tokens above name *what color is what*. They do not say *what colors are allowed together*. Components that freely mix `background:` from one hue and `color:` from another produce contrast bugs that no individual hex value can prevent. The contrast-pair system below addresses that at the token layer.

Every text color is **bound to a specific surface** by name. Components write the pair together. Mismatching a text token against the wrong surface — for example painting `--text-on-emphasis` (intended as dark text on bright cyan) onto `--surface-base` (a dark page background) — is a design error caught at code review by the token name itself.

### Surface families

| Surface | Dark theme | Light theme | Role |
|---|---|---|---|
| `--surface-base` | `#070A0F` | `#FFFFFF` | Page background |
| `--surface-elevated` | `#101822` | `#F4F6F9` | Cards, panels, table chrome |
| `--surface-overlay` | `#0B1118` | `#FFFFFF` | Dialogs, topbar, footer, popovers |
| `--surface-emphasis` | `#11D9FF` | `#0B95B0` | Primary CTAs, current-page pill |
| `--surface-emphasis-2` | `#7C4DFF` | `#5B30C9` | Secondary CTAs, accent gradients |
| `--surface-success` | `#A7FF18` | `#4A9300` | Success badges, do-list border |
| `--surface-warning` | `#FFB020` | `#B57500` | Warning chips, conflict markers |
| `--surface-danger` | `#FF4D5E` | `#C32A38` | Errors, dont-list border |
| `--surface-info` | `#11D9FF` | `#0B95B0` | Info callouts |
| `--surface-muted` | `#2B333D` | `#DDE1E6` | Disabled controls, hairline panels |

### Text variants — paired by name

| Surface | Primary text | Muted | Subtle |
|---|---|---|---|
| `--surface-base` | `--text-on-base` | `--text-on-base-muted` | `--text-on-base-subtle` |
| `--surface-elevated` | `--text-on-elevated` | `--text-on-elevated-muted` | `--text-on-elevated-subtle` |
| `--surface-overlay` | `--text-on-overlay` | `--text-on-overlay-muted` | — |
| `--surface-emphasis` | `--text-on-emphasis` | — | — |
| `--surface-emphasis-2` | `--text-on-emphasis-2` | — | — |
| `--surface-success` | `--text-on-success` | — | — |
| `--surface-warning` | `--text-on-warning` | — | — |
| `--surface-danger` | `--text-on-danger` | — | — |
| `--surface-info` | `--text-on-info` | — | — |
| `--surface-muted` | `--text-on-muted` | — | — |

### Borders

| Surface | Hairline | Stronger | Accent |
|---|---|---|---|
| `--surface-base` | `--border-on-base` | `--border-on-elevated` | `--border-emphasis` |
| `--surface-elevated` | — | `--border-on-elevated` | `--border-emphasis` |
| `--surface-overlay` | `--border-on-overlay` | — | `--border-emphasis` |

### Contrast contracts

Each pair is guaranteed by construction to clear WCAG AA contrast on its surface in *both* themes:

- `--text-on-*` primary: ≥ 7:1 (AAA where feasible, never below AA 4.5:1).
- `--text-on-*-muted`: ≥ 7:1 on its paired surface for secondary copy.
- `--text-on-*-subtle`: ≥ 4.5:1 — reserved for meta/caption text only.
- Bright surface tokens (`emphasis`, `success`, `warning`) pair with `--causl-void` in dark theme and pure white in light theme so the contrast direction is consistent.

### Rule

> Any rule that sets `background:` must explicitly pair the matching `color:` token from the same surface family. Free-mixing across pairs is a brand-system violation.

The hue tokens (`--causl-async-cyan`, `--causl-mist`, etc.) remain as the raw palette these pairs reference. They MAY still be used inside the pair-token definitions in `:root` and `:root[data-theme="light"]` (because the pair tokens *are* the palette mapping). They MUST NOT be used directly inside component rules: a component that writes `color: var(--causl-mist)` has bypassed the contract and will drift the next time a surface beneath it changes.

---

## 8.2 Semantic State Tokens

§8.1 binds *what color sits on what surface*. The state-token layer in this section binds *what color expresses what interaction*. Hover, focus, active, pressed, disabled, error, warning, success, and info each map to a named token pair (background + foreground; some include a border or focus ring). Components MUST reference these tokens — never inline `rgba()` or hex — so the entire state palette flips together in light theme via `:root[data-theme="light"]`.

The state tokens live in `causl-org/css/site.css` between the §8.1 surface/text contract and the component rules; the TypeDoc overlay (`causl-typedoc.css`) mirrors the same definitions so generated pages resolve them without depending on `site.css`.

### Interaction states

| State | Token pair | Dark bg | Dark fg | Light bg | Light fg |
|---|---|---|---|---|---|
| Hover | `--state-hover-bg` / `--state-hover-fg` | `rgba(17,217,255,0.08)` | `#11D9FF` | `rgba(11,149,176,0.08)` | `#0B95B0` |
| Focus | `--state-focus-outline` / `--state-focus-ring` | `#11D9FF` / `0 0 0 3px rgba(17,217,255,0.4)` | — | `#0B95B0` / `0 0 0 3px rgba(11,149,176,0.4)` | — |
| Active | `--state-active-bg` / `--state-active-fg` | `#11D9FF` | `#070A0F` | `#0B95B0` | `#FFFFFF` |
| Pressed | `--state-pressed-bg` | `rgba(17,217,255,0.16)` | — | `rgba(11,149,176,0.16)` | — |
| Disabled | `--state-disabled-bg` / `--state-disabled-fg` | `#2B333D` | `#8FA2AA` | `#DDE1E6` | `#5A6470` |

### Status states

| State | Token triple | Dark bg | Dark fg / border | Light bg | Light fg / border |
|---|---|---|---|---|---|
| Error | `--state-error-bg` / `--state-error-fg` / `--state-error-border` | `rgba(255,77,94,0.08)` | `#FF4D5E` | `rgba(195,42,56,0.08)` | `#C32A38` |
| Warning | `--state-warning-bg` / `--state-warning-fg` / `--state-warning-border` | `rgba(255,176,32,0.08)` | `#FFB020` | `rgba(181,117,0,0.08)` | `#B57500` |
| Success | `--state-success-bg` / `--state-success-fg` / `--state-success-border` | `rgba(167,255,24,0.08)` | `#A7FF18` | `rgba(74,147,0,0.08)` | `#4A9300` |
| Info | `--state-info-bg` / `--state-info-fg` / `--state-info-border` | `rgba(17,217,255,0.08)` | `#11D9FF` | `rgba(11,149,176,0.08)` | `#0B95B0` |

### Contrast contracts

Every fg-on-bg state pair clears WCAG AA in *both* themes. Status backgrounds are an 8% alpha tint of the hue, so they sit transparently over `--surface-base` or `--surface-elevated` without breaking the §8.1 pair contract. The fg tokens are the full-strength dimmed hue:

- Light theme fg colors `#0B95B0` (cyan), `#C32A38` (red), `#B57500` (amber), `#4A9300` (green) all clear ≥ 4.5:1 against `#FFFFFF` and against the 8%-alpha tint composited over white.
- Dark theme fg colors are the high-luminance brand hues, all ≥ 7:1 against `#070A0F` (`--surface-base`) and the 8%-alpha tint composited over it.

### Rule

> Any new component that expresses an interaction state (hover, focus, active, pressed, disabled) or a status (error, warning, success, info) MUST reference the corresponding state token. Inlining `rgba(17,217,255,0.08)` or `#FF4D5E` in a component rule is a brand-system violation: the value will not flip in light theme and bypasses the contrast contract.

State tokens compose with §8.1 pair tokens — a hover rule on `.button.ghost` sets `background: var(--state-hover-bg)` *and* keeps `color:` paired against its surface; an error callout sets `background: var(--state-error-bg)` *and* `color: var(--state-error-fg)`, treating the (bg, fg) pair as a single unit just like the surface/text pairs.

---

## 9. Typography

### Recommended Type System

| Use | Recommended Fonts |
|---|---|
| Product and docs UI | Inter, Aptos, IBM Plex Sans, or system sans |
| Wordmark exploration | Space Grotesk, Sora, Eurostile-style geometric sans, or custom angular lettering |
| Code and technical metadata | JetBrains Mono, Cascadia Mono, IBM Plex Mono, or Berkeley Mono |
| Transaction IDs and logs | Monospace only |

### Typographic Personality

- Headlines should be short and declarative.
- Body text should be clean and documentation-friendly.
- Code, traces, graph labels, and transaction logs should use monospace.
- Avoid overly playful typefaces. The mark and the prose voice supply personality; the typography should supply credibility.

### Canonical Typefaces (Causl Site)

For the canonical Causl site (causl.org), the brand commits to two specific typefaces, self-hosted to keep first-paint independent of any third-party CDN and to avoid the privacy/uptime costs of Google Fonts:

- **Inter** (Latin subset, self-hosted) — body, UI, headlines. Weights shipped: 400 / 500 / 600 / 700 / 800–900. Source: rsms/inter.
- **IBM Plex Mono** (Latin-1 subset, self-hosted) — code, transaction IDs, graph labels, log lines. Weights shipped: 400 / 500 / 700. Source: IBM/plex.

These are loaded via `@font-face` in `causl-org/css/site.css` from `causl-org/fonts/*.woff2` with `font-display: swap`. The sans / mono fallback chains declared in `--sans` and `--mono` exist as a defensive layer only (for the swap window and for browsers that fail to fetch the WOFF2); they MUST NOT be cited as acceptable canonical brand faces. Substituting a different sans or mono on the canonical site is a brand-system violation. Issue #1262.

---

## 10. UI Theme

Causl’s devtools and documentation should feel like a graph debugger at midnight.

### UI Surface Rules

- Use dark backgrounds by default.
- Prefer thin borders over heavy containers.
- Use cyan for selected dependency paths.
- Use green only for committed/safe state.
- Use amber and red consistently for warnings/errors.
- Use small monospace labels for metadata.
- Show provenance paths visually whenever possible.
- Treat conflicts as records with structure, not alert banners only.

### Example UI States

| State | Visual Treatment |
|---|---|
| Clean committed snapshot | Green status dot, mist text, low-contrast border |
| Live dependency trace | Cyan edge highlight, cyan selected node, trace path label |
| Stale async result blocked | Red badge with timestamp/version metadata |
| Conflict detected | Amber badge, structured conflict record, resolution affordance |
| Formula recomputation | Violet trace line with recomputation count |
| Undoable semantic transaction | Copper timestamp marker plus transaction label |

---

## 11. Brand Mark (Identity Mark)

> Per the Option B decision in issue #1263, Causl has no animal mascot. This section, formerly "Mascot Specification," now anchors the brand's primary visual expression on the abstract geometric mark — the canonical Causl mark documented below. The single source of truth for the mark file is `causl-org/img/causl-mark.svg`; its inline comment back-references this section by number.

### Mark Concept

The Causl mark is the dependency graph reduced to its essential shape. Seven nodes arrayed on a circle represent the graph's nodes; a single cyan arc traces the causal path through them; one node is painted commit-red to mark the point where causality becomes visible (commit, conflict, resolution). The composition reads simultaneously as an open C (the wordmark's first letter) and as a directed graph closing on itself. There is no creature, no fur, no eye, no harness — only nodes, propagation, and one highlighted commit point.

### Geometry

- **viewBox:** `0 0 120 120` (square, 120-unit canvas).
- **Nodes:** seven circles of radius 10, arrayed on a 40-unit circle centered at (60, 60). Node coordinates: `(88.3, 31.7)`, `(60, 20)`, `(31.7, 31.7)`, `(20, 60)`, `(31.7, 88.3)`, `(60, 100)`, and the commit node at `(88.3, 88.3)`.
- **Causal arc:** SVG path `M 88.3 31.7 A 40 40 0 1 0 88.3 88.3`, swept counter-clockwise from the top-right node to the bottom-right node, with `fill="none"`, `stroke-width="8"`, `stroke-linecap="round"`.
- **Plate:** no backing plate is baked into the canonical SVG. The mark works on both the dark site gradient and the light-mode paper. When a plate is required (favicon, social cards, OG images), apply it via CSS or a per-export wrapper SVG — never inside `causl-mark.svg`.

### Color

- **Six graph nodes + causal arc:** Async Cyan `#11D9FF` (spec §8).
- **Commit node (bottom-right, `88.3, 88.3`):** Rollback Red `#FF4D5E` (spec §8).
- The cyan / commit-red pairing is load-bearing semantics, not decoration: cyan is live propagation, red is the resolved/committed point. Do not recolor the mark to fit a non-brand palette; if monochrome is required (single-color print, embossed surfaces), render the entire mark in a single neutral and document the substitution at the asset level.

### Clear Space and Sizing

- **Clear space:** at least one node diameter (≈8.3% of the mark's side) of empty space around the mark on all sides. No text, no UI chrome, no badges may enter the clear-space zone.
- **Minimum size:** 16 × 16 px (favicon floor); the seven-node geometry remains legible at that size on a dark plate. Below 16 px, fall back to the wordmark only.
- **Lockup:** in a full lockup (mark + wordmark), the mark's height matches the wordmark cap-height to approximately 2.6× — the wordmark sits to the right of the mark, baseline-aligned to the mark's lower commit node.

### Placement

| Context | Treatment |
|---|---|
| GitHub org avatar | Icon-only mark on a dark plate (`#0B1020` or `--surface-overlay`) |
| README header | Full lockup: mark + Causl wordmark + tagline |
| Favicon | The mark itself, plate-less SVG at `causl-org/img/causl-mark.svg` |
| Devtools | Icon-only mark; semantic node colors may shift to reflect live graph state |
| Stickers / OG cards | Mark + wordmark + tagline on a dark plate |

### Mark Do / Don't

Do:

- Use the canonical SVG at `causl-org/img/causl-mark.svg` verbatim — it is the single source of truth.
- Pair the mark with the wordmark in lockups, never substitute one for the other.
- Honor the cyan-and-commit-red color contract; the red node is the resolution point.
- Preserve clear space on every placement.

Don't:

- Do not add a backing plate inside `causl-mark.svg`; apply plates externally.
- Do not skew, rotate (beyond the canonical orientation), or distort the node array.
- Do not swap in mascot illustrations, animal silhouettes, or character art — there is no mascot (issue #1263, Option B).
- Do not recolor the mark to non-brand palettes; if monochrome is required, render in a single neutral and document.
- Do not render the mark below 16 px; fall back to the wordmark.

---

## 12. Product Naming System

### Packages

```text
@causl/core
@causl/react
@causl/devtools
@causl/formula
@causl/sync
causl-server
```

### Feature Names

| Feature | Suggested Name | Notes |
|---|---|---|
| Scoped state graph | Burrow | Optional, evocative of the "in-the-walls" voice while staying understandable |
| Dependency inspector | Nest View | Good for devtools only; avoid overusing in core docs |
| Derivation provenance | Trace | Strong technical term |
| Stale async protection | Snare | Brandable; use carefully with explanation |
| Consistent read model | Snapshot | Clear and established |
| Semantic transaction log | Commit Log | Clear and direct |
| Conflict registry | Conflict Records | Prefer clarity over cute naming |

### Naming Principle

Use brand vocabulary for memorable devtools surfaces and docs sections, but keep the public API technically clear. For example, `snapshot`, `transaction`, `trace`, and `conflict` are better API terms than overly cute brand-vocabulary names.

---

## 13. Brand Applications

### README Header

```md
# Causl

Transactional state for tangled dependency graphs.

Causl gives complex applications deterministic transactions, committed snapshots, dependency-aware recomputation, stale async protection, and first-class conflict records.
```

### GitHub Description

```text
Transactional state for tangled dependency graphs.
```

### npm Description

```text
A transactional, dependency-aware state engine for complex React and live-graph applications.
```

### Launch Post Headline Options

- Meet Causl: transactional state for tangled dependency graphs
- Stop debugging ghosts in your state graph
- Commit only consistency with Causl
- A state engine for apps that outgrew reducers, atoms, and object observables

### Sticker Copy

- Commit only consistency.
- Stale write caught.
- Catch race conditions in the walls.
- Untangle the graph.
- I found the race condition.

All sticker treatments pair the copy above with the Causl mark on a dark plate. No mascot illustrations.

---

## 14. Practical Brand Guardrails

### Strong Fit

Causl is strongest when used for:

- state engines
- graph computation
- devtools
- transaction systems
- synchronization layers
- formula engines
- debugging and inspection tools

### Weaker Fit

Causl is less ideal for a product that wants to feel:

- corporate and risk-averse
- consumer-friendly first
- minimal and luxury-coded
- nontechnical
- healthcare/regulatory without explanation

### Main Risk

The word "rat" has negative associations: pest, snitch, and "RAT" as remote-access trojan. The brand controls this by *not* illustrating a rat: the mark is geometric, the prose voice keeps the "in the walls" metaphor at the language layer only, and the technical positioning carries the weight.

### Mitigation

- Always pair the name with a clear technical tagline.
- Use polished dark-tech visuals — geometric, diagrammatic, never character-led.
- Keep the mark front-and-center as the brand's primary symbol; never substitute illustration.
- Avoid malware jokes in primary messaging.
- Emphasize consistency, transactions, and graph inspection.

---

## 15. Final Brand Direction

**Causl** should be positioned as a serious open-source systems library anchored on a memorable geometric mark — the 7-node graph + cyan causal arc — and a slightly feral, hacker-native prose voice.

The brand should make one promise repeatedly:

> Complex state does not have to be mysterious. Causl exposes the graph, orders the transaction, blocks stale writes, records conflicts, and commits only consistency.

