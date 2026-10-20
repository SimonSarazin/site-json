/**
 * Titre de `searchHeader` reflétant la VALEUR ACTIVE d'un filtre (`headlineFromFilter`).
 *
 * Sert une page dont l'identité est un filtre posé par l'extérieur — `/theme?theme=La+petite+enfance`,
 * atteinte depuis le menu dynamique du header : y afficher « Nos thèmes » perd l'information la plus
 * utile de la page, à savoir DE QUEL thème on parle.
 *
 * Le filtre visé peut être `hidden` : on le cherche donc dans la liste COMPLÈTE des filtres, pas dans
 * le sous-ensemble visible. C'est même le cas d'usage d'origine — une page scopée par un filtre que
 * l'utilisateur ne manipule pas lui-même.
 */

/** Le minimum lu ici d'une option de filtre — le `label` reste opaque (`LocalizedString` ou clé i18n). */
interface OptionLike {
  id: string;
  label: unknown;
}

/** Le minimum lu ici d'un filtre. */
interface FiltreLike {
  id: string;
  options?: OptionLike[];
}

/**
 * Les options de `filtres[id]` correspondant à `selection(filtre)`, **dans l'ordre des options** — pas
 * dans celui de la sélection : le titre d'une page doit être stable, or l'ordre de sélection dépend de
 * l'ordre des clics et de l'URL. Renvoie `[]` si le filtre est introuvable ou rien de sélectionné, ce
 * que l'appelant traduit en « garder le `headline` déclaré ».
 *
 * Une valeur sélectionnée dont l'option n'existe plus (liste dynamique qui a changé, id périmé dans un
 * lien partagé) est simplement ignorée : mieux vaut retomber sur le titre déclaré qu'afficher un id brut.
 */
export function optionsDuTitre<F extends FiltreLike>(
  filtres: readonly F[] | undefined,
  id: string | undefined,
  // Générique sur `F` : l'appelant passe son propre lecteur de sélection, typé sur SON filtre complet
  // (`DropdownFilterConfig`), pas sur le minimum lu ici.
  selection: (filtre: F) => string[],
): OptionLike[] {
  if (!id || !filtres?.length) return [];
  const filtre = filtres.find((f) => f.id === id);
  if (!filtre?.options?.length) return [];
  const ids = new Set(selection(filtre));
  if (ids.size === 0) return [];
  return filtre.options.filter((o) => ids.has(o.id));
}

/** Séparateur de plusieurs valeurs dans un titre (filtre `multiple`). */
export const SEPARATEUR_TITRE = " · ";
