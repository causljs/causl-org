/* causl.org code-block enhancer — adds line numbers, copy-to-clipboard,
 * and an optional Run-code playground sliding terminal to every
 * <pre><code class="language-X"> on the page.
 *
 * Lifecycle:
 *   - Runs after DOMContentLoaded (or immediately if the DOM is already
 *     parsed). Loaded with `defer` after Prism, so highlight tokens are
 *     already in place and we only ever read code.textContent (which is
 *     the raw, un-highlighted source).
 *   - Idempotent: each <pre> is tagged with data-enhanced="true" the
 *     first time we touch it.
 *
 * Pieces:
 *   A. Line-number gutter — a sibling <aside> inserted as the first
 *      child of <pre>. It carries aria-hidden + user-select:none so its
 *      numbers are never part of a copy/paste selection.
 *   B. Copy-to-clipboard button — absolutely positioned in the wrapper's
 *      bottom-right. Click runs navigator.clipboard.writeText on the
 *      <code>'s raw text and flashes a "Copied!" tooltip on success.
 *   C. Run button (only for <pre class="… is-playground">) — opens a
 *      sandboxed iframe, pipes console.log/error back to a sliding
 *      <pre class="codeblock-terminal"> below the code box. The slide-out
 *      respects prefers-reduced-motion (CSS handles that bit).
 *
 * The Run-code sandbox is necessarily limited: a srcdoc iframe with
 * `sandbox="allow-scripts"` runs in an opaque origin and can import
 * the vendored @causl/core ES module by absolute URL. Anything that
 * needs DOM, network, or @causl/react will not work in v1. See the PR
 * body for the full list of caveats. */
(function () {
  'use strict';

  // SVG glyphs — kept inline so the script is single-file and the
  // page never blocks on an extra asset request. 16x16 viewBox, stroke
  // currentColor so the button can be themed by parent color.
  var COPY_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="9" height="10" rx="1.5"/><path d="M3 12V3a1 1 0 0 1 1-1h7"/></svg>';
  var CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 8 7 12 13 4"/></svg>';
  var PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3.2v9.6a.5.5 0 0 0 .76.43l8-4.8a.5.5 0 0 0 0-.86l-8-4.8A.5.5 0 0 0 4 3.2z"/></svg>';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance, { once: true });
  } else {
    enhance();
  }

  function enhance() {
    var blocks = document.querySelectorAll('pre > code');
    Array.prototype.forEach.call(blocks, enhanceBlock);
  }

  function enhanceBlock(code) {
    var pre = code.parentElement;
    if (!pre || pre.dataset.enhanced === 'true') return;
    // Skip inline code (paranoia: querySelector above already filters
    // to pre>code, but a stray pre>span>code in some doc somewhere
    // could trip us up. Bail if pre tag isn't PRE).
    if (pre.tagName !== 'PRE') return;
    pre.dataset.enhanced = 'true';

    // Wrap the <pre> so we have a positioning context for the buttons
    // and the slide-out terminal. Preserves siblings/order.
    var wrapper = document.createElement('div');
    wrapper.className = 'codeblock-wrapper';
    if (pre.parentNode) {
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
    }

    addLineNumbers(code, pre);
    addCopyButton(code, wrapper);
    if (pre.classList.contains('is-playground')) {
      addRunButton(code, wrapper);
    }
  }

  // ---------------------------------------------------------------------
  // A. Line numbers
  // ---------------------------------------------------------------------
  function addLineNumbers(code, pre) {
    // Use textContent (not innerText) — innerText would collapse
    // whitespace and miscount lines. Prism replaces children with
    // highlighted spans but textContent still returns the raw source.
    var text = code.textContent || '';
    var lines = text.split('\n');
    // A trailing newline is conventional; don't count an empty final
    // "line" or every block reads as N+1.
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
    // First child so it sits visually to the left of <code>.
    pre.insertBefore(gutter, code);
    pre.classList.add('has-gutter');
  }

  // ---------------------------------------------------------------------
  // B. Copy-to-clipboard
  // ---------------------------------------------------------------------
  function addCopyButton(code, wrapper) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codeblock-btn codeblock-copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    btn.innerHTML = COPY_SVG + '<span class="codeblock-btn-tooltip">Copy</span>';

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

    wrapper.appendChild(btn);
  }

  // ---------------------------------------------------------------------
  // C. Run button + sandboxed iframe + sliding terminal
  // ---------------------------------------------------------------------
  function addRunButton(code, wrapper) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'codeblock-btn codeblock-run';
    btn.setAttribute('aria-label', 'Run code');
    btn.innerHTML = PLAY_SVG + '<span class="codeblock-btn-tooltip">Run</span>';

    var terminal = document.createElement('pre');
    terminal.className = 'codeblock-terminal';
    terminal.setAttribute('aria-live', 'polite');
    terminal.setAttribute('aria-label', 'Code output');

    wrapper.appendChild(btn);
    wrapper.appendChild(terminal);

    btn.addEventListener('click', function () {
      terminal.classList.add('is-open');
      terminal.textContent = '> running...';
      runCode(code.textContent || '', terminal, wrapper);
    });
  }

  // Resolve the vendored @causl/core path relative to the currently
  // executing script. This lets one JS file work whether it was loaded
  // from /js/codeblock-enhance.js (depth 1) or /pages/foo/bar/baz/
  // (depth 4) — the import-map URL is absolute, so the iframe (which
  // has its own document root via srcdoc) can resolve it identically.
  function vendorBase() {
    // currentScript is null after async resolution; grab on first call
    // and cache on the function so re-entry stays correct.
    if (vendorBase._cached) return vendorBase._cached;
    var src = null;
    // document.currentScript is unavailable inside event handlers, so
    // walk <script> tags looking for our filename.
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i].src || '';
      if (s.indexOf('codeblock-enhance.js') !== -1) { src = s; break; }
    }
    if (!src) src = location.href;
    // Strip /js/codeblock-enhance.js → site root, then append vendor.
    var base = src.replace(/\/js\/codeblock-enhance\.js.*$/, '/');
    vendorBase._cached = base;
    return base;
  }

  function runCode(source, terminal, wrapper) {
    // Clear any prior iframe for this wrapper (re-clicks restart).
    var prior = wrapper.querySelector('iframe.codeblock-sandbox');
    if (prior) prior.remove();

    var base = vendorBase();
    var importMap = {
      imports: {
        '@causl/core': base + 'vendor/@causl/core/index.js',
        '@causl/core/': base + 'vendor/@causl/core/',
      },
    };

    // Build the sandbox HTML. The <script type="module"> body wraps the
    // user code in an async IIFE so top-level await works, captures
    // console.log / console.error / console.warn, and forwards each
    // entry to the parent via postMessage. Errors during evaluation
    // are caught and reported the same way so the terminal shows the
    // exception text instead of going silent.
    var runId = 'r' + Math.random().toString(36).slice(2);
    var head =
      '<meta charset="utf-8">' +
      '<script type="importmap">' + JSON.stringify(importMap) + '<\/script>';

    // Note: source is injected into a <script> body. We rely on the
    // sandbox attribute for isolation; no escape is performed beyond
    // closing-tag protection (a literal "</script>" in user source
    // would break out of the host script). Replace it defensively.
    var safeSource = String(source).replace(/<\/script>/gi, '<\\/script>');

    var body =
      '<script type="module">' +
      '(async () => {' +
      '  const send = (level, args) => {' +
      '    try {' +
      '      parent.postMessage({ type: "causl-codeblock-log", runId: ' + JSON.stringify(runId) + ', level: level, data: args.map(formatArg).join(" ") }, "*");' +
      '    } catch (_) {}' +
      '  };' +
      '  const formatArg = (a) => {' +
      '    if (a === null) return "null";' +
      '    if (a === undefined) return "undefined";' +
      '    if (typeof a === "string") return a;' +
      '    if (typeof a === "number" || typeof a === "boolean") return String(a);' +
      '    try { return JSON.stringify(a); } catch (_) { return String(a); }' +
      '  };' +
      '  const origLog = console.log.bind(console);' +
      '  const origErr = console.error.bind(console);' +
      '  const origWarn = console.warn.bind(console);' +
      '  console.log = (...args) => { origLog(...args); send("log", args); };' +
      '  console.error = (...args) => { origErr(...args); send("error", args); };' +
      '  console.warn = (...args) => { origWarn(...args); send("warn", args); };' +
      '  window.addEventListener("error", (e) => send("error", [e.message || String(e.error || e)]));' +
      '  window.addEventListener("unhandledrejection", (e) => send("error", ["Unhandled rejection: " + (e.reason && (e.reason.message || e.reason) || "")]));' +
      '  try {' +
      '    /* === user source === */' +
      safeSource +
      '\n    /* === end user source === */' +
      '  } catch (e) {' +
      '    send("error", [(e && e.message) ? e.message : String(e)]);' +
      '  }' +
      '  parent.postMessage({ type: "causl-codeblock-done", runId: ' + JSON.stringify(runId) + ' }, "*");' +
      '})();' +
      '<\/script>';

    var srcdoc = '<!doctype html><html><head>' + head + '</head><body>' + body + '</body></html>';

    var iframe = document.createElement('iframe');
    iframe.className = 'codeblock-sandbox';
    // allow-scripts is the minimum; we intentionally omit allow-same-origin
    // so the sandbox runs in an opaque origin and can't reach the host
    // page's storage, cookies, or DOM.
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.display = 'none';
    iframe.srcdoc = srcdoc;
    wrapper.appendChild(iframe);

    var lines = [];
    var idle = null;
    var done = false;

    function render() {
      // The leading "> " prefix gives terminal lines a shell-prompt
      // feel that matches what an end-user would expect from a Run
      // playground; it is purely cosmetic.
      var formatted = lines.length === 0
        ? '> (no output)'
        : lines.map(function (l) { return '> ' + l; }).join('\n');
      terminal.textContent = formatted;
    }

    function handler(e) {
      var d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.runId !== runId) return;
      if (d.type === 'causl-codeblock-log') {
        var prefix = d.level === 'error' ? '[error] ' : d.level === 'warn' ? '[warn] ' : '';
        lines.push(prefix + (typeof d.data === 'string' ? d.data : ''));
        render();
      } else if (d.type === 'causl-codeblock-done') {
        done = true;
        if (lines.length === 0) {
          terminal.textContent = '> (no output)';
        }
        window.removeEventListener('message', handler);
        clearTimeout(idle);
        // Leave the iframe in the DOM briefly so any late-firing
        // microtasks resolve; then GC it.
        setTimeout(function () { if (iframe.parentNode) iframe.remove(); }, 1500);
      }
    }

    window.addEventListener('message', handler);

    // Hard timeout: if the module never resolves (infinite loop, top-
    // level await on a never-resolved promise) drop the iframe after
    // 5s so we don't leak.
    idle = setTimeout(function () {
      if (!done) {
        lines.push('[error] timed out after 5s');
        render();
        window.removeEventListener('message', handler);
        if (iframe.parentNode) iframe.remove();
      }
    }, 5000);
  }
})();
