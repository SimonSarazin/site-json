/**
 * Source de commandes du module profil : recherche d'entités backend
 * (organisations, projets, events, POI, citoyens) via `entity.searchCostum`.
 *
 * Source ASYNC : exécutée seulement à l'ouverture de la palette ET quand la
 * requête fait >= 2 caractères (cf. `useCommands`). Dégradation propre :
 * renvoie `[]` si aucune entité costum n'est chargée (pas de backend) ou en cas
 * d'erreur — la palette continue de fonctionner avec les autres sources.
 */
import { registerCommandSource } from "@/modules/commandPalette";
import type { Command, CommandReadContext } from "@/modules/commandPalette";
import { getEntityIcon } from "@/lib/entityIcons";

interface SearchResultEntity {
  id?: string;
  slug?: string;
  serverData?: { name?: string; slug?: string };
  getEntityType?: () => string;
}

registerCommandSource({
  namespace: "profil:entities",
  async: true,
  groups: [{ id: "profil:entities", heading: { fr: "Annuaire", en: "Directory" }, order: 50 }],
  getCommands: async (ctx: CommandReadContext): Promise<Command[]> => {
    const { entity, query } = ctx;
    if (!entity || query.trim().length < 2) return [];

    let results: SearchResultEntity[] = [];
    try {
      const payload = {
        searchType: ["organizations", "projects", "events", "poi", "citoyens"],
        name: query,
        indexMin: 0,
        indexStep: 8,
      };
      const page = (await entity.searchCostum(
        payload as unknown as Parameters<typeof entity.searchCostum>[0]
      )) as unknown as { results?: SearchResultEntity[] };
      results = page?.results ?? [];
    } catch (err) {
      console.error("[commandPalette] profil entity search failed", err);
      return [];
    }

    return results.slice(0, 8).map((e): Command => {
      const type = e.getEntityType?.() ?? "poi";
      const slug = e.slug ?? e.serverData?.slug;
      const name = e.serverData?.name ?? slug ?? "—";
      return {
        id: `profil:${e.id ?? slug ?? name}`,
        label: name,
        keywords: [query, type],
        icon: getEntityIcon(type, { className: "h-5 w-5", withColor: true }),
        group: "profil:entities",
        perform: (run) => {
          if (slug) run.navigate(`/profil/${slug}`);
          run.close();
        },
      };
    });
  },
});
