import { useQuery } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useHydratedUserContextId } from "@/hooks/useHydratedUserContextId";
import getValueByPath from "@/helpers/getValueByPath";
import { PROFIL_QUERY_KEYS } from "../constants/queryKeys";
import { SIMILAR_PLACES_FIELDS_MAP } from "../constants/similarPlacesFieldsMap";
import type { Organization } from "@communecter/cocolight-api-client";

/**
 * Surface SDK dont ce hook dépend, ACTUELLEMENT ABSENTE des types générés de
 * `cocolight-api-client` — le lot qui l'ajoutait (`FRANCETIERSLIEUX_ANSWERDIRECTORY`/
 * `FRANCETIERSLIEUX_GETAGGREGATETR`, variant `searchCostum` "franceTierslieux-answerdirectory") a
 * été mis de côté par `git stash` le 29/09 (onglet « Similaires » retiré de l'UI — décision
 * produit, pas un abandon : ce fichier reste tel quel pour repartir sans réécriture le jour où
 * l'onglet revient, cf. `doc-projets/tiers-lieux.md`). Cast minimal pour garder ce fichier
 * compilable pendant la pause — à supprimer et retyper CONTRE LE VRAI SDK au `git stash pop`.
 */
interface EndpointApiFranceTierslieuxStashe {
  francetierslieuxAnswerdirectory: (data: Record<string, unknown>) => Promise<unknown>;
  francetierslieuxGetaggregatetr: (data: Record<string, unknown>) => Promise<unknown>;
}

/**
 * `{"$or": {"_id": {"$in": orgIds}, "vote.<userId>": {"$exists": true}}}` — portage EXACT de
 * `myOrga.myOrgaFilter` (`listOrga.php:83-88`) : PAS un id de critère figé (`vote.<userId>` change
 * selon le compte connecté, corrigé après une lecture initiale erronée — cf. le document de
 * spécification SDK `answerdirectory`).
 */
export function buildMyOrgaFilter(orgIds: readonly string[], userId: string): Record<string, unknown> {
  return { $or: { _id: { $in: [...orgIds] }, [`vote.${userId}`]: { $exists: true } } };
}

/**
 * Construit `allPaths` pour `getaggregatetr` à partir des réponses (`org.answers.answers`) des
 * organisations membres — portage EXACT de `listOrga.php:279-297`, bug INCLUS (délibérément, pas une
 * correction) : le JS legacy initialise `allPaths[keyPath] = []` mais écrit toujours
 * `allPaths[valuePath]` (une clé DIFFÉRENTE, `keyPath` étant le suffixe de `valuePath`), donc
 * `allPaths[keyPath]` reste pour toujours vide et n'entre jamais dans l'union — chaque chemin est
 * réécrit (pas accumulé) par la DERNIÈRE organisation qui porte une réponse à ce chemin. Avec un
 * tout petit nombre de lieux membres, la « similarité » porte donc surtout sur le dernier lieu
 * traité. C'est le comportement RÉEL du legacy, reproduit à l'identique plutôt que « corrigé »
 * silencieusement (CLAUDE.md : ne pas déduire une règle métier depuis le code, ni la modifier sans
 * validation).
 *
 * Prend des objets ORGANISATION BRUTS (pas des instances `Organization` du SDK) — cf. le commentaire
 * sur `fetchOrgsAvecReponses` : `Organization._transformServerData` réécrit tout champ `.answers`
 * en présumant la forme `navigator/gettl` (`{formId: AnswerDoc[]}`), incompatible avec celle
 * qu'ajoute `answerdirectory` ici (`.answers` = UN document Answer, dont le propre sous-champ
 * `.answers` porte les réponses keyées par étape) — l'auto-liaison démolit silencieusement cette
 * structure si on la laisse s'appliquer.
 */
export function buildAllPaths(orgs: readonly Record<string, unknown>[]): Record<string, unknown[] | string> {
  const allPaths: Record<string, unknown[] | string> = {};
  for (const org of orgs) {
    const answers = getValueByPath(org, "answers.answers");
    if (!answers || typeof answers !== "object") continue;
    for (const valuePath of Object.values(SIMILAR_PLACES_FIELDS_MAP)) {
      const answerPath = valuePath.replace(/^answers\./, "");
      const answerValue = getValueByPath(answers as Record<string, unknown>, answerPath);
      if (Array.isArray(answerValue)) {
        allPaths[valuePath] = [...new Set(answerValue)];
      } else if (typeof answerValue === "string") {
        allPaths[valuePath] = answerValue;
      }
    }
  }
  return allPaths;
}

/** `Object.values(links.organizations)[0].name` par résultat — portage de `listOrga.php:315-320`. */
export function extractOrgNames(profileResults: readonly unknown[]): string[] {
  const noms: string[] = [];
  for (const profil of profileResults) {
    const orgs = getValueByPath(profil as Record<string, unknown>, "links.organizations");
    if (orgs && typeof orgs === "object") {
      const premiere = Object.values(orgs as Record<string, { name?: string }>)[0];
      if (premiere?.name) noms.push(premiere.name);
    }
  }
  return noms;
}

/**
 * « Mes lieux », onglet 5 (Tiers-lieux similaires) — portage à 3 requêtes séquentielles de
 * `myOrga.sections.mySimilarTr` (`listOrga.php:268-330`) :
 *  1. `answerdirectory` sur les lieux DÉJÀ membres (`myOrgaFilter`) → leurs réponses au formulaire.
 *  2. Agrégation CLIENT (`buildAllPaths`, bug legacy inclus) → `getaggregatetr` → scores + NOMS
 *     d'organisations similaires (`links.organizations.<id>.name`).
 *  3. `answerdirectory` filtré par ces noms → fiches complètes à afficher.
 *
 * Chaque requête ne part QUE si les précédentes ont abouti — pas de fallback silencieux : sans
 * réponse/`answers` sur aucun lieu membre, `allPaths` reste vide et `getaggregatetr` ne renverrait
 * rien d'utile (limite serveur), donc court-circuité ici (`enabled` interne à `queryFn`).
 */
export function useSimilarPlacesQuery(
  orgIds: readonly string[],
  options?: { enabled?: boolean },
) {
  const { entity, api, me } = useCocolight();
  const userContextId = useHydratedUserContextId();
  const userId = me?.id;

  return useQuery<Organization[]>({
    queryKey: [...PROFIL_QUERY_KEYS.SIMILAR_PLACES(orgIds, userContextId)],
    queryFn: async () => {
      if (!entity || !api || !userId) return [];

      // Étape 1 : appel DIRECT à l'endpoint (pas `entity.searchCostum()`) — volontaire, cf.
      // `buildAllPaths`. `searchCostum()` fait passer chaque résultat par
      // `Organization._transformServerData`, qui réécrit `.answers` en présumant la forme
      // `navigator/gettl` et démolit celle qu'ajoute `answerdirectory` ici. Contexte costum
      // reconstruit à la main (ce que fait `_withCostumContext` en interne pour les autres appels).
      const costumSlug = entity.serverData?.slug ?? "";
      const costumId = entity.id ?? undefined;
      const costumType = entity.getEntityType() as "organizations" | "projects";
      const endpointApi = api.endpointApi as unknown as EndpointApiFranceTierslieuxStashe;
      const reponseBrute = await endpointApi.francetierslieuxAnswerdirectory({
        searchType: ["organizations"],
        countType: ["organizations"],
        filters: buildMyOrgaFilter(orgIds, userId),
        notSourceKey: true,
        indexMin: 0,
        indexStep: orgIds.length || 1,
        fields: [],
        // Ajv (`useDefaults`) les compléterait de toute façon dans `searchCostum()` — posés ici EN
        // DUR car l'appel direct à `endpointApi` (pour contourner l'auto-liaison, cf. plus haut)
        // exige le type strict `FrancetierslieuxAnswerdirectoryData`, non `Partial<...>`.
        initType: "",
        count: true,
        fediverse: false,
        costumEditMode: false,
        costumSlug,
        contextId: costumId,
        contextType: costumType,
        costumId,
        costumType,
        sourceKey: costumSlug ? [costumSlug] : [],
      });
      const orgsAvecReponses = ((reponseBrute as { results?: unknown[] })?.results ?? []) as Record<string, unknown>[];

      const allPaths = buildAllPaths(orgsAvecReponses);
      if (Object.keys(allPaths).length === 0) return [];

      const scores = await endpointApi.francetierslieuxGetaggregatetr({ allPaths, limit: 30 });
      const profileResults = (scores as { profileResults?: unknown[] })?.profileResults ?? [];
      const orgaNames = extractOrgNames(profileResults);
      if (orgaNames.length === 0) return [];

      // Étape 3 : affichage — entités liées voulues ici (EntityCard attend une vraie Organization).
      // Variant "franceTierslieux-answerdirectory" absent du type `SearchCostumVariant` pendant la
      // pause (cf. commentaire en tête de fichier) — cast au lieu d'un `as SearchCostumVariant` qui
      // échouerait, `searchCostum` reste sinon inchangé.
      const similaires = await entity.searchCostum(
        {
          searchType: ["organizations"],
          filters: { name: { $in: orgaNames } },
          notSourceKey: true,
          indexMin: 0,
          indexStep: 30,
          fields: [],
        },
        { variant: "franceTierslieux-answerdirectory" } as unknown as Parameters<typeof entity.searchCostum>[1],
      );
      return similaires.results as unknown as Organization[];
    },
    enabled: orgIds.length > 0 && !!userId && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
  });
}
