/* causl.org code-block runtime component (#1295).
 *
 * The HTML payload is the BARE MINIMUM:
 *
 *     <code class="codeblock-source" data-lang="X">RAW SOURCE</code>
 *
 * No gutter, no wrapper, no copy button in the document — this module
 * adds them at runtime so the static HTML stays trivial to author,
 * easy to copy verbatim out of source files, and free of redundant
 * markup that bloats the byte budget.
 *
 * Three jobs, all self-contained:
 *
 *   1. MOUNT  — find every `<code class="codeblock-source">`, wrap its
 *               text in a `<span class="codeblock-text">`, prepend a
 *               line-number gutter, append a copy button.
 *
 *   2. COPY   — clicking the copy button writes the original textContent
 *               (captured BEFORE the gutter / button were added) to the
 *               clipboard, then briefly flashes "Copied!".
 *
 *   3. AUDIT  — every text-bearing descendant of the mounted block has
 *               its computed `color` checked against the nearest
 *               non-transparent ancestor `background-color`. If WCAG
 *               contrast < 4.5:1 (body) or < 3:1 (large), we log a
 *               console.warn and apply a corrective inline `color` —
 *               whichever of `--text-on-elevated` or `--text-on-base`
 *               clears the threshold on the discovered surface.
 *
 * The audit re-runs whenever `<html data-theme>` changes (theme toggle):
 * computed style values flip and what was legible in dark may not be
 * legible in light, or vice versa.
 *
 * Lifecycle:
 *   - Loaded with `defer` AFTER Prism on tutorial pages (so Prism token
 *     spans are in place when we audit colors).
 *   - Mount runs once at DOMContentLoaded; idempotent via
 *     `data-codeblock-mounted="true"` on the source <code>.
 *
 * No imports, no globals leaked beyond `window.__causlCodeblock` (a tiny
 * handle the audit script can call to re-run, useful in DevTools). */
(function () {
  'use strict';

  // ----- SVG glyphs (inlined so we don't pay a network round-trip) -----
  var COPY_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="9" height="10" rx="1.5"/><path d="M3 12V3a1 1 0 0 1 1-1h7"/></svg>';
  var CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 8 7 12 13 4"/></svg>';

  // ----- WCAG constants -----
  var WCAG_AA_NORMAL = 4.5;
  var WCAG_AA_LARGE = 3.0;

  // ============================================================
  // Boot
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    mountAll();
    auditAll();
    observeThemeChanges();
    // Expose a tiny handle for DevTools / tests.
    window.__causlCodeblock = {
      mount: mountAll,
      audit: auditAll,
    };
  }

  // ============================================================
  // 1. MOUNT
  // ============================================================
  function mountAll() {
    var roots = document.querySelectorAll('code.codeblock-source');
    Array.prototype.forEach.call(roots, mountOne);
  }

  function mountOne(code) {
    if (code.dataset.codeblockMounted === 'true') return;

    // Capture the raw source BEFORE any DOM mutation. textContent
    // already collapses syntax-highlight spans into plain text, which
    // is exactly what we want to copy.
    var originalText = code.textContent || '';

    // Tokenize source text into lines for the gutter. Mirrors the
    // textContent convention: trailing "" after split is dropped so a
    // single-line block reads as one line, not two.
    var lines = originalText.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) lines = [''];

    // Move the existing children (raw text or syntax-highlight spans)
    // into a new <span class="codeblock-text">. We can't just innerHTML
    // them — that would clone, not move, and break event listeners on
    // any inner nodes (rare, but defensive).
    var textSpan = document.createElement('span');
    textSpan.className = 'codeblock-text';
    while (code.firstChild) textSpan.appendChild(code.firstChild);

    // Gutter — pure presentational, hidden from copy/paste via CSS
    // user-select: none + aria-hidden for AT.
    var gutter = document.createElement('span');
    gutter.className = 'codeblock-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < lines.length; i++) {
      var line = document.createElement('span');
      line.className = 'codeblock-gutter-line';
      line.textContent = String(i + 1);
      gutter.appendChild(line);
    }

    // Copy button — last child so CSS can `position: absolute` it at
    // the bottom-right.
    var btn = buildCopyButton();
    bindCopy(btn, originalText);

    // Compose the final tree. Order matters for CSS grid columns:
    // gutter is column 1, text is column 2.
    code.appendChild(gutter);
    code.appendChild(textSpan);
    code.appendChild(btn);

    code.dataset.codeblockMounted = 'true';

    // If a tutorial-page source carries a Prism `language-X` class and
    // Prism happens to be on the page, tokenize the text span now. This
    // is a no-op when Prism isn't loaded (homepage, TypeDoc API pages).
    runPrismIfAvailable(code, textSpan);
  }

  function buildCopyButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codeblock-btn codeblock-copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.innerHTML = COPY_SVG + '<span class="codeblock-btn-tooltip">Copy</span>';
    return btn;
  }

  function bindCopy(btn, text) {
    btn.addEventListener('click', function () {
      var ok = function () { flash(btn, 'Copied!', CHECK_SVG, true); };
      var fail = function () { flash(btn, 'Copy failed', COPY_SVG, false); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail);
      } else {
        // Legacy fallback for non-secure contexts / very old Safari.
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'absolute';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          ok();
        } catch (_) { fail(); }
      }
    });
  }

  function flash(btn, label, svg, success) {
    if (success) btn.classList.add('is-success');
    var tooltip = btn.querySelector('.codeblock-btn-tooltip');
    if (tooltip) tooltip.textContent = label;
    var icon = btn.querySelector('svg');
    if (icon) icon.outerHTML = svg;
    setTimeout(function () {
      btn.classList.remove('is-success');
      var t = btn.querySelector('.codeblock-btn-tooltip');
      if (t) t.textContent = 'Copy';
      var i = btn.querySelector('svg');
      if (i) i.outerHTML = COPY_SVG;
    }, 1500);
  }

  // Prism integration: optional. Tutorial pages load Prism so that
  // language-X grammars colour the source. We only invoke it when both
  // Prism is on the window AND the source span carries a language-X
  // class (homepage / TypeDoc blocks don't — they ship their own
  // tokens or bake them at build time).
  function runPrismIfAvailable(code, textSpan) {
    var lang = code.getAttribute('data-lang');
    if (!lang) return;
    if (typeof window === 'undefined' || !window.Prism) return;
    if (typeof window.Prism.highlightElement !== 'function') return;
    // Move the language class onto the text span so Prism's selector
    // (`code[class*="language-"]`) doesn't re-tokenize the outer
    // <code> (which would clobber the gutter + button on innerHTML
    // replacement).
    var langClass = 'language-' + lang;
    if (textSpan.classList.contains(langClass)) return;
    textSpan.classList.add(langClass);
    try { window.Prism.highlightElement(textSpan); }
    catch (_) { /* unknown grammar; leave plain text */ }
  }

  // ============================================================
  // 2. CONTRAST AUDIT
  // ============================================================
  // Run AFTER mount so the structure is in place. Re-run on theme
  // change. Walks every text-bearing element inside each mounted
  // codeblock, compares computed color against the nearest opaque
  // ancestor background.

  function auditAll() {
    var roots = document.querySelectorAll('code.codeblock-source[data-codeblock-mounted="true"]');
    Array.prototype.forEach.call(roots, auditOne);
  }

  function auditOne(code) {
    // Clear any prior inline corrections so we re-derive from the
    // current theme's computed colours, not the previous theme's
    // corrections.
    var corrected = code.querySelectorAll('[data-codeblock-corrected="true"]');
    Array.prototype.forEach.call(corrected, function (el) {
      el.style.removeProperty('color');
      delete el.dataset.codeblockCorrected;
    });

    // Walk every element that holds a non-empty text node.
    var nodes = [];
    var walker = document.createTreeWalker(code, NodeFilter.SHOW_ELEMENT, null);
    var node = walker.nextNode();
    while (node) {
      if (hasOwnText(node)) nodes.push(node);
      node = walker.nextNode();
    }
    // Also include the root itself if it carries direct text children.
    if (hasOwnText(code)) nodes.unshift(code);

    nodes.forEach(function (el) {
      var fg = parseColor(getComputedStyle(el).color);
      if (!fg) return;
      var bgInfo = findOpaqueAncestorBg(el);
      if (!bgInfo) return;
      var ratio = contrastRatio(fg, bgInfo.color);
      // Use the small-text threshold by default; the gutter / source
      // are 0.875rem so always "normal" text under WCAG.
      if (ratio >= WCAG_AA_NORMAL) return;

      // Skip syntax-highlight tokens — their colors are intentional
      // design choices (Prism .token.*, TypeDoc .hl-N, homepage .tok-*).
      // Overriding them with the muted body-text token flattens all
      // syntax color into one grey blob, defeating highlighting entirely.
      // Apply the "large/decorative" WCAG threshold (3:1) for tokens
      // instead of body text's 4.5:1 — and even then, log-only, no fix.
      if (isSyntaxToken(el)) {
        if (ratio < WCAG_AA_LARGE) {
          // eslint-disable-next-line no-console
          console.warn('[codeblock] syntax token under 3:1 — left as-is to preserve highlighting', {
            element: el,
            color: cssColorString(fg),
            background: cssColorString(bgInfo.color),
            ratio: round2(ratio),
          });
        }
        return;
      }
      // Try to repair. Prefer --text-on-elevated, fall back to --text-
      // on-base — whichever clears the threshold on this surface.
      var fix = pickReadable(bgInfo.color, [
        '--text-on-elevated',
        '--text-on-base',
      ]);
      if (fix && fix.ratio >= WCAG_AA_NORMAL) {
        el.style.color = fix.value;
        el.dataset.codeblockCorrected = 'true';
        // eslint-disable-next-line no-console
        console.warn('[codeblock] low contrast — corrected', {
          element: el,
          before: { color: cssColorString(fg), ratio: round2(ratio) },
          after: { token: fix.token, color: fix.value, ratio: round2(fix.ratio) },
          background: { color: cssColorString(bgInfo.color), source: bgInfo.element },
        });
      } else {
        // eslint-disable-next-line no-console
        console.warn('[codeblock] low contrast — no repair', {
          element: el,
          color: cssColorString(fg),
          background: cssColorString(bgInfo.color),
          ratio: round2(ratio),
        });
      }
    });
  }

  // True if the element's class list marks it as a syntax-highlight
  // token from any of the three emitters we ship:
  //   - Prism:   .token, .token.<name>
  //   - TypeDoc: .hl-0 ... .hl-13
  //   - Homepage hand-coded: .tok-fn, .tok-com, .tok-cyan, .tok-amber, etc.
  // The audit must NOT auto-correct these — their colors are intentional
  // and a 4.5:1 override flattens all syntax color to muted body text.
  function isSyntaxToken(el) {
    if (!el || !el.classList) return false;
    var cn = el.className;
    if (typeof cn !== 'string') return false;
    return /(?:^|\s)(?:token(?:\s|$)|hl-\d|tok-)/.test(cn);
  }

  // Does this element have any directly-owned non-whitespace text?
  function hasOwnText(el) {
    var c = el.firstChild;
    while (c) {
      if (c.nodeType === 3 /* TEXT */ && c.nodeValue && /\S/.test(c.nodeValue)) {
        return true;
      }
      c = c.nextSibling;
    }
    return false;
  }

  // Walk up from `start` (inclusive) to find the nearest ancestor with
  // a non-transparent computed background-color. Returns {element, color}
  // or null if even <html> is transparent (extremely unlikely).
  function findOpaqueAncestorBg(start) {
    var el = start;
    while (el && el.nodeType === 1) {
      var cs = getComputedStyle(el);
      var c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) {
        // If partially transparent, alpha-composite against the next
        // opaque layer to get the effective surface colour the eye sees.
        if (c.a >= 1) return { element: el, color: c };
        var parent = el.parentElement;
        var under = parent ? findOpaqueAncestorBg(parent) : null;
        if (under) return { element: el, color: composite(c, under.color) };
        return { element: el, color: c };
      }
      el = el.parentElement;
    }
    return null;
  }

  // Try each token in order; return the one whose resolved value has
  // the best contrast on `bg`, provided it meets WCAG AA.
  function pickReadable(bg, tokens) {
    var probe = document.documentElement;
    var best = null;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var value = getComputedStyle(probe).getPropertyValue(token).trim();
      if (!value) continue;
      // Resolve the token through a temporary element so colour
      // functions (rgb / rgba / hex) all normalize to rgb().
      var probeEl = document.createElement('span');
      probeEl.style.color = value;
      probeEl.style.position = 'absolute';
      probeEl.style.visibility = 'hidden';
      document.body.appendChild(probeEl);
      var resolved = parseColor(getComputedStyle(probeEl).color);
      document.body.removeChild(probeEl);
      if (!resolved) continue;
      var ratio = contrastRatio(resolved, bg);
      if (!best || ratio > best.ratio) {
        best = { token: token, value: value, ratio: ratio };
      }
    }
    return best;
  }

  // ============================================================
  // 3. THEME CHANGE OBSERVER
  // ============================================================
  function observeThemeChanges() {
    if (typeof MutationObserver !== 'function') return;
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          auditAll();
          return;
        }
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ============================================================
  // Colour math — minimal WCAG 2.x contrast helpers
  // ============================================================
  function parseColor(str) {
    if (!str) return null;
    var s = str.trim().toLowerCase();
    if (s === 'transparent' || s === 'currentcolor') return { r: 0, g: 0, b: 0, a: 0 };
    var m = s.match(/^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)(?:[,\s/]+([0-9.]+%?))?\s*\)$/);
    if (m) {
      var a = m[4];
      var alpha = a == null ? 1 : (a.indexOf('%') !== -1 ? parseFloat(a) / 100 : parseFloat(a));
      return { r: +m[1], g: +m[2], b: +m[3], a: alpha };
    }
    return null;
  }

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

  function relativeLuminance(rgb) {
    return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
  }

  function contrastRatio(fg, bg) {
    // Composite fg over bg first if fg is translucent — what the eye
    // actually sees on screen.
    var effFg = fg.a < 1 ? composite(fg, bg) : fg;
    var l1 = relativeLuminance(effFg);
    var l2 = relativeLuminance(bg);
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function cssColorString(c) {
    return 'rgba(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ', ' + (Math.round(c.a * 100) / 100) + ')';
  }

  function round2(n) { return Math.round(n * 100) / 100; }
})();
