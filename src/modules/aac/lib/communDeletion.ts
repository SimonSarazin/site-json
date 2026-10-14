import type { CagnotteResource } from "@/modules/cagnotte/types";

/**
 * Ce que la suppression d'un commun doit savoir avant de proposer quoi que ce soit : l'argent
 * déjà engagé, et ce qui disparaîtrait avec lui. Fonction pure : la règle qui REFUSE une
 * suppression doit être vérifiable sans monter un composant.
 */

export interface CommunDeletionPlan {
  /** Projet rattaché au commun, `null` s'il n'y en a pas. */
  projectId: string | null;
  /** Actions du projet, tous paliers confondus — supprimées seulement sur demande. */
  actionIds: string[];
  /** Nombre de versements enregistrés sur le commun, clôturés compris. */
  paymentCount: number;
  /** Somme des versements. Sert au message de refus, jamais à la décision. */
  paymentAmount: number;
  /**
   * Dès qu'un versement existe, le commun porte une trace comptable : le supprimer effacerait
   * la contrepartie de sommes engagées. Le retrait de l'annuaire (`useCommunSelectionAction`)
   * reste la voie non destructive.
   */
  isBlocked: boolean;
}

const EMPTY_PLAN: CommunDeletionPlan = {
  projectId: null,
  actionIds: [],
  paymentCount: 0,
  paymentAmount: 0,
  isBlocked: false,
};

/**
 * Analyse l'enveloppe de financement d'un commun.
 *
 * Les versements se comptent sur `items[].allFunding`, et sur rien d'autre :
 * `resourceFinancedAmount` ne somme que les paliers OUVERTS, si bien qu'un commun financé puis
 * clôturé afficherait 0 € et redeviendrait supprimable ; et `funding` seul manquerait les lignes
 * reconstruites depuis les financeurs bruts, le chemin courant d'un AAC.
 *
 * Aucun filtrage par statut : promesse comme versement bloquent la suppression.
 */
export function resolveCommunDeletionPlan(
  resource: CagnotteResource | null | undefined
): CommunDeletionPlan {
  if (!resource) return EMPTY_PLAN;

  const items = Array.isArray(resource.items) ? resource.items : [];

  const versements = items.flatMap((item) =>
    Array.isArray(item?.allFunding) ? item.allFunding : []
  );

  const actionIds = items
    .flatMap((item) => (Array.isArray(item?.actions) ? item.actions : []))
    .map((action) => action?.id)
    .filter((id): id is string => typeof id === "string" && id !== "");

  const paymentAmount = versements.reduce((somme, v) => {
    const montant = Number(v?.amount);
    return somme + (Number.isFinite(montant) ? montant : 0);
  }, 0);

  return {
    projectId: resource.projectId || null,
    // Dédoublonné : une même action peut être rattachée à deux paliers, et on ne
    // veut pas la supprimer deux fois (la seconde échouerait en 404).
    actionIds: [...new Set(actionIds)],
    paymentCount: versements.length,
    paymentAmount,
    isBlocked: versements.length > 0,
  };
}
