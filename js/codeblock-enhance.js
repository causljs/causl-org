/* causl.org code-block enhancer — wires up copy-to-clipboard for every
 * pre-rendered <code class="codeblock"> on the page, and acts as a
 * fallback rewriter for any <pre><code> that wasn't pre-rendered.
 *
 * Pre-rendering pipeline:
 *   1. tools/docs-postprocess/prerender-codeblocks.py  (#1280 / #1292)
 *      — wraps every <pre><code> in <div class="codeblock-wrapper">,
 *      injects the line-number gutter + copy button.
 *   2. tools/docs-postprocess/flatten-codeblocks.py    (#1294)
 *      — collapses the 4-level wrapper into a single
 *      <code class="codeblock" data-lang="..."> root. The flat root
 *      holds BOTH the surface background AND the foreground colour,
 *      defeating TypeDoc's <pre> contrast bug on API pages.
 *
 * At runtime this script only has to bind the click handler on each
 * pre-rendered copy button. The fallback path handles two cases:
 *   a) Blocks added dynamically after page load.
 *   b) Pages we forgot to pre-render (defence in depth).
 *
 * Lifecycle:
 *   - Runs after DOMContentLoaded (or immediately if the DOM is
 *     already parsed). Loaded with `defer` after Prism, so highlight
 *     tokens are in place when we read code text.
 *   - Idempotent: each <code class="codeblock"> is tagged
 *     data-enhanced="true". Each copy button gets data-copy-bound="true"
 *     after wiring.
 *
 * The playground / Run button used to live here too; it moved to
 * playground.js (#1292) so the editable component is a separate
 * concern and this file only deals with read-only code blocks. */
(function () {
  'use strict';

  // SVG glyphs — kept inline so the script is single-file and the page
  // never blocks on an extra asset request. 16x16 viewBox, stroke
  // currentColor so the button can be themed by parent color.
  var COPY_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="9" height="10" rx="1.5"/><path d="M3 12V3a1 1 0 0 1 1-1h7"/></svg>';
  var CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 8 7 12 13 4"/></svg>';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }

  function enhance() {
    // First: every pre-rendered .codeblock gets its copy button wired
    // AND its source span tokenized via Prism (if the source span carries
    // a `language-X` class — typically tutorial pages). This is the
    // fast path — no DOM mutation beyond Prism's own tokenizer.
    var blocks = document.querySelectorAll('code.codeblock');
    Array.prototype.forEach.call(blocks, bindCodeblockCopy);
    Array.prototype.forEach.call(blocks, highlightSourceSpan);

    // Second: any <pre><code> not yet inside a .codeblock falls back to
    // the legacy runtime path. This covers two cases:
    //   a) Blocks added dynamically after page load.
    //   b) Pages we forgot to pre-render (defence in depth).
    var legacy = document.querySelectorAll('pre > code');
    Array.prototype.forEach.call(legacy, enhanceLegacyBlock);
  }

  // ---------------------------------------------------------------------
  // Pre-rendered path: bind copy click on each static <code class="codeblock">.
  // The copy button is a direct child of the .codeblock. The source span
  // (<span class="codeblock-source">) is the read-target for the copy.
  // ---------------------------------------------------------------------
  function bindCodeblockCopy(block) {
    var btn = block.querySelector(':scope > .codeblock-copy');
    var source = block.querySelector(':scope > .codeblock-source');
    if (!btn || !source) return;
    if (btn.dataset.copyBound === 'true') return;
    btn.dataset.copyBound = 'true';
    bindCopyButton(btn, source);
  }

  // ---------------------------------------------------------------------
  // Prism integration (#1294)
  // ---------------------------------------------------------------------
  // The flat <code class="codeblock"> root deliberately does NOT carry
  // a `language-X` class — that would make Prism's auto-highlight run
  // on the OUTER code (gutter line-numbers + source concatenated as
  // textContent), destroying the gutter via innerHTML overwrite.
  //
  // Instead, the language-X class lives on <span class="codeblock-source">
  // (the inner span containing just the source text). Prism's auto
  // selectors don't match a <span>, so we invoke Prism.highlightElement
  // on the source span manually here. Prism tokenizes the source span's
  // textContent (the actual code), then replaces ITS innerHTML — the
  // gutter and copy button on the parent <code> are untouched.
  //
  // No-op when:
  //   * Prism isn't loaded yet on the page (Prism is `defer` after this
  //     script in the document; runs after both scripts have parsed).
  //   * The source span lacks a `language-X` class (homepage hand-coded
  //     blocks + TypeDoc API blocks — those use their own pre-baked
  //     tokens and don't need Prism).
  //   * Already tokenized (data-prism-bound="true").
  function highlightSourceSpan(block) {
    var source = block.querySelector(':scope > .codeblock-source');
    if (!source) return;
    if (source.dataset.prismBound === 'true') return;
    var cls = source.getAttribute('class') || '';
    if (!/\blanguage-[\w-]+\b/.test(cls)) return;
    if (typeof window === 'undefined' || !window.Prism) return;
    if (typeof window.Prism.highlightElement !== 'function') return;
    source.dataset.prismBound = 'true';
    try {
      window.Prism.highlightElement(source);
    } catch (_) {
      // If Prism throws (unknown grammar, etc.), leave the source span
      // as plain text — better than a half-tokenized mess.
      source.dataset.prismBound = 'false';
    }
  }

  // ---------------------------------------------------------------------
  // Fallback path: rewrite a <pre><code> that wasn't pre-rendered into
  // the new flat <code class="codeblock"> structure. Mirrors what the
  // sweep scripts (prerender + flatten) do at build time so any block
  // we miss (or that is added at runtime) still gets the gutter, copy
  // button, and the pair-token surface contract.
  // ---------------------------------------------------------------------
  function enhanceLegacyBlock(code) {
    var pre = code.parentElement;
    if (!pre || pre.tagName !== 'PRE') return;
    if (pre.dataset.enhanced === 'true') return;
    // If the pre is already inside the flat structure (shouldn't happen,
    // but defensive), bail.
    if (pre.closest && pre.closest('code.codeblock')) return;
    pre.dataset.enhanced = 'true';

    normalizeBlock(code, pre);

    // Build the new flat <code class="codeblock"> root.
    var block = document.createElement('code');
    block.className = 'codeblock';
    block.dataset.enhanced = 'true';
    var lang = extractLang(code);
    if (lang) block.dataset.lang = lang;

    // Gutter — one <span> per line, all under <span class="codeblock-gutter">.
    var text = code.textContent || '';
    var lines = text.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) lines = [''];
    var gutter = document.createElement('span');
    gutter.className = 'codeblock-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < lines.length; i++) {
      var num = document.createElement('span');
      num.className = 'codeblock-gutter-line';
      num.textContent = String(i + 1);
      gutter.appendChild(num);
    }
    block.appendChild(gutter);

    // Source — wrap the original <code>'s child nodes so any Prism
    // token spans / TypeDoc hl-N spans survive verbatim. The language-X
    // class moves from the original <code> to this span so the
    // highlightSourceSpan() pass (or Prism's own auto-highlight if it
    // ever runs again) can tokenize without clobbering the gutter.
    var source = document.createElement('span');
    var sourceCls = 'codeblock-source';
    var origCls = code.getAttribute('class') || '';
    var langClassMatch = origCls.match(/\blanguage-[\w-]+\b/);
    if (langClassMatch) sourceCls += ' ' + langClassMatch[0];
    source.className = sourceCls;
    while (code.firstChild) source.appendChild(code.firstChild);
    block.appendChild(source);

    // Copy button — appended last so it sits at the tail; CSS positions
    // it absolutely in the bottom-right corner of the .codeblock.
    var btn = buildCopyButton();
    bindCopyButton(btn, source);
    block.appendChild(btn);

    // Swap the entire <pre> out for the new flat root.
    if (pre.parentNode) pre.parentNode.replaceChild(block, pre);

    // Tokenize the source if Prism is available + a language was set.
    highlightSourceSpan(block);
  }

  // ---------------------------------------------------------------------
  // Normalization — fix up emitter-specific quirks so the rest of the
  // pipeline can treat every block uniformly.
  //
  // 1. Replace <br> / <br/> elements inside <code> with text-node "\n".
  //    TypeDoc emits multi-line code with <br/> separators rather than
  //    raw newlines; textContent collapses <br/> to nothing, so without
  //    this step a 20-line TypeDoc example reads as a single "line".
  //
  // 2. Drop element siblings of <code> inside <pre>. TypeDoc inserts its
  //    own <button>Copy</button> inside the <pre>, immediately after
  //    </code>. We're replacing the whole <pre> with a flat <code> root
  //    so this isn't strictly required for visual correctness, but we
  //    still strip it so the textContent we read for the gutter line
  //    count doesn't include the literal "Copy" string.
  // ---------------------------------------------------------------------
  function normalizeBlock(code, pre) {
    var brs = code.getElementsByTagName('br');
    for (var i = brs.length - 1; i >= 0; i--) {
      var br = brs[i];
      if (br.parentNode) {
        br.parentNode.replaceChild(document.createTextNode('\n'), br);
      }
    }
    var children = Array.prototype.slice.call(pre.children);
    for (var j = 0; j < children.length; j++) {
      if (children[j] !== code) {
        pre.removeChild(children[j]);
      }
    }
  }

  // Pull a data-lang hint off a <code> element. Mirrors the Python
  // sweep's extract_lang(): prefer "language-X", else the first class
  // token, else "".
  function extractLang(code) {
    var cls = code.getAttribute('class') || '';
    var m = cls.match(/\blanguage-([\w-]+)\b/);
    if (m) return m[1];
    var first = cls.split(/\s+/).filter(Boolean)[0];
    return first || '';
  }

  // ---------------------------------------------------------------------
  // Copy-to-clipboard — shared by pre-rendered and fallback paths.
  // ---------------------------------------------------------------------
  function buildCopyButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codeblock-btn codeblock-copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.innerHTML = COPY_SVG + '<span class="codeblock-btn-tooltip">Copy</span>';
    btn.dataset.copyBound = 'true';
    return btn;
  }

  function bindCopyButton(btn, source) {
    btn.addEventListener('click', function () {
      var text = source.textContent || '';
      var ok = function () {
        btn.classList.add('is-success');
        var tooltip = btn.querySelector('.codeblock-btn-tooltip');
        if (tooltip) tooltip.textContent = 'Copied!';
        var icon = btn.querySelector('svg');
        if (icon) icon.outerHTML = CHECK_SVG;
        setTimeout(function () {
          btn.classList.remove('is-success');
          var t = btn.querySelector('.codeblock-btn-tooltip');
          if (t) t.textContent = 'Copy';
          var i = btn.querySelector('svg');
          if (i) i.outerHTML = COPY_SVG;
        }, 1500);
      };
      var fail = function () {
        var tooltip = btn.querySelector('.codeblock-btn-tooltip');
        if (tooltip) tooltip.textContent = 'Copy failed';
        setTimeout(function () {
          var t = btn.querySelector('.codeblock-btn-tooltip');
          if (t) t.textContent = 'Copy';
        }, 1500);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fail);
      } else {
        // Legacy fallback for old Safari / non-secure contexts.
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
        } catch (_) {
          fail();
        }
      }
    });
  }
})();
