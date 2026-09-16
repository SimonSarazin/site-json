/**
 * Rattachement d'un membre à une PAGE de regroupement (un territoire pour parent62, une région ou
 * une filière ailleurs) : chemin de la page, et couleurs de sa carte.
 *
 * Le module `profil` est générique — il ne doit rien savoir de parent62. La convention vit donc
 * dans un PRESET surchargeable, pas dans le corps des fonctions : un autre site branche ses propres
 * gabarits depuis sa config (`card.rattachement`) sans toucher au code.
 */
export interface ConventionRattachement {
  /** Gabarit du chemin de la page de rattachement. `{slug}` est remplacé par le slug normalisé. */
  cheminGabarit: string;
  /** Préfixe des variables CSS de couleur : `<prefixe>-<slug>-carte` et `<prefixe>-<slug>-encre`. */
  prefixeCouleur: string;
}

/** Convention en service : les 9 pages `/territoire/*` de parent62 et leurs teintes de marque. */
export const CONVENTION_RATTACHEMENT_DEFAUT: ConventionRattachement = {
  cheminGabarit: "/territoire/{slug}",
  prefixeCouleur: "--territoire",
};

/**
 * Slug canonique d'un rattachement à partir du libellé porté par un profil
 * (`citoyens.territoires` chez parent62).
 *
 * Les 9 pages `/territoire/*` portent en titre EXACTEMENT ce libellé : la correspondance est donc
 * une simple normalisation, pas une table à maintenir en double. Vérifié sur les 9 valeurs réelles.
 */
function slugRattachement(nom: string | null | undefined): string | null {
  if (!nom || typeof nom !== "string") return null;
  const slug = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

/** Chemin de la page de rattachement, ou `null` s'il n'y a rien à lier. */
export function cheminTerritoire(
  nom: string | null | undefined,
  convention: ConventionRattachement = CONVENTION_RATTACHEMENT_DEFAUT,
): string | null {
  const slug = slugRattachement(nom);
  return slug ? convention.cheminGabarit.replace("{slug}", slug) : null;
}

/**
 * Deux libellés désignent-ils le même rattachement ?
 *
 * Comparaison sur le SLUG et non sur le texte : la valeur saisie dans le profil
 * (« Familles en sol mineur Hénin Carvin ») et celle écrite dans la config d'une page
 * (« Familles en sol mineur Hénin-Carvin ») diffèrent par la casse, les accents et la ponctuation
 * sans désigner autre chose. Même normalisation que le lien, pour que les deux usages — lien vers
 * la page, appariement — ne puissent pas diverger.
 */
export function memeTerritoire(a: string | null | undefined, b: string | null | undefined): boolean {
  const sa = slugRattachement(a);
  const sb = slugRattachement(b);
  return sa !== null && sa === sb;
}

/**
 * Fond, encre et bordure de la carte d'une personne, aux couleurs de SON rattachement.
 *
 * Les variables sont nommées par convention (`<prefixe>-<slug>-carte` / `-encre`) et servies par la
 * feuille du site — pour parent62, des teintes de marque déjà ramenées au contraste AA. On ne les
 * recalcule pas ici : le code ne connaît que le NOM de la variable, jamais sa valeur.
 *
 * Le repli n'est pas décoratif : un profil sans rattachement, ou d'un rattachement inconnu de la
 * feuille, doit rendre une carte NEUTRE lisible dans les deux modes plutôt qu'une carte
 * transparente. La bordure suit la même chaîne que le fond — sur un rattachement connu elle vaut la
 * couleur de la carte, donc invisible ; sinon elle retombe sur `--border`, et c'est là qu'elle sert.
 */
export function couleursTerritoire(
  nom: string | null | undefined,
  convention: ConventionRattachement = CONVENTION_RATTACHEMENT_DEFAUT,
): { fond: string; encre: string; bordure: string } {
  const slug = slugRattachement(nom);
  const neutre = { fond: "var(--card)", encre: "var(--card-foreground)", bordure: "var(--border)" };
  if (!slug) return neutre;
  const base = `${convention.prefixeCouleur}-${slug}`;
  return {
    fond: `var(${base}-carte, var(--card))`,
    encre: `var(${base}-encre, var(--card-foreground))`,
    bordure: `var(${base}-carte, var(--border))`,
  };
}
