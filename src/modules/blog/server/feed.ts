import { initApi } from "@/lib/apiClient";
import { getBaseUrl, getSitePublicUrl } from "@/lib/constant/common";
import { buildSearchPayload } from "@/modules/search/lib/buildSearchPayload";
import { stripMarkdown } from "../lib/markdown";

/** Échappement XML (5 caractères). */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

interface FeedArticle {
  id?: string; slug?: string; name?: string; shortDescription?: string;
  description?: string; created?: number; profilImageUrl?: string; profilMediumImageUrl?: string;
}
function norm(r: unknown): FeedArticle {
  const sd = (r as { serverData?: Record<string, unknown> })?.serverData;
  const base = (sd && typeof sd === "object" ? sd : (r as Record<string, unknown>)) as FeedArticle;
  if (base.id != null) return base;
  const rootId = (r as { id?: unknown })?.id;
  return rootId != null ? { ...base, id: String(rootId) } : base;
}

/**
 * Rend un flux RSS 2.0 des articles d'un costum (POI type=article, scope source.key), triés par date DESC.
 * Réutilise EXACTEMENT le pipeline du fil (initApi + buildSearchPayload + entity.searchCostum) — server-side,
 * hors React. Chargé par dev-server (ssrLoadModule) et prod-server (via ré-export entry-server → build SSR).
 */
export async function renderBlogFeed(opts: {
  costumSlug: string;
  limit?: number;
  title?: string;
  description?: string;
  /**
   * `config.blog.publicFilters` — filtres serveur du périmètre PUBLIC (ex. `{publicationStatus:"Publié"}`),
   * passés par dev-server/prod-server depuis la config chargée. Sans eux, le flux distribue les brouillons
   * et les archives que les sections `articleFeed` excluent. `type:"article"` reste non surchargeable.
   */
  publicFilters?: Record<string, unknown>;
}): Promise<string> {
  const { costumSlug, limit = 30, title = "Articles", description, publicFilters = {} } = opts;
  const { entity } = await initApi({ baseURL: getBaseUrl() });
  if (!entity) throw new Error("API non initialisée (feed)");

  const payload = buildSearchPayload(
    // Le flux public ne distribue pas les articles EN ATTENTE : applyValidationGate le pose (costumSlug présent). §16.
    { defaultFilters: { ...publicFilters, type: "article" }, defaultSortBy: { created: -1 }, costumSlug, sourceKey: [costumSlug] } as never,
    { name: "", type: ["poi"], indexStep: limit },
  );
  const page = (await entity.searchCostum(
    payload as unknown as Parameters<typeof entity.searchCostum>[0],
  )) as unknown as { results?: unknown[] };
  const articles = (page?.results ?? []).map(norm).filter((a) => a.id || a.slug);

  const origin = getSitePublicUrl().replace(/\/$/, "");
  const feedUrl = `${origin}/blog/feed.xml`;
  const homeUrl = `${origin}/blog`;

  const items = articles.map((a) => {
    const link = a.slug ? `${origin}/blog/${a.slug}` : `${origin}/blog/id/${a.id}`;
    const body = a.shortDescription
      || (typeof a.description === "string" ? stripMarkdown(a.description).slice(0, 500) : "");
    const pubDate = typeof a.created === "number"
      ? new Date(a.created < 2e10 ? a.created * 1000 : a.created).toUTCString() : "";
    const img = a.profilImageUrl || a.profilMediumImageUrl;
    return `<item>`
      + `<title>${esc(a.name)}</title>`
      + `<link>${esc(link)}</link>`
      + `<guid isPermaLink="true">${esc(link)}</guid>`
      + (pubDate ? `<pubDate>${pubDate}</pubDate>` : "")
      + `<description>${esc(body)}</description>`
      + (img ? `<enclosure url="${esc(img)}" type="image/jpeg" length="0"/>` : "")
      + `</item>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`
    + `<channel>`
    + `<title>${esc(title)}</title>`
    + `<link>${esc(homeUrl)}</link>`
    + `<atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml"/>`
    + `<description>${esc(description || title)}</description>`
    + `<language>fr</language>`
    + items
    + `</channel></rss>`;
}
