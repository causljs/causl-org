/* causl.org code-block enhancer — wires up copy-to-clipboard for every
 * pre-rendered <div class="codeblock-wrapper"> on the page, and acts
 * as a fallback wrapper for any <pre><code> that wasn't pre-rendered.
 *
 * Pre-rendering (tools/docs-postprocess/prerender-codeblocks.py)
 * already injects the wrapper div, line-number gutter, has-gutter
 * class, data-enhanced="true" flag, and the copy <button> for every
 * static <pre><code> in causl-org/. At runtime this script only has
 * to bind the click handler on each pre-rendered button.
 *
 * Lifecycle:
 *   - Runs after DOMContentLoaded (or immediately if the DOM is
 *     already parsed). Loaded with `defer` after Prism, so highlight
 *     tokens are in place when we read code.textContent.
 *   - Idempotent: each <pre> is tagged data-enhanced="true". Each
 *     copy button gets data-copy-bound="true" after wiring.
 *
 * Pieces:
 *   1. bindCopyButton() — wires a single .codeblock-copy click handler
 *      to its sibling <code>. Reads code.textContent so any rich
 *      Prism markup is collapsed to the original source.
 *   2. enhanceLegacyBlock() — fallback for any <pre><code> not in a
 *      .codeblock-wrapper. Mirrors the old runtime path (wrap, gutter,
 *      button) so dynamically-added blocks still get enhancements.
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
    // First: every pre-rendered wrapper gets its copy button wired.
    // This is the fast path — no DOM mutation, just event binding.
    var wrappers = document.querySelectorAll('.codeblock-wrapper');
    Array.prototype.forEach.call(wrappers, bindWrapperCopy);

    // Second: any <pre><code> not yet inside a wrapper falls back to
    // the legacy runtime path. This covers two cases:
    //   a) Blocks added dynamically after page load.
    //   b) Pages we forgot to pre-render (defence in depth).
    var blocks = document.querySelectorAll('pre > code');
    Array.prototype.forEach.call(blocks, enhanceLegacyBlock);
  }

  // ---------------------------------------------------------------------
  // Pre-rendered path: bind copy click on each static .codeblock-wrapper.
  // ---------------------------------------------------------------------
  function bindWrapperCopy(wrapper) {
    var btn = wrapper.querySelector(':scope > .codeblock-copy');
    var code = wrapper.querySelector(':scope > pre > code');
    if (!btn || !code) return;
    if (btn.dataset.copyBound === 'true') return;
    btn.dataset.copyBound = 'true';
    bindCopyButton(btn, code);
  }

  // ---------------------------------------------------------------------
  // Fallback path: wrap a <pre><code> that wasn't pre-rendered. This
  // mirrors the original runtime behaviour from before #1292 so any
  // block we miss (or that is added at runtime) still gets the gutter,
  // copy button, and wrapper.
  // ---------------------------------------------------------------------
  function enhanceLegacyBlock(code) {
    var pre = code.parentElement;
    if (!pre || pre.tagName !== 'PRE') return;
    if (pre.dataset.enhanced === 'true') return;
    // If the parent is already a wrapper, the pre-rendered path
    // handled this block; nothing to do here.
    if (pre.parentNode && pre.parentNode.classList &&
        pre.parentNode.classList.contains('codeblock-wrapper')) {
      return;
    }
    pre.dataset.enhanced = 'true';

    normalizeBlock(code, pre);

    var wrapper = document.createElement('div');
    wrapper.className = 'codeblock-wrapper';
    if (pre.parentNode) {
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
    }

    addLineNumbers(code, pre);
    addCopyButton(code, wrapper);
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
  //    </code>. We're replacing that with our own copy button on the
  //    wrapper; the original would otherwise show up in copy payloads
  //    (appending the literal string "Copy" to the clipboard) and would
  //    visually duplicate our button.
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

  // ---------------------------------------------------------------------
  // Line numbers (fallback path only).
  // ---------------------------------------------------------------------
  function addLineNumbers(code, pre) {
    var text = code.textContent || '';
    var lines = text.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) lines = [''];

    var gutter = document.createElement('aside');
    gutter.className = 'codeblock-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < lines.length; i++) {
      var num = document.createElement('span');
      num.className = 'codeblock-gutter-line';
      num.textContent = String(i + 1);
      gutter.appendChild(num);
    }
    pre.insertBefore(gutter, code);
    pre.classList.add('has-gutter');
  }

  // ---------------------------------------------------------------------
  // Copy-to-clipboard — used by both pre-rendered and fallback paths.
  // ---------------------------------------------------------------------
  function addCopyButton(code, wrapper) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codeblock-btn codeblock-copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.innerHTML = COPY_SVG + '<span class="codeblock-btn-tooltip">Copy</span>';
    btn.dataset.copyBound = 'true';
    bindCopyButton(btn, code);
    wrapper.appendChild(btn);
  }

  function bindCopyButton(btn, code) {
    btn.addEventListener('click', function () {
      var text = code.textContent || '';
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
