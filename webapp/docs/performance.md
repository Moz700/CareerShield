# Performance

Lighthouse 12.8.2 on the production build, served by `vite preview` under the GitHub Pages sub-path
(`/CareerShield/`, gzip on), with Playwright's Chromium. Mobile uses Lighthouse's default mobile
profile (simulated slow 4G and 4x CPU slowdown); desktop uses `--preset=desktop`. Each value is the
median of three runs on a fresh profile, so pages that need an occupation (Moves) show their empty
state. JS and Total are kilobytes transferred (gzip), including the data, which ships as JS chunks.

Reproduce with `npm run build && node scripts/perf.cjs` (see the header of the script).

## Baseline (version 2.1.0, before this pass)

| Form | Page | Perf | A11y | BP | SEO | LCP (s) | TBT (ms) | CLS | JS (KB) | Total (KB) |
|---|---|---|---|---|---|---|---|---|---|---|
| mobile | Home | 72 | 92 | 100 | 100 | 4.0 | 548 | 0.000 | 407 | 478 |
| mobile | Analyse | 44 | 100 | 100 | 100 | 6.1 | 5918 | 0.090 | 858 | 929 |
| mobile | Moves | 64 | 100 | 100 | 100 | 4.1 | 160 | 0.425 | 428 | 499 |
| mobile | Atlas | 80 | 100 | 100 | 100 | 4.1 | 264 | 0.000 | 426 | 497 |
| mobile | Evidence | 70 | 92 | 100 | 100 | 4.2 | 549 | 0.000 | 427 | 498 |
| desktop | Home | 99 | 92 | 100 | 100 | 0.9 | 57 | 0.000 | 407 | 478 |
| desktop | Analyse | 68 | 100 | 100 | 100 | 1.2 | 1387 | 0.026 | 858 | 929 |
| desktop | Moves | 99 | 100 | 100 | 100 | 0.9 | 0 | 0.026 | 428 | 499 |
| desktop | Atlas | 99 | 100 | 100 | 100 | 0.8 | 9 | 0.015 | 426 | 497 |
| desktop | Evidence | 96 | 92 | 100 | 100 | 0.8 | 1 | 0.118 | 427 | 498 |

What the baseline showed:

- **Analyse** downloaded the title-matching data (1.8 MB raw, 449 KB gzip) before the page could
  render, then built the TF-IDF index on the main thread 250 ms after opening: about 6 s of blocked
  main thread on a mid-range phone.
- **LCP** on every page was late because the headings faded in from transparent, and on the data
  pages because nothing but grey placeholders painted until all core data had arrived.
- **Home** kept the main thread busy with the hero canvas, which redrew 700 dots one by one on every
  frame, forever, even when scrolled out of view.
- **CLS** on Moves (empty state) came from the footer jumping up when the tall placeholder was
  replaced by a short page; on Evidence from bars that grew leftwards and from the font swap.
- **Accessibility**: the language button's accessible name did not contain its visible text, and two
  ordered lists had animation wrappers between `<ol>` and `<li>`.
