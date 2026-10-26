import { useMemo } from "react";
import type { MapConf } from "@/modules/search/schema";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import type { UserWithContributions } from "../../../helpers/summary";
import { buildContributorsMapModel } from "../../../utils/ampliUsersGeo";
import { useContributorCities } from "../../../hooks/useContributorCities";
import { MeeteemMap } from "./MeeteemMap";

/**
 * Conf carte des contributeurs — constante de MODULE, pas un littéral inline :
 * `SearchMap` mémoïse ses marqueurs sur l'identité de cet objet, une référence
 * neuve à chaque rendu re-rendrait tous les marqueurs.
 *
 * `useItemImage` rend l'avatar du contributeur en vignette ronde plutôt qu'une
 * goutte anonyme — cohérent avec la vue liste (`AmpliUserCard`), qui affiche
 * déjà ces mêmes avatars. Un contributeur sans photo retombe sur la goutte.
 */
const CONTRIBUTORS_MAP_CONF: MapConf = { marker: { useItemImage: true } };

interface AmpliContributorsMapProps {
  /** Contributeurs agrégés — cf. `getSummaryData(...).users`. */
  users: UserWithContributions[];
  /** Query en cours : sans ce garde, la carte annoncerait « aucun contributeur
   *  localisé » avant même que les données arrivent. */
  isLoading: boolean;
  /** Query pas encore lancée (`entity` non initialisée) — `isLoading` est alors
   *  FAUX alors que rien n'est chargé, d'où les deux gardes. */
  isPending: boolean;
  /** La requête a ÉCHOUÉ. Indispensable : en react-query un échec définitif met
   *  `isLoading` ET `isPending` à faux, donc sans ce troisième signal une panne
   *  du backend s'afficherait comme l'affirmation « aucun contributeur
   *  localisé » — un mensonge, puisque rien n'a été chargé. */
  isError?: boolean;
}

/**
 * Carte des contributeurs du tab « community ».
 *
 * Les auteurs sont déjà projetés avec leurs coordonnées par la requête du
 * renderer (`geo` / `geoPosition` à la racine de leur `serverData`) : cette vue
 * ne déclenche AUCUN appel réseau, elle convertit ce qu'elle a déjà.
 *
 * Le compteur « X sur Y localisés » n'est pas décoratif : `SearchMap` écarte
 * silencieusement toute entité sans coordonnées, et sur ce tab un contributeur
 * non géolocalisé est le cas NOMINAL (l'adresse Communecter est souvent
 * renseignée sans géocodage). Sans lui, la carte mentirait par omission.
 *
 * Export DÉFAUT : `AmpliCommunity` est importé en eager par
 * `AmpliSectionRenderer`, ce module doit donc rester chargeable en `lazy()`
 * (il tire tout le stack carte : MapLibre, supercluster, i18n search).
 */
export default function AmpliContributorsMap({ users, isLoading, isPending, isError = false }: AmpliContributorsMapProps) {
  const t = useT("modules/ampli");
  const { currentLocale } = useLocalization();

  // Le parent recrée `data` à chaque rendu (littéraux inline dans
  // `AmpliSectionRenderer`) : sans mémo, `results` changerait d'identité à
  // chaque frappe d'état et re-rendrait toute la carte.
  // La popup n'a qu'un champ de texte libre (`shortDescription`) : on y met le
  // nombre de contributions, qui est le sujet même de ce tab — sinon la popup
  // n'affiche que ce que le marqueur montre déjà.
  // Les contributeurs sans coordonnées propres sont placés au centre de leur
  // commune : l'annuaire les affiche avec leur ville, une carte qui les omet
  // montre moins de points que de fiches.
  const { cityCoords, isResolving } = useContributorCities(users);

  const { entities, located, total } = useMemo(
    () =>
      buildContributorsMapModel(users, {
        cityCoords,
        formatContributions: (count) =>
          String(
            t(count > 1 ? "AmpliUserCard.contributions_other" : "AmpliUserCard.contributions_one", undefined, {
              count: String(count),
            }),
          ),
      }),
    // On dépend de la LANGUE, pas de `t` : `useT` rend une NOUVELLE fonction à
    // chaque rendu, la mettre en dépendance annulerait ce mémo — et reconstruire
    // toutes les entités ferait reconstruire l'index de clustering et re-rendre
    // tous les marqueurs. `currentLocale` est la seule chose dont le libellé
    // dépend réellement (`I18nBridge` aligne i18next dessus).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, currentLocale, cityCoords],
  );

  // `isResolving` compte : sans lui, la carte afficherait « aucun contributeur
  // localisé » (ou un compteur faux) le temps que les communes reviennent.
  const isComplete = !isLoading && !isPending && !isResolving;
  const missing = total - located;

  return (
    <div className="py-5">
      <MeeteemMap
        entities={entities}
        // Pas de chargement par pages ici : la requête du renderer pose
        // `indexStep: 0` (périmètre complet en une fois), donc rien à annoncer
        // — `MapProgress` ne rend rien avec ces valeurs.
        loaded={located}
        total={null}
        isComplete={isComplete}
        capped={false}
        isPartial={isError}
        map={CONTRIBUTORS_MAP_CONF}
        emptyMessage={String(t("AmpliCommunity.map.empty"))}
        errorMessage={String(t("AmpliCommunity.map.error"))}
        className="h-80 sm:h-105 md:h-150"
      />
      {isComplete && !isError && missing > 0 && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {String(
            t(
              missing > 1 ? "AmpliCommunity.map.missing_other" : "AmpliCommunity.map.missing_one",
              undefined,
              { count: String(missing), located: String(located), total: String(total) },
            ),
          )}
        </p>
      )}
    </div>
  );
}
