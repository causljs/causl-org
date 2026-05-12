# causl-org/fonts

Self-hosted WOFF2 brand typefaces for causl.org. Wired up by
`@font-face` rules at the top of `../css/site.css` and preloaded
from `../index.html`. See issue #1262.

## Inventory

| File                          | Family        | Weight | Source                                                                                                                              |
| ----------------------------- | ------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `Inter-Regular.woff2`         | Inter         | 400    | <https://rsms.me/inter/font-files/Inter-Regular.woff2>                                                                              |
| `Inter-Medium.woff2`          | Inter         | 500    | <https://rsms.me/inter/font-files/Inter-Medium.woff2>                                                                               |
| `Inter-SemiBold.woff2`        | Inter         | 600    | <https://rsms.me/inter/font-files/Inter-SemiBold.woff2>                                                                             |
| `Inter-Bold.woff2`            | Inter         | 700    | <https://rsms.me/inter/font-files/Inter-Bold.woff2>                                                                                 |
| `Inter-Black.woff2`           | Inter         | 800–900| <https://rsms.me/inter/font-files/Inter-Black.woff2>                                                                                |
| `IBMPlexMono-Regular.woff2`   | IBM Plex Mono | 400    | <https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/split/woff2/IBMPlexMono-Regular-Latin1.woff2>            |
| `IBMPlexMono-Medium.woff2`    | IBM Plex Mono | 500    | <https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/split/woff2/IBMPlexMono-Medium-Latin1.woff2>             |
| `IBMPlexMono-Bold.woff2`      | IBM Plex Mono | 700    | <https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/split/woff2/IBMPlexMono-Bold-Latin1.woff2>               |

The IBM Plex Mono files are the `*-Latin1` split-subset variants
(~16-17 KB each). The Inter files from rsms.me are the standard
Latin distribution (~108-112 KB each); rsms does not publish a
smaller pre-subset.

## Refreshing

To re-fetch all eight files into this directory:

```sh
cd causl-org/fonts
for w in Regular Medium SemiBold Bold Black; do
  curl -fsSL -o "Inter-$w.woff2" \
    "https://rsms.me/inter/font-files/Inter-$w.woff2"
done
for w in Regular Medium Bold; do
  curl -fsSL -o "IBMPlexMono-$w.woff2" \
    "https://raw.githubusercontent.com/IBM/plex/master/packages/plex-mono/fonts/split/woff2/IBMPlexMono-$w-Latin1.woff2"
done
```

## Licenses

- Inter: SIL Open Font License 1.1 — <https://github.com/rsms/inter/blob/master/LICENSE.txt>
- IBM Plex Mono: SIL Open Font License 1.1 — <https://github.com/IBM/plex/blob/master/LICENSE.txt>
