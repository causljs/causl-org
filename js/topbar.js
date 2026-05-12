/* causl.org shared header — used on every page.
 *
 * Three responsibilities:
 *   1. Scroll-collapse animation on the home page (.topbar.is-hero).
 *      Drives --p1 / --p2 / --p3 and toggles .collapsed when fully shrunk.
 *      Inner pages don't ship .is-hero, so this becomes a no-op for them.
 *   2. Burger drawer toggle (.menu-open on the header).
 *   3. Light/dark theme toggle (now lives inside the drawer).
 *
 * Ported verbatim from libviprs-org/topbar.js. The scroll handler
 * shape, stage thresholds (0→0.02, 0.02→0.04, 0.04→0.06) and CSS
 * variable names (--p1/--p2/--p3) are kept literally — the bug fixed
 * in #1248 and #1259 regressed because the local refactor diverged
 * from the canonical libviprs source. This file is now identical to
 * libviprs-org/topbar.js except for the localStorage key, which is
 * scoped to "causl-theme" so the two sites don't fight over the
 * setting on browsers that share storage across subdomains.
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
  // logs every scroll/resize event + threshold crossings + ResizeObserver
  // entries to the console. Verbose by design: the user runs the site,
  // captures the trace, and pastes back for analysis. Set to false (here
  // or via `window.__TOPBAR_DEBUG__ = false`) after diagnosis to silence.
  // Behavior is otherwise unchanged from the canonical libviprs-org port.
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
      log('[topbar:diag] init skipped — no is-hero', { hasBar: !!bar, classes: bar && bar.className });
      return;
    }
    log('[topbar:diag] init', { vh: window.innerHeight, scrollY: window.scrollY, classList: bar.className });

    var lastY = window.scrollY;
    var lastCollapsed = bar.classList.contains('collapsed');

    function clamp01(x) { return Math.max(0, Math.min(1, x)); }
    function stage(start, end) {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var y = window.scrollY || document.documentElement.scrollTop;
      return clamp01((y - vh * start) / (vh * (end - start)));
    }

    function update() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var y = window.scrollY || document.documentElement.scrollTop;
      var direction = y > lastY ? 'down' : (y < lastY ? 'up' : 'stable');
      var p1 = stage(0, 0.02);
      var p2 = stage(0.02, 0.04);
      var p3 = stage(0.04, 0.06);
      bar.style.setProperty('--p1', p1);
      bar.style.setProperty('--p2', p2);
      bar.style.setProperty('--p3', p3);
      var willCollapse = p3 >= 1;
      if (willCollapse !== lastCollapsed) {
        log('[topbar:diag] threshold-cross', {
          from: lastCollapsed ? 'collapsed' : 'hero',
          to: willCollapse ? 'collapsed' : 'hero',
          y: y,
          p3: p3,
          direction: direction,
        });
      }
      bar.classList.toggle('collapsed', willCollapse);
      lastCollapsed = willCollapse;
      log('[topbar:diag] scroll', {
        y: y,
        dy: y - lastY,
        dir: direction,
        p1: p1.toFixed(3),
        p2: p2.toFixed(3),
        p3: p3.toFixed(3),
        collapsed: willCollapse,
      });
      lastY = y;
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', function () {
      log('[topbar:diag] resize', { newVh: window.innerHeight });
      update();
    });

    // Also watch the bar's actual height — if it isn't growing on scroll-up,
    // this surfaces it (browser layout vs. our CSS-variable contract).
    if (typeof ResizeObserver !== 'undefined') {
      var resizeObs = new ResizeObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          log('[topbar:diag] bar resized', { height: e.contentRect.height, classes: bar.className });
        }
      });
      resizeObs.observe(bar);
    }

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
