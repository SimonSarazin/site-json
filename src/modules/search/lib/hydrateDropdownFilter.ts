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
 *  - sinon, les valeurs reconnues de l'URL sont appliquées (`apply`), sous forme d'ids d'options.
 *
 * RAPPROCHEMENT URL ⇄ OPTION : délégué à `resolveOptionInList` (`dropdownFilters.ts`), la chaîne
 * déjà utilisée par le clic sur une facette (`useDropdownFilterNav`, `ClickableFacet`) — id exact,
 * puis `value` normalisée, puis libellé normalisé. Comparer aux seuls `id` (version d'origine)
 * laissait tomber SANS TRACE toute URL portant la valeur affichée plutôt que le slug : c'est le cas
 * des liens ENGENDRÉS par un menu `dynamicList` du header, qui portent la valeur brute de
 * `costum.lists` alors que l'option correspondante, venue du socle de config, garde son id de slug
 * (`withDeclared`) — le visiteur arrivait sur la bonne page, non filtrée. Même tolérance que
 * `computeFiltersFromUrl` (sidebar `filters`, `name || id`) : une seule convention pour les deux
 * mécanismes de filtrage.
 */
import { resolveOptionInList } from "./dropdownFilters";
import type { DropdownOptionConfig } from "./dropdownFilters";

export interface FilterHydrationInput {
  /** Valeur brute lue dans l'URL pour ce filtre (chaîne vide si le paramètre est absent). */
  raw: string;
  /** Dernière valeur brute déjà traitée pour ce filtre (`undefined` = jamais). */
  lastAppliedRaw: string | undefined;
  /** Le filtre a-t-il fini de résoudre ses options (statique ou recette dynamique) ? */
  optionsReady: boolean;
  /** Une sélection est-elle actuellement active pour ce filtre ? */
  hasCurrentSelection: boolean;
  /**
   * Options RÉSOLUES du filtre (socle de config + valeurs `costum.lists`, cf.
   * `useDynamicFilterOptions`) — sert à reconnaître la valeur de l'URL et à écarter les
   * identifiants inconnus/périmés.
   */
  options: readonly DropdownOptionConfig[];
}

export type FilterHydrationDecision =
  | { action: "skip" }
  | { action: "wait" }
  | { action: "clear" }
  | { action: "apply"; ids: string[] };

export function resolveFilterHydration(input: FilterHydrationInput): FilterHydrationDecision {
  const { raw, lastAppliedRaw, optionsReady, hasCurrentSelection, options } = input;
  if (lastAppliedRaw === raw) return { action: "skip" };
  if (!raw) return hasCurrentSelection ? { action: "clear" } : { action: "skip" };
  if (!optionsReady) return { action: "wait" };
  const ids: string[] = [];
  for (const segment of raw.split(",")) {
    // Pendant de l'encodage à l'écriture : une valeur peut contenir une virgule (cf.
    // `dropdownFilterToParam`/`buildDynamicNavChildren`, qui l'encodent pour cette raison).
    let valeur = segment.trim();
    try {
      valeur = decodeURIComponent(valeur);
    } catch {
      /* séquence d'échappement invalide : on garde la valeur telle quelle */
    }
    const option = resolveOptionInList(options, valeur);
    // Dédoublonné : deux graphies de la MÊME option dans l'URL (`?theme=la-sante,La santé`) ne
    // doivent pas produire deux fois la même sélection.
    if (option && !ids.includes(option.id)) ids.push(option.id);
  }
  return ids.length ? { action: "apply", ids } : { action: "skip" };
}
