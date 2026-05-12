/* causl.org shared header — used on every page.
 *
 * Single-source-of-truth topbar injection (#1260).
 * --------------------------------------------------------------------
 * Every page renders a minimal placeholder:
 *
 *   <div id="topbar-host"
 *        data-current="documentation"
 *        data-depth="1"
 *        data-hero="false">
 *     <!-- progressive-enhancement fallback links live here for
 *          crawlers / no-JS users. JS replaces the host with the
 *          canonical <header id="topbar"> element below. -->
 *   </div>
 *
 * renderTopbar() replaces that host with the full topbar HTML so the
 * nav is canonical: one template, 41+ pages. No hand-edited copies to
 * drift. See issue #1260 for the rationale.
 *
 * Three runtime responsibilities (unchanged from the pre-#1260 file):
 *   1. Scroll-collapse animation on the home page (.topbar.is-hero).
 *      Drives --p1 / --p2 / --p3 and toggles .collapsed when fully shrunk.
 *      Inner pages don't ship .is-hero, so this becomes a no-op for them.
 *   2. Burger drawer toggle (.menu-open on the header).
 *   3. Light/dark theme toggle (lives inside the drawer).
 *
 * Ported verbatim from libviprs-org/topbar.js. The scroll handler shape,
 * stage thresholds (0→0.02, 0.02→0.04, 0.04→0.06) and CSS variable names
 * (--p1/--p2/--p3) are kept literally — the bug fixed in #1248 and
 * #1259 regressed because the local refactor diverged from the canonical
 * libviprs source. Diagnostics flag added per #1277.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Topbar template
  //
  // Every URL is root-relative ("/pages/...") — the site lives at the
  // domain root (causl.org) and uses pretty trailing-slash URLs. The
  // brand image is also root-relative so the topbar HTML is identical
  // regardless of which page injects it.
  // ---------------------------------------------------------------------------

  /** Canonical nav links: [href, label, currentKey]. */
  var NAV_LINKS = [
    ['/',                                       'Home',            'home'],
    ['/pages/documentation/',                   'Documentation',   'documentation'],
    ['/pages/documentation/getting-started/',   'Getting Started', 'getting-started'],
    ['/pages/documentation/tutorial/',          'Tutorial',        'tutorial'],
    ['/pages/documentation/usage/',             'Usage Guide',     'usage'],
    ['/pages/documentation/api/',               'API',             'api'],
    ['/pages/documentation/faq/',               'FAQ',             'faq'],
    ['/pages/documentation/best-practices/',    'Best Practices',  'best-practices'],
    ['/pages/benchmarks/',                      'Benchmarks',      'benchmarks'],
    ['/pages/playground/',                      'Playground',      'playground'],
    ['/pages/spreadsheet/',                     'Spreadsheet',     'spreadsheet'],
    ['https://github.com/iasbuilt/causl',       'GitHub',          'github']
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildNavLinksHtml(current) {
    var out = '';
    for (var i = 0; i < NAV_LINKS.length; i++) {
      var href = NAV_LINKS[i][0];
      var label = NAV_LINKS[i][1];
      var key = NAV_LINKS[i][2];
      var isCurrent = current && current === key;
      var attrs = ' href="' + escapeHtml(href) + '"';
      if (isCurrent) attrs += ' class="is-current" aria-current="page"';
      if (/^https?:/.test(href)) attrs += ' rel="noopener"';
      out += '        <a' + attrs + '>' + escapeHtml(label) + '</a>\n';
    }
    return out;
  }

  function buildTopbarHtml(opts) {
    var isHero = !!opts.hero;
    var current = opts.current || '';
    var heroClass = isHero ? ' is-hero' : '';
    return ''
      + '<header id="topbar" class="topbar' + heroClass + '">\n'
      + '  <div class="topbar-content">\n'
      + '    <a href="/" class="topbar-brand" aria-label="Causl home">\n'
      + '      <img class="topbar-brand-img" src="/img/causl-mark.svg" alt="" aria-hidden="true" width="80" height="80">\n'
      + '      <span class="brand-name">caus<span class="accent">l</span></span>\n'
      + '    </a>\n'
      + '    <div class="pronunciation"><span lang="en-fonipa">/ˈkɔː.zəl/</span> — like “causal”</div>\n'
      + '    <p class="tagline">Transactional state for tangled dependency graphs.</p>\n'
      + '  </div>\n'
      + '\n'
      + '  <button id="topbarBurger" class="topbar-burger"\n'
      + '          aria-label="Open navigation menu" aria-expanded="false"\n'
      + '          aria-controls="topbar-menu">\n'
      + '    <span class="burger-icon"></span>\n'
      + '  </button>\n'
      + '\n'
      + '  <nav id="topbar-menu" class="topbar-menu" aria-hidden="true"\n'
      + '       aria-label="Site navigation">\n'
      + '    <div class="topbar-menu-inner">\n'
      + buildNavLinksHtml(current)
      + '      <hr class="menu-divider" />\n'
      + '      <button id="themeToggle" type="button"\n'
      + '              class="topbar-theme-toggle" role="switch" aria-checked="false">\n'
      + '        <span class="theme-glyph">☾</span>\n'
      + '        <span class="theme-label">Dark</span>\n'
      + '      </button>\n'
      + '    </div>\n'
      + '  </nav>\n'
      + '</header>\n';
  }

  /**
   * Replace `host` (a <div id="topbar-host">) with the canonical topbar.
   * Reads `data-current` (nav key), `data-hero` (truthy → is-hero variant).
   * Safe no-op when host is null.
   */
  function renderTopbar(host) {
    if (!host) return;
    var current = host.getAttribute('data-current') || '';
    var hero = (host.getAttribute('data-hero') || '').toLowerCase() === 'true';
    var html = buildTopbarHtml({ current: current, hero: hero });
    // Use a transient wrapper so we can lift a real <header> element out.
    var tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    var header = tpl.content.firstElementChild;
    if (header && host.parentNode) {
      host.parentNode.replaceChild(header, host);
    }
  }

  // Exposed so footer.js and tests can call it directly.
  window.renderTopbar = renderTopbar;

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
  //
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
  //
  // Order matters: render the placeholder → real header *first*, then init
  // theme/drawer/hero-collapse so those handlers find their target elements.
  // ---------------------------------------------------------------------------

  function start() {
    renderTopbar(document.getElementById('topbar-host'));
    if (typeof window.renderFooter === 'function') {
      window.renderFooter(document.getElementById('footer-host'));
    }
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
