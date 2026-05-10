#!/usr/bin/env node
// Mademoiselle blog static-site generator — trilingual (EN/AR/FR) edition.
// Reads content/blog/<locale>/*.md (or flat content/blog/*.md treated as `en`),
// renders blog/<slug>/index.html (en), <locale>/blog/<slug>/index.html (ar/fr),
// feed.xml + llms.txt per locale, and a multi-locale sitemap.xml with
// hreflang alternates declared as xhtml:link entries (Google's preferred form).

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
// Static files / dirs at repo root that should land in dist/ verbatim.
const STATIC_FILES = ['index.html', 'manifest.webmanifest', 'robots.txt', 'humans.txt', '_headers'];
const STATIC_DIRS = ['assets'];
const SITE_URL = 'https://mademoizelle.co';
const SITE_NAME = 'Mademoiselle';
const TODAY = new Date().toISOString().slice(0, 10);

// Locales -------------------------------------------------------------------
// `en` is the default (canonical, no path prefix). Adding a locale here +
// content/blog/<code>/ posts is enough to ship that language.
const LOCALES = ['en', 'ar', 'fr'];
const DEFAULT_LOCALE = 'en';
const RTL_LOCALES = new Set(['ar']);

// BCP-47 codes used in <html lang>, hreflang, and JSON-LD.
const BCP47 = { en: 'en', ar: 'ar', fr: 'fr' };

// Categories per locale.
const CATEGORIES = {
  beauty:    { tone: 'rose',  en: 'Beauty Intelligence', ar: 'ذكاء الجمال',          fr: 'Intelligence beauté'      },
  closet:    { tone: 'sage',  en: 'Smart Closet',        ar: 'الخزانة الذكية',        fr: 'Garde-robe intelligente'  },
  studio:    { tone: 'warm',  en: 'Studio Notes',        ar: 'ملاحظات الاستوديو',     fr: 'Notes de studio'          },
  salons:    { tone: 'cream', en: 'Salon Stories',       ar: 'قصص الصالونات',         fr: 'Histoires de salons'      },
  privacy:   { tone: 'dusk',  en: 'Privacy & Trust',     ar: 'الخصوصية والثقة',       fr: 'Confidentialité'          },
  editorial: { tone: 'plum',  en: 'Editorial',           ar: 'تحريري',                fr: 'Éditorial'                },
};

// Localized UI strings used by templates + generated HTML.
const I18N = {
  en: {
    siteTagline: 'Editorial voice notes from the team building Mademoiselle, an AI beauty companion.',
    journalTitle: 'The Journal',
    home: 'Home', journal: 'Journal', plans: 'Plans', cta: 'Get the App',
    onThisPage: 'On this page', share: 'Share', writtenBy: 'Written by',
    minRead: 'min read', updated: 'Updated',
    faqHeading: 'Frequently asked', relatedHeading: 'Keep reading', relatedEyebrow: 'More from the Journal',
    olderLabel: 'Older', newerLabel: 'Newer',
    closingEyebrow: 'Try it yourself', closingTitle: 'Now go see yourself in something new.', closingCta: 'Open Mademoiselle',
    breadcrumbHome: 'Home', breadcrumbJournal: 'Journal',
    languageSwitcher: 'Language', languageNames: { en: 'English', ar: 'العربية', fr: 'Français' },
    explore: 'Explore', company: 'Company', allRights: 'All rights reserved.', madeFor: 'Made with care for MENA.',
    aboutAuthor: 'Writing for the Mademoiselle Journal — beauty intelligence, MENA-first, with care.',
  },
  ar: {
    siteTagline: 'ملاحظات تحريرية من الفريق الذي يبني Mademoiselle، رفيقة الجمال بالذكاء الاصطناعي.',
    journalTitle: 'المجلة',
    home: 'الرئيسية', journal: 'المجلة', plans: 'الباقات', cta: 'حمّل التطبيق',
    onThisPage: 'في هذه الصفحة', share: 'مشاركة', writtenBy: 'بقلم',
    minRead: 'دقائق قراءة', updated: 'تحديث',
    faqHeading: 'أسئلة متكرّرة', relatedHeading: 'تابعي القراءة', relatedEyebrow: 'المزيد من المجلة',
    olderLabel: 'أقدم', newerLabel: 'أحدث',
    closingEyebrow: 'جرّبيها بنفسك', closingTitle: 'اذهبي الآن لتري نفسك في إطلالة جديدة.', closingCta: 'افتحي Mademoiselle',
    breadcrumbHome: 'الرئيسية', breadcrumbJournal: 'المجلة',
    languageSwitcher: 'اللغة', languageNames: { en: 'English', ar: 'العربية', fr: 'Français' },
    explore: 'استكشفي', company: 'الشركة', allRights: 'جميع الحقوق محفوظة.', madeFor: 'صُنع بعناية لمنطقة الشرق الأوسط.',
    aboutAuthor: 'تكتب لمجلة Mademoiselle — ذكاء الجمال، الشرق الأوسط أوّلاً، بكامل العناية.',
  },
  fr: {
    siteTagline: 'Notes éditoriales de l’équipe qui construit Mademoiselle, une compagne beauté par IA.',
    journalTitle: 'Le Journal',
    home: 'Accueil', journal: 'Journal', plans: 'Forfaits', cta: 'Obtenir l’app',
    onThisPage: 'Sur cette page', share: 'Partager', writtenBy: 'Écrit par',
    minRead: 'min de lecture', updated: 'Mis à jour',
    faqHeading: 'Questions fréquentes', relatedHeading: 'Poursuivre la lecture', relatedEyebrow: 'Plus dans le Journal',
    olderLabel: 'Plus ancien', newerLabel: 'Plus récent',
    closingEyebrow: 'Essayez-le', closingTitle: 'Allez vous voir sous un autre jour.', closingCta: 'Ouvrir Mademoiselle',
    breadcrumbHome: 'Accueil', breadcrumbJournal: 'Journal',
    languageSwitcher: 'Langue', languageNames: { en: 'English', ar: 'العربية', fr: 'Français' },
    explore: 'Explorer', company: 'Entreprise', allRights: 'Tous droits réservés.', madeFor: 'Conçu avec soin pour la région MENA.',
    aboutAuthor: 'Écrit pour le Journal Mademoiselle — intelligence beauté, MENA d’abord, avec soin.',
  },
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

function escapeAttr(s) { return escapeHtml(s); }

function stripEmojis(s) {
  if (!s) return s;
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, '');
}

// Strip Arabic harakat (diacritics) so heading IDs are stable across input.
// Carefully covers U+064B–U+065F (harakat) + U+0670 (superscript alef) only;
// must NOT include U+0660–U+0669 (Arabic-Indic digits).
function stripArabicDiacritics(s) {
  return s.replace(/[\u064B-\u065F\u0670]/g, '');
}

// Slugify that preserves Arabic letters (browsers handle %-encoding fine);
// strips Latin punctuation, lowercases Latin, hyphenates whitespace.
function slugify(text) {
  return stripArabicDiacritics(String(text))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^؀-ۿa-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'section';
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

function toArabicDigits(n) {
  return String(n).split('').map((ch) => {
    const d = parseInt(ch, 10);
    if (isNaN(d)) return ch;
    return String.fromCharCode(0x0660 + d);
  }).join('');
}

function formatReadingTime(minutes, locale) {
  const m = Math.max(1, Math.round(minutes));
  if (locale === 'ar') return `${toArabicDigits(m)} ${I18N.ar.minRead}`;
  if (locale === 'fr') return `${m} ${I18N.fr.minRead}`;
  return `${m} ${I18N.en.minRead}`;
}

function formatDate(iso, locale) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const localeMap = { en: 'en-US', ar: 'ar', fr: 'fr-FR' };
  return d.toLocaleDateString(localeMap[locale] || 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
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

function localePathPrefix(locale) {
  return locale === DEFAULT_LOCALE ? '' : `/${locale}`;
}

function postUrl(locale, slug) {
  return `${SITE_URL}${localePathPrefix(locale)}/blog/${slug}/`;
}

function blogIndexUrl(locale) {
  return `${SITE_URL}${localePathPrefix(locale)}/blog/`;
}

// Read posts ----------------------------------------------------------------

function readLocalePosts(locale) {
  // Posts can live in either content/blog/<locale>/ or content/blog/ (root,
  // treated as the default locale for backwards compat with the original layout).
  const dirs = [`${CONTENT_DIR}/${locale}`];
  if (locale === DEFAULT_LOCALE) dirs.push(CONTENT_DIR);
  const posts = [];
  const seenSlugs = new Set();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = `${dir}/${file}`;
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) continue;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      if (!data.title || !data.publishedAt) {
        console.warn(`! skipping ${file} (missing title/publishedAt)`);
        continue;
      }
      const slug = data.slug || file.replace(/\.md$/, '');
      if (seenSlugs.has(slug)) continue; // locale-subdir wins over root
      seenSlugs.add(slug);
      const fmLocale = data.locale || locale;
      posts.push({
        ...data,
        slug,
        locale: fmLocale,
        translationKey: data.translationKey || slug,
        title: stripEmojis(data.title),
        description: stripEmojis(data.description || data.excerpt || ''),
        excerpt: stripEmojis(data.excerpt || data.description || ''),
        author: stripEmojis(data.author || SITE_NAME),
        tags: Array.isArray(data.tags) ? data.tags : [],
        category: data.category || 'editorial',
        coverTone: data.coverTone || (CATEGORIES[data.category]?.tone) || 'warm',
        featured: !!data.featured,
        faq: Array.isArray(data.faq) ? data.faq : [],
        content,
        filePath,
      });
    }
  }
  posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return posts;
}

function readAllPostsByLocale() {
  const byLocale = {};
  for (const locale of LOCALES) {
    byLocale[locale] = readLocalePosts(locale);
  }
  return byLocale;
}

// Build a translationKey -> { locale -> post } map for hreflang generation.
function buildTranslationGraph(byLocale) {
  const graph = {};
  for (const locale of LOCALES) {
    for (const post of byLocale[locale]) {
      if (!graph[post.translationKey]) graph[post.translationKey] = {};
      graph[post.translationKey][locale] = post;
    }
  }
  return graph;
}

// TOC / markdown ------------------------------------------------------------

function extractToc(content) {
  const toc = [];
  const seen = new Set();
  const lines = content.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h2 = line.match(/^##\s+(.+?)\s*#*\s*$/);
    const h3 = line.match(/^###\s+(.+?)\s*#*\s*$/);
    if (h2) {
      const text = h2[1].trim();
      toc.push({ level: 2, text, id: dedupeId(slugify(text), seen) });
    } else if (h3) {
      const text = h3[1].trim();
      toc.push({ level: 3, text, id: dedupeId(slugify(text), seen) });
    }
  }
  return toc;
}

function tocToHtml(toc, locale) {
  if (!toc.length) return '';
  const label = I18N[locale].onThisPage;
  let html = `<nav class="post-toc" aria-label="${escapeAttr(label)}"><p class="post-toc-label">${escapeHtml(label)}</p><ol class="post-toc-list">`;
  let openLevel = 0;
  for (const item of toc) {
    if (item.level === 2) {
      if (openLevel === 3) { html += '</ol></li>'; openLevel = 2; }
      if (openLevel === 0) openLevel = 2;
      html += `<li class="post-toc-item post-toc-item-2"><a href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a>`;
    } else if (item.level === 3) {
      if (openLevel !== 3) { html += '<ol class="post-toc-sublist toc-h3">'; openLevel = 3; }
      html += `<li class="post-toc-item post-toc-item-3"><a href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a></li>`;
    }
  }
  if (openLevel === 3) html += '</ol></li>';
  else if (openLevel === 2) html += '</li>';
  html += '</ol></nav>';
  return html;
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

function buildRenderer(toc) {
  const headingQueues = new Map();
  for (const item of toc) {
    if (!headingQueues.has(item.text)) headingQueues.set(item.text, []);
    headingQueues.get(item.text).push(item.id);
  }

  const renderer = new marked.Renderer();

  renderer.heading = function ({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    const plain = tokensToPlainText(tokens).trim();
    if (depth === 2 || depth === 3) {
      const queue = headingQueues.get(plain);
      const id = queue && queue.length ? queue.shift() : slugify(plain);
      return `<h${depth} id="${escapeAttr(id)}" class="post-h${depth}"><a class="post-anchor" href="#${escapeAttr(id)}" aria-hidden="true">#</a>${inner}</h${depth}>\n`;
    }
    return `<h${depth} class="post-h${depth}">${inner}</h${depth}>\n`;
  };

  renderer.image = function ({ href, title, text }) {
    const alt = stripEmojis(text || '');
    const t = title ? ` title="${escapeAttr(title)}"` : '';
    return `<img src="${escapeAttr(href)}" alt="${escapeAttr(alt)}"${t} loading="lazy" decoding="async">`;
  };

  renderer.link = function ({ href, title, tokens }) {
    const inner = this.parser.parseInline(tokens);
    const t = title ? ` title="${escapeAttr(title)}"` : '';
    const isExternal = /^https?:\/\//.test(href) && !href.includes('mademoizelle.co');
    const ext = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeAttr(href)}"${t}${ext}>${inner}</a>`;
  };

  renderer.code = function ({ text, lang }) {
    const langString = (lang || '').match(/^\S*/)?.[0] || '';
    const langClass = langString ? ` class="language-${escapeAttr(langString)}"` : '';
    const body = text.replace(/\n$/, '') + '\n';
    return `<div class="prose-codeblock"><pre><code${langClass}>${escapeHtml(body)}</code></pre></div>\n`;
  };

  renderer.blockquote = function ({ tokens }) {
    const inner = this.parser.parse(tokens);
    const match = inner.match(/^<p>\s*\[!(note|warning|ai|tip)\]\s*([\s\S]*?)<\/p>\s*([\s\S]*)$/i);
    if (match) {
      const type = match[1].toLowerCase();
      const firstPara = match[2].trim();
      const rest = match[3].trim();
      const labelMap = {
        note:    { en: 'Note',       ar: 'ملاحظة',    fr: 'Note' },
        warning: { en: 'Warning',    ar: 'تنبيه',      fr: 'Attention' },
        ai:      { en: 'From the AI', ar: 'من الذكاء الاصطناعي', fr: 'De l’IA' },
        tip:     { en: 'Tip',         ar: 'نصيحة',     fr: 'Astuce' },
      };
      // Locale is on the renderer config; default to en if missing.
      const locale = this._mademoiselleLocale || 'en';
      const label = labelMap[type][locale] || labelMap[type].en;
      let body = '';
      if (firstPara) body += `<p>${firstPara}</p>`;
      if (rest) body += rest;
      return `<aside class="callout callout-${type}"><strong class="callout-label">${escapeHtml(label)}</strong>${body}</aside>\n`;
    }
    return `<blockquote class="prose-blockquote">\n${inner}</blockquote>\n`;
  };

  return renderer;
}

function renderMarkdown(content, toc, locale) {
  const renderer = buildRenderer(toc);
  renderer._mademoiselleLocale = locale;
  marked.setOptions({ gfm: true, breaks: false });
  return marked.parse(content, { renderer });
}

// Tags / related ------------------------------------------------------------

function tagsHtml(tags, locale) {
  if (!tags || !tags.length) return '';
  return tags
    .map((t) => `<a class="post-tag" href="${localePathPrefix(locale)}/blog/?tag=${encodeURIComponent(t)}">${escapeHtml(t)}</a>`)
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

function relatedHtml(list, locale) {
  if (!list.length) return '';
  const cards = list.map((p) => {
    const cat = CATEGORIES[p.category] || { tone: 'plum', en: 'Editorial', ar: 'تحريري', fr: 'Éditorial' };
    const label = cat[locale] || cat.en;
    return `<a class="related-card" href="${localePathPrefix(locale)}/blog/${escapeAttr(p.slug)}/">
      <span class="related-card-tone tone-${escapeAttr(cat.tone)}" aria-hidden="true"></span>
      <span class="related-card-cat">${escapeHtml(label)}</span>
      <h3 class="related-card-title">${escapeHtml(p.title)}</h3>
      <p class="related-card-excerpt">${escapeHtml(p.excerpt || p.description || '')}</p>
    </a>`;
  }).join('\n');
  return cards;
}

function faqHtml(faq, locale) {
  if (!faq || !faq.length) return '';
  const heading = I18N[locale].faqHeading;
  const items = faq.map((qa) => `
    <details class="faq-item">
      <summary class="faq-q">${escapeHtml(qa.q)}</summary>
      <div class="faq-a"><p>${escapeHtml(qa.a)}</p></div>
    </details>`).join('');
  return `<section class="post-faq" aria-label="${escapeAttr(heading)}"><h2 class="post-faq-heading">${escapeHtml(heading)}</h2>${items}</section>`;
}

function prevNextHtml(post, all, locale) {
  const i = all.findIndex((p) => p.slug === post.slug);
  const newer = i > 0 ? all[i - 1] : null;
  const older = i < all.length - 1 ? all[i + 1] : null;
  const lp = localePathPrefix(locale);
  const olderLabel = I18N[locale].olderLabel;
  const newerLabel = I18N[locale].newerLabel;
  const prevHtml = older
    ? `<a class="pager-card pager-prev" href="${lp}/blog/${escapeAttr(older.slug)}/"><span class="pager-direction">${escapeHtml(olderLabel)}</span><span class="pager-title">${escapeHtml(older.title)}</span></a>`
    : '';
  const nextHtml = newer
    ? `<a class="pager-card pager-next" href="${lp}/blog/${escapeAttr(newer.slug)}/"><span class="pager-direction">${escapeHtml(newerLabel)}</span><span class="pager-title">${escapeHtml(newer.title)}</span></a>`
    : '';
  return { prevHtml, nextHtml };
}

function coverHtml(post) {
  const cat = CATEGORIES[post.category] || { tone: post.coverTone };
  const tone = post.coverTone || cat.tone || 'warm';
  if (post.coverImage) {
    return `<img src="${escapeAttr(post.coverImage)}" alt="${escapeAttr(post.title)}" loading="eager" decoding="async">`;
  }
  return `<div class="tone-block tone-${escapeAttr(tone)}" aria-hidden="true"></div>`;
}

// JSON-LD -------------------------------------------------------------------

function blogPostingJsonLd(post, translations) {
  const langCode = BCP47[post.locale] || 'en';
  const url = postUrl(post.locale, post.slug);
  const cat = CATEGORIES[post.category] || { en: 'Editorial' };
  const sectionLabel = cat[post.locale] || cat.en;
  // Translation list for inLanguage variants — schema.org allows
  // sameAs / workTranslation; we use workTranslation entries.
  const translationsArr = Object.entries(translations || {})
    .filter(([loc]) => loc !== post.locale)
    .map(([loc, tp]) => ({
      '@type': 'Article',
      '@id': postUrl(loc, tp.slug),
      headline: tp.title,
      inLanguage: BCP47[loc],
      url: postUrl(loc, tp.slug),
    }));

  const obj = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    description: post.description,
    datePublished: toIsoString(post.publishedAt),
    dateModified: toIsoString(post.updatedAt || post.publishedAt),
    author: { '@type': 'Person', name: post.author, url: SITE_URL },
    publisher: {
      '@type': 'Organization', name: SITE_NAME, url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/logo-mark.svg` },
    },
    image: post.coverImage ? `${SITE_URL}${post.coverImage}` : `${SITE_URL}/assets/og.svg`,
    keywords: (post.tags || []).join(', '),
    inLanguage: langCode,
    articleSection: sectionLabel,
    url,
    isPartOf: {
      '@type': 'Blog',
      '@id': blogIndexUrl(post.locale),
      name: `${SITE_NAME} — ${I18N[post.locale].journalTitle}`,
    },
  };
  if (translationsArr.length) obj.workTranslation = translationsArr;
  return obj;
}

function faqPageJsonLd(faq) {
  if (!faq || !faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

function breadcrumbJsonLd(post) {
  const lp = localePathPrefix(post.locale);
  const cat = CATEGORIES[post.category] || { en: 'Editorial' };
  const sectionLabel = cat[post.locale] || cat.en;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: I18N[post.locale].breadcrumbHome,    item: `${SITE_URL}${lp}/` },
      { '@type': 'ListItem', position: 2, name: I18N[post.locale].breadcrumbJournal, item: `${SITE_URL}${lp}/blog/` },
      { '@type': 'ListItem', position: 3, name: sectionLabel,                        item: `${SITE_URL}${lp}/blog/?category=${encodeURIComponent(post.category)}` },
      { '@type': 'ListItem', position: 4, name: post.title,                          item: postUrl(post.locale, post.slug) },
    ],
  };
}

function blogJsonLd(posts, locale) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': blogIndexUrl(locale),
    name: `${SITE_NAME} — ${I18N[locale].journalTitle}`,
    url: blogIndexUrl(locale),
    inLanguage: BCP47[locale],
    publisher: {
      '@type': 'Organization', name: SITE_NAME, url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/logo-mark.svg` },
    },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: postUrl(locale, p.slug),
      datePublished: toIsoString(p.publishedAt),
    })),
  };
}

function jsonLdScript(obj) {
  if (!obj) return '';
  return `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
}

// hreflang + language switcher ----------------------------------------------

function hreflangLinksHtml(translations, currentLocale, currentSlug) {
  // Always include x-default pointing to the default-locale URL.
  const lines = [];
  const defaultPost = translations[DEFAULT_LOCALE];
  const defaultUrl = defaultPost ? postUrl(DEFAULT_LOCALE, defaultPost.slug) : postUrl(currentLocale, currentSlug);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${defaultUrl}">`);
  for (const loc of LOCALES) {
    const tp = translations[loc];
    if (!tp) continue;
    lines.push(`<link rel="alternate" hreflang="${BCP47[loc]}" href="${postUrl(loc, tp.slug)}">`);
  }
  return lines.join('\n');
}

// Pill-style language switcher matching the homepage `.lang-switch` design.
// Renders <a class="lang-btn" aria-pressed="true|false"> for the three locales.
// EN/AR/FR is the canonical order. Pill labels: EN, عربي, FR (mirrors homepage).
const LANG_PILL_LABEL = { en: 'EN', ar: 'عربي', fr: 'FR' };

function languageSwitcherHtml(translations, currentLocale) {
  const items = LOCALES.map((loc) => {
    const tp = translations[loc];
    const href = tp ? postUrl(loc, tp.slug) : `${SITE_URL}${localePathPrefix(loc)}/blog/`;
    const pressed = loc === currentLocale ? 'true' : 'false';
    const label = LANG_PILL_LABEL[loc] || I18N[currentLocale].languageNames[loc];
    return `<a class="lang-btn" href="${href}" hreflang="${BCP47[loc]}" data-lang="${loc}" aria-pressed="${pressed}">${escapeHtml(label)}</a>`;
  }).join('');
  return `<div class="lang-switch" role="group" aria-label="${escapeAttr(I18N[currentLocale].languageSwitcher)}">${items}</div>`;
}

// Template substitution -----------------------------------------------------

function render(template, vars) {
  let out = template;
  // Strip HTML comments that contain template tokens so any {{tokens}} used
  // inside dev-doc comments do not bleed into the output. (Without this,
  // JSON-LD/hreflang tokens used to illustrate substitution end up rendered
  // inside the comment, producing duplicated <script> blocks and <link>
  // tags before <html>.) Plain structural comments without tokens are
  // preserved so author intent is kept.
  out = out.replace(/<!--[\s\S]*?-->/g, (m) => /\{\{\{?\w+\}?\}\}/.test(m) ? '' : m);
  out = out.replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => {
    const v = vars[name];
    return v === undefined || v === null ? '' : String(v);
  });
  out = out.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name];
    if (v === undefined || v === null) return '';
    return escapeHtml(String(v));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Build per-post + per-index pages
// ---------------------------------------------------------------------------

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
  const size = Buffer.byteLength(content, 'utf-8');
  const kb = size < 1024 ? `${size}B` : `${(size / 1024).toFixed(1)}KB`;
  console.log(`  -> wrote ${filePath.replace(`${ROOT}/`, '')} (${kb})`);
}

function loadTemplate(name) {
  const p = `${TEMPLATE_DIR}/${name}`;
  if (!fs.existsSync(p)) {
    console.error(`! template missing: templates/${name}`);
    return null;
  }
  return fs.readFileSync(p, 'utf-8');
}

function buildPostVars(post, allInLocale, translationGraph) {
  const locale = post.locale;
  const t = I18N[locale];
  const cat = CATEGORIES[post.category] || { tone: 'plum', en: 'Editorial', ar: 'تحريري', fr: 'Éditorial' };
  const sectionLabel = cat[locale] || cat.en;
  const translations = translationGraph[post.translationKey] || {};
  const toc = extractToc(post.content);
  const contentHtml = renderMarkdown(post.content, toc, locale);
  const rt = readingTime(post.content);
  const updatedBlock = post.updatedAt
    ? `<span class="post-updated">${escapeHtml(t.updated)} <time datetime="${escapeAttr(toIsoString(post.updatedAt))}">${escapeHtml(formatDate(post.updatedAt, locale))}</time></span>`
    : '';
  const { prevHtml, nextHtml } = prevNextHtml(post, allInLocale, locale);
  const related = relatedPosts(post, allInLocale, 3);
  const url = postUrl(locale, post.slug);
  const publishedAtIso = toIsoString(post.publishedAt);

  // JSON-LD: three blocks (BlogPosting + FAQPage + BreadcrumbList).
  const jsonLdBlocks = [
    jsonLdScript(blogPostingJsonLd(post, translations)),
    jsonLdScript(faqPageJsonLd(post.faq)),
    jsonLdScript(breadcrumbJsonLd(post)),
  ].filter(Boolean).join('\n');

  return {
    // Document metadata
    lang: BCP47[locale],
    dir: RTL_LOCALES.has(locale) ? 'rtl' : 'ltr',
    locale,
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    journalTitle: t.journalTitle,
    // Post fields
    title: post.title,
    description: post.description,
    slug: post.slug,
    publishedAt: post.publishedAt,
    publishedAtIso,
    publishedAtFormatted: formatDate(post.publishedAt, locale),
    updatedAtBlock: updatedBlock,
    readingTime: formatReadingTime(rt.minutes, locale),
    author: post.author,
    categoryLabel: sectionLabel,
    categorySlug: post.category,
    categoryTone: cat.tone,
    tagsHtml: tagsHtml(post.tags, locale),
    tocHtml: tocToHtml(toc, locale),
    contentHtml,
    faqHtml: faqHtml(post.faq, locale),
    prevHtml, nextHtml,
    relatedHtml: relatedHtml(related, locale),
    shareUrl: url,
    canonical: url,
    coverHtml: coverHtml(post),
    jsonLd: jsonLdBlocks,
    hreflangLinks: hreflangLinksHtml(translations, locale, post.slug),
    languageSwitcherHtml: languageSwitcherHtml(translations, locale),
    ogImage: post.coverImage ? `${SITE_URL}${post.coverImage}` : `${SITE_URL}/assets/og.svg`,
    // Localized UI
    iHome: t.home, iJournal: t.journal, iPlans: t.plans, iCta: t.cta,
    iShare: t.share, iWrittenBy: t.writtenBy, iAboutAuthor: t.aboutAuthor,
    iRelatedHeading: t.relatedHeading, iRelatedEyebrow: t.relatedEyebrow,
    iClosingEyebrow: t.closingEyebrow, iClosingTitle: t.closingTitle, iClosingCta: t.closingCta,
    iBreadcrumbHome: t.breadcrumbHome, iBreadcrumbJournal: t.breadcrumbJournal,
    iExplore: t.explore, iCompany: t.company, iAllRights: t.allRights, iMadeFor: t.madeFor,
    iLanguageSwitcher: t.languageSwitcher,
    indexHref: blogIndexUrl(locale).replace(SITE_URL, ''),
    // Homepage handles its own EN/AR toggle via localStorage. There is no
    // standalone /ar/ or /fr/ homepage page, so keep all "Home" links pointing
    // at the canonical site root.
    homeHref: '/',
    plansHref: '/#plans',
    downloadHref: '/#download',
  };
}

function renderPost(post, allInLocale, translationGraph, postTemplate) {
  const vars = buildPostVars(post, allInLocale, translationGraph);
  return render(postTemplate, vars);
}

function postCard(post, locale) {
  const cat = CATEGORIES[post.category] || { tone: 'plum', en: 'Editorial', ar: 'تحريري', fr: 'Éditorial' };
  const label = cat[locale] || cat.en;
  return `<a class="post-card tone-${escapeAttr(cat.tone)}" data-category="${escapeAttr(post.category)}" href="${localePathPrefix(locale)}/blog/${escapeAttr(post.slug)}/">
    <span class="post-card-cat">${escapeHtml(label)}</span>
    <h3 class="post-card-title">${escapeHtml(post.title)}</h3>
    <p class="post-card-excerpt">${escapeHtml(post.excerpt || post.description || '')}</p>
    <span class="post-card-meta">
      <time datetime="${escapeAttr(toIsoString(post.publishedAt))}">${escapeHtml(formatDate(post.publishedAt, locale))}</time>
      <span class="post-card-author">${escapeHtml(post.author)}</span>
    </span>
  </a>`;
}

function categoriesStripHtml(posts, locale) {
  const counts = {};
  for (const p of posts) counts[p.category] = (counts[p.category] || 0) + 1;
  const allLabel = locale === 'ar' ? 'الكل' : (locale === 'fr' ? 'Tous' : 'All');
  const allChip = `<a class="cat-chip" data-category="all" data-active="true" aria-selected="true" href="${localePathPrefix(locale)}/blog/">${escapeHtml(allLabel)} <span class="cat-chip-count">${posts.length}</span></a>`;
  const chips = Object.entries(CATEGORIES)
    .filter(([slug]) => counts[slug])
    .map(([slug, c]) => {
      const label = c[locale] || c.en;
      return `<a class="cat-chip tone-${escapeAttr(c.tone)}" data-category="${escapeAttr(slug)}" data-active="false" aria-selected="false" href="${localePathPrefix(locale)}/blog/?category=${encodeURIComponent(slug)}">${escapeHtml(label)} <span class="cat-chip-count">${counts[slug]}</span></a>`;
    });
  return [allChip, ...chips].join(' ');
}

function featuredHtml(posts, locale) {
  const f = posts.find((p) => p.featured);
  if (!f) return '';
  const cat = CATEGORIES[f.category] || { tone: 'plum', en: 'Editorial', ar: 'تحريري', fr: 'Éditorial' };
  const label = cat[locale] || cat.en;
  const featuredLabel = locale === 'ar' ? 'مميّز' : (locale === 'fr' ? 'À la une' : 'Featured');
  return `<a class="featured-card tone-${escapeAttr(cat.tone)}" href="${localePathPrefix(locale)}/blog/${escapeAttr(f.slug)}/">
    <span class="featured-flag">${escapeHtml(featuredLabel)}</span>
    <span class="featured-cat">${escapeHtml(label)}</span>
    <h2 class="featured-title">${escapeHtml(f.title)}</h2>
    <p class="featured-excerpt">${escapeHtml(f.excerpt || f.description || '')}</p>
    <span class="featured-meta">
      <time datetime="${escapeAttr(toIsoString(f.publishedAt))}">${escapeHtml(formatDate(f.publishedAt, locale))}</time>
      <span>${escapeHtml(f.author)}</span>
    </span>
  </a>`;
}

function indexHreflangLinks(locale) {
  const lines = [];
  lines.push(`<link rel="alternate" hreflang="x-default" href="${blogIndexUrl(DEFAULT_LOCALE)}">`);
  for (const loc of LOCALES) {
    lines.push(`<link rel="alternate" hreflang="${BCP47[loc]}" href="${blogIndexUrl(loc)}">`);
  }
  return lines.join('\n');
}

function indexLanguageSwitcher(locale) {
  const items = LOCALES.map((loc) => {
    const href = blogIndexUrl(loc);
    const pressed = loc === locale ? 'true' : 'false';
    const label = LANG_PILL_LABEL[loc] || I18N[locale].languageNames[loc];
    return `<a class="lang-btn" href="${href}" hreflang="${BCP47[loc]}" data-lang="${loc}" aria-pressed="${pressed}">${escapeHtml(label)}</a>`;
  }).join('');
  return `<div class="lang-switch" role="group" aria-label="${escapeAttr(I18N[locale].languageSwitcher)}">${items}</div>`;
}

function renderIndex(posts, locale, indexTemplate) {
  const t = I18N[locale];
  const cardPosts = posts.filter((p) => !p.featured);
  const cards = (cardPosts.length ? cardPosts : posts).map((p) => postCard(p, locale)).join('\n');
  const blogLd = jsonLdScript(blogJsonLd(posts, locale));
  const vars = {
    lang: BCP47[locale],
    dir: RTL_LOCALES.has(locale) ? 'rtl' : 'ltr',
    locale,
    siteName: SITE_NAME,
    siteUrl: SITE_URL,
    journalTitle: t.journalTitle,
    siteTagline: t.siteTagline,
    canonical: blogIndexUrl(locale),
    hreflangLinks: indexHreflangLinks(locale),
    languageSwitcherHtml: indexLanguageSwitcher(locale),
    postsHtml: cards,
    categoriesHtml: categoriesStripHtml(posts, locale),
    featuredHtml: featuredHtml(posts, locale),
    totalPostCount: posts.length,
    jsonLd: blogLd,
    feedHref: `${localePathPrefix(locale)}/feed.xml`,
    homeHref: '/',
    plansHref: '/#plans',
    downloadHref: '/#download',
    indexHref: blogIndexUrl(locale).replace(SITE_URL, ''),
    iHome: t.home, iJournal: t.journal, iPlans: t.plans, iCta: t.cta,
    iExplore: t.explore, iCompany: t.company, iAllRights: t.allRights, iMadeFor: t.madeFor,
    iLanguageSwitcher: t.languageSwitcher,
  };
  return render(indexTemplate, vars);
}

// Generators ----------------------------------------------------------------

function generateFeed(posts, locale) {
  const t = I18N[locale];
  const items = posts.slice(0, 20).map((p) => {
    const link = postUrl(locale, p.slug);
    return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid isPermaLink="true">${escapeHtml(link)}</guid>
      <description>${escapeHtml(p.description || p.excerpt || '')}</description>
      <pubDate>${toRfc822(p.publishedAt)}</pubDate>
      <author>${escapeHtml(p.author)}</author>
      <category>${escapeHtml((CATEGORIES[p.category]?.[locale]) || (CATEGORIES[p.category]?.en) || p.category)}</category>
    </item>`;
  }).join('\n');
  const lastBuild = toRfc822(new Date().toISOString());
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(SITE_NAME)} — ${escapeHtml(t.journalTitle)}</title>
    <link>${escapeHtml(blogIndexUrl(locale))}</link>
    <atom:link href="${escapeHtml(SITE_URL + localePathPrefix(locale) + '/feed.xml')}" rel="self" type="application/rss+xml" />
    <description>${escapeHtml(t.siteTagline)}</description>
    <language>${BCP47[locale]}</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function generateLlmsTxt(posts, locale) {
  const t = I18N[locale];
  const lines = [];
  lines.push(`# ${SITE_NAME} — ${t.journalTitle}`);
  lines.push('');
  lines.push(t.siteTagline);
  lines.push('');
  lines.push(locale === 'ar' ? '## المقالات' : (locale === 'fr' ? '## Articles' : '## Posts'));
  lines.push('');
  for (const p of posts) {
    const desc = (p.description || p.excerpt || '').replace(/\s+/g, ' ').trim();
    lines.push(`- ${postUrl(locale, p.slug)} — ${p.title} (${p.publishedAt}) — ${desc}`);
  }
  lines.push('');
  return lines.join('\n');
}

// Multi-locale sitemap with hreflang xhtml:link alternates.
// Reference: https://developers.google.com/search/docs/specialty/international/localized-versions#sitemap
function generateSitemap(byLocale, translationGraph) {
  const urls = [];

  // Home + blog index per locale, with full hreflang sets.
  const indexAlts = LOCALES.map((loc) => ({
    hreflang: BCP47[loc], href: blogIndexUrl(loc),
  }));
  const homeAlts = LOCALES.map((loc) => ({
    hreflang: BCP47[loc], href: `${SITE_URL}${localePathPrefix(loc)}/`,
  }));

  for (const loc of LOCALES) {
    urls.push({
      loc: `${SITE_URL}${localePathPrefix(loc)}/`,
      lastmod: TODAY,
      changefreq: 'monthly',
      priority: loc === DEFAULT_LOCALE ? '1.0' : '0.9',
      alternates: [{ hreflang: 'x-default', href: `${SITE_URL}/` }, ...homeAlts],
    });
    urls.push({
      loc: blogIndexUrl(loc),
      lastmod: TODAY,
      changefreq: 'weekly',
      priority: '0.8',
      alternates: [{ hreflang: 'x-default', href: blogIndexUrl(DEFAULT_LOCALE) }, ...indexAlts],
    });
  }

  // Per-post entries with translation alternates.
  for (const loc of LOCALES) {
    for (const post of byLocale[loc]) {
      const translations = translationGraph[post.translationKey] || {};
      const alts = [];
      const def = translations[DEFAULT_LOCALE];
      alts.push({
        hreflang: 'x-default',
        href: def ? postUrl(DEFAULT_LOCALE, def.slug) : postUrl(loc, post.slug),
      });
      for (const l2 of LOCALES) {
        const tp = translations[l2];
        if (!tp) continue;
        alts.push({ hreflang: BCP47[l2], href: postUrl(l2, tp.slug) });
      }
      const lastmod = (post.updatedAt || post.publishedAt || TODAY).slice(0, 10);
      urls.push({
        loc: postUrl(loc, post.slug),
        lastmod,
        changefreq: 'monthly',
        priority: post.featured ? '0.7' : '0.6',
        alternates: alts,
      });
    }
  }

  const body = urls.map((u) => {
    const altLines = (u.alternates || [])
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
      .join('\n');
    return `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
${altLines}
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

function main() {
  console.log(`Mademoiselle blog build (trilingual) — ${new Date().toISOString()}`);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const f of STATIC_FILES) {
    const src = `${ROOT}/${f}`;
    if (fs.existsSync(src)) fs.copyFileSync(src, `${DIST}/${f}`);
  }
  for (const d of STATIC_DIRS) {
    const src = `${ROOT}/${d}`;
    if (fs.existsSync(src)) fs.cpSync(src, `${DIST}/${d}`, { recursive: true });
  }
  console.log(`  copied static files -> dist/`);

  const byLocale = readAllPostsByLocale();
  const translationGraph = buildTranslationGraph(byLocale);

  let total = 0;
  for (const loc of LOCALES) total += byLocale[loc].length;
  if (total === 0) {
    console.error('! no posts found in content/blog/');
    process.exit(1);
  }
  for (const loc of LOCALES) {
    console.log(`  read ${byLocale[loc].length} ${loc.toUpperCase()} posts`);
  }

  const postTemplate = loadTemplate('post.html');
  const indexTemplate = loadTemplate('blog-index.html');
  if (!postTemplate || !indexTemplate) process.exit(1);

  let postsBuilt = 0;
  for (const loc of LOCALES) {
    const posts = byLocale[loc];
    if (!posts.length) continue;
    const lp = localePathPrefix(loc);
    const outBlog = lp ? `${DIST}${lp}/blog` : `${DIST}/blog`;

    for (const post of posts) {
      const html = renderPost(post, posts, translationGraph, postTemplate);
      writeFile(`${outBlog}/${post.slug}/index.html`, html);
      postsBuilt++;
    }

    writeFile(`${outBlog}/index.html`, renderIndex(posts, loc, indexTemplate));
    writeFile(`${DIST}${lp}/feed.xml`, generateFeed(posts, loc));
    writeFile(`${DIST}${lp}/llms.txt`, generateLlmsTxt(posts, loc));
  }

  // Combined sitemap at root.
  writeFile(`${DIST}/sitemap.xml`, generateSitemap(byLocale, translationGraph));

  // llms.txt at root mirrors the default-locale one for compatibility.
  if (byLocale[DEFAULT_LOCALE].length) {
    writeFile(`${DIST}/llms.txt`, generateLlmsTxt(byLocale[DEFAULT_LOCALE], DEFAULT_LOCALE));
  }

  const elapsed = Date.now() - startedAt;
  console.log(`Built ${postsBuilt} posts across ${LOCALES.length} locales in ${elapsed}ms`);
}

main();
