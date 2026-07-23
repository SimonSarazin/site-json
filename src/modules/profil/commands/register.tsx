/**
 * Source de commandes du module profil : recherche d'entités backend
 * (organisations, projets, events, POI, citoyens) via `entity.searchCostum`.
 *
 * Source ASYNC : exécutée seulement à l'ouverture de la palette ET quand la
 * requête fait >= 2 caractères (cf. `useCommands`). Dégradation propre :
 * renvoie `[]` si aucune entité costum n'est chargée (pas de backend) ou en cas
 * d'erreur — la palette continue de fonctionner avec les autres sources.
 *
 * Payload configurable via `commandPalette.entitySearch` :
 *   { enabled?, searchType?, limit?, params?, itemAction?, itemActionByType? }
 * - `enabled: false` désactive complètement la source.
 * - `searchType` : types d'entités cherchés (défaut : les 5 types).
 * - `limit` : nombre max de résultats (défaut 8 ; passé en `indexStep`).
 * - `params` : champs additionnels fusionnés dans le payload `searchCostum`
 *   (avancé : `filters`, `notSourceKey`, scope costum, …).
 * - `itemAction` / `itemActionByType` : action au clic — `{kind: "profil"}`
 *   (défaut, navigation `/profil/:slug`) ou `{kind: "preview", detailsMode?,
 *   preview?}` (détail du module search, pattern rowAction observatoire) ;
 *   surchargeable par type d'entité (clé ex. `"poi"`).
 */
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { SearchEntity } from "@communecter/cocolight-api-client";
import { registerCommandSource } from "@/modules/commandPalette";
import type { Command, CommandReadContext } from "@/modules/commandPalette";
import { getEntityIcon } from "@/lib/entityIcons";
import { check } from "@/modules/formEngine/engine/conditional";
import type { Predicate, FormValues } from "@/modules/formEngine/types";
import { resolveServerDataPath } from "@/modules/search/lib/dropdownFilters";

const DEFAULT_ENTITY_TYPES = ["organizations", "projects", "events", "poi", "citoyens"];

interface SearchResultEntity {
  id?: string;
  slug?: string;
  serverData?: { name?: string; slug?: string; type?: string };
  getEntityType?: () => string;
}

registerCommandSource({
  namespace: "profil:entities",
  async: true,
  groups: [{ id: "profil:entities", heading: { fr: "Annuaire", en: "Directory" }, order: 50 }],
  getCommands: async (ctx: CommandReadContext): Promise<Command[]> => {
    const { entity, query } = ctx;
    const cfg = ctx.config.commandPalette?.entitySearch;

    if (cfg?.enabled === false) return [];
    if (!entity || query.trim().length < 2) return [];

    const searchType = cfg?.searchType ?? DEFAULT_ENTITY_TYPES;
    const limit = cfg?.limit ?? 8;

    let results: SearchResultEntity[] = [];
    try {
      const payload = {
        searchType,
        name: query,
        indexMin: 0,
        indexStep: limit,
        ...(cfg?.params ?? {}),
      };
      const page = (await entity.searchCostum(
        payload as unknown as Parameters<typeof entity.searchCostum>[0]
      )) as unknown as { results?: SearchResultEntity[] };
      results = page?.results ?? [];
    } catch (err) {
      console.error("[commandPalette] profil entity search failed", err);
      return [];
    }

    // Exclusion par sous-type POI (serverData.type) — ex. les articles, gérés par la source blog:articles.
    const exclude = new Set(cfg?.excludeTypes ?? []);
    const kept = exclude.size > 0
      ? results.filter((e) => !exclude.has(e.serverData?.type ?? ""))
      : results;

    return kept.slice(0, limit).map((e): Command => {
      const type = e.getEntityType?.() ?? "poi";
      const subType = e.serverData?.type;
      const slug = e.slug ?? e.serverData?.slug;
      const name = e.serverData?.name ?? slug ?? "—";
      // Action au clic : surcharge par SOUS-TYPE POI (`serverData.type`, ex. recoveryCenter/affiche) >
      // par TYPE d'entité (`poi`/`events`) > défaut global > navigation profil.
      const itemAction =
        (subType ? cfg?.itemActionBySubType?.[subType] : undefined) ??
        cfg?.itemActionByType?.[type] ??
        cfg?.itemAction;
      // Données du prédicat iconRules : `serverData` + `collection` injecté, DERRIÈRE un Proxy qui résout
      // les chemins pointés (`address.addressLocality`, …) via `resolveServerDataPath` → un prédicat peut
      // matcher n'importe quel champ, même imbriqué (pas seulement le top-level).
      const matchData = new Proxy(
        { ...((e.serverData ?? {}) as Record<string, unknown>), collection: type },
        {
          get: (t, p) =>
            typeof p === "string" && p.includes(".") ? resolveServerDataPath(t, p) : t[p as keyof typeof t],
        },
      ) as unknown as FormValues;
      // Icône : 1re règle `iconRules` dont le prédicat matche → DynamicIcon ; sinon icône par défaut du type.
      // GUARD : une règle malformée (ex. `op:"matches"` avec un regex invalide → `new RegExp` throw) NE doit
      // PAS remonter hors de ce map (elle ferait renvoyer `[]` à toute la source → annuaire vidé). On l'ignore.
      let iconName: string | undefined;
      try {
        iconName = cfg?.iconRules?.find((r) => check(r.when as Predicate, matchData))?.icon;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[commandPalette] iconRule invalide, ignorée :", err);
      }
      return {
        id: `profil:${e.id ?? slug ?? name}`,
        label: name,
        keywords: [query, type],
        icon: iconName
          ? <DynamicIcon name={iconName as IconName} className="h-5 w-5" />
          : getEntityIcon(type, { className: "h-5 w-5", withColor: true }),
        group: "profil:entities",
        perform: (run) => {
          if (itemAction?.kind === "preview" && run.openEntityPreview) {
            run.close();
            // Le résultat searchCostum EST une entité SDK vivante — l'interface
            // locale SearchResultEntity n'en lit qu'une vue étroite.
            run.openEntityPreview(e as unknown as SearchEntity, {
              detailsMode: itemAction.detailsMode,
              preview: itemAction.preview,
              list: itemAction.list,
            });
            return;
          }
          if (slug) run.navigate(`/profil/${slug}`);
          run.close();
        },
      };
    });
  },
});
