/* causl.org shared topbar.
 *
 * Three responsibilities, one IIFE:
 *
 *   1. Theme toggle — persists choice to localStorage; falls back
 *      to prefers-color-scheme until the user clicks. Changes
 *      data-theme on <html>, plus glyph + label text on the chip.
 *
 *   2. Burger drawer — toggles .menu-open on the bar; closes on
 *      link tap, outside click, or Escape; updates ARIA.
 *
 *   3. Hero scroll-collapse — only on the homepage (.topbar.is-hero).
 *      Drives --c1, --c2, --c3 from scrollY, then flips .collapsed
 *      once --c3 reaches 1 so the bar pins to the viewport top.
 *
 * Inner pages render the bar in its collapsed shape via CSS
 * defaults; the script becomes a no-op for #3 and only wires up
 * theme + drawer.
 */
(function () {
  'use strict';

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function safeLocalStorage(op, key, value) {
    try {
      if (op === 'get') return window.localStorage.getItem(key);
      if (op === 'set') window.localStorage.setItem(key, value);
    } catch (_) { /* private mode / disabled storage */ }
    return null;
  }

  // -- theme ---------------------------------------------------------

  function initTheme() {
    var btn = document.getElementById('themeToggle');
    var glyph = btn && btn.querySelector('.theme-glyph');
    var label = btn && btn.querySelector('.theme-label');

    function paint(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (glyph) glyph.textContent = theme === 'dark' ? '☀' : '☾';
      if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
      if (btn) btn.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
      safeLocalStorage('set', 'causl-theme', theme);
    }

    var saved = safeLocalStorage('get', 'causl-theme');
    if (saved === 'light' || saved === 'dark') {
      paint(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      paint('light');
    } else {
      paint('dark');
    }

    if (btn) {
      btn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        paint(current === 'dark' ? 'light' : 'dark');
      });
    }

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var followSystem = function (e) {
        var pinned = safeLocalStorage('get', 'causl-theme');
        if (!pinned) paint(e.matches ? 'dark' : 'light');
      };
      if (mq.addEventListener) mq.addEventListener('change', followSystem);
      else if (mq.addListener) mq.addListener(followSystem);
    }
  }

  // -- drawer --------------------------------------------------------

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

    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });

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

  // -- hero collapse -------------------------------------------------

  function initHeroCollapse() {
    var bar = document.getElementById('topbar');
    if (!bar || !bar.classList.contains('is-hero')) return;

    function stage(start, end, vh, y) {
      return clamp01((y - vh * start) / (vh * (end - start)));
    }

    function tick() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var y = window.scrollY || document.documentElement.scrollTop;
      bar.style.setProperty('--c1', stage(0.00, 0.025, vh, y));
      bar.style.setProperty('--c2', stage(0.025, 0.05, vh, y));
      var c3 = stage(0.05, 0.075, vh, y);
      bar.style.setProperty('--c3', c3);
      bar.classList.toggle('collapsed', c3 >= 1);
    }

    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    tick();
  }

  // -- bootstrap -----------------------------------------------------

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
