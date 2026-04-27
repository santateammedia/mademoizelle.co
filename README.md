~~~~
# Mademoizelle.co

The marketing site for **Mademoiselle** — AI hairstyle try-on, smart closet, real salon booking.

## Architecture

- Single-file static site (`index.html`) — zero build step, single HTTP request, ~12KB gzipped.
- Inline CSS (custom-property-driven design system) + ~2KB vanilla JS for interactions.
- Assets are pure SVG. No images, no JS frameworks, no npm.

## Blog

The journal at `/blog/` is **statically generated at build time** by a tiny
Node script. No React, no Next.js, no framework — pure markdown to HTML.

- **Source:** `content/blog/*.md` — frontmatter-driven posts.
- **Templates:** `templates/post.html` (single post) and `templates/blog-index.html` (listing).
- **Generator:** `scripts/build-blog.mjs` — reads sources, renders TOC + markdown,
  writes `blog/<slug>/index.html`, `blog/index.html`, `feed.xml`, `llms.txt`,
  and rewrites `sitemap.xml`.

```bash
npm install
npm run build
```

Output is **not committed** — Vercel runs the build at deploy time.

### Frontmatter (one source of truth)

```yaml
---
title: "..."             # required
description: "..."       # ~155 chars, used for meta description
excerpt: "..."           # ~200 chars, listing card preview
slug: "..."              # required (also derivable from filename)
publishedAt: "2026-04-26" # required, ISO date
updatedAt: "2026-04-27"  # optional
author: "..."
category: "beauty | closet | studio | salons | privacy | editorial"
tags: ["...", "..."]
coverTone: "warm | rose | sage | cream | dusk | plum"
featured: true            # optional, picks the hero spot in /blog/
faq:                      # optional
  - q: "..."
    a: "..."
---
```

### Template placeholders

The build script substitutes these into `templates/post.html`:

`{{title}}`, `{{description}}`, `{{slug}}`, `{{publishedAt}}`,
`{{publishedAtIso}}`, `{{publishedAtFormatted}}`, `{{updatedAtBlock}}`,
`{{readingTime}}`, `{{author}}`, `{{categoryLabel}}`, `{{categorySlug}}`,
`{{categoryTone}}`, `{{tagsHtml}}`, `{{tocHtml}}`, `{{contentHtml}}`,
`{{faqHtml}}`, `{{prevHtml}}`, `{{nextHtml}}`, `{{relatedHtml}}`,
`{{shareUrl}}`, `{{coverHtml}}`, `{{jsonLd}}`.

And into `templates/blog-index.html`:

`{{postsHtml}}`, `{{categoriesHtml}}`, `{{featuredHtml}}`, `{{totalPostCount}}`.

`{{name}}` does HTML-escape; `{{{name}}}` injects raw HTML for the
pre-rendered fields above (TOC, content, cards, etc.).

## Local preview

```bash
# any of these — pick your weapon
python3 -m http.server 4173
# or
npx serve -l 4173
```

Then open http://localhost:4173.

## Deploy

```bash
vercel deploy --prod
# or any static host: drop the directory, you're done.
```

## File map

```
.
├── index.html              # the entire site
├── assets/
│   ├── favicon.svg
│   ├── apple-touch-icon.svg
│   ├── logo-mark.svg
│   ├── logo-wordmark.svg
│   └── og.svg              # OG card; export og.png from this at 1200×630
├── manifest.webmanifest
├── robots.txt
├── sitemap.xml
├── vercel.json             # for Vercel deploys
└── _headers                # for Netlify / Cloudflare Pages
```

## Brand notes

- Coral (#F74F7D) is a moment, not a color — under 3% of any screen.
- Cormorant Garamond italic + Inter. Editorial first.
- Three themes downstream: Light (ivory), Dark, Midnight. The site itself uses Light + a Dark toggle.

## License

© Mademoiselle. All rights reserved.
~~~~
