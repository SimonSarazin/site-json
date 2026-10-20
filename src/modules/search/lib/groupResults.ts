import { resolveServerDataPath } from "./dropdownFilters";

/** Un groupe de résultats partageant la même valeur de champ. */
export interface GroupeResultats<T> {
  /** Valeur de regroupement telle que lue (chaîne), `null` pour les résultats sans valeur. */
  cle: string | null;
  items: T[];
}

/** Tri des items À L'INTÉRIEUR de chaque groupe. */
export interface TriDansGroupe {
  champ: string;
  ordre?: "asc" | "desc";
}

/** Valeur lue dans `serverData` (chemin pointé) ; un tableau compte pour sa PREMIÈRE valeur. */
function premiereValeur(serverData: unknown, champ: string): unknown {
  const brut = resolveServerDataPath(serverData as Record<string, unknown> | undefined, champ);
  return Array.isArray(brut) ? brut[0] : brut;
}

/** Forme comparable d'une valeur, `null` si elle est absente ou vide. */
function versComparable(valeur: unknown): number | string | null {
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : valeur.getTime();
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur !== "string") return null;
  const texte = valeur.trim();
  if (texte === "") return null;
  const nombre = Number(texte);
  return Number.isFinite(nombre) ? nombre : texte;
}

/**
 * Comparaison croissante de deux valeurs de `serverData`, `null` si l'une manque (au consommateur
 * de décider où la ranger) :
 *  - une valeur numérique (« 2022 » comme 2022) se compare en NOMBRE : « 9 » avant « 10 », qu'un tri
 *    de chaînes inverserait ;
 *  - une `Date` (le SDK normalise `created`/`updated` en `Date`) se compare par son instant ;
 *  - un texte se compare à la française.
 */
export function comparerValeurs(a: unknown, b: unknown): number | null {
  const ca = versComparable(a);
  const cb = versComparable(b);
  if (ca === null || cb === null) return null;
  if (typeof ca === "number" && typeof cb === "number") return ca - cb;
  return String(ca).localeCompare(String(cb), "fr", { numeric: true });
}

/**
 * Regroupe des résultats par la valeur d'un champ (`serverData`, chemin pointé), groupes triés.
 *
 * Choix assumés :
 *  - sans `tri`, l'ordre des items DANS un groupe est celui du serveur. Le tri de secours `tri` existe
 *    parce que le backend ne lit que la PREMIÈRE clé de `sortBy` (`SearchNew.php`) : avec
 *    `{ annee: -1, created: -1 }`, `created` est ignoré, et le paramètre `sort` qui prendrait toutes
 *    les clés est refusé par la validation du SDK. Il ne trie qu'une page chargée, pas la collection ;
 *  - un tableau range l'item sous sa PREMIÈRE valeur, pas dans chaque groupe : un résultat affiché
 *    deux fois se lirait comme un doublon ;
 *  - les résultats sans valeur forment un groupe `null` placé en DERNIER, jamais silencieusement
 *    écartés — une fiche mal renseignée doit rester visible pour être corrigée. Même règle dans un
 *    groupe : un item sans valeur de `tri` passe après les autres, quel que soit l'ordre.
 */
export function grouperParChamp<T extends { serverData?: unknown }>(
  resultats: T[],
  champ: string,
  ordre: "asc" | "desc" = "asc",
  tri?: TriDansGroupe,
): GroupeResultats<T>[] {
  const groupes = new Map<string | null, T[]>();
  for (const r of resultats) {
    const valeur = premiereValeur(r.serverData, champ);
    const cle = valeur === undefined || valeur === null || String(valeur).trim() === ""
      ? null
      : String(valeur).trim();
    const liste = groupes.get(cle);
    if (liste) liste.push(r);
    else groupes.set(cle, [r]);
  }

  const sens = ordre === "desc" ? -1 : 1;
  const avecValeur = [...groupes.keys()]
    .filter((k): k is string => k !== null)
    .sort((a, b) => sens * (comparerValeurs(a, b) ?? 0));
  const resultat: GroupeResultats<T>[] = avecValeur.map((cle) => ({ cle, items: groupes.get(cle)! }));
  if (groupes.has(null)) resultat.push({ cle: null, items: groupes.get(null)! });
  return tri ? resultat.map((g) => ({ ...g, items: trierItems(g.items, tri) })) : resultat;
}

/** Tri STABLE des items d'un groupe : à valeur égale, l'ordre du serveur est conservé. */
function trierItems<T extends { serverData?: unknown }>(items: T[], { champ, ordre = "asc" }: TriDansGroupe): T[] {
  const sens = ordre === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const va = premiereValeur(a.serverData, champ);
    const vb = premiereValeur(b.serverData, champ);
    const comparaison = comparerValeurs(va, vb);
    if (comparaison !== null) return sens * comparaison;
    // Au moins une valeur manque : les absents en dernier, deux absents gardent leur ordre.
    return (versComparable(va) === null ? 1 : 0) - (versComparable(vb) === null ? 1 : 0);
  });
}
