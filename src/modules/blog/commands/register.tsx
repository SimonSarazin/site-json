/**
 * Source de commandes du module blog : recherche d'ARTICLES (POI `type:"article"`) scopés au costum, via
 * `entity.searchCostum`. Au clic → navigation vers le reader blog (`/blog/:slug` ou `/blog/id/:id`), PAS
 * `/profil/:slug` (c'est ce qui distingue cette source de `profil:entities`). Source ASYNC (exécutée à
 * l'ouverture + requête ≥ 2 caractères). Dégradation propre : `[]` sans backend, sans config, ou sur erreur.
 *
 * Config via `commandPalette.articleSearch` : `{ enabled?, costumSlug (requis), limit?, detailBasePath? }`.
 */
import { Newspaper } from "lucide-react";
import { registerCommandSource } from "@/modules/commandPalette";
import type { Command, CommandReadContext } from "@/modules/commandPalette";
import { buildSearchPayload } from "@/modules/search/lib/buildSearchPayload";

interface ArticleResult {
  id?: string;
  slug?: string;
  serverData?: { name?: string; slug?: string; id?: string };
}

registerCommandSource({
  namespace: "blog:articles",
  async: true,
  groups: [{ id: "blog:articles", heading: { fr: "Articles", en: "Articles" }, order: 40 }],
  getCommands: async (ctx: CommandReadContext): Promise<Command[]> => {
    const { entity, query } = ctx;
    const cfg = ctx.config.commandPalette?.articleSearch;

    if (!cfg || cfg.enabled === false || !cfg.costumSlug) return [];
    if (!entity || query.trim().length < 2) return [];

    const limit = cfg.limit ?? 8;
    // Reader CANONIQUE unique = /blog (cf. items 2+3, detailBasePath déprécié). Forcé pour éviter tout
    // open-redirect : un base configurable vide + slug `//host` produirait une URL protocol-relative.
    const base = "/blog";

    let results: ArticleResult[] = [];
    try {
      // Payload canonique (filters type=article + scope costum + name + tri date DESC), comme le fil.
      // Les articles EN ATTENTE ne sont pas proposés : applyValidationGate le pose (costumSlug présent). §16.
      const payload = buildSearchPayload(
        { defaultFilters: { type: "article" }, defaultSortBy: { created: -1 }, costumSlug: cfg.costumSlug, sourceKey: [cfg.costumSlug] } as never,
        { name: query, type: ["poi"], indexStep: limit },
      );
      const page = (await entity.searchCostum(
        payload as unknown as Parameters<typeof entity.searchCostum>[0],
      )) as unknown as { results?: ArticleResult[] };
      results = page?.results ?? [];
    } catch (err) {
      console.error("[commandPalette] blog article search failed", err);
      return [];
    }

    return results.slice(0, limit).map((e): Command => {
      const slug = e.slug ?? e.serverData?.slug;
      const id = e.id ?? e.serverData?.id;
      const name = e.serverData?.name ?? slug ?? "—";
      // slug prioritaire → /blog/:slug ; sinon /blog/id/:id (les ~82 % d'articles slugless).
      const href = slug ? `${base}/${slug}` : id ? `${base}/id/${id}` : null;
      return {
        id: `blog:${id ?? slug ?? name}`,
        label: name,
        keywords: [query, "article"],
        icon: <Newspaper className="h-5 w-5 text-muted-foreground" />,
        group: "blog:articles",
        perform: (run) => {
          if (href) run.navigate(href);
          run.close();
        },
      };
    });
  },
});
