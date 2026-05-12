/* sandbox-runner.js — shared srcdoc-iframe runner used by
 * playground.js (the editable code component). Lives at site root so
 * any consumer can `<script src="…/js/sandbox-runner.js" defer>` and
 * call `window.CauslSandbox.run(source, opts)`.
 *
 * Design constraints (carried over from #1280):
 *   - Sandbox is a srcdoc iframe with sandbox="allow-scripts" only.
 *     Omitting allow-same-origin means the frame runs in an opaque
 *     origin and cannot reach the host page's storage, cookies, or
 *     DOM.
 *   - It imports the vendored @causl/core ES module by absolute URL
 *     resolved at script load time, so the same call site works from
 *     any depth in the docs tree.
 *   - User source is injected into a <script type="module"> body. We
 *     defensively replace literal "</script>" so a stray closing tag
 *     in user input can't break out of the host script. allow-scripts
 *     sandbox is what actually contains the code.
 *   - console.log / error / warn are intercepted and forwarded to the
 *     parent via postMessage so the calling component can render them
 *     in its own terminal element.
 *   - 5-second hard timeout so an infinite loop or never-resolving
 *     top-level await doesn't leak the iframe.
 *
 * Public surface:
 *   CauslSandbox.run(source, {
 *     onLog(level, message),  // 'log' | 'error' | 'warn'
 *     onDone(),               // called once, after timeout or natural completion
 *     onError(message),       // pre-timeout failure (rare; same channel as onLog)
 *     timeoutMs = 5000,       // override for slow CI machines if needed
 *   }) -> dispose()
 *
 *   The returned dispose() tears down the iframe + listeners. The
 *   runner self-disposes after timeout / done.
 */
(function (global) {
  'use strict';

  function vendorBase() {
    if (vendorBase._cached) return vendorBase._cached;
    var src = null;
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i].src || '';
      if (s.indexOf('sandbox-runner.js') !== -1) { src = s; break; }
    }
    if (!src) {
      // Fall back to the location of any codeblock.js script, which
      // lives alongside the sandbox runner. This covers loaders that
      // strip the explicit src attribute.
      for (var k = 0; k < scripts.length; k++) {
        var t = scripts[k].src || '';
        if (t.indexOf('codeblock.js') !== -1 ||
            t.indexOf('playground.js') !== -1) { src = t; break; }
      }
    }
    if (!src) src = location.href;
    // Strip /js/<filename>.js to recover the site root.
    var base = src.replace(/\/js\/[^/]+\.js.*$/, '/');
    vendorBase._cached = base;
    return base;
  }

  function run(source, opts) {
    opts = opts || {};
    var onLog = typeof opts.onLog === 'function' ? opts.onLog : function () {};
    var onDone = typeof opts.onDone === 'function' ? opts.onDone : function () {};
    var timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 5000;

    var base = vendorBase();
    var importMap = {
      imports: {
        '@causl/core': base + 'vendor/@causl/core/index.js',
        '@causl/core/': base + 'vendor/@causl/core/',
      },
    };

    var runId = 'r' + Math.random().toString(36).slice(2);
    var head =
      '<meta charset="utf-8">' +
      '<script type="importmap">' + JSON.stringify(importMap) + '<\/script>';

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
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.display = 'none';
    iframe.srcdoc = srcdoc;
    document.body.appendChild(iframe);

    var disposed = false;
    var idle = null;

    function dispose() {
      if (disposed) return;
      disposed = true;
      window.removeEventListener('message', handler);
      clearTimeout(idle);
      // Leave the iframe briefly so any late-firing microtasks can
      // resolve before GC.
      setTimeout(function () { if (iframe.parentNode) iframe.remove(); }, 1500);
    }

    function handler(e) {
      var d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.runId !== runId) return;
      if (d.type === 'causl-codeblock-log') {
        onLog(d.level || 'log', typeof d.data === 'string' ? d.data : '');
      } else if (d.type === 'causl-codeblock-done') {
        onDone();
        dispose();
      }
    }
    window.addEventListener('message', handler);

    idle = setTimeout(function () {
      if (!disposed) {
        onLog('error', 'timed out after ' + (timeoutMs / 1000) + 's');
        onDone();
        dispose();
      }
    }, timeoutMs);

    return dispose;
  }

  global.CauslSandbox = { run: run };
})(typeof window !== 'undefined' ? window : globalThis);
