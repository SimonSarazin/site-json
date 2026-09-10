/**
 * Préchargement SSR de la fiche d'un commun (`/aac/commun/:answerId`).
 *
 * La fiche est un lien PARTAGEABLE : son `<head>` doit porter le titre, le
 * résumé et l'image du commun au moment où le robot ou l'aperçu de messagerie
 * lit la réponse HTTP — pas après hydratation. Sans rien de préchargé côté
 * serveur, `answerQuery` était en chargement au rendu SSR et la page n'émettait
 * que son SEO de repli (titre générique, ni `og:description` ni `og:image`).
 *
 * Patron identique à `blog/prefetch/prefetchArticle` : un `loader` de route
 * remplit le cache que le rendu lira, puis `entry-server` le déshydrate. Ne sont
 * préchargées QUE des données sérialisables — `serialize(dehydratedState,
 * { isJSON: true })` traverse tout l'état : `answer.serverData` et
 * `form.serverData` sont des documents JSON, pas des instances du SDK.
 */
import type { QueryClient } from "@tanstack/react-query";
import { getBaseUrl } from "@/lib/constant/common";
import { initApi, type InitApiResult } from "@/lib/apiClient";
import type { CoFormAnswer, CoFormData } from "@/modules/coform/types";

/**
 * Les clés des deux requêtes de la fiche — PARTAGÉES avec `AacCommunDetailPage`,
 * qui les lit par ces mêmes fonctions. Précharger sous une clé recopiée à la
 * main, c'est remplir une entrée que la page ne lira jamais.
 *
 * Le dernier segment est le lecteur : `answer.serverData` et
 * `form.serverData.access` portent un `access` calculé POUR LUI (même motif que
 * `COFORM_QUERY_KEYS.FORM`). Au SSR il vaut celui de l'init de la requête —
 * anonyme tant que le serveur ne porte pas de session.
 */
export const COMMUN_ANSWER_QUERY_KEY = (answerId: string | null, userId: string | null = null) =>
  ["aac-commun-detail", answerId, userId] as const;

export const COMMUN_FORM_QUERY_KEY = (formId: string | null, userId: string | null = null) =>
  ["aac-commun-form", formId, userId] as const;

/**
 * L'init API de CETTE requête SSR, sous la MÊME entrée de cache
 * qu'`entry-server` (`["cocolight-init"]`, la seule que sa déshydratation
 * exclut). Les loaders tournant avant elle, c'est le loader qui la crée et
 * `entry-server` qui la retrouve : un aller-retour d'init, pas deux.
 */
function ensureApi(queryClient: QueryClient): Promise<InitApiResult> {
  return queryClient.ensureQueryData({
    queryKey: ["cocolight-init"],
    queryFn: () => initApi({ baseURL: getBaseUrl() }),
  });
}

/**
 * Précharge la réponse (le commun) puis le formulaire qui fait autorité.
 *
 * @param siteFormId `config.aac.formId` — le formulaire de L'APPEL COURANT, que
 *   la page préfère à celui du dépôt (`answer.form`), exactement comme
 *   `directory.formId ?? originFormId`. Le repli n'est lu qu'à défaut.
 */
export async function prefetchCommunDetail(
  queryClient: QueryClient,
  answerId: string,
  siteFormId: string | null = null
): Promise<void> {
  const { api, me } = await ensureApi(queryClient);
  if (!api) return;

  const userId = me?.id ?? null;

  const answer = await queryClient.ensureQueryData({
    queryKey: COMMUN_ANSWER_QUERY_KEY(answerId, userId),
    queryFn: async (): Promise<CoFormAnswer> => {
      const res = await api.answer({ id: answerId });
      return res.serverData as unknown as CoFormAnswer;
    },
  });

  const formId = siteFormId || answer?.form || null;
  if (!formId) return;

  await queryClient.ensureQueryData({
    queryKey: COMMUN_FORM_QUERY_KEY(formId, userId),
    queryFn: async (): Promise<CoFormData> => {
      const res = await api.form({ id: formId });
      return res.serverData as unknown as CoFormData;
    },
  });
}
