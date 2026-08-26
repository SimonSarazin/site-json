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
import { entityMatchData, firstMatching } from "@/lib/entityMatch";
import { applyValidationGate } from "@/modules/search/lib/validationGate";

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
      const params = (cfg?.params ?? {}) as Record<string, unknown>;
      // La palette appelle `searchCostum` EN DIRECT, hors `buildSearchPayload` : sans cet appel la
      // porte de validation n'existe pas ici, et une fiche en attente reste atteignable au ⌘K sur
      // toutes les pages alors qu'elle n'apparaît dans aucune liste (défaut mesuré, commit e3f1a060).
      // Le slug vient de `params.costumSlug` s'il est écrit, sinon du costum porteur du site.
      const filters = applyValidationGate(params.filters as Record<string, unknown> | undefined, {
        costumSlug: params.costumSlug ?? entity.slug,
        notSourceKey: params.notSourceKey,
        types: searchType as string[],
      });
      const payload = {
        searchType,
        name: query,
        indexMin: 0,
        indexStep: limit,
        ...params,
        ...(filters && Object.keys(filters).length > 0 ? { filters } : {}),
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
      // Icône : 1re règle `iconRules` dont le prédicat matche → DynamicIcon ; sinon icône par défaut du type.
      // `entityMatchData` construit la vue matchable (serverData + collection/sourceKey/sourceKeys, chemins
      // pointés résolus) et `firstMatching` porte la GARDE : une règle malformée (ex. `op:"matches"` avec un
      // regex invalide) est ignorée au lieu de faire renvoyer `[]` à toute la source (annuaire vidé).
      const iconName = firstMatching(cfg?.iconRules, entityMatchData(e), (err) =>
        console.warn("[commandPalette] iconRule invalide, ignorée :", err),
      )?.icon;
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
