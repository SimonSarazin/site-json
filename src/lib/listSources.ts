import { normalizeFilterValue } from "@/modules/search/lib/dropdownFilters";

/**
 * Fusion ORDONNÉE de plusieurs sources de valeurs de liste — le cœur de la mécanique unique de
 * résolution des listes `costum.lists`.
 *
 * Une « source » est indifféremment : un socle déclaré en config (l'`enum` d'un champ, les `options`
 * d'un filtre), une liste STATIQUE du costum lue en mémoire, ou une recette résolue par
 * `costum/co/listvalues`. Elles se traitent toutes pareil ici — c'est tout l'intérêt : le consommateur
 * n'a plus à savoir sous quelle forme la liste est déclarée en base, ni à choisir entre substituer et
 * fusionner.
 *
 * ORDRE = PRIORITÉ. La première source où une valeur apparaît fixe sa GRAPHIE retenue (et donc, chez
 * l'appelant, son libellé i18n s'il en a un). Le socle déclaré passe donc en premier : ses 18 thèmes
 * gardent leurs libellés traduits, et les valeurs venues de la base qu'il ne contient pas s'ajoutent
 * derrière.
 *
 * VARIANTS : POURQUOI CETTE PARTIE N'EST PAS COSMÉTIQUE.
 * Le serveur regroupe les graphies d'une même valeur (« Le Port » / « LE PORT » / « Le port ») et rend
 * le groupe dans `variants` ; un filtre doit interroger le GROUPE ENTIER, sinon il laisse de côté les
 * fiches portant une autre graphie. Ce regroupement est fait PAR LISTE : deux recettes distinctes (une
 * par collection, cas parent62 `poi` + `events`) produisent deux groupements indépendants. Si « Pêche »
 * n'existe que dans l'une et « pêche » que dans l'autre, fusionner sans réunir les `variants` ne
 * garderait qu'une graphie — et le filtre raterait SILENCIEUSEMENT toutes les fiches de l'autre
 * collection. On réunit donc ici, par valeur canonique, toutes les graphies vues ET tous les `variants`
 * déclarés par chaque source.
 *
 * Le regroupement utilise `normalizeFilterValue` (casse, accents, apostrophes, espaces) — la même règle
 * que le rapprochement d'une valeur d'URL avec une option de filtre (`resolveFilterOption`). Une seule
 * notion d'égalité dans tout le repo.
 */

/** Ce que rend une source : ses valeurs, et — pour une recette résolue côté serveur — les graphies
 *  regroupées derrière chacune. */
export interface SourceDeValeurs {
  values: readonly string[];
  /** `variants[valeur] = toutes les graphies du groupe`, valeur retenue comprise (forme rendue par
   *  `costum/co/listvalues`). Absent pour un socle déclaré ou une liste statique : leurs valeurs sont
   *  curées à la main, chacune est seule de son groupe. */
  variants?: Record<string, readonly string[]>;
}

export interface ValeursFusionnees {
  values: string[];
  /** Renseigné SEULEMENT pour les valeurs qui ont plusieurs graphies — même règle que le serveur, qui
   *  omet `variants` quand il n'y a rien à regrouper. */
  variants: Record<string, string[]>;
}

export function resolveListSources(sources: readonly SourceDeValeurs[]): ValeursFusionnees {
  /** clé canonique → graphie RETENUE (celle de la source la plus prioritaire). */
  const retenue = new Map<string, string>();
  /** clé canonique → toutes les graphies vues, retenue comprise, dans l'ordre de rencontre. */
  const graphies = new Map<string, string[]>();
  /** clés canoniques dans l'ordre de première apparition — l'ordre de sortie. */
  const ordre: string[] = [];

  const noter = (cle: string, graphie: string) => {
    const vues = graphies.get(cle);
    if (!vues) {
      graphies.set(cle, [graphie]);
      return;
    }
    if (!vues.includes(graphie)) vues.push(graphie);
  };

  for (const source of sources) {
    for (const valeur of source.values ?? []) {
      if (typeof valeur !== "string" || valeur.trim() === "") continue;
      const cle = normalizeFilterValue(valeur);
      if (cle === "") continue;
      if (!retenue.has(cle)) {
        retenue.set(cle, valeur);
        ordre.push(cle);
      }
      noter(cle, valeur);
      // Les graphies que le serveur a déjà regroupées derrière cette valeur rejoignent le même groupe :
      // c'est ce qui permet à une graphie propre à l'AUTRE collection de rester interrogeable.
      for (const g of source.variants?.[valeur] ?? []) {
        if (typeof g === "string" && g !== "") noter(cle, g);
      }
    }
  }

  const values = ordre.map((cle) => retenue.get(cle) as string);
  const variants: Record<string, string[]> = {};
  for (const cle of ordre) {
    const groupe = graphies.get(cle) as string[];
    if (groupe.length > 1) variants[retenue.get(cle) as string] = groupe;
  }
  return { values, variants };
}
