/**
 * Décision pure d'hydratation d'UN filtre `dropdownFilters` depuis l'URL — extraite de
 * `SearchHeaderSection.tsx` pour rester testable (composant = JSX + hooks, logique pure à part).
 * Le composant ne fait plus que lire la décision et la dispatcher ; toute la logique de rattrapage
 * vit ici.
 *
 * Le contrat exact (pourquoi chaque branche existe) :
 *  - une valeur d'URL déjà appliquée ne redéclenche rien (`skip`) ;
 *  - une valeur RETIRÉE de l'URL (vide) désélectionne SI quelque chose était sélectionné, sinon ne
 *    fait rien. Un utilisateur qui décoche lui-même une option a déjà vidé la sélection AVANT que
 *    l'URL ne change : cette branche ne fait alors que confirmer un état déjà vide. Un retour
 *    arrière du navigateur, en revanche, change l'URL SANS jamais toucher l'état — c'est ce cas que
 *    `clear` corrige (absent de la version d'origine : le contenu restait filtré sur une valeur que
 *    l'URL affichée ne mentionnait plus) ;
 *  - un filtre à source dynamique n'est hydratable qu'une fois ses valeurs ARRIVÉES (`wait`) — on ne
 *    marque PAS `raw` comme traité dans ce cas, pour retenter au prochain rendu où les options
 *    changent (sans ça, les options déclarées serviraient de repli pendant le chargement, le filtre
 *    paraîtrait prêt, et rejetterait la valeur de l'URL — le deep-link disparaîtrait en silence) ;
 *  - sinon, les ids valides de l'URL sont appliqués (`apply`).
 */
export interface FilterHydrationInput {
  /** Valeur brute lue dans l'URL pour ce filtre (chaîne vide si le paramètre est absent). */
  raw: string;
  /** Dernière valeur brute déjà traitée pour ce filtre (`undefined` = jamais). */
  lastAppliedRaw: string | undefined;
  /** Le filtre a-t-il fini de résoudre ses options (statique ou recette dynamique) ? */
  optionsReady: boolean;
  /** Une sélection est-elle actuellement active pour ce filtre ? */
  hasCurrentSelection: boolean;
  /** ids d'options valides — sert à écarter les identifiants inconnus/périmés de l'URL. */
  optionIds: readonly string[];
}

export type FilterHydrationDecision =
  | { action: "skip" }
  | { action: "wait" }
  | { action: "clear" }
  | { action: "apply"; ids: string[] };

export function resolveFilterHydration(input: FilterHydrationInput): FilterHydrationDecision {
  const { raw, lastAppliedRaw, optionsReady, hasCurrentSelection, optionIds } = input;
  if (lastAppliedRaw === raw) return { action: "skip" };
  if (!raw) return hasCurrentSelection ? { action: "clear" } : { action: "skip" };
  if (!optionsReady) return { action: "wait" };
  const ids = raw
    .split(",")
    // Pendant de l'encodage à l'écriture : une valeur peut contenir une virgule (cf.
    // `dropdownFilterToParam`/`buildDynamicNavChildren`, qui l'encodent pour cette raison).
    .map((s) => {
      try {
        return decodeURIComponent(s.trim());
      } catch {
        return s.trim();
      }
    })
    .filter((id) => optionIds.includes(id));
  return ids.length ? { action: "apply", ids } : { action: "skip" };
}
