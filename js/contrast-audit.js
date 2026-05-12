/* ============================================================================
 * causl-org contrast audit (#1276)
 *
 * A dev-only tool: walks all visible text nodes in the document, computes
 * effective foreground color + nearest non-transparent ancestor background,
 * then checks the WCAG 2.x contrast ratio between them. Fails are logged
 * via console.warn so the user can scan & locate problem nodes via DevTools.
 *
 * Opt-in: nothing runs unless you set window.__CAUSL_CONTRAST_AUDIT__ = true
 * BEFORE this script loads (or call window.__causlContrastAudit() afterward).
 *
 * Typical usage:
 *   1. Open the page in a browser.
 *   2. In DevTools console:
 *        window.__CAUSL_CONTRAST_AUDIT__ = true; location.reload();
 *      or, without reloading:
 *        window.__causlContrastAudit();
 *   3. Toggle dark/light theme and re-run.
 *
 * Limitations:
 *   - Does not understand background-images / gradients (treats them as opaque
 *     when the layer also has a base background-color; otherwise warns once).
 *   - Walks up the DOM to find a non-transparent ancestor bg, alpha-composing
 *     against white as a worst-case fallback if no opaque ancestor exists.
 *   - Skips elements with display:none / visibility:hidden / 0-size rects.
 * ========================================================================== */

(function () {
  'use strict';

  var WCAG_AA_NORMAL = 4.5;
  var WCAG_AA_LARGE = 3.0;

  function parseColor(str) {
    if (!str) return null;
    var s = str.trim().toLowerCase();
    if (s === 'transparent' || s === 'currentcolor' || s === 'inherit' || s === 'initial' || s === 'unset' || s === 'none') return null;
    // rgb(R G B / A) or rgb(R, G, B) or rgba(...)
    var m = s.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s/]+([0-9.]+%?))?\s*\)$/);
    if (m) {
      var a = m[4];
      var alpha = a == null ? 1 : (a.indexOf('%') !== -1 ? parseFloat(a) / 100 : parseFloat(a));
      return { r: +m[1], g: +m[2], b: +m[3], a: alpha };
    }
    return null;
  }

  // Alpha-composite top over bottom (both must be in {r,g,b,a})
  function composite(top, bottom) {
    if (top.a >= 1) return { r: top.r, g: top.g, b: top.b, a: 1 };
    var a = top.a + bottom.a * (1 - top.a);
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    var r = (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a;
    var g = (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a;
    var b = (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a;
    return { r: r, g: g, b: b, a: a };
  }

  function srgbToLinear(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(c) {
    return 0.2126 * srgbToLinear(c.r) + 0.7152 * srgbToLinear(c.g) + 0.0722 * srgbToLinear(c.b);
  }

  function contrastRatio(fg, bg) {
    var l1 = relativeLuminance(fg);
    var l2 = relativeLuminance(bg);
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Walk up ancestors to find the first element with a non-transparent
  // background-color (or background image), alpha-composing as we go.
  function effectiveBackground(el) {
    var cur = el;
    var stack = [];
    while (cur && cur.nodeType === 1) {
      var cs = getComputedStyle(cur);
      var bg = parseColor(cs.backgroundColor);
      var bgImg = cs.backgroundImage && cs.backgroundImage !== 'none';
      if (bg && bg.a > 0) {
        stack.push({ el: cur, color: bg, hasImage: bgImg });
        if (bg.a >= 1) break;
      } else if (bgImg) {
        // unknown opacity from image; treat as opaque-ish white fallback
        stack.push({ el: cur, color: { r: 255, g: 255, b: 255, a: 1 }, hasImage: true });
        break;
      }
      cur = cur.parentElement;
    }
    if (!stack.length) {
      // fall back to body / html background or white
      return { el: document.documentElement, color: { r: 255, g: 255, b: 255, a: 1 }, hasImage: false };
    }
    // composite bottom-up — last item is the most-ancestor opaque layer
    var composed = stack[stack.length - 1].color;
    for (var i = stack.length - 2; i >= 0; i--) {
      composed = composite(stack[i].color, composed);
    }
    return { el: stack[0].el, color: composed, hasImage: stack.some(function (s) { return s.hasImage; }) };
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
  }

  function hasDirectText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim().length > 0) return true;
    }
    return false;
  }

  function isLargeText(cs) {
    var fs = parseFloat(cs.fontSize); // px
    var fw = (cs.fontWeight || '').toString();
    var bold = fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 700;
    // Per WCAG: large = >=18pt (~24px) or >=14pt (~18.66px) + bold
    return fs >= 24 || (fs >= 18.66 && bold);
  }

  function run() {
    if (!window.__CAUSL_CONTRAST_AUDIT__) {
      console.info('[contrast-audit] disabled — set window.__CAUSL_CONTRAST_AUDIT__ = true to enable, then call window.__causlContrastAudit().');
      return;
    }
    console.group('[contrast-audit] starting walk');
    var t0 = performance.now();
    var checked = 0;
    var failed = 0;
    var passed = 0;
    var skipped = 0;

    var all = document.querySelectorAll('body, body *');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!hasDirectText(el)) continue;
      if (!isVisible(el)) { skipped++; continue; }
      var cs = getComputedStyle(el);
      var fg = parseColor(cs.color);
      if (!fg || fg.a === 0) { skipped++; continue; }
      var bgInfo = effectiveBackground(el);
      var bg = bgInfo.color;
      // Composite fg if partially transparent against bg
      var fgComposite = fg.a < 1 ? composite(fg, bg) : fg;
      var ratio = contrastRatio(fgComposite, bg);
      checked++;
      var threshold = isLargeText(cs) ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
      if (ratio < threshold) {
        failed++;
        console.warn(
          '[contrast-audit] FAIL',
          el,
          'ratio=' + ratio.toFixed(2) + ' (need >= ' + threshold + ')',
          'color=' + cs.color,
          '(effective=' + JSON.stringify(round(fgComposite)) + ')',
          'bg-on=' + (bgInfo.el === el ? '(self)' : bgInfo.el && bgInfo.el.tagName),
          'bg=' + JSON.stringify(round(bg)),
          bgInfo.hasImage ? '[bg-image present — ratio approximate]' : ''
        );
      } else {
        passed++;
      }
    }

    var dt = (performance.now() - t0).toFixed(1);
    console.log('[contrast-audit] done in ' + dt + 'ms — checked=' + checked + ' passed=' + passed + ' FAILED=' + failed + ' skipped=' + skipped);
    console.groupEnd();
    return { checked: checked, passed: passed, failed: failed, skipped: skipped };
  }

  function round(c) {
    return {
      r: Math.round(c.r),
      g: Math.round(c.g),
      b: Math.round(c.b),
      a: Math.round(c.a * 100) / 100,
    };
  }

  // Expose manual trigger
  window.__causlContrastAudit = run;

  // Auto-run only if explicitly enabled before this script loaded.
  if (window.__CAUSL_CONTRAST_AUDIT__) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(run, 0);
    } else {
      window.addEventListener('DOMContentLoaded', run);
    }
  }
})();
