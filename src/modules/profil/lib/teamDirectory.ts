/**
 * Rattachement d'un membre à une PAGE de regroupement (un territoire pour parent62, une région ou
 * une filière ailleurs) : chemin de la page, et couleurs de sa carte.
 *
 * Le module `profil` est générique — il ne doit rien savoir de parent62. La convention vient donc
 * TOUJOURS de la config (`card.rattachement`, obligatoire dès que `card.type: "team"`) : aucun
 * gabarit n'est codé ici en repli, sinon le métier d'un site reviendrait se figer dans le moteur.
 */
export interface ConventionRattachement {
  /** Gabarit du chemin de la page de rattachement. `{slug}` est remplacé par le slug normalisé. */
  cheminGabarit: string;
  /** Préfixe des variables CSS de couleur : `<prefixe>-<slug>-carte` et `<prefixe>-<slug>-encre`. */
  prefixeCouleur: string;
}

/**
 * Garde d'entrée de la carte « équipe » : la convention est OBLIGATOIRE, et son absence est une
 * erreur de config à faire échouer tôt (préflight, `config:render`) plutôt qu'une carte rendue sans
 * lien ni couleur, qui passerait inaperçue en revue.
 */
export function exigerConvention(convention: ConventionRattachement | undefined): ConventionRattachement {
  // Même contrat que le gate préflight `member-team-card` : un gabarit sans `{slug}` enverrait
  // toutes les cartes vers la même page, un préfixe sans `--` ne nommerait aucune variable CSS.
  const ok =
    !!convention &&
    typeof convention.cheminGabarit === "string" && convention.cheminGabarit.includes("{slug}") &&
    typeof convention.prefixeCouleur === "string" && /^--[a-z][a-z0-9-]*$/.test(convention.prefixeCouleur);
  if (!ok) {
    throw new Error(
      'member.card.rattachement est requis avec card.type "team" : { cheminGabarit avec "{slug}", prefixeCouleur "--…" }.',
    );
  }
  return convention;
}

/**
 * Slug canonique d'un rattachement à partir du libellé porté par un profil
 * (`citoyens.territoires` chez parent62).
 *
 * Les 9 pages `/territoire/*` portent en titre EXACTEMENT ce libellé : la correspondance est donc
 * une simple normalisation, pas une table à maintenir en double. Vérifié sur les 9 valeurs réelles.
 * Plage des diacritiques écrite en échappements `\u` : des caractères combinants bruts, qu'un
 * éditeur normalise en NFC, feraient silencieusement disparaître la classe.
 */
function slugRattachement(nom: string | null | undefined): string | null {
  if (!nom || typeof nom !== "string") return null;
  const slug = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

/** Chemin de la page de rattachement, ou `null` s'il n'y a rien à lier. */
export function cheminTerritoire(
  nom: string | null | undefined,
  convention: ConventionRattachement,
): string | null {
  const slug = slugRattachement(nom);
  return slug ? convention.cheminGabarit.replace("{slug}", slug) : null;
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
  convention: ConventionRattachement,
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
