/* playground.js — editable code-block component for causl.org.
 *
 * Mounts on every <div class="playground-wrapper"> in the document.
 * Each wrapper hosts:
 *   - .playground-source <textarea> (the editable code)
 *   - .playground-gutter <aside> (line numbers, recomputed on input)
 *   - .playground-run <button> (executes the current textarea value
 *     in a sandboxed iframe via sandbox-runner.js)
 *   - .playground-reset <button> (restores the source to
 *     data-initial)
 *   - .playground-terminal <pre> (slide-out output, aria-live=polite)
 *
 * Initial source comes from the wrapper's data-initial attribute (or
 * the textarea's initial value at mount time as a fallback). The
 * attribute is the source of truth for Reset.
 *
 * Loaded with `defer` after sandbox-runner.js so window.CauslSandbox
 * is available. Idempotent: each wrapper carries data-playground-bound
 * once wired.
 */
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll, { once: true });
  } else {
    mountAll();
  }

  function mountAll() {
    var wrappers = document.querySelectorAll('.playground-wrapper');
    Array.prototype.forEach.call(wrappers, mount);
  }

  function mount(wrapper) {
    if (wrapper.dataset.playgroundBound === 'true') return;
    wrapper.dataset.playgroundBound = 'true';

    var textarea = wrapper.querySelector(':scope .playground-source');
    var gutter = wrapper.querySelector(':scope .playground-gutter');
    var runBtn = wrapper.querySelector(':scope .playground-run');
    var resetBtn = wrapper.querySelector(':scope .playground-reset');
    var terminal = wrapper.querySelector(':scope .playground-terminal');
    if (!textarea || !runBtn || !terminal) return;

    // Resolve the initial source. Prefer data-initial because Reset
    // needs an immutable reference; if missing, snapshot textarea.value
    // now and stash it back so the contract holds either way.
    var initial = wrapper.dataset.initial;
    if (initial === undefined || initial === null) {
      initial = textarea.value;
      wrapper.dataset.initial = initial;
    }
    textarea.value = initial;

    syncGutter(textarea, gutter);

    // Debounce gutter recomputation on input; typing is too fast to
    // rerender every keystroke on long blocks, but the visible lag is
    // imperceptible at 60ms.
    var gutterTimer = null;
    textarea.addEventListener('input', function () {
      if (gutterTimer) cancelAnimationFrame(gutterTimer);
      gutterTimer = requestAnimationFrame(function () {
        syncGutter(textarea, gutter);
      });
    });
    // Pressing Tab inserts two spaces instead of moving focus — this
    // is a code editor, the page-navigation default would be hostile.
    textarea.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      syncGutter(textarea, gutter);
    });

    var disposer = null;
    runBtn.addEventListener('click', function () {
      if (!global().CauslSandbox || typeof global().CauslSandbox.run !== 'function') {
        terminal.classList.add('is-open');
        terminal.textContent = '> [error] sandbox-runner.js not loaded';
        return;
      }
      if (disposer) { disposer(); disposer = null; }
      terminal.classList.add('is-open');
      terminal.textContent = '> running...';
      var lines = [];
      var rendered = false;
      function render() {
        rendered = true;
        var formatted = lines.length === 0
          ? '> (no output)'
          : lines.map(function (l) { return '> ' + l; }).join('\n');
        terminal.textContent = formatted;
      }
      disposer = global().CauslSandbox.run(textarea.value, {
        onLog: function (level, msg) {
          var prefix = level === 'error' ? '[error] '
            : level === 'warn' ? '[warn] '
            : '';
          lines.push(prefix + msg);
          render();
        },
        onDone: function () {
          if (!rendered) terminal.textContent = '> (no output)';
        },
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        textarea.value = wrapper.dataset.initial || '';
        syncGutter(textarea, gutter);
        textarea.focus();
      });
    }
  }

  function syncGutter(textarea, gutter) {
    if (!gutter) return;
    var text = textarea.value || '';
    var lines = text.split('\n');
    // Keep at least one line so the gutter never collapses to zero
    // height; a never-empty textarea is the common case anyway.
    if (lines.length === 0) lines = [''];
    var existing = gutter.children.length;
    var needed = lines.length;
    if (needed > existing) {
      var frag = document.createDocumentFragment();
      for (var i = existing; i < needed; i++) {
        var span = document.createElement('span');
        span.className = 'playground-gutter-line';
        span.textContent = String(i + 1);
        frag.appendChild(span);
      }
      gutter.appendChild(frag);
    } else if (needed < existing) {
      while (gutter.children.length > needed) {
        gutter.removeChild(gutter.lastChild);
      }
    }
  }

  function global() {
    return typeof window !== 'undefined' ? window : globalThis;
  }
})();
