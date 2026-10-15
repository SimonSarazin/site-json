/**
 * L'init API (`initApi`) vue comme UNE entrée React Query : `["cocolight-init"]`.
 *
 * Côté serveur, chaque requête HTTP a son `QueryClient` (créé par `entry-server`). Tout ce qui
 * tourne pendant son rendu — `entry-server` lui-même et les loaders de préchargement des routes
 * (recherche, filtres, profil, article, commun) — passe par CETTE entrée au lieu d'appeler
 * `initApi()` directement. React Query dédoublonne les appels concurrents sur une même clé : un
 * seul `ApiClient` et une seule résolution de l'entité porteuse (`getinfo/key` + `element/about`,
 * 51 Ko) par requête, au lieu d'une par loader. Mesuré sur tiers-lieux avant ce partage :
 * `/lieux` = 6 inits (17 appels backend), `/` = 3 (8 appels).
 *
 * L'isolation entre requêtes est inchangée : elle tient au `QueryClient` par requête (vidé à la
 * fermeture de la réponse), pas au nombre d'appels à `initApi`.
 *
 * Si l'init REJETTE (stockage des jetons ou constructeur du client en échec — `initApi` rattrape
 * déjà le reste), React Query ne garde rien : chaque demande suivante de la requête réessaie. C'est
 * le comportement d'avant le partage (un essai par loader), pas une régression, et c'est voulu :
 * un échec passager ne doit pas être mémorisé pour tout le rendu.
 *
 * Côté client, `useCocolightInit` lit la même clé sur le `QueryClient` du navigateur, où `initApi`
 * est de toute façon un singleton.
 *
 * ⚠️ Cette entrée n'est JAMAIS déshydratée (`shouldDehydrateQuery` dans `entry-server`) : elle
 * porte des instances du SDK (`ApiClient`, `Api`), pas du JSON. Les données utiles au client
 * voyagent sous `["cocolight-data"]`.
 */
import type { QueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "./constant/common";
import { initApi, type InitApiResult } from "./apiClient";

/** Clé de l'init API — partagée par `entry-server`, les loaders SSR et `useCocolightInit`. */
export const COCOLIGHT_INIT_QUERY_KEY = ["cocolight-init"] as const;

/**
 * L'init API de ce `queryClient` : créée au premier appel, retrouvée ensuite — y compris par les
 * appels concurrents, qui attendent la même promesse.
 *
 * Pas d'options : une entrée de cache n'a qu'une valeur, des options passées par un deuxième
 * appelant seraient ignorées en silence. L'init SSR se fait toujours sur `getBaseUrl()`.
 */
export function ensureInitApi(queryClient: QueryClient): Promise<InitApiResult> {
  return queryClient.ensureQueryData({
    queryKey: COCOLIGHT_INIT_QUERY_KEY,
    queryFn: () => initApi({ baseURL: getBaseUrl() }),
  });
}
