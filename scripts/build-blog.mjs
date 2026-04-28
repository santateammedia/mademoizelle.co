#!/usr/bin/env node
// Mademoiselle blog static-site generator.
// Reads content/blog/*.md, renders blog/<slug>/index.html, blog/index.html,
// feed.xml, llms.txt, and rewrites sitemap.xml.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import readingTime from 'reading-time';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const CONTENT_DIR = `${ROOT}/content/blog`;
const TEMPLATE_DIR = `${ROOT}/templates`;
const DIST = `${ROOT}/dist`;
const OUT_DIR = `${DIST}/blog`;
// Static files / dirs at repo root that should land in dist/ verbatim.
const STATIC_FILES = ['index.html', 'manifest.webmanifest', 'robots.txt', 'humans.txt', '_headers'];
const STATIC_DIRS = ['assets'];
const SITE_URL = 'https://mademoizelle.co';
const SITE_NAME = 'Mademoiselle';
const SITE_TAGLINE = 'Editorial voice notes from the team building Mademoiselle, an AI beauty companion.';
const TODAY = '2026-04-28';

const CATEGORIES = {
  beauty:    { label: 'Beauty Intelligence', tone: 'rose'  },
  closet:    { label: 'Smart Closet',        tone: 'sage'  },
  studio:    { label: 'Studio Notes',        tone: 'warm'  },
  salons:    { label: 'Salon Stories',       tone: 'cream' },
  privacy:   { label: 'Privacy & Trust',     tone: 'dusk'  },
  editorial: { label: 'Editorial',           tone: 'plum'  },
};

const startedAt = Date.now();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function stripEmojis(s) {
  if (!s) return s;
  // Strip common emoji ranges (BMP + supplementary).
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, '');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function dedupeId(id, seen) {
  let candidate = id || 'section';
  let i = 2;
  while (seen.has(candidate)) {
    candidate = `${id}-${i}`;
    i++;
  }
  seen.add(candidate);
  return candidate;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function toIsoString(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString();
}

function toRfc822(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toUTCString();
}

// Read all posts ------------------------------------------------------------

function readAllPosts() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`! content directory missing: ${CONTENT_DIR}`);
    return [];
  }
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const filePath = `${CONTENT_DIR}/${file}`;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    if (!data.title || !data.publishedAt) {
      console.warn(`! skipping ${file} (missing title/publishedAt)`);
      continue;
    }
    const slug = data.slug || file.replace(/\.md$/, '');
    posts.push({
      ...data,
      slug,
      title: stripEmojis(data.title),
      description: stripEmojis(data.description || data.excerpt || ''),
      excerpt: stripEmojis(data.excerpt || data.description || ''),
      author: stripEmojis(data.author || 'Mademoiselle'),
      tags: Array.isArray(data.tags) ? data.tags : [],
      category: data.category || 'editorial',
      coverTone: data.coverTone || (CATEGORIES[data.category]?.tone) || 'warm',
      featured: !!data.featured,
      faq: Array.isArray(data.faq) ? data.faq : [],
      content,
      filePath,
    });
  }
  posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return posts;
}

// TOC extraction ------------------------------------------------------------

function extractToc(content) {
  const toc = [];
  const seen = new Set();
  const lines = content.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const h2 = line.match(/^##\s+(.+?)\s*#*\s*$/);
    const h3 = line.match(/^###\s+(.+?)\s*#*\s*$/);
    if (h2) {
      const text = h2[1].trim();
      const id = dedupeId(slugify(text), seen);
      toc.push({ level: 2, text, id });
    } else if (h3) {
      const text = h3[1].trim();
      const id = dedupeId(slugify(text), seen);
      toc.push({ level: 3, text, id });
    }
  }
  return toc;
}

function tocToHtml(toc) {
  if (!toc.length) return '';
  let html = '<nav class="post-toc" aria-label="Table of contents"><p class="post-toc-label">On this page</p><ol class="post-toc-list">';
  let openLevel = 0;
  for (const item of toc) {
    if (item.level === 2) {
      if (openLevel === 3) {
        html += '</ol></li>';
        openLevel = 2;
      }
      if (openLevel === 0) openLevel = 2;
      html += `<li class="post-toc-item post-toc-item-2"><a href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a>`;
    } else if (item.level === 3) {
      if (openLevel !== 3) {
        html += '<ol class="post-toc-sublist">';
        openLevel = 3;
      }
      html += `<li class="post-toc-item post-toc-item-3"><a href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a></li>`;
    }
  }
  if (openLevel === 3) html += '</ol></li>';
  else if (openLevel === 2) html += '</li>';
  html += '</ol></nav>';
  return html;
}

// Markdown rendering --------------------------------------------------------

function buildRenderer(toc) {
  // Map heading text -> queue of ids (in order) so we attach correctly even with dupes.
  const headingQueues = new Map();
  for (const item of toc) {
    if (!headingQueues.has(item.text)) headingQueues.set(item.text, []);
    headingQueues.get(item.text).push(item.id);
  }

  const renderer = new marked.Renderer();

  renderer.heading = function ({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    // Reconstruct the plain text for matching.
    const plain = tokensToPlainText(tokens).trim();
    if (depth === 2 || depth === 3) {
      const queue = headingQueues.get(plain);
      const id = queue && queue.length ? queue.shift() : slugify(plain);
      return `<h${depth} id="${escapeAttr(id)}" class="post-h${depth}"><a class="post-anchor" href="#${escapeAttr(id)}" aria-hidden="true">#</a>${inner}</h${depth}>\n`;
    }
    return `<h${depth} class="post-h${depth}">${inner}</h${depth}>\n`;
  };

  renderer.table = function (token) {
    let header = '';
    for (let j = 0; j < token.header.length; j++) {
      header += this.tablecell(token.header[j]);
    }
    let body = '';
    for (const row of token.rows) {
      let cell = '';
      for (let j = 0; j < row.length; j++) {
        cell += this.tablecell(row[j]);
      }
      body += this.tablerow({ text: cell });
    }
    return `<div class="prose-table-wrap"><table class="prose-table"><thead>${this.tablerow({ text: header })}</thead><tbody>${body}</tbody></table></div>\n`;
  };

  renderer.image = function ({ href, title, text }) {
    const alt = stripEmojis(text || '');
    const t = title ? ` title="${escapeAttr(title)}"` : '';
    return `<img src="${escapeAttr(href)}" alt="${escapeAttr(alt)}"${t} loading="lazy" decoding="async">`;
  };

  renderer.code = function ({ text, lang }) {
    const langString = (lang || '').match(/^\S*/)?.[0] || '';
    const langClass = langString ? ` class="language-${escapeAttr(langString)}"` : '';
    const body = text.replace(/\n$/, '') + '\n';
    return `<div class="prose-codeblock"><pre><code${langClass}>${escapeHtml(body)}</code></pre></div>\n`;
  };

  renderer.blockquote = function ({ tokens }) {
    const inner = this.parser.parse(tokens);
    // Detect callout marker. `inner` is already rendered HTML.
    const match = inner.match(/^<p>\s*\[!(note|warning|ai)\]\s*([\s\S]*?)<\/p>\s*([\s\S]*)$/i);
    if (match) {
      const type = match[1].toLowerCase();
      const firstPara = match[2].trim();
      const rest = match[3].trim();
      const labelMap = { note: 'Note', warning: 'Warning', ai: 'From the AI' };
      const label = labelMap[type];
      let body = '';
      if (firstPara) body += `<p>${firstPara}</p>`;
      if (rest) body += rest;
      return `<aside class="callout callout-${type}"><strong class="callout-label">${label}</strong>${body}</aside>\n`;
    }
    return `<blockquote class="prose-blockquote">\n${inner}</blockquote>\n`;
  };

  return renderer;
}

function tokensToPlainText(tokens) {
  if (!Array.isArray(tokens)) return '';
  let out = '';
  for (const t of tokens) {
    if (t.text) out += t.text;
    else if (t.tokens) out += tokensToPlainText(t.tokens);
    else if (t.raw) out += t.raw;
  }
  return out;
}

function renderMarkdown(content, toc) {
  const renderer = buildRenderer(toc);
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(content, { renderer });
}

// Tag/category/related ------------------------------------------------------

function tagsHtml(tags) {
  if (!tags || !tags.length) return '';
  return tags
    .map((t) => `<a class="post-tag" href="/blog/?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
    .join(' ');
}

function relatedPosts(post, all, n = 3) {
  const others = all.filter((p) => p.slug !== post.slug);
  const scored = others.map((p) => {
    let score = 0;
    if (p.category === post.category) score += 2;
    const shared = (p.tags || []).filter((t) => (post.tags || []).includes(t));
    score += shared.length;
    return { post: p, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n).map((s) => s.post);
}

function relatedHtml(list) {
  if (!list.length) return '';
  const cards = list.map((p) => {
    const cat = CATEGORIES[p.category] || { label: 'Editorial', tone: 'plum' };
    return `<a class="related-card" href="/blog/${escapeAttr(p.slug)}/">
      <span class="related-card-tone tone-${escapeAttr(cat.tone)}" aria-hidden="true"></span>
      <span class="related-card-cat">${escapeHtml(cat.label)}</span>
      <h3 class="related-card-title">${escapeHtml(p.title)}</h3>
      <p class="related-card-excerpt">${escapeHtml(p.excerpt || p.description || '')}</p>
    </a>`;
  }).join('\n');
  return `<section class="related-grid" aria-label="Related reading"><h2 class="related-heading">Related reading</h2><div class="related-cards">${cards}</div></section>`;
}

function faqHtml(faq) {
  if (!faq || !faq.length) return '';
  const items = faq.map((qa) => `
    <details class="faq-item">
      <summary class="faq-q">${escapeHtml(qa.q)}</summary>
      <div class="faq-a"><p>${escapeHtml(qa.a)}</p></div>
    </details>`).join('');
  return `<section class="post-faq" aria-label="Frequently asked"><h2 class="post-faq-heading">Frequently asked</h2>${items}</section>`;
}

function prevNextHtml(post, all) {
  const i = all.findIndex((p) => p.slug === post.slug);
  const newer = i > 0 ? all[i - 1] : null;
  const older = i < all.length - 1 ? all[i + 1] : null;
  const prevHtml = older
    ? `<a class="post-pager post-pager-prev" href="/blog/${escapeAttr(older.slug)}/"><span class="post-pager-label">Older</span><span class="post-pager-title">${escapeHtml(older.title)}</span></a>`
    : '';
  const nextHtml = newer
    ? `<a class="post-pager post-pager-next" href="/blog/${escapeAttr(newer.slug)}/"><span class="post-pager-label">Newer</span><span class="post-pager-title">${escapeHtml(newer.title)}</span></a>`
    : '';
  return { prevHtml, nextHtml };
}

function coverHtml(post) {
  const cat = CATEGORIES[post.category] || { tone: post.coverTone };
  const tone = post.coverTone || cat.tone || 'warm';
  if (post.coverImage) {
    return `<figure class="post-cover post-cover-image"><img src="${escapeAttr(post.coverImage)}" alt="${escapeAttr(post.title)}" loading="eager" decoding="async"></figure>`;
  }
  return `<div class="post-cover post-cover-tone tone-${escapeAttr(tone)}" aria-hidden="true"></div>`;
}

function articleJsonLd(post) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: toIsoString(post.publishedAt),
    dateModified: toIsoString(post.updatedAt || post.publishedAt),
    author: { '@type': 'Person', name: post.author },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${post.slug}/` },
    image: post.coverImage ? `${SITE_URL}${post.coverImage}` : `${SITE_URL}/assets/og.svg`,
  };
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

// Template substitution -----------------------------------------------------

// Names that should be substituted RAW even when written with double braces,
// e.g. JSON-LD literals that include their own quoting.
const RAW_DOUBLE_BRACE_KEYS = new Set([
  'titleJson', 'descriptionJson', 'authorJson', 'shareUrlJson',
  'publishedAtIsoJson', 'categoryLabelJson',
]);

function render(template, vars) {
  let out = template;
  // Triple braces: raw substitution.
  out = out.replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined || v === null ? '' : String(v);
  });
  // Double braces: escaped substitution (except for the raw whitelist).
  out = out.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    if (v === undefined || v === null) return '';
    if (RAW_DOUBLE_BRACE_KEYS.has(name) || name.endsWith('Json')) {
      return String(v);
    }
    return escapeHtml(String(v));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  const size = Buffer.byteLength(content, 'utf-8');
  const kb = size < 1024 ? `${size}B` : `${(size / 1024).toFixed(1)}KB`;
  const rel = filePath.replace(`${ROOT}/`, '');
  console.log(`  -> wrote ${rel} (${kb})`);
}

function loadTemplate(name) {
  const p = `${TEMPLATE_DIR}/${name}`;
  if (!fs.existsSync(p)) {
    console.error(`! template missing: templates/${name} — skipping (other agent may not have finished)`);
    return null;
  }
  return fs.readFileSync(p, 'utf-8');
}

function buildPostVars(post, all) {
  const cat = CATEGORIES[post.category] || { label: 'Editorial', tone: 'plum' };
  const toc = extractToc(post.content);
  const contentHtml = renderMarkdown(post.content, toc);
  const rt = readingTime(post.content);
  const minutes = Math.max(1, Math.round(rt.minutes));
  const updatedBlock = post.updatedAt
    ? `<span class="post-updated">Updated <time datetime="${escapeAttr(toIsoString(post.updatedAt))}">${escapeHtml(formatDate(post.updatedAt))}</time></span>`
    : '';
  const { prevHtml, nextHtml } = prevNextHtml(post, all);
  const related = relatedPosts(post, all, 3);
  const shareUrl = `${SITE_URL}/blog/${post.slug}/`;
  const jsonLd = articleJsonLd(post);
  const publishedAtIso = toIsoString(post.publishedAt);

  return {
    title: post.title,
    description: post.description,
    slug: post.slug,
    publishedAt: post.publishedAt,
    publishedAtIso,
    publishedAtFormatted: formatDate(post.publishedAt),
    updatedAtBlock: updatedBlock,
    readingTime: `${minutes} min read`,
    author: post.author,
    categoryLabel: cat.label,
    categorySlug: post.category,
    categoryTone: cat.tone,
    tagsHtml: tagsHtml(post.tags),
    tocHtml: tocToHtml(toc),
    contentHtml,
    faqHtml: faqHtml(post.faq),
    prevHtml,
    nextHtml,
    relatedHtml: relatedHtml(related),
    shareUrl,
    coverHtml: coverHtml(post),
    jsonLd,
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    canonical: shareUrl,
    ogImage: post.coverImage ? `${SITE_URL}${post.coverImage}` : `${SITE_URL}/assets/og.svg`,
    // Pre-JSON-encoded values for the JSON-LD block (include surrounding quotes).
    titleJson: JSON.stringify(post.title),
    descriptionJson: JSON.stringify(post.description),
    authorJson: JSON.stringify(post.author),
    shareUrlJson: JSON.stringify(shareUrl),
    publishedAtIsoJson: JSON.stringify(publishedAtIso),
    categoryLabelJson: JSON.stringify(cat.label),
  };
}

function renderPost(post, all, postTemplate) {
  const vars = buildPostVars(post, all);
  return render(postTemplate, vars);
}

function postCard(post) {
  const cat = CATEGORIES[post.category] || { label: 'Editorial', tone: 'plum' };
  return `<a class="post-card tone-${escapeAttr(cat.tone)}" data-category="${escapeAttr(post.category)}" href="/blog/${escapeAttr(post.slug)}/">
    <span class="post-card-cat">${escapeHtml(cat.label)}</span>
    <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
    <p class="post-card-excerpt">${escapeHtml(post.excerpt || post.description || '')}</p>
    <span class="post-card-meta">
      <time datetime="${escapeAttr(toIsoString(post.publishedAt))}">${escapeHtml(formatDate(post.publishedAt))}</time>
      <span class="post-card-author">${escapeHtml(post.author)}</span>
    </span>
  </a>`;
}

function categoriesStripHtml(posts) {
  const counts = {};
  for (const p of posts) counts[p.category] = (counts[p.category] || 0) + 1;
  const allChip = `<a class="cat-chip" data-category="all" data-active="true" aria-selected="true" href="/blog/">All <span class="cat-chip-count">${posts.length}</span></a>`;
  const chips = Object.entries(CATEGORIES)
    .filter(([slug]) => counts[slug])
    .map(([slug, c]) =>
      `<a class="cat-chip tone-${escapeAttr(c.tone)}" data-category="${escapeAttr(slug)}" data-active="false" aria-selected="false" href="/blog/?category=${encodeURIComponent(slug)}">${escapeHtml(c.label)} <span class="cat-chip-count">${counts[slug]}</span></a>`
    );
  return [allChip, ...chips].join(' ');
}

function featuredHtml(posts) {
  const f = posts.find((p) => p.featured);
  if (!f) return '';
  const cat = CATEGORIES[f.category] || { label: 'Editorial', tone: 'plum' };
  return `<a class="featured-card tone-${escapeAttr(cat.tone)}" href="/blog/${escapeAttr(f.slug)}/">
    <span class="featured-flag">Featured</span>
    <span class="featured-cat">${escapeHtml(cat.label)}</span>
    <h2 class="featured-title">${escapeHtml(f.title)}</h2>
    <p class="featured-excerpt">${escapeHtml(f.excerpt || f.description || '')}</p>
    <span class="featured-meta">
      <time datetime="${escapeAttr(toIsoString(f.publishedAt))}">${escapeHtml(formatDate(f.publishedAt))}</time>
      <span>${escapeHtml(f.author)}</span>
    </span>
  </a>`;
}

function renderIndex(posts, indexTemplate) {
  const cardPosts = posts.filter((p) => !p.featured);
  const cards = (cardPosts.length ? cardPosts : posts).map(postCard).join('\n');
  const vars = {
    postsHtml: cards,
    categoriesHtml: categoriesStripHtml(posts),
    featuredHtml: featuredHtml(posts),
    totalPostCount: posts.length,
    siteUrl: SITE_URL,
    siteName: SITE_NAME,
    canonical: `${SITE_URL}/blog/`,
  };
  return render(indexTemplate, vars);
}

// Generators ----------------------------------------------------------------

function generateFeed(posts) {
  const items = posts.slice(0, 20).map((p) => {
    const link = `${SITE_URL}/blog/${p.slug}/`;
    return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
      <description>${escapeHtml(p.description || p.excerpt || '')}</description>
      <pubDate>${toRfc822(p.publishedAt)}</pubDate>
      <author>${escapeHtml(p.author)}</author>
      <category>${escapeHtml((CATEGORIES[p.category]?.label) || p.category)}</category>
    </item>`;
  }).join('\n');
  const lastBuild = toRfc822(new Date().toISOString());
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(SITE_NAME)} — Journal</title>
    <link>${escapeHtml(SITE_URL + '/blog/')}</link>
    <atom:link href="${escapeHtml(SITE_URL + '/feed.xml')}" rel="self" type="application/rss+xml" />
    <description>${escapeHtml(SITE_TAGLINE)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function generateLlmsTxt(posts) {
  const lines = [];
  lines.push(`# ${SITE_NAME} — Journal`);
  lines.push('');
  lines.push(SITE_TAGLINE);
  lines.push('');
  lines.push('## Posts');
  lines.push('');
  for (const p of posts) {
    const desc = (p.description || p.excerpt || '').replace(/\s+/g, ' ').trim();
    lines.push(`- /blog/${p.slug}/ — ${p.title} (${p.publishedAt}) — ${desc}`);
  }
  lines.push('');
  lines.push('## About');
  lines.push('');
  lines.push('Mademoiselle is an AI beauty companion: try on hairstyles, build a smart closet, and book real salons. The Journal collects studio notes, design thinking, and editorial guides from the team building it. Voice is editorial, soft, MENA-aware. No third-party trackers in the studio flow.');
  lines.push('');
  return lines.join('\n');
}

function generateSitemap(posts) {
  const urls = [];
  urls.push({ loc: `${SITE_URL}/`, lastmod: TODAY, changefreq: 'monthly', priority: '1.0' });
  urls.push({ loc: `${SITE_URL}/blog/`, lastmod: TODAY, changefreq: 'weekly', priority: '0.8' });
  for (const p of posts) {
    const lastmod = (p.updatedAt || p.publishedAt || TODAY).slice(0, 10);
    urls.push({
      loc: `${SITE_URL}/blog/${p.slug}/`,
      lastmod,
      changefreq: 'monthly',
      priority: p.featured ? '0.7' : '0.6',
    });
  }
  const body = urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  console.log(`Mademoiselle blog build — ${new Date().toISOString()}`);

  // Reset dist/
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Copy static files + dirs from repo root into dist/
  for (const f of STATIC_FILES) {
    const src = `${ROOT}/${f}`;
    if (fs.existsSync(src)) fs.copyFileSync(src, `${DIST}/${f}`);
  }
  for (const d of STATIC_DIRS) {
    const src = `${ROOT}/${d}`;
    if (fs.existsSync(src)) fs.cpSync(src, `${DIST}/${d}`, { recursive: true });
  }
  console.log(`  copied static files -> dist/`);

  const posts = readAllPosts();
  if (!posts.length) {
    console.error('! no posts found in content/blog/');
    process.exit(1);
  }
  console.log(`  read ${posts.length} posts from content/blog/`);

  const postTemplate = loadTemplate('post.html');
  const indexTemplate = loadTemplate('blog-index.html');

  let postsBuilt = 0;
  if (postTemplate) {
    for (const post of posts) {
      const html = renderPost(post, posts, postTemplate);
      writeFile(`${OUT_DIR}/${post.slug}/index.html`, html);
      postsBuilt++;
    }
  } else {
    console.warn('! skipped per-post HTML generation (no post.html template).');
  }

  if (indexTemplate) {
    const indexHtml = renderIndex(posts, indexTemplate);
    writeFile(`${OUT_DIR}/index.html`, indexHtml);
  } else {
    console.warn('! skipped blog index generation (no blog-index.html template).');
  }

  writeFile(`${DIST}/feed.xml`, generateFeed(posts));
  writeFile(`${DIST}/llms.txt`, generateLlmsTxt(posts));
  writeFile(`${DIST}/sitemap.xml`, generateSitemap(posts));

  const elapsed = Date.now() - startedAt;
  console.log(`Built ${postsBuilt} posts in ${elapsed}ms`);
}

main();
