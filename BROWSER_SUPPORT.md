# causl.org — Browser support baseline

## Minimum versions

| Browser            | Minimum     | Released  |
| ------------------ | ----------- | --------- |
| Safari (macOS/iOS) | **16.4**    | 2023-03   |
| Chrome / Edge      | **105**     | 2022-08   |
| Firefox            | **121**     | 2023-12   |

The baseline is the highest version required by *any* feature
listed below; the table picks the floor at which every feature
on this page is supported natively, without polyfills.

## Required features

| Feature                                  | Why we use it                                                                                                       | Floor       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- |
| `<script type="importmap">`              | Aliases bare specifiers (`@causl/core`) to the vendored ESM build under `vendor/@causl/*/index.js`, with esm.sh fallback. | Safari 16.4, Chrome 89, Firefox 108 |
| CSS `:has()` selector                    | `body:has(.topbar.collapsed)` reserves the sticky-bar offset, without JS-driven body class.                          | Safari 15.4, Chrome 105, Firefox 121 |
| ESM with `import()` + dynamic chunks     | The playground and spreadsheet pages dynamically `import()` `@causl/*` and React 19 from the vendored ESM modules.   | Universal in baseline |
| `backdrop-filter` (with `-webkit-` prefix) | Topbar blur backdrop. The `-webkit-` prefix lands the same effect on Safari 9–15.                                   | Safari 9 (prefixed), Chrome 76, Firefox 103 |
| `prefers-reduced-motion`                 | Disables the scroll-driven hero collapse for users who opted out of motion.                                          | Universal in baseline |
| `prefers-color-scheme`                   | Initial theme detection when the user hasn't pinned a preference.                                                   | Universal in baseline |
| CSS custom properties (variables)        | The token system in `css/site.css` — every colour, radius, and font lives here.                                       | Universal in baseline |
| CSS `clamp()`                            | Responsive type scale on headings.                                                                                  | Universal in baseline |

## What we do NOT need

* No transpilation: every page ships as raw HTML + CSS + ES2022 JS.
* No bundler: the importmap + vendored ESM provide the same shape an adopter installs from npm.
* No CSS preprocessor: tokens cover the design system; everything else is plain CSS.

## What breaks below baseline

| Below-baseline browser | What breaks                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| Safari < 16.4          | Importmap is ignored; playground + spreadsheet fall back to esm.sh URLs (which still work).                  |
| Safari < 15.4 / Firefox < 121 | `body:has(.topbar.collapsed)` does nothing — the sticky bar still works but a 3.6rem offset is missing under the collapsed bar. Visual only. |
| Chrome < 105           | Same as Safari < 15.4 (no `:has()`).                                                                          |
| Anything ≤ ES5         | Pages fail to execute the topbar JS (uses `var` only, but `Array.prototype.forEach` and `Map` are required).  |

## Updating the baseline

If a new feature lifts the floor (e.g. CSS `@container` or
`@scope`), bump the minimums and the floor row above. Don't
add polyfills — if a feature isn't in the baseline, don't use it.
