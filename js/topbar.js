/* causl.org shared header — used on every page.
 *
 * Three responsibilities:
 *   1. Scroll-collapse animation on the home page (.topbar.is-hero).
 *      Drives --p1 / --p2 / --p3 with a step-quantized scrollY → p
 *      mapping. There is no class flip and no layout-affecting toggle:
 *      the bar stays `position: sticky` at every scroll position and
 *      only the CSS custom properties change. Inner pages don't ship
 *      .is-hero, so this becomes a no-op for them (their --p* values
 *      stay pinned to 1, the collapsed shape, via base CSS).
 *   2. Burger drawer toggle (.menu-open on the header).
 *   3. Light/dark theme toggle (now lives inside the drawer).
 *
 * Closes #1289 — the previous design toggled a `.collapsed` class on
 * a continuous scrollY threshold, which combined with the
 * `body:has(.topbar.collapsed) { padding-top }` reservation rule to
 * produce a content-shift flicker loop near the threshold (captured
 * in the #1277 diagnostic trace: scroll-up through y≈25 removes
 * .collapsed → padding-top reservation vanishes → content shifts
 * down ~45px → next scroll reports dy:+22.5 → .collapsed re-added →
 * loop). The fix removes the discrete class flip and the
 * padding-top compensation entirely.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Theme toggle
  // ---------------------------------------------------------------------------

  function initTheme() {
    var btn = document.getElementById('themeToggle');
    var glyph = btn && btn.querySelector('.theme-glyph');
    var label = btn && btn.querySelector('.theme-label');

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (glyph) glyph.textContent = theme === 'dark' ? '☀' : '☾';
      if (label) label.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
      if (btn) btn.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
      try { localStorage.setItem('causl-theme', theme); } catch (_) { /* private mode */ }
    }

    var saved = null;
    try { saved = localStorage.getItem('causl-theme'); } catch (_) { /* ignore */ }

    if (saved === 'light' || saved === 'dark') {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }

    if (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
      });
    }

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var listener = function (e) {
        var pinned = null;
        try { pinned = localStorage.getItem('causl-theme'); } catch (_) { /* ignore */ }
        if (!pinned) applyTheme(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', listener);
      else if (mq.addListener) mq.addListener(listener);  // Safari < 14
    }
  }

  // ---------------------------------------------------------------------------
  // Burger drawer
  // ---------------------------------------------------------------------------

  function initDrawer() {
    var bar = document.getElementById('topbar');
    var burger = document.getElementById('topbarBurger');
    var menu = document.getElementById('topbar-menu');
    if (!bar || !burger || !menu) return;

    function setOpen(open) {
      bar.classList.toggle('menu-open', !!open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    burger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!bar.classList.contains('menu-open'));
    });

    // Tap a link → close so the navigation feels snappy.
    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });

    // Click anywhere outside the drawer or burger closes it.
    document.addEventListener('click', function (e) {
      if (!bar.classList.contains('menu-open')) return;
      if (bar.contains(e.target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar.classList.contains('menu-open')) {
        setOpen(false);
        burger.focus();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Scroll-collapse animation (home page only)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Diagnostics flag for #1277 — when true, the hero-collapse update path
  // logs every scroll/resize event to the console. Verbose by design: the
  // user runs the site, captures the trace, and pastes back for analysis.
  // Set to false (here or via `window.__TOPBAR_DEBUG__ = false`) after
  // diagnosis to silence. Kept in place after #1289 so the fix can be
  // verified against the same instrumentation that produced the original
  // capture.
  // ---------------------------------------------------------------------------
  var DEBUG = true;
  function log() {
    var enabled = (typeof window !== 'undefined' && window.__TOPBAR_DEBUG__ !== undefined)
      ? !!window.__TOPBAR_DEBUG__
      : DEBUG;
    if (!enabled) return;
    try { console.log.apply(console, arguments); } catch (_) { /* ignore */ }
  }

  function initHeroCollapse() {
    var bar = document.getElementById('topbar');
    if (!bar || !bar.classList.contains('is-hero')) {
      log('[topbar:diag] init skipped — no is-hero');
      return;
    }
    // Respect reduced motion: snap fully expanded, no scroll handler.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      bar.style.setProperty('--p1', '0');
      bar.style.setProperty('--p2', '0');
      bar.style.setProperty('--p3', '0');
      return;
    }

    var STEPS = 4;  // 5 discrete heights: p ∈ {0, 0.25, 0.5, 0.75, 1.0}
    var lastY = 0;
    var lastP = -1;  // forces first frame to apply

    function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    function update() {
      var vh = window.innerHeight || document.documentElement.clientHeight || 600;
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var collapseDistance = Math.min(vh * 0.30, 240);  // collapse over first 30% of vh, max 240px
      var pRaw = clamp01(y / collapseDistance);
      var pStep = Math.round(pRaw * STEPS) / STEPS;

      // Only write if changed — avoids style recalc on every scroll.
      if (pStep !== lastP) {
        bar.style.setProperty('--p1', String(pStep));
        bar.style.setProperty('--p2', String(pStep));
        bar.style.setProperty('--p3', String(pStep));
        lastP = pStep;
      }

      // Diagnostics retained for verification (#1277 → #1289).
      log('[topbar:diag] scroll', {
        y: y,
        dy: y - lastY,
        dir: y > lastY ? 'down' : (y < lastY ? 'up' : 'stable'),
        pRaw: pRaw.toFixed(3),
        pStep: pStep.toFixed(3),
      });
      lastY = y;
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', function () {
      log('[topbar:diag] resize', { newVh: window.innerHeight });
      update();
    });
    update();
  }

  // ---------------------------------------------------------------------------
  // Init — run *now* if DOM is already parsed; otherwise wait for it. Don't
  // gate on DOMContentLoaded alone, because <script defer> runs after parse
  // but before DCL fires, and we want the burger to work the moment the
  // user can see it.
  // ---------------------------------------------------------------------------

  function start() {
    initTheme();
    initDrawer();
    initHeroCollapse();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
