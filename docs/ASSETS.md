# Assets

Every image, font and sound shipped in the app, with its source and licence. Original art or CC0 only for images;
open-licence fonts only (`CLAUDE.md` §7). Add a row when an asset is added.

| Asset | Used for | Source | Licence | Added |
|---|---|---|---|---|
| KaTeX fonts (`KaTeX_*`, 20 families, woff2/woff/ttf), bundled from `node_modules/katex/dist/fonts` | Rendering math in questions | [KaTeX](https://github.com/KaTeX/KaTeX) 0.19 npm package | MIT (`node_modules/katex/LICENSE`) | 2026-11-04 |
| Nunito (latin subset, weights 400 and 700, woff2/woff), via `@fontsource/nunito` 5.3.0 | Body text | [Nunito](https://github.com/googlefonts/nunito), © 2014 The Nunito Project Authors | SIL OFL 1.1 (`node_modules/@fontsource/nunito/LICENSE`) | 2026-11-05 |
| Grenze (latin subset, weight 600, woff2/woff), via `@fontsource/grenze` 5.3.0 | Headings, timer, answer letters | [Grenze](https://github.com/Omnibus-Type/Grenze), © 2019 The Grenze Project Authors | SIL OFL 1.1 (`node_modules/@fontsource/grenze/LICENSE`) | 2026-11-05 |

Fonts are bundled into the app by Vite and served from our own origin: no request to a font service (owner choice
2026-11-05). Characters outside the latin subset fall back to the system font.
