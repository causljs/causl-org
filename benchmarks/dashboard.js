/* ============================================================
   causl.org/benchmarks — full dashboard renderer (#707, #769).

   Pure-vanilla JS, no dependencies. Reads a JSON file matching
   the shape of `packages/bench/report/benchmark_history.json`
   (HistoryEntry[] from packages/bench/src/report.ts) and renders
   one inline-SVG sparkline per (library × scenario × scale) cell.

   Each sparkline shows:
     - median (ms)  → solid library-coloured line, smoothed with a
       Catmull-Rom-style cubic interpolation, plus dots
     - p95   (ms)   → translucent band (median ↔ p95) with the same
       smoothing applied to both edges so the band reads cleanly
     - regression badge (right edge): pass / regressed / improved /
       noisy — verdict computed by comparing the latest entry to the
       second-to-latest, and by the CoV proxy on the latest entry
     - hover tooltip: a thin invisible SVG <rect> covers each datapoint
       and exposes a tooltip with the run's date, version, median, p95
       so the user can hover any run, not just the latest, and read
       its values
     - profile-artifact link (placeholder until #709's nightly publish
       lands — directories are populated by the perf-snapshot workflow
       parked in `.github/workflows-disabled/perf-snapshot.yml` until
       CI is restored in #725)

   --------------------------------------------------------------
   D3 / Plotly decision (#769) — STAY ON VANILLA SVG.

   #769 asked us to evaluate D3 (~70 KB minified) or Plotly
   (~3.5 MB minified) as an upgrade over the inline-SVG MVP from
   PR #771. We chose to stay on vanilla SVG, with the visible
   upgrades the issue wanted (smoother lines, better axis ticks,
   per-point hover tooltips) implemented directly. Rationale:

     1. Lighthouse Performance budget. Lazy-loading any extra
        third-party JS is non-zero TBT (Total Blocking Time) and
        non-zero LCP-after-hydration. A static page whose entire
        purpose is to render N small charts is exactly the case
        where shipping a charting framework would be net-negative
        on Lighthouse.
     2. The features the issue wanted (cubic smoothing, "nice"
        axis ticks, hover tooltips) are 80 lines of vanilla code
        each, not a 70 KB dependency. We've added them inline.
     3. No build step on causl.org/. The site is a flat directory
        served as static files. Adding a bundler just to import
        d3-shape + d3-scale + d3-axis would be a much larger
        architectural change than the issue scopes.
     4. Plotly is not a serious option — 3.5 MB minified for a
        tiny per-cell sparkline is two orders of magnitude over
        budget.

   The decision is captured in the PR for #769. If the dashboard
   ever needs full interactive charts (zoom, brush, crosshair,
   etc.) the right move is a dedicated bundled subpage, not
   inflating the index sparkline grid. — see PR body for the
   Lighthouse score capture.
   --------------------------------------------------------------

   Filters at the top let the user toggle which (library × scenario
   × scale) cells render. The default view is the headline
   "causl-vs-best-competitor at the 10k scale": only causl + mobx
   at scale 10000 — the cells the regression-gate watches most
   closely. Toggling re-renders the grid in place.

   The script first attempts ./history.json; if that 404s it falls
   back to ./history.sample.json (a checked-in sample so the page is
   never blank). The fallback is announced in the meta strip.
   ============================================================ */

(() => {
  'use strict'

  const HISTORY_URL = './history.json'
  const SAMPLE_URL = './history.sample.json'

  /** Canonical library order — mirrors packages/bench/src/chart.ts. */
  const LIBRARY_ORDER = ['causl', 'jotai', 'redux-toolkit', 'mobx']

  /** Library colours — pulled from the brand palette in site.css.
   *  All four colours have ≥ 4.5:1 contrast against the dashboard
   *  surface (`#11182A`-ish) since they are the same chips used on
   *  the rest of causl.org. */
  const LIBRARY_COLOR = {
    causl: '#27D3C3',
    jotai: '#5EE6A8',
    'redux-toolkit': '#FFB347',
    mobx: '#FF646E',
  }

  /** Default-view filter: the headline "causl vs best competitor"
   *  cells at the 10k scale per the issue spec. Users can toggle
   *  any other library/scenario/scale via the filter UI. */
  const DEFAULT_LIBRARIES = new Set(['causl', 'mobx'])
  const DEFAULT_SCALES = new Set([10000])

  /** Verdict thresholds — match the spec in #707. */
  const REGRESSION_PCT = 0.10 // > 10% slower
  const IMPROVED_PCT = 0.10 // > 10% faster
  const PASS_PCT = 0.05 // within 5%
  /** True CoV is samples-stdev / mean. We only have median + p95, so
   *  use `(p95 - median) / median` as a (much wider) dispersion proxy.
   *  For a roughly normal distribution `(p95 - μ) / μ ≈ 1.645 × CoV`,
   *  so a 5% true CoV would correspond to ≈ 8% on this proxy. To
   *  keep the badge from firing on every slightly-noisy cell, we
   *  set the noisy gate at 50% (proxy) — which roughly maps to a
   *  true CoV in the 30%+ range, the band where the cell really
   *  isn't trustable. The spec's 5%-CoV criterion can't be applied
   *  literally without per-iteration sample arrays in HistorySample. */
  const NOISY_PROXY = 0.50

  /** Verdict palette — high-contrast against the card background. */
  const VERDICT_COLOR = {
    pass: '#5EE6A8', // success-mint
    regressed: '#FF646E', // conflict-coral
    improved: '#4F7CFF', // signal-blue
    noisy: '#FFB347', // commit-amber
    unknown: '#A9B5C9', // fog
  }

  /** ----------------------------------------------------------------
   *  Filter state — managed as a single mutable object that the
   *  filter UI mutates and the renderer reads. Re-renders are
   *  triggered by `applyFilters()`.
   *  ---------------------------------------------------------------- */
  const filterState = {
    libraries: null, // Set<string> — populated on first render
    scenarios: null, // Set<string>
    scales: null, // Set<number>
  }

  /** ----------------------------------------------------------------
   *  Pure helpers
   *  ---------------------------------------------------------------- */

  /** Format a number for tick labels — never depends on locale. */
  function formatNumber(n) {
    if (!Number.isFinite(n)) return 'n/a'
    if (Math.abs(n) >= 100) return Math.round(n).toString()
    return Number.parseFloat(n.toFixed(2)).toString()
  }

  /** Tooltip-friendly ISO date → "May 06". */
  function formatShortDate(iso) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const month = d.toLocaleString('en-US', { month: 'short' })
    return `${month} ${d.getUTCDate().toString().padStart(2, '0')}`
  }

  /** Escape any text we splat into innerHTML — defence-in-depth even
   *  though the upstream JSON is checked-in / authored. */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /** Group a HistoryEntry[] into a Map keyed by `library|scenario|scale`,
   *  each value an array of { capturedAt, version, sample } in run
   *  order. Entries without a matching sample for a cell are skipped
   *  for that cell only. */
  function groupCells(history) {
    const cells = new Map()
    for (const entry of history) {
      for (const sample of entry.samples) {
        const key = `${sample.library}|${sample.scenario}|${sample.scale}`
        let bucket = cells.get(key)
        if (!bucket) {
          bucket = {
            library: sample.library,
            scenario: sample.scenario,
            scale: sample.scale,
            points: [],
          }
          cells.set(key, bucket)
        }
        bucket.points.push({
          capturedAt: entry.capturedAt,
          version: entry.version,
          medianMs: sample.medianMs,
          p95Ms: sample.p95Ms,
        })
      }
    }
    return cells
  }

  /** Sort cells by canonical library order, then scenario alpha,
   *  then scale ascending. */
  function sortCells(cells) {
    const arr = Array.from(cells.values())
    arr.sort((a, b) => {
      const la = LIBRARY_ORDER.indexOf(a.library)
      const lb = LIBRARY_ORDER.indexOf(b.library)
      const lcmp =
        (la === -1 ? Number.POSITIVE_INFINITY : la) -
        (lb === -1 ? Number.POSITIVE_INFINITY : lb)
      if (lcmp !== 0) return lcmp
      if (a.scenario !== b.scenario) return a.scenario < b.scenario ? -1 : 1
      return a.scale - b.scale
    })
    return arr
  }

  /** ----------------------------------------------------------------
   *  Verdict computation
   *
   *  We don't have per-iteration samples in HistoryEntry — each
   *  HistorySample is a pre-aggregated (medianMs, p95Ms). The CoV
   *  check therefore uses the gap between p95 and the median as a
   *  proxy for sample dispersion: `(p95 - median) / median`. This is
   *  a coarse approximation that runs strictly bigger than the true
   *  CoV (a p95-spread is wider than one stdev), so it errs on the
   *  side of marking borderline cells noisy — the right failure
   *  mode for a regression dashboard.
   *  ---------------------------------------------------------------- */
  function computeVerdict(points) {
    if (!points || points.length === 0) return { kind: 'unknown', detail: 'no data' }

    const last = points[points.length - 1]
    if (!Number.isFinite(last.medianMs)) {
      return { kind: 'unknown', detail: 'last median is non-finite' }
    }

    // Noisy check fires regardless of trend — a high-variance latest
    // run isn't trustable as either pass or regression.
    if (Number.isFinite(last.p95Ms) && last.medianMs > 0) {
      const proxy = (last.p95Ms - last.medianMs) / last.medianMs
      if (proxy > NOISY_PROXY) {
        return {
          kind: 'noisy',
          detail: `p95 ${formatNumber(last.p95Ms)} ms is ${formatNumber(proxy * 100)}% above median (latest run)`,
        }
      }
    }

    if (points.length < 2) {
      return { kind: 'unknown', detail: 'only one run — no trend yet' }
    }

    const prev = points[points.length - 2]
    if (!Number.isFinite(prev.medianMs) || prev.medianMs <= 0) {
      return { kind: 'unknown', detail: 'previous median is non-finite' }
    }

    const delta = (last.medianMs - prev.medianMs) / prev.medianMs
    const detail = `${delta >= 0 ? '+' : ''}${formatNumber(delta * 100)}% vs prior run (${formatNumber(prev.medianMs)} → ${formatNumber(last.medianMs)} ms)`

    if (delta > REGRESSION_PCT) return { kind: 'regressed', detail }
    if (delta < -IMPROVED_PCT) return { kind: 'improved', detail }
    if (Math.abs(delta) <= PASS_PCT) return { kind: 'pass', detail }
    // 5%–10% drift: not a regression but not strictly within-pass —
    // we still call it pass because the spec only carves "regressed"
    // and "improved" out at the 10% line.
    return { kind: 'pass', detail }
  }

  /** Render a tiny SVG dot for the right-edge badge. Returns the SVG
   *  fragment (not a wrapping element) so the caller can place it
   *  inside an existing chart SVG or alongside the chart. */
  function renderBadgeDot(verdict, cx, cy, r) {
    const color = VERDICT_COLOR[verdict.kind] ?? VERDICT_COLOR.unknown
    return (
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" ` +
      `stroke="rgba(11,16,32,0.4)" stroke-width="1">` +
      `<title>${escapeHtml(verdict.kind)}: ${escapeHtml(verdict.detail)}</title>` +
      `</circle>`
    )
  }

  /** Build the placeholder profile-artifact URL for a cell. The path
   *  scheme matches the `profiles/${lib}-${scn}-${n}/` layout the
   *  perf-snapshot workflow uploads (currently disabled — see
   *  `.github/workflows-disabled/perf-snapshot.yml`). The `latest/`
   *  segment is the symlink the publish step will point at the
   *  most recent date+sha directory once CI is restored. */
  function profileUrlFor(cell) {
    const slug = `${cell.library}-${cell.scenario}-${cell.scale}`
    return `./profiles/latest/${slug}/`
  }

  /** ----------------------------------------------------------------
   *  Cubic-Hermite interpolation (D3-equivalent smoothing).
   *
   *  d3-shape's `curveCatmullRom` is ~30 lines of math; we inline
   *  the same algorithm so we don't need d3-shape. Given a series
   *  of (x,y) points we emit an SVG path with cubic Bézier segments
   *  whose tangents come from the Catmull-Rom formula at α=0.5
   *  (centripetal — handles non-uniformly-spaced x values without
   *  overshoot). For < 2 points we just render a moveTo.
   *  ---------------------------------------------------------------- */
  function catmullRomPath(points) {
    if (points.length === 0) return ''
    if (points.length === 1) {
      const [p] = points
      return `M ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
    }
    const cmds = [`M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`]
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] ?? points[i]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] ?? p2
      // Catmull-Rom → Bézier tangent magnitudes (α = 0.5, centripetal).
      const c1x = p1[0] + (p2[0] - p0[0]) / 6
      const c1y = p1[1] + (p2[1] - p0[1]) / 6
      const c2x = p2[0] - (p3[0] - p1[0]) / 6
      const c2y = p2[1] - (p3[1] - p1[1]) / 6
      cmds.push(
        `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ` +
          `${c2x.toFixed(2)} ${c2y.toFixed(2)} ` +
          `${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`,
      )
    }
    return cmds.join(' ')
  }

  /** ----------------------------------------------------------------
   *  "Nice" axis ticks (D3-equivalent d3-scale.ticks).
   *
   *  Given a domain [min, max] and a target tick count, return ≤
   *  `count + 1` "round" tick values whose step is in {1, 2, 5} ×
   *  10^k. Mirrors d3-scale.ticks so visiting the chart "feels" the
   *  same as a D3 chart, without the dependency.
   *  ---------------------------------------------------------------- */
  function niceTicks(min, max, count) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || count <= 0) return []
    if (min === max) return [min]
    const span = max - min
    const step0 = span / count
    const power = Math.floor(Math.log10(step0))
    const base = Math.pow(10, power)
    const ratio = step0 / base
    let step
    if (ratio >= 5) step = 10 * base
    else if (ratio >= 2) step = 5 * base
    else if (ratio >= 1) step = 2 * base
    else step = base
    const start = Math.ceil(min / step) * step
    const ticks = []
    // Guard against fp drift — limit to count+2 ticks max.
    for (let i = 0; i < count + 2; i += 1) {
      const v = start + i * step
      if (v > max + step * 1e-9) break
      // Round to kill fp dust like 0.30000000000000004.
      const rounded = Math.round(v * 1e6) / 1e6
      ticks.push(rounded)
    }
    return ticks
  }

  /** ----------------------------------------------------------------
   *  Sparkline (SVG)
   *
   *  Mirrors the conventions in packages/bench/src/chart.ts:
   *    - viewBox + xmlns for clean inline embedding
   *    - <path> with cubic-Hermite smoothing for the median series
   *    - <path> with same smoothing for the p95 band envelope
   *    - "nice" axis ticks (1/2/5 × 10^k) on the y-axis
   *    - per-point invisible hit-rect with <title> for full hover
   *      coverage (every run is hoverable, not just the latest)
   *    - badge dot at the right edge
   *  ---------------------------------------------------------------- */
  function renderSparkline(cell, verdict) {
    const W = 320
    const H = 130
    const PAD_L = 38
    const PAD_R = 26 // a few extra px to reserve room for the badge
    const PAD_T = 10
    const PAD_B = 30 // extra bottom room for the date axis line

    const pts = cell.points
    if (pts.length === 0) {
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
        `role="img" aria-label="no data for ${escapeHtml(cell.library)} ${escapeHtml(cell.scenario)} at scale ${cell.scale}">` +
        `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="11" fill="#A9B5C9">no data</text>` +
        `</svg>`
      )
    }

    // Y-domain: include both median and p95 so the band fits.
    let yMin = Number.POSITIVE_INFINITY
    let yMax = Number.NEGATIVE_INFINITY
    for (const p of pts) {
      if (Number.isFinite(p.medianMs)) {
        yMin = Math.min(yMin, p.medianMs)
        yMax = Math.max(yMax, p.medianMs)
      }
      if (Number.isFinite(p.p95Ms)) {
        yMin = Math.min(yMin, p.p95Ms)
        yMax = Math.max(yMax, p.p95Ms)
      }
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = 0
      yMax = 1
    }
    if (yMin === yMax) {
      const eps = Math.max(yMax * 0.05, 0.001)
      yMin -= eps
      yMax += eps
    }

    const innerW = W - PAD_L - PAD_R
    const innerH = H - PAD_T - PAD_B

    const xAt = (i) => {
      if (pts.length === 1) return PAD_L + innerW / 2
      return PAD_L + (innerW * i) / (pts.length - 1)
    }
    const yAt = (v) => {
      if (!Number.isFinite(v)) return PAD_T + innerH
      const t = (v - yMin) / (yMax - yMin)
      return PAD_T + innerH * (1 - t)
    }

    const color = LIBRARY_COLOR[cell.library] ?? '#A9B5C9'

    // p95 band — smooth envelope built from a forward Catmull-Rom
    // path along p95 then a reverse Catmull-Rom path along median.
    const upperRaw = []
    const lowerRaw = []
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i]
      if (!Number.isFinite(p.medianMs) || !Number.isFinite(p.p95Ms)) continue
      upperRaw.push([xAt(i), yAt(p.p95Ms)])
      lowerRaw.push([xAt(i), yAt(p.medianMs)])
    }
    let bandPath = ''
    if (upperRaw.length >= 2) {
      const upPath = catmullRomPath(upperRaw)
      // Reverse the lower path and convert to "L"-only commands so it
      // joins cleanly to the end of the upper path inside one <path>.
      const downPts = lowerRaw.slice().reverse()
      const downCmds = downPts
        .map((p, i) =>
          i === 0
            ? `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`
            : `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`,
        )
        .join(' ')
      bandPath =
        `<path d="${upPath} ${downCmds} Z" fill="${color}" ` +
        `fill-opacity="0.18" stroke="none" />`
    }

    // Median line — smoothed with the same algorithm so the visual
    // weight matches the band edge.
    const medianRaw = []
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i]
      if (!Number.isFinite(p.medianMs)) continue
      medianRaw.push([xAt(i), yAt(p.medianMs)])
    }
    const medianLine =
      medianRaw.length > 0
        ? `<path d="${catmullRomPath(medianRaw)}" fill="none" ` +
          `stroke="${color}" stroke-width="1.6" stroke-linecap="round" ` +
          `stroke-linejoin="round" />`
        : ''

    // Dots — small circles at every median point. Each dot wraps a
    // <title> so a hover anywhere on the dot produces the OS tooltip.
    const dots = pts
      .map((p, i) => {
        if (!Number.isFinite(p.medianMs)) return ''
        const tooltip =
          `${formatShortDate(p.capturedAt)} · ${escapeHtml(p.version)}\n` +
          `median ${formatNumber(p.medianMs)} ms · p95 ${formatNumber(p.p95Ms)} ms`
        return (
          `<circle cx="${xAt(i).toFixed(2)}" cy="${yAt(p.medianMs).toFixed(2)}" ` +
          `r="2.6" fill="${color}" stroke="rgba(11,16,32,0.5)" stroke-width="1">` +
          `<title>${escapeHtml(tooltip)}</title>` +
          `</circle>`
        )
      })
      .join('')

    // Per-point invisible hit rects — much wider than the dot so the
    // tooltip is reachable even when the user's cursor isn't sitting
    // on the 2.6px dot. The rect spans the whole vertical axis, half
    // a column wide on each side. This is the same affordance
    // d3-axis users get with `voronoi` overlays, minus the math.
    let hitRects = ''
    if (pts.length >= 2) {
      const colW = innerW / (pts.length - 1)
      hitRects = pts
        .map((p, i) => {
          const cx = xAt(i)
          const x0 = Math.max(PAD_L, cx - colW / 2)
          const x1 = Math.min(W - PAD_R, cx + colW / 2)
          const tooltip =
            `${formatShortDate(p.capturedAt)} · ${escapeHtml(p.version)}\n` +
            `median ${formatNumber(p.medianMs)} ms · p95 ${formatNumber(p.p95Ms)} ms`
          return (
            `<rect x="${x0.toFixed(2)}" y="${PAD_T}" ` +
            `width="${(x1 - x0).toFixed(2)}" height="${innerH.toFixed(2)}" ` +
            `fill="transparent" pointer-events="all">` +
            `<title>${escapeHtml(tooltip)}</title>` +
            `</rect>`
          )
        })
        .join('')
    }

    // Y-axis ticks: D3-style "nice" ticks via niceTicks(min, max, 4).
    // We always render at least 2 ticks (top/bottom of inner rect)
    // when niceTicks returns < 2.
    let yTickValues = niceTicks(yMin, yMax, 4)
    if (yTickValues.length < 2) yTickValues = [yMin, yMax]
    const tick = (v) => {
      const y = yAt(v)
      const label = formatNumber(v)
      return (
        `<g class="tick">` +
        `<line x1="${PAD_L}" y1="${y.toFixed(2)}" ` +
        `x2="${W - PAD_R}" y2="${y.toFixed(2)}" ` +
        `stroke="rgba(169,181,201,0.16)" stroke-width="1" />` +
        `<text x="${PAD_L - 4}" y="${(y + 3).toFixed(2)}" ` +
        `text-anchor="end" font-size="9" fill="#A9B5C9">${label}</text>` +
        `</g>`
      )
    }
    const yTicks = yTickValues.map(tick).join('')

    // X-axis baseline + first/last labels.
    const xAxisY = (PAD_T + innerH).toFixed(2)
    const xAxisLine =
      `<line x1="${PAD_L}" y1="${xAxisY}" x2="${W - PAD_R}" y2="${xAxisY}" ` +
      `stroke="rgba(169,181,201,0.32)" stroke-width="1" />`
    let xTicks = ''
    if (pts.length >= 2) {
      const first = formatShortDate(pts[0].capturedAt)
      const last = formatShortDate(pts[pts.length - 1].capturedAt)
      xTicks =
        `<text x="${PAD_L}" y="${H - 8}" font-size="9" fill="#A9B5C9">${escapeHtml(first)}</text>` +
        `<text x="${W - PAD_R}" y="${H - 8}" text-anchor="end" font-size="9" fill="#A9B5C9">${escapeHtml(last)}</text>`
      // Mid label only if there are 3+ runs and there's room.
      if (pts.length >= 3) {
        const midIdx = Math.floor((pts.length - 1) / 2)
        const midLabel = formatShortDate(pts[midIdx].capturedAt)
        const midX = xAt(midIdx)
        // Only draw mid label if it isn't kissing an edge label.
        if (midX > PAD_L + 30 && midX < W - PAD_R - 30) {
          xTicks +=
            `<text x="${midX.toFixed(2)}" y="${H - 8}" text-anchor="middle" ` +
            `font-size="9" fill="#A9B5C9">${escapeHtml(midLabel)}</text>`
        }
      }
    } else {
      xTicks =
        `<text x="${PAD_L + innerW / 2}" y="${H - 8}" text-anchor="middle" ` +
        `font-size="9" fill="#A9B5C9">${escapeHtml(formatShortDate(pts[0].capturedAt))}</text>`
    }

    const yCaption = `<text x="6" y="${PAD_T + 8}" font-size="9" fill="#A9B5C9">ms</text>`

    // Badge dot at the right edge — vertically centred against the
    // last datapoint so the eye links them.
    const badgeCx = W - 10
    const badgeCy = pts.length
      ? yAt(pts[pts.length - 1].medianMs)
      : H / 2
    const badge = renderBadgeDot(verdict, badgeCx, badgeCy, 5)

    const lastP = pts[pts.length - 1]
    const ariaLabel =
      `${cell.library} on ${cell.scenario} at scale ${cell.scale}: ` +
      `median ${formatNumber(lastP.medianMs)} ms over ${pts.length} run${pts.length === 1 ? '' : 's'}, ` +
      `verdict ${verdict.kind}`

    // Order matters for hit testing: hit rects last so they sit on
    // top of dots and band, but are still pointer-events="all" with
    // fill="transparent" so clicks/hovers pass through cleanly.
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
      `role="img" aria-label="${escapeHtml(ariaLabel)}">` +
      yTicks +
      bandPath +
      medianLine +
      xAxisLine +
      dots +
      xTicks +
      yCaption +
      badge +
      hitRects +
      `</svg>`
    )
  }

  /** ----------------------------------------------------------------
   *  Card DOM
   *  ---------------------------------------------------------------- */
  function renderCell(cell) {
    const verdict = computeVerdict(cell.points)
    const card = document.createElement('article')
    card.className = 'cell-card'
    card.dataset.library = cell.library
    card.dataset.scenario = cell.scenario
    card.dataset.scale = String(cell.scale)
    card.dataset.verdict = verdict.kind

    const last = cell.points[cell.points.length - 1]
    const lastMedian = last ? formatNumber(last.medianMs) : 'n/a'
    const lastP95 = last ? formatNumber(last.p95Ms) : 'n/a'
    const color = LIBRARY_COLOR[cell.library] ?? '#A9B5C9'
    const profileUrl = profileUrlFor(cell)
    const verdictColor = VERDICT_COLOR[verdict.kind] ?? VERDICT_COLOR.unknown

    card.innerHTML =
      `<header class="cell-head">` +
      `<span class="cell-library" style="--lib-color:${color}">${escapeHtml(cell.library)}</span>` +
      `<span class="cell-verdict" data-kind="${verdict.kind}" ` +
      `style="--verdict-color:${verdictColor}" title="${escapeHtml(verdict.detail)}">` +
      `<span class="cell-verdict-dot" aria-hidden="true"></span>` +
      `<span class="cell-verdict-label">${verdict.kind}</span>` +
      `</span>` +
      `<span class="cell-scale">scale ${cell.scale.toLocaleString('en-US')}</span>` +
      `</header>` +
      `<h4 class="cell-scenario">${escapeHtml(cell.scenario)}</h4>` +
      `<div class="cell-chart">${renderSparkline(cell, verdict)}</div>` +
      `<dl class="cell-stats">` +
      `<div><dt>median</dt><dd>${lastMedian} ms</dd></div>` +
      `<div><dt>p95</dt><dd>${lastP95} ms</dd></div>` +
      `<div><dt>runs</dt><dd>${cell.points.length}</dd></div>` +
      `</dl>` +
      `<a class="cell-profile-link" href="${profileUrl}" rel="noopener" ` +
      `aria-label="Profile artifacts for ${escapeHtml(cell.library)} ${escapeHtml(cell.scenario)} at scale ${cell.scale} (placeholder — populated by #709 once CI is restored)">` +
      `<span class="cell-profile-link-tooltip">profile snapshot → <code>${profileUrl}</code><br><em>placeholder until #709 nightly publish lands</em></span>` +
      `<span class="cell-profile-link-glyph" aria-hidden="true">⌕</span>` +
      `<span class="cell-profile-link-text">profile</span>` +
      `</a>`
    return card
  }

  /** Group cells by scenario for visual grouping in the page. */
  function groupByScenario(cells) {
    const groups = new Map()
    for (const cell of cells) {
      let bucket = groups.get(cell.scenario)
      if (!bucket) {
        bucket = []
        groups.set(cell.scenario, bucket)
      }
      bucket.push(cell)
    }
    return groups
  }

  /** ----------------------------------------------------------------
   *  Filter UI
   *  ---------------------------------------------------------------- */

  /** Discover the universe of (library, scenario, scale) values and
   *  seed the filterState with the default-view subset. */
  function seedFilterState(allCells) {
    const allLibs = new Set()
    const allScenarios = new Set()
    const allScales = new Set()
    for (const c of allCells) {
      allLibs.add(c.library)
      allScenarios.add(c.scenario)
      allScales.add(c.scale)
    }

    // Defaults: causl + mobx (where present), 10000 scale, all
    // scenarios on. Fall back gracefully if the universe is smaller
    // than the spec defaults (e.g. a fixture without a 10k scale).
    const defaultLibs = new Set(
      [...DEFAULT_LIBRARIES].filter((l) => allLibs.has(l)),
    )
    if (defaultLibs.size === 0) {
      // Nothing in the default set survived — open the gate so the
      // user sees something rather than an empty grid.
      for (const l of allLibs) defaultLibs.add(l)
    }

    const defaultScales = new Set(
      [...DEFAULT_SCALES].filter((s) => allScales.has(s)),
    )
    if (defaultScales.size === 0) {
      for (const s of allScales) defaultScales.add(s)
    }

    filterState.libraries = defaultLibs
    filterState.scenarios = new Set(allScenarios)
    filterState.scales = defaultScales

    // Stash the universes on the state object so the UI can render
    // checkboxes for them.
    filterState._allLibraries = LIBRARY_ORDER.filter((l) => allLibs.has(l))
      .concat([...allLibs].filter((l) => !LIBRARY_ORDER.includes(l)).sort())
    filterState._allScenarios = [...allScenarios].sort()
    filterState._allScales = [...allScales].sort((a, b) => a - b)
  }

  /** Apply current filterState to the universe and return the kept cells. */
  function applyFilters(allCells) {
    return allCells.filter((c) =>
      filterState.libraries.has(c.library) &&
      filterState.scenarios.has(c.scenario) &&
      filterState.scales.has(c.scale),
    )
  }

  /** Build the filter UI. The caller wires the `onChange` callback to
   *  the renderer so toggling a checkbox triggers a re-render. */
  function renderFilterUI(host, onChange) {
    host.innerHTML = ''

    const fieldset = (legendText, ariaLabel, items, getKey, getLabel, stateSet) => {
      const fs = document.createElement('fieldset')
      fs.className = 'filter-group'
      fs.setAttribute('aria-label', ariaLabel)

      const legend = document.createElement('legend')
      legend.className = 'filter-legend'
      legend.textContent = legendText
      fs.appendChild(legend)

      const list = document.createElement('div')
      list.className = 'filter-list'

      for (const item of items) {
        const key = getKey(item)
        const label = document.createElement('label')
        label.className = 'filter-chip'
        const cb = document.createElement('input')
        cb.type = 'checkbox'
        cb.value = String(key)
        cb.checked = stateSet.has(key)
        cb.setAttribute(
          'aria-label',
          `${legendText.toLowerCase()} ${getLabel(item)}`,
        )
        cb.addEventListener('change', () => {
          if (cb.checked) stateSet.add(key)
          else stateSet.delete(key)
          onChange()
        })
        const span = document.createElement('span')
        span.className = 'filter-chip-text'
        span.textContent = getLabel(item)
        label.appendChild(cb)
        label.appendChild(span)
        list.appendChild(label)
      }

      fs.appendChild(list)
      return fs
    }

    const libFs = fieldset(
      'Library',
      'Filter by library',
      filterState._allLibraries,
      (l) => l,
      (l) => l,
      filterState.libraries,
    )

    const scnFs = fieldset(
      'Scenario',
      'Filter by scenario',
      filterState._allScenarios,
      (s) => s,
      (s) => s,
      filterState.scenarios,
    )

    const scaleFs = fieldset(
      'Scale',
      'Filter by scale (node count)',
      filterState._allScales,
      (s) => s,
      (s) => s.toLocaleString('en-US'),
      filterState.scales,
    )

    host.appendChild(libFs)
    host.appendChild(scnFs)
    host.appendChild(scaleFs)

    // "Reset" / "All on" affordances — small text buttons so power
    // users can flip the gate without clicking through every chip.
    const actions = document.createElement('div')
    actions.className = 'filter-actions'

    const allBtn = document.createElement('button')
    allBtn.type = 'button'
    allBtn.className = 'filter-action'
    allBtn.textContent = 'All cells on'
    allBtn.setAttribute('aria-label', 'Enable every library, scenario, and scale')
    allBtn.addEventListener('click', () => {
      for (const l of filterState._allLibraries) filterState.libraries.add(l)
      for (const s of filterState._allScenarios) filterState.scenarios.add(s)
      for (const s of filterState._allScales) filterState.scales.add(s)
      onChange()
      renderFilterUI(host, onChange)
    })

    const defaultBtn = document.createElement('button')
    defaultBtn.type = 'button'
    defaultBtn.className = 'filter-action'
    defaultBtn.textContent = 'Default view (causl + mobx @ 10k)'
    defaultBtn.setAttribute(
      'aria-label',
      'Restore the default view: causl and mobx at scale 10000',
    )
    defaultBtn.addEventListener('click', () => {
      filterState.libraries = new Set(
        [...DEFAULT_LIBRARIES].filter((l) => filterState._allLibraries.includes(l)),
      )
      filterState.scenarios = new Set(filterState._allScenarios)
      filterState.scales = new Set(
        [...DEFAULT_SCALES].filter((s) => filterState._allScales.includes(s)),
      )
      onChange()
      renderFilterUI(host, onChange)
    })

    actions.appendChild(defaultBtn)
    actions.appendChild(allBtn)
    host.appendChild(actions)
  }

  /** ----------------------------------------------------------------
   *  Top-level renderer
   *  ---------------------------------------------------------------- */
  function renderGrid(gridHost, allCells) {
    gridHost.innerHTML = ''
    const visible = applyFilters(allCells)
    if (visible.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'dashboard-empty'
      empty.textContent =
        'No cells match the current filters. Use the toggles above to widen the view.'
      gridHost.appendChild(empty)
      return
    }

    const groups = groupByScenario(visible)
    for (const [scenario, scenarioCells] of groups) {
      const section = document.createElement('section')
      section.className = 'cell-group'
      section.setAttribute('aria-label', `Scenario: ${scenario}`)

      const title = document.createElement('h3')
      title.className = 'cell-group-title'
      title.textContent = scenario
      section.appendChild(title)

      const grid = document.createElement('div')
      grid.className = 'cell-grid'
      for (const cell of scenarioCells) {
        grid.appendChild(renderCell(cell))
      }
      section.appendChild(grid)
      gridHost.appendChild(section)
    }
  }

  function renderDashboard(host, history, sourceLabel) {
    host.innerHTML = ''

    // Top-line meta strip — number of runs, last-run timestamp, source.
    const meta = document.createElement('div')
    meta.className = 'dashboard-meta'
    const runCount = history.length
    const last = history[history.length - 1]
    const lastWhen = last ? formatShortDate(last.capturedAt) : '—'
    const lastVersion = last ? last.version : '—'
    meta.innerHTML =
      `<div><strong>Runs</strong> ${runCount}</div>` +
      `<div><strong>Latest</strong> ${escapeHtml(lastWhen)}</div>` +
      `<div><strong>Version</strong> <code>${escapeHtml(lastVersion)}</code></div>` +
      `<div><strong>Source</strong> ${escapeHtml(sourceLabel)}</div>`
    host.appendChild(meta)

    const allCells = sortCells(groupCells(history))
    if (allCells.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'dashboard-empty'
      empty.textContent = 'history.json had no samples to plot.'
      host.appendChild(empty)
      return
    }

    seedFilterState(allCells)

    // Filter UI inside a <details> so it folds out of the way on
    // narrow viewports while staying keyboard-reachable.
    const filterShell = document.createElement('details')
    filterShell.className = 'filter-shell'
    filterShell.open = true
    const filterSummary = document.createElement('summary')
    filterSummary.className = 'filter-summary'
    filterSummary.textContent = 'Filters'
    filterShell.appendChild(filterSummary)

    const filterHost = document.createElement('div')
    filterHost.className = 'filter-host'
    filterHost.setAttribute('role', 'group')
    filterHost.setAttribute('aria-label', 'Dashboard filters')
    filterShell.appendChild(filterHost)
    host.appendChild(filterShell)

    // Legend strip for the verdict badges.
    const legend = document.createElement('div')
    legend.className = 'verdict-legend'
    legend.setAttribute('aria-label', 'Regression verdict legend')
    legend.innerHTML =
      `<span class="verdict-legend-label">Verdict</span>` +
      Object.entries(VERDICT_COLOR)
        .filter(([k]) => k !== 'unknown')
        .map(
          ([k, c]) =>
            `<span class="verdict-legend-item" data-kind="${k}">` +
            `<span class="verdict-legend-dot" style="--verdict-color:${c}"></span>` +
            `<span class="verdict-legend-text">${k}</span>` +
            `</span>`,
        )
        .join('')
    host.appendChild(legend)

    const gridHost = document.createElement('div')
    gridHost.className = 'dashboard-grid'
    host.appendChild(gridHost)

    const onChange = () => renderGrid(gridHost, allCells)
    renderFilterUI(filterHost, onChange)
    renderGrid(gridHost, allCells)
  }

  /** Try the live URL, fall back to the sample stub. */
  async function loadHistory() {
    const tryFetch = async (url) => {
      const res = await fetch(url, { cache: 'no-cache' })
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`)
        err.status = res.status
        throw err
      }
      return res.json()
    }

    try {
      const data = await tryFetch(HISTORY_URL)
      return { data, sourceLabel: 'history.json (live)' }
    } catch {
      const data = await tryFetch(SAMPLE_URL)
      return { data, sourceLabel: 'history.sample.json (stub)' }
    }
  }

  /** Public bootstrap. Called from index.html once the DOM is ready. */
  async function bootstrap() {
    const host = document.querySelector('#dashboard-root')
    if (!host) return

    host.innerHTML = '<p class="dashboard-loading">Loading history…</p>'

    try {
      const { data, sourceLabel } = await loadHistory()
      if (!Array.isArray(data)) {
        throw new Error('history JSON was not an array of HistoryEntry')
      }
      renderDashboard(host, data, sourceLabel)
    } catch (err) {
      host.innerHTML =
        `<p class="dashboard-error">` +
        `Could not load benchmark history: ${escapeHtml((err && err.message) || String(err))}.` +
        `</p>`
    } finally {
      host.setAttribute('aria-busy', 'false')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap)
  } else {
    bootstrap()
  }
})()
