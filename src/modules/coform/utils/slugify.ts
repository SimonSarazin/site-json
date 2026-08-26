/**
 * Slugification d'un libellé d'option, **réplique exacte** du `slugifyString` du template legacy
 * `modules/survey/views/tpls/forms/cplx/categorizedCheckbox.php` (lignes 357-392).
 *
 * Ce n'est pas un slugify générique : c'est la moitié d'un identifiant PERSISTÉ. Les réponses en
 * base portent des clés `<index>_<slug>` produites par cette fonction ; toute divergence, même sur
 * un seul caractère, rend une réponse déjà enregistrée irrésoluble.
 *
 * ⚠️ **L'ordre des étapes est porteur de sens.** Les non-lettres sont remplacées AVANT la
 * décomposition NFKD : à ce moment `é` est encore une lettre unique (`\p{L}` la retient), et c'est
 * seulement ensuite qu'elle est décomposée en `e` + diacritique, puis le diacritique supprimé.
 * Décomposer d'abord donnerait `e` + U+0301, le diacritique deviendrait un `-`, et
 * « Métiers » sortirait `m-tiers` au lieu de `metiers`.
 *
 * Le pendant PHP (`InflectorHelper::slugifyString`, via sa table `translate_accent`) produit
 * aujourd'hui le même résultat sur les cas courants. Ce ne fut pas toujours vrai : des clés
 * historiques portent l'accent SUPPRIMÉ et non translittéré (`mtiers-de-la-communication` observé
 * en base) — d'où la résolution tolérante côté lecture, cf. `resolveStoredKey`.
 */
export function slugifyOption(text: unknown): string {
  if (text === null || text === undefined) return "n-a";

  let str = String(text);
  // 1. Tout ce qui n'est ni lettre (toutes langues) ni chiffre devient un tiret.
  str = str.replace(/[^\p{L}\d]+/gu, "-");
  // 2. Décomposition puis suppression des diacritiques (U+0300–U+036F).
  str = str.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  str = str.toLowerCase();
  // 3. Tirets de bord, puis résidus non ASCII (alphabets non latins déjà réduits à des tirets).
  str = str.replace(/^-+|-+$/g, "");
  str = str.replace(/[^a-z0-9-]+/g, "");

  return str === "" ? "n-a" : str;
}

/**
 * Compose la clé persistée d'une option : `<index>_<slug>`.
 *
 * `index` est la position dans la liste **NON dédupliquée** — c'est ce que le legacy écrit
 * (`categorizedCheckbox.php:470` et `:492`) et ce que l'agrégateur backend recalcule
 * (`Aap.php:2102`, `:2115`, `:2150`, `:2173`). Dédupliquer avant d'indexer décalerait toutes les
 * clés suivantes et invaliderait les réponses déjà en base.
 */
export function buildOptionKey(index: number, label: unknown): string {
  return `${index}_${slugifyOption(label)}`;
}

/** Partie slug d'une clé `<index>_<slug>` — `"4_documentation-interne"` → `"documentation-interne"`. */
export function optionKeySlug(key: string): string {
  const sep = key.indexOf("_");
  return sep === -1 ? key : key.slice(sep + 1);
}
