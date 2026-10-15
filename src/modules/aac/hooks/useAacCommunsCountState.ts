/**
 * Le décompte des communs ET sa joignabilité — le socle partagé du médaillon d'`aac-highlight`
 * et des tuiles de stats à source `aacCommuns` (`stats`, `cta-card-grid`).
 *
 * `reachable` dit si le chiffre sera connu UN JOUR. Sans AAC déclaré (`config.aac.formId`) non ;
 * pas davantage si la résolution du formulaire a échoué (formulaire supprimé, 403) ou s'est
 * terminée sans rien produire (pas d'entité costum, donc requête jamais activée) : la requête du
 * décompte attend `resolved` et resterait `pending` pour toujours. Dans tous ces cas c'est une
 * ABSENCE, pas une attente.
 *
 * ⚠ Calculé dès le rendu serveur : un serveur qui n'a pas résolu l'entité voit `reachable` faux là
 * où le client, qui résout la sienne, le verra vrai. Un rendu qui en dépend doit attendre
 * l'hydratation pour conclure à l'absence.
 */
import { useAacCommunsCount } from "./useAacCommunsCount";
import { useAacDirectoryContext } from "./useAacDirectoryContext";

export interface AacCommunsCountState {
  /** `null` tant que le chiffre n'est pas connu — jamais un 0 provisoire. */
  count: number | null;
  error: Error | null;
  reachable: boolean;
}

/** @param wanted la surface veut-elle un chiffre ? Faux ⇒ aucune requête de décompte. */
export function useAacCommunsCountState(wanted: boolean): AacCommunsCountState {
  const context = useAacDirectoryContext();
  const { formId, resolved, isFormLoading, configError } = context;
  const reachable = formId !== null && !configError && (isFormLoading || Boolean(resolved));
  const { count, error } = useAacCommunsCount(context, wanted && reachable);
  return { count, error, reachable };
}
