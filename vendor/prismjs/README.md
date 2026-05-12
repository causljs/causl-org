# Prism.js (vendored)

Static, vendored syntax-highlighter assets shipped with the causl-org site
to avoid runtime CDN dependencies and keep the highlighter in source control.

## Version

- **Prism**: 1.30.0
- **Source**: https://github.com/PrismJS/prism (npm package
  [`prismjs`](https://www.npmjs.com/package/prismjs))
- **Downloaded from**: `https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/<name>.min.js`
- **License**: MIT — © 2012 Lea Verou

## Files

| File | Purpose |
| --- | --- |
| `prism-core.min.js` | Core highlighter (required, must load first) |
| `prism-markup.min.js` | HTML / XML / SVG |
| `prism-css.min.js` | CSS |
| `prism-clike.min.js` | Shared base for C-family languages (required by js/ts/jsx/tsx) |
| `prism-javascript.min.js` | JavaScript |
| `prism-typescript.min.js` | TypeScript |
| `prism-jsx.min.js` | JSX |
| `prism-tsx.min.js` | TSX |
| `prism-bash.min.js` | Shell / Bash |
| `prism-rust.min.js` | Rust |
| `prism-json.min.js` | JSON |

## Refreshing

```bash
cd causl-org/vendor/prismjs
for f in prism-core prism-markup prism-css prism-clike prism-javascript \
         prism-typescript prism-jsx prism-tsx prism-bash prism-rust prism-json; do
  curl -fsSL "https://cdn.jsdelivr.net/npm/prismjs@1.30.0/components/${f}.min.js" \
    -o "${f}.min.js"
done
```

## Theme

The visual theme lives in `causl-org/css/syntax.css` and is authored against
the pair tokens defined in `causl-org/css/site.css` (#1268). It does not use
any of Prism's bundled themes — Prism is loaded "naked" and the token classes
are styled from scratch using `--surface-elevated`, `--text-on-elevated-*`,
and the brand accent tokens (`--causl-commit-green`, `--causl-conflict-amber`,
`--causl-async-cyan`, `--causl-mutation-violet`).
