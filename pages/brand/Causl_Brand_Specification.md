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

The Causl mascot is the creature that survives inside complex systems: small, clever, hard to kill, excellent at finding hidden paths, and perfectly comfortable in the walls of the stack.

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

Causl should sound like a serious systems tool with a mischievous mascot.

### Voice Attributes

| Attribute | Meaning |
|---|---|
| Precise | Explain the mechanism. Avoid vague magic language. |
| Hacker-native | Use developer vocabulary naturally: commit, trace, graph, stale, snapshot, conflict. |
| Forensic | The product reveals hidden causality and provenance. |
| Scrappy | The mascot gives the brand attitude without making the tool unserious. |
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
- “AI-powered” unless actually true
- “The cutest state library”
- “RAT” jokes that evoke malware as the main message
- Pest/horror imagery

---

## 7. Visual Identity

### Visual Concept

The identity should combine three visual ideas:

1. **Rat:** clever systems creature.
2. **Stack:** layered slabs, state layers, transaction history, snapshots.
3. **Graph:** dependency edges, nodes, formulas, propagation paths.

The mark should ideally show a rat crouched on layered stack slabs, with graph nodes either orbiting around it or threading through the composition. The rat should have one bright neon eye to imply watchfulness, inspection, and hidden-state detection.

### Logo Direction

**Primary mark:** angular rat silhouette on a layered stack.  
**Secondary motif:** tail as dependency edge or graph line.  
**Accent motif:** one neon eye.  
**Wordmark:** Causl in title case with strong camelcase distinction.

### Logo Usage

| Context | Recommended Usage |
|---|---|
| GitHub org avatar | Icon-only rat-on-stack mark |
| README header | Full lockup: mark + Causl wordmark + tagline |
| Favicon | Simplified rat head, bright eye, or rat-on-stack silhouette |
| Devtools | Icon-only mark with semantic colors for live graph state |
| Stickers | Mascot with tagline: “Commit only consistency.” |

---

## 8. Color Scheme

The Causl palette is a dark terminal theme with semantic neon accents. Colors should not be decorative only; they should map to state concepts.

| Token | Hex | Role |
|---|---:|---|
| **Void Black** | `#070A0F` | Primary background, terminal darkness, hero surfaces |
| **Ink Black** | `#0B1118` | Secondary background, docs sections, app chrome |
| **Stack Slate** | `#101822` | Panels, cards, devtools surfaces, code blocks |
| **Rat Graphite** | `#2B333D` | Borders, disabled UI, mascot body, inactive nodes |
| **Snapshot Mist** | `#D7E6EA` | Primary text on dark backgrounds |
| **Trace Ash** | `#8FA2AA` | Secondary text, annotations, low-emphasis metadata |
| **Async Cyan** | `#11D9FF` | Live dependency edges, async resources, links, graph focus |
| **Commit Green** | `#A7FF18` | Successful commits, active snapshots, healthy graph state |
| **Copper Wire** | `#C8743D` | Machinery accents, mascot hardware, structural lines |
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
- **Copper** is structural and brand-specific; use it for machinery, mascot hardware, and subtle accents.

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
- Avoid overly playful typefaces. The mascot supplies personality; the typography should supply credibility.

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

## 11. Mascot Specification

### Mascot Concept

The Causl mascot is a compact systems engineer that lives in the stack. It is clever, alert, and slightly suspicious of hidden side effects.

### Core Features

- Dark graphite fur
- One bright neon green or cyan eye
- Angular ears and sharp silhouette
- Long tail that can double as a graph edge
- Small diagnostic visor or goggles
- Harness or satchel for transaction logs
- Commit stamp, tiny wrench, or rolled graph blueprint
- Optional copper mechanical accents

### Personality

| Trait | Expression |
|---|---|
| Clever | Inspecting a graph edge with narrowed eyes |
| Scrappy | Carrying a commit stamp through cables |
| Forensic | Pointing at a stale async result in a trace |
| Triumphant | Holding a captured conflict record |
| Calm under chaos | Sitting on top of a messy dependency nest |

### Mascot Do / Don’t

Do:

- Make it sharp, alert, and technical.
- Use it to explain state mechanics visually.
- Pair it with real technical diagrams.
- Use it in docs, stickers, release posts, and devtools empty states.

Don’t:

- Make it gross or horror-coded.
- Lean into disease/pest associations.
- Overuse malware “RAT” references.
- Make it so cute that the tool feels unserious.
- Use random animal poses with no relation to dependency graphs or transactions.

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
| Scoped state graph | Burrow | Optional, mascot-aligned but still understandable |
| Dependency inspector | Nest View | Good for devtools only; avoid overusing in core docs |
| Derivation provenance | Trace | Strong technical term |
| Stale async protection | Snare | Brandable; use carefully with explanation |
| Consistent read model | Snapshot | Clear and established |
| Semantic transaction log | Commit Log | Clear and direct |
| Conflict registry | Conflict Records | Prefer clarity over cute naming |

### Naming Principle

Use brand vocabulary for memorable devtools surfaces and docs sections, but keep the public API technically clear. For example, `snapshot`, `transaction`, `trace`, and `conflict` are better API terms than overly cute mascot names.

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
- There’s a rat in your stack.
- Untangle the graph.
- I found the race condition.

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

The word “rat” has negative associations: pest, snitch, and “RAT” as remote-access trojan. The brand should control this by making the mascot clearly a systems engineer / graph inspector, not malware or vermin.

### Mitigation

- Always pair the name with a clear technical tagline.
- Use polished dark-tech visuals.
- Keep the mascot sharp and intelligent, not gross.
- Avoid malware jokes in primary messaging.
- Emphasize consistency, transactions, and graph inspection.

---

## 15. Final Brand Direction

**Causl** should be positioned as a serious open-source systems library with a memorable hacker mascot.

The brand should make one promise repeatedly:

> Complex state does not have to be mysterious. Causl exposes the graph, orders the transaction, blocks stale writes, records conflicts, and commits only consistency.

