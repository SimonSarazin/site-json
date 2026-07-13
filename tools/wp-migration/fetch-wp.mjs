#!/usr/bin/env node
/**
 * Récupération COMPLÈTE d'un site WordPress via l'API REST (wp/v2) pour import ultérieur en POI costum.
 * - Pagine tous les posts (per_page=100, suit X-WP-TotalPages).
 * - Convertit `content.rendered` (HTML) -> **markdown** (turndown + gfm).
 * - Résout categories/tags/auteurs (id -> nom/slug).
 * - Télécharge les images (à la une + inline dans le contenu) et RÉÉCRIT les URLs en chemins LOCAUX
 *   (pour réhébergement Coco).
 * - Sortie : out/articles.ndjson (1 article/ligne), out/articles.json (tableau final), out/categories.json,
 *   out/summary.csv (récap plat), out/images/*, out/manifest.json.
 * - REPRENABLE (checkpoint par page ; images skip-if-exists) et THROTTLÉ (poli avec le serveur source).
 *
 * Usage : node fetch-wp.mjs [--base https://www.parent62.org] [--out ./out] [--max-pages N]
 *                           [--per-page 100] [--throttle 300] [--no-images] [--resume]
 *
 * Mapping cible (POI type=article) — pour info, l'import est une étape séparée :
 *   title -> name ; contentMarkdown -> description (format markdown) ; excerpt -> shortDescription ;
 *   date -> created ; categories/tags -> tags ; featuredImage.localPath -> image (réhébergée) ;
 *   slug -> slug ; link/guid -> source.originUrl (+ clé d'idempotence wpId).
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import { createHash } from "node:crypto";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const BASE = (arg("--base", "https://www.parent62.org")).replace(/\/+$/, "");
const OUT = resolve(arg("--out", "./out"));
const PER_PAGE = Number(arg("--per-page", "100"));
const MAX_PAGES = arg("--max-pages") ? Number(arg("--max-pages")) : Infinity;
const THROTTLE = Number(arg("--throttle", "300"));
const NO_IMAGES = flag("--no-images");
const RESUME = flag("--resume");

const IMG_DIR = join(OUT, "images");
mkdirSync(IMG_DIR, { recursive: true });
const NDJSON = join(OUT, "articles.ndjson");
const CHECKPOINT = join(OUT, "checkpoint.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "*" });
td.use(gfm);
// Garde les images (turndown -> ![alt](src)) ; on réécrit src -> local après coup.

// Décodeur d'entités HTML minimal (titres/excerpts WP rendered).
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', "#039": "'", apos: "'", nbsp: " ", laquo: "«", raquo: "»", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ugrave: "ù", ocirc: "ô", euro: "€" };
function decodeEntities(s = "") {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => (name.toLowerCase() in NAMED ? NAMED[name.toLowerCase()] : m));
}
const htmlToText = (html = "") => decodeEntities(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();

// ── fetch JSON avec entêtes (pour X-WP-Total*) + retries ──────────────────────
async function getJson(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "coco-migration/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return { body, headers: res.headers };
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(THROTTLE * attempt * 3);
    }
  }
}

// ── download image (dedup + skip-if-exists) → chemin local relatif ────────────
const urlToLocal = new Map();
async function downloadImage(url) {
  if (!url) return null;
  if (urlToLocal.has(url)) return urlToLocal.get(url);
  const clean = url.split("?")[0];
  let ext = extname(clean).toLowerCase(); if (!/^\.(jpg|jpeg|png|gif|webp|svg|avif)$/.test(ext)) ext = ".jpg";
  const hash = createHash("md5").update(url).digest("hex").slice(0, 8);
  const name = `${hash}-${basename(clean).replace(/[^\w.\-]/g, "_")}`.slice(0, 100).replace(/(\.\w+)?$/, ext);
  const rel = `images/${name}`;
  const abs = join(OUT, rel);
  urlToLocal.set(url, rel);
  if (existsSync(abs)) return rel;
  if (NO_IMAGES) return rel;
  try {
    const res = await fetch(url, { headers: { "user-agent": "coco-migration/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(abs, Buffer.from(await res.arrayBuffer()));
    await sleep(THROTTLE);
    return rel;
  } catch (e) {
    console.warn(`  ⚠ image KO ${url} : ${e.message}`);
    urlToLocal.set(url, null);
    return null;
  }
}

// ── maps id->nom pour categories / tags / users (paginé) ──────────────────────
async function fetchTaxonomy(kind) {
  const map = new Map();
  for (let page = 1; ; page++) {
    const { body, headers } = await getJson(`${BASE}/wp-json/wp/v2/${kind}?per_page=100&page=${page}`);
    for (const t of body) map.set(t.id, { name: decodeEntities(t.name), slug: t.slug, count: t.count });
    if (page >= Number(headers.get("x-wp-totalpages") || 1)) break;
    await sleep(THROTTLE);
  }
  return map;
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`WP migration ← ${BASE}  →  ${OUT}`);
  let startPage = 1;
  if (RESUME && existsSync(CHECKPOINT)) { startPage = (JSON.parse(readFileSync(CHECKPOINT, "utf8")).lastPage || 0) + 1; console.log(`Reprise à la page ${startPage}`); }
  else { writeFileSync(NDJSON, ""); }

  console.log("Taxonomies…");
  const [cats, tags, users] = await Promise.all([fetchTaxonomy("categories"), fetchTaxonomy("tags"), fetchTaxonomy("users")]);
  writeFileSync(join(OUT, "categories.json"), JSON.stringify([...cats.entries()].map(([id, c]) => ({ id, ...c })), null, 2));
  console.log(`  ${cats.size} catégories, ${tags.size} tags, ${users.size} auteurs`);

  // total pages
  const first = await getJson(`${BASE}/wp-json/wp/v2/posts?per_page=${PER_PAGE}&_embed&page=1`);
  const totalPages = Math.min(Number(first.headers.get("x-wp-totalpages") || 1), MAX_PAGES);
  const totalPosts = first.headers.get("x-wp-total");
  console.log(`Posts : ${totalPosts} au total, ${totalPages} page(s) à traiter (per_page=${PER_PAGE})`);

  let count = 0;
  for (let page = startPage; page <= totalPages; page++) {
    const { body: posts } = page === 1 ? first : await getJson(`${BASE}/wp-json/wp/v2/posts?per_page=${PER_PAGE}&_embed&page=${page}`);
    for (const p of posts) {
      // featured image
      const fm = p._embedded?.["wp:featuredmedia"]?.[0];
      const featuredUrl = fm?.source_url || null;
      const featuredLocal = featuredUrl ? await downloadImage(featuredUrl) : null;
      // inline images du contenu
      const html = p.content?.rendered || "";
      const imgUrls = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
      const inline = [];
      for (const u of [...new Set(imgUrls)]) { const local = await downloadImage(u); inline.push({ originalUrl: u, localPath: local }); }
      // html -> markdown, puis réécriture des URLs d'images en chemins locaux
      let md = td.turndown(html);
      for (const { originalUrl, localPath } of inline) if (localPath) md = md.split(originalUrl).join(localPath);
      md = md.replace(/\n{3,}/g, "\n\n").trim();

      const record = {
        wpId: p.id,
        guid: p.guid?.rendered || null,
        link: p.link || null,
        slug: p.slug || null,
        status: p.status,
        title: decodeEntities(p.title?.rendered || ""),
        date: p.date || null,
        modified: p.modified || null,
        excerpt: htmlToText(p.excerpt?.rendered || ""),
        contentMarkdown: md,
        contentFormat: "markdown",
        categories: (p.categories || []).map((id) => cats.get(id)?.name).filter(Boolean),
        categorySlugs: (p.categories || []).map((id) => cats.get(id)?.slug).filter(Boolean),
        tags: (p.tags || []).map((id) => tags.get(id)?.name).filter(Boolean),
        author: users.get(p.author)?.name || p._embedded?.author?.[0]?.name || null,
        featuredImage: featuredUrl ? { originalUrl: featuredUrl, localPath: featuredLocal, alt: decodeEntities(fm?.alt_text || "") } : null,
        inlineImages: inline.filter((i) => i.localPath),
        acf: p.acf && Object.keys(p.acf).length ? p.acf : undefined,
      };
      appendFileSync(NDJSON, JSON.stringify(record) + "\n");
      count++;
    }
    writeFileSync(CHECKPOINT, JSON.stringify({ lastPage: page, count, at: new Date().toISOString() }));
    console.log(`  page ${page}/${totalPages} — ${count} articles, ${urlToLocal.size} images vues`);
    await sleep(THROTTLE);
  }

  // articles.json (tableau) + summary.csv depuis le NDJSON
  const records = readFileSync(NDJSON, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  writeFileSync(join(OUT, "articles.json"), JSON.stringify(records, null, 2));
  const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["wpId,date,slug,title,categories,tags,hasImage,inlineImages"]
    .concat(records.map((r) => [r.wpId, r.date, r.slug, csvEsc(r.title), csvEsc(r.categories.join("|")), csvEsc(r.tags.join("|")), r.featuredImage ? 1 : 0, r.inlineImages.length].join(",")))
    .join("\n");
  writeFileSync(join(OUT, "summary.csv"), csv);
  const downloaded = [...urlToLocal.values()].filter(Boolean).length;
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ base: BASE, totalPosts, totalPagesProcessed: totalPages, articles: records.length, imagesDownloaded: downloaded, categories: cats.size, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`\n✅ Terminé : ${records.length} articles, ${downloaded} images → ${OUT}`);
  console.log(`   articles.json · articles.ndjson · summary.csv · categories.json · images/ · manifest.json`);
})().catch((e) => { console.error("❌", e); process.exit(1); });
