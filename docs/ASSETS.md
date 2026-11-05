# Assets

Every image, font and sound shipped in the app, with its source and licence. Original art or CC0 only for images;
open-licence fonts only (`CLAUDE.md` §7). Add a row when an asset is added.

| Asset | Used for | Source | Licence | Added |
|---|---|---|---|---|
| KaTeX fonts (`KaTeX_*`, 20 families, woff2/woff/ttf), bundled from `node_modules/katex/dist/fonts` | Rendering math in questions | [KaTeX](https://github.com/KaTeX/KaTeX) 0.19 npm package | MIT (`node_modules/katex/LICENSE`) | 2026-11-04 |
| Nunito (latin subset, weights 400 and 700, woff2/woff), via `@fontsource/nunito` 5.3.0 | Body text | [Nunito](https://github.com/googlefonts/nunito), © 2014 The Nunito Project Authors | SIL OFL 1.1 (`node_modules/@fontsource/nunito/LICENSE`) | 2026-11-05 |
| Grenze (latin subset, weight 600, woff2/woff), via `@fontsource/grenze` 5.3.0 | Headings, timer, answer letters | [Grenze](https://github.com/Omnibus-Type/Grenze), © 2019 The Grenze Project Authors | SIL OFL 1.1 (`node_modules/@fontsource/grenze/LICENSE`) | 2026-11-05 |
| `public/art/hoot.svg` | Professor Hoot, the coach | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png` | App icons (install, home screen) | Rendered from `public/art/hoot.svg` on `#fffaf0` (Task 23); the maskable one keeps Hoot in the middle 60% | Project's own | 2026-11-05 |
| `public/art/crest-owlcrest.svg` | Owlcrest house crest (owl, teal) | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/art/crest-emberwing.svg` | Emberwing house crest (dragon, orange) | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/art/crest-foxglen.svg` | Foxglen house crest (fox, moss green) | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/art/crest-starhorn.svg` | Starhorn house crest (unicorn, lavender) | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/art/castle-map.svg` | Castle map with the six towers (Gate, Clock, Hourglass, Shadow, Mist, Rising) | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/art/potion.svg` | Potion practice | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |
| `public/art/spellbook.svg` | Spellbook chapters | Original SVG drawn for this app (Task 20) | Project's own | 2026-11-05 |

Fonts are bundled into the app by Vite and served from our own origin: no request to a font service (owner choice
2026-11-05). Characters outside the latin subset fall back to the system font.

**Art rules (Task 20).** Crests are round medallions, never heraldic shields, and the house colours avoid the
franchise pairs (red/gold, green/silver, blue/bronze, yellow/black). No lettering inside the art, so no font travels
with it. `tests/unit/art.test.ts` checks that every SVG has a row here, a title for screen readers, no script, links or
embedded images, and stays under 12 KB. Review sheet: open `docs/art-sheet.html` in a browser.

