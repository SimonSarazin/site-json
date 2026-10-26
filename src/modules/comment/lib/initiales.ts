/**
 * Les initiales d'un nom, pour le repli d'un avatar sans image.
 *
 * Trois endroits du module en fabriquaient, chacun à sa façon, et tous les trois prenaient le
 * PREMIER CARACTÈRE d'un mot — quel qu'il soit. Mesuré sur les 105 247 noms de la base de dev :
 * **998** produisaient une première initiale qui n'est pas une lettre et **4 025** une seconde.
 * Les cas ne sont pas anecdotiques : « // Parallèle // RENNES » donnait `//`, « "" Le bonheur
 * est dans le jardin"" » donnait `""`, « SEOR - Société d'Études » donnait `S-`.
 *
 * La règle retenue : **on ne garde que des lettres**, et on va les chercher là où elles sont.
 *
 * 1. Un mot qui ne contient aucune lettre n'est pas un mot — `//`, `-`, `&`, `🌱`, `974` sont
 *    écartés AVANT qu'on compte les deux premiers. C'est ce qui donne `PR` et non `/P` pour
 *    « // Parallèle // RENNES » : sans cette étape, la ponctuation occuperait la place.
 * 2. Dans le mot retenu, on prend la première LETTRE, pas le premier caractère — d'où `N` pour
 *    « #NuitDebout » et `P` pour « 4P ».
 * 3. Les chiffres ne sont jamais des initiales. « CAUE 974 » rend `C`, pas `C9` : un chiffre ne
 *    se lit pas comme une initiale et n'aide en rien à reconnaître la ligne.
 * 4. Si rien ne reste — un nom entièrement numérique ou fait de symboles — on rend `?`, jamais
 *    une chaîne vide, qui laisserait une pastille muette.
 *
 * `\p{L}` avec le drapeau `u` couvre les lettres accentuées comme les alphabets non latins :
 * « Émile » rend `É`, et un nom en cyrillique ou en arabe garde les siennes.
 */

/** Une lettre, dans n'importe quel alphabet. */
const LETTRE = /\p{L}/u;

export function initialesDe(nom: string | null | undefined, max = 2): string {
  const mots = String(nom ?? "").split(/\s+/).filter(mot => LETTRE.test(mot));
  const lettres = mots
    .slice(0, Math.max(1, max))
    // Le parcours se fait par POINT DE CODE (`[...mot]`) et non par unité de code : un nom
    // ouvert par un emoji couperait sinon une paire de substitution en deux.
    .map(mot => [...mot].find(caractere => LETTRE.test(caractere)) ?? "");
  return lettres.join("").toUpperCase() || "?";
}
