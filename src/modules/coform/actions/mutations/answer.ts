/**
 * Suppression d'une réponse, et des éléments qu'elle a engendrés — par opposition à
 * `selection.ts`, qui n'écrit que des champs d'une réponse existante.
 *
 * Pas de hook ici : le seul appelant, `useDeleteCommun`, supprime une réponse SANS contexte
 * CoForm — ni formulaire ni réponse chargés — que `createCoFormMutation` lui imposerait.
 */

/** Le sous-ensemble strictement nécessaire du client d'endpoints, pour tester sans réseau. */
export interface AnswerDeletionEndpoint {
  deleteElement: (data: {
    reason: string;
    pathParams: { type: string; id: string };
  }) => Promise<unknown>;
}

/**
 * Supprime un élément par sa collection et son id — geste IRRÉVERSIBLE. Passe par
 * `DELETE_ELEMENT` (`co2/element/delete`), qui retire le document, ses commentaires et ses
 * fichiers.
 *
 * Appel DIRECT à l'endpoint, et non `Answer.delete()` / `Action.delete()` : ces deux entités
 * réimplémentent leur garde client sans consulter `_hasElevatedManageRight`, donc sans
 * `_costumAdminAuthorized`, et refusent localement une suppression que le backend accepte
 * (`Authorisation::canDeleteElement` porte `isCostumAdmin`). Le même garde échoue pour l'auteur
 * d'un commun déposé au nom d'une organisation, `findanswered` remplaçant `serverData.user`.
 * Contournement à retirer dès que le SDK est corrigé.
 *
 * Écart délibéré au legacy, qui appelle `survey/co/delete` : même prédicat d'autorisation, mais
 * cette route-là laisse les commentaires derrière elle et son seul apport, `Answer::removeLinks`,
 * est un point d'extension costum vide hors `ctenat`.
 *
 * Le gate d'affichage, lui, reste côté front (`canDeleteCommun`).
 *
 * @param type collection backend : `"answers"`, `"actions"`, `"projects"`…
 * @param reason raison d'audit transmise au backend, visible dans les journaux.
 */
export async function deleteElementById(
  endpointApi: AnswerDeletionEndpoint,
  type: string,
  id: string,
  reason: string
): Promise<void> {
  await endpointApi.deleteElement({ reason, pathParams: { type, id } });
}
