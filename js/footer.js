/* causl.org shared footer — single-source-of-truth injection (#1260).
 *
 * Mirrors topbar.js. Pages render a placeholder:
 *
 *   <div id="footer-host">
 *     <!-- minimum semantic links for crawlers / no-JS users -->
 *   </div>
 *
 * renderFooter() replaces it with the canonical <footer> element. The
 * actual call site is start() in topbar.js — that file owns the
 * lifecycle so both injections share the same DOMContentLoaded gate
 * and inject in a deterministic order (topbar first, footer second).
 *
 * Loaded with <script defer> *before* topbar.js so window.renderFooter
 * is already defined when topbar.js's start() probes for it.
 */
(function () {
  'use strict';

  /** Canonical footer links. Kept in lockstep with the topbar nav so
   *  drift between the two (which was the original #1260 symptom) is
   *  impossible by construction. */
  var FOOTER_LINKS = [
    ['/',                       'Home'],
    ['/pages/documentation/',   'Documentation'],
    ['/pages/benchmarks/',      'Benchmarks'],
    ['/pages/playground/',      'Playground'],
    ['/pages/spreadsheet/',     'Spreadsheet'],
    ['https://github.com/iasbuilt/causl', 'GitHub']
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildFooterHtml() {
    var links = '';
    for (var i = 0; i < FOOTER_LINKS.length; i++) {
      var href = FOOTER_LINKS[i][0];
      var label = FOOTER_LINKS[i][1];
      var attrs = ' href="' + escapeHtml(href) + '"';
      if (/^https?:/.test(href)) attrs += ' rel="noopener"';
      links += '        <a' + attrs + '>' + escapeHtml(label) + '</a>\n';
    }
    return ''
      + '<footer class="site-footer">\n'
      + '  <div class="page">\n'
      + '    <p>© 2026 Causl contributors · MIT License · State with cause and effect.</p>\n'
      + '    <div class="footer-links">\n'
      + links
      + '    </div>\n'
      + '  </div>\n'
      + '</footer>\n';
  }

  /**
   * Replace `host` (a <div id="footer-host">) with the canonical footer.
   * Safe no-op when host is null.
   */
  function renderFooter(host) {
    if (!host) return;
    var tpl = document.createElement('template');
    tpl.innerHTML = buildFooterHtml().trim();
    var footer = tpl.content.firstElementChild;
    if (footer && host.parentNode) {
      host.parentNode.replaceChild(footer, host);
    }
  }

  // Exposed for topbar.js start() and tests.
  window.renderFooter = renderFooter;
})();
