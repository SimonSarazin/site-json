import type { CommentableType, DiscussionCarrier, DiscussionThread } from "../types";

/**
 * Recherche textuelle dans le panneau de discussions — fonctions PURES.
 *
 * Le champ de recherche filtre ce que l'écran affiche DÉJÀ : le rail des porteurs et la
 * colonne des fils, tels qu'ils sont en mémoire. Rien ne repart au serveur. C'est délibéré :
 * l'endpoint `discussions` rend un jeu borné (cf. `truncated` / `scanTruncated`), donc filtrer
 * côté client ne peut rien « manquer » que l'écran aurait montré sans la recherche.
 *
 * Deux règles portent tout le reste :
 *   1. **on ne filtre que ce qui est visible**. Un porteur n'affiche que son nom : le filtrer
 *      sur son type produirait des rangées retenues pour un mot qu'on ne lit nulle part. Un
 *      fil, lui, affiche son titre ET son libellé de type — les deux entrent donc en jeu.
 *   2. **rien n'est traduit ici**. Le libellé de type est un paramètre (`libelleType`), fourni
 *      par le composant qui a déjà `useT`. Une lib pure qui irait chercher la locale serait
 *      intestable sans provider, et surtout elle se désynchroniserait de ce qui est rendu.
 *
 * ---
 * POURQUOI PAS UN HELPER DE REPLI EXISTANT — décision, pas oubli :
 *
 *  - `foldForSearch` (`@/modules/aac/lib/filterCommuns`) est sémantiquement IDENTIQUE à
 *    `replierPourRecherche`. Mais le module `comment` n'importe rien de `@/modules/*` : il ne
 *    connaît que `@/components/ui/*`, `@/hooks/*`, `@/lib/*` et `@/i18n`. Ce serait son tout
 *    premier import inter-modules, et dans le mauvais sens — d'un module « core » vers un
 *    module de fonctionnalité. Le jour où `aac` bouge, `comment` casserait sans raison.
 *
 *  - `normalizeFilterValue` (`@/modules/search/lib/dropdownFilters`) fait DAVANTAGE : il
 *    retire les parenthèses et unifie les apostrophes, parce qu'il est calibré sur la
 *    taxonomie backend des facettes. Ici, chercher « Crèche (annexe) » ne rendrait plus ce que
 *    l'écran affiche, puisque les parenthèses tombées ne sont plus tombées dans le titre rendu.
 *
 *  - Ce n'est pas un cas isolé : neuf copies locales de `normalize("NFD")` vivent déjà dans
 *    `src/` (celle-ci fait la dixième), et AUCUNE dans `src/lib/`. À faire converger le jour
 *    où `src/lib/` gagne un utilitaire de texte partagé — pas avant, et pas depuis ici.
 */

/** Repli pour comparaison : minuscules, accents retirés. « Crèche » ≡ « creche ». */
export function replierPourRecherche(valeur: string): string {
  // Pas de `trim()` ici : il est fait UNE fois, dans `motsDeRequete`. Le rajouter à chaque
  // repli décalerait les indices de `segmenterCorrespondances` par rapport au texte d'origine.
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques combinantes
    .toLowerCase();
}

/** Découpe une requête en mots repliés. Rend `[]` pour une requête vide ou blanche. */
export function motsDeRequete(requete: string): readonly string[] {
  // Découper AVANT de replier, et filtrer les vides : un double espace produirait sinon un
  // mot `""`, sous-chaîne de TOUT, qui rendrait le filtre silencieusement inopérant.
  return requete
    .trim()
    .split(/\s+/)
    .map(replierPourRecherche)
    .filter(mot => mot !== "");
}

/** Tous les mots sont-ils présents, dans n'importe quel ordre, dans l'union des champs ? */
export function correspondAuxMots(
  mots: readonly string[],
  ...champs: readonly (string | null | undefined)[]
): boolean {
  // Pas de requête = pas de filtre. C'est ce qui rend l'appel sûr sans garde chez l'appelant.
  if (mots.length === 0) return true;

  // Les champs absents disparaissent au lieu de devenir « null » : sinon taper « null »
  // remonterait précisément les rangées qui n'ont pas de titre.
  const meule = champs
    .filter((champ): champ is string => typeof champ === "string" && champ !== "")
    .map(replierPourRecherche)
    .join(" ");

  // ET sur les mots, indifférent à l'ordre : « parents arras » et « arras parents » donnent le
  // même résultat. Les mots arrivent DÉJÀ repliés de `motsDeRequete` — on ne replie pas deux fois.
  return mots.every(mot => meule.includes(mot));
}

/** Les porteurs retenus. Rend le tableau REÇU tel quel quand `mots` est vide. */
export function filtrerPorteurs(
  carriers: readonly DiscussionCarrier[],
  mots: readonly string[],
): readonly DiscussionCarrier[] {
  // Même référence : l'appelant mémoïse dessus, et re-filtrer à vide ferait clignoter le rail.
  if (mots.length === 0) return carriers;

  // `carrier.name` SEUL. Pas le type : il n'est pas affiché sur une rangée de porteur, et
  // filtrer sur un libellé invisible produit des résultats inexplicables (« pourquoi cette
  // orga ressort-elle sur "projet" ? »). Conséquence assumée : le groupe « sans espace »,
  // dont le `name` est nul, quitte la liste dès le premier caractère tapé.
  return carriers.filter(carrier => correspondAuxMots(mots, carrier.name));
}

/** Les fils retenus. `libelleType` est fourni PAR L'APPELANT : cette fonction ne traduit pas. */
export function filtrerFils(
  threads: readonly DiscussionThread[],
  mots: readonly string[],
  libelleType: (type: CommentableType) => string,
): readonly DiscussionThread[] {
  if (mots.length === 0) return threads;

  // Le type EST affiché sur une rangée de fil, à côté du titre : le filtrer est cohérent avec
  // ce qu'on lit. D'où l'asymétrie VOULUE avec `filtrerPorteurs`, qui, lui, l'ignore.
  //
  // En revanche, un fil sans titre ne correspond QUE par son libellé de type : le libellé de
  // repli « Sans titre » (`panel.untitled`) n'entre JAMAIS dans la comparaison. Trois raisons :
  // c'est du chrome et non de la donnée ; « sans » est une sous-chaîne bien trop commune
  // (« sans-abri », « puissance »…) ; et la même donnée répondrait différemment selon la
  // locale — « Untitled » en anglais ne se cherche pas avec les mêmes lettres.
  return threads.filter(thread =>
    correspondAuxMots(mots, thread.title, libelleType(thread.target.type)),
  );
}

/** Une plage de caractères à marquer, en indices du texte ORIGINAL. */
interface Plage {
  readonly debut: number;
  readonly fin: number;
}

/**
 * Replie le texte en gardant, pour chaque caractère replié, d'où il vient dans l'original.
 *
 * Indispensable : `normalize("NFD")` CHANGE les longueurs (« è » devient deux unités avant que
 * le diacritique ne tombe). Chercher dans `replierPourRecherche(texte)` puis réutiliser ces
 * indices tels quels sur le texte d'origine découperait à côté, d'un caractère par accent.
 */
function replierAvecCarte(texte: string): { replie: string; debuts: number[]; fins: number[] } {
  let replie = "";
  const debuts: number[] = [];
  const fins: number[] = [];
  let curseur = 0;

  // Point de code par point de code (`for..of`), pour ne jamais couper une paire de substitution.
  for (const pointDeCode of texte) {
    const suivant = curseur + pointDeCode.length;
    const morceau = replierPourRecherche(pointDeCode);
    replie += morceau;
    // Une entrée de carte par UNITÉ UTF-16, et non par point de code : `indexOf` rend des
    // indices en unités, et un émoji en vaut deux. Une entrée par point de code décalait d'un
    // cran tout ce qui suit un émoji — « 🎉 réunion » cherché « union » marquait « réunionnion ».
    for (let unite = 0; unite < morceau.length; unite++) {
      debuts.push(curseur);
      fins.push(suivant);
    }
    // Un point de code qui se replie en RIEN (un diacritique déjà décomposé dans la source)
    // est rattaché au caractère précédent, sinon il resterait orphelin en tête du segment
    // suivant et viendrait se poser sur la mauvaise lettre à l'écran.
    if (morceau === "" && fins.length > 0) fins[fins.length - 1] = suivant;
    curseur = suivant;
  }

  return { replie, debuts, fins };
}

/**
 * Découpe un texte en segments pour la surbrillance des correspondances.
 * Rend une liste de `{ texte, marque }` — jamais de HTML : c'est React qui rend.
 */
export function segmenterCorrespondances(
  texte: string,
  mots: readonly string[],
): readonly { readonly texte: string; readonly marque: boolean }[] {
  // Un mot vide serait sous-chaîne de tout ET ferait tourner `indexOf` en rond : on l'écarte
  // avant toute chose, même si `motsDeRequete` n'en produit jamais.
  const utiles = mots.filter(mot => mot !== "");
  if (texte === "" || utiles.length === 0) return [{ texte, marque: false }];

  const { replie, debuts, fins } = replierAvecCarte(texte);

  const plages: Plage[] = [];
  for (const mot of utiles) {
    // Pas à pas de 1 : deux occurrences du même mot peuvent se chevaucher (« aa » dans « aaa »),
    // et en sauter une laisserait un trou visible dans la surbrillance.
    for (let i = replie.indexOf(mot); i !== -1; i = replie.indexOf(mot, i + 1)) {
      plages.push({ debut: debuts[i], fin: fins[i + mot.length - 1] });
    }
  }
  if (plages.length === 0) return [{ texte, marque: false }];

  plages.sort((a, b) => a.debut - b.debut);

  // Fusion des plages qui se chevauchent OU se touchent : deux `<mark>` collés dupliqueraient
  // le caractère commun et casseraient la recomposition exacte du texte.
  const fusionnees: Plage[] = [];
  for (const plage of plages) {
    const derniere = fusionnees.length > 0 ? fusionnees[fusionnees.length - 1] : null;
    if (derniere !== null && plage.debut <= derniere.fin) {
      if (plage.fin > derniere.fin) fusionnees[fusionnees.length - 1] = { debut: derniere.debut, fin: plage.fin };
    } else {
      fusionnees.push(plage);
    }
  }

  // Segments CONTIGUS, découpés dans le texte ORIGINAL — accents compris. C'est tout l'intérêt :
  // on compare sans accents, mais on rend exactement ce que l'auteur a écrit, et
  // `segments.map(s => s.texte).join("")` redonne le texte de départ, caractère pour caractère.
  const segments: { texte: string; marque: boolean }[] = [];
  let position = 0;
  for (const { debut, fin } of fusionnees) {
    if (debut > position) segments.push({ texte: texte.slice(position, debut), marque: false });
    segments.push({ texte: texte.slice(debut, fin), marque: true });
    position = fin;
  }
  if (position < texte.length) segments.push({ texte: texte.slice(position), marque: false });

  return segments;
}
