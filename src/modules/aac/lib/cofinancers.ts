/**
 * L'agrégation des cofinanceurs d'un commun — UNE fonction, lue par la carte
 * (le compteur « cofinanceurs ») ET par la table (une ligne par cofinanceur).
 *
 * Deux agrégations séparées ne se recoupaient pas : la table écartait toute
 * ligne sans `financerId` (son montant n'apparaissait nulle part) alors que la
 * carte comptait `new Set(financerId)`, où `undefined` valait une entrée. Sur
 * une dépense `financer: [{id: "org1", …, amount: 500}, {name: "Doublonnage
 * porteur", amount: 100}]` — la 2ᵉ entrée est le doublonnage décrit dans
 * doc/34 §2, qui ne désigne pas une entité et arrive sans `id` — la carte
 * annonçait « 600 € · 2 cofinanceurs » et la table une seule ligne à 500 €.
 *
 * Ici, une ligne n'est JAMAIS écartée : à défaut d'id elle s'agrège sur son
 * nom, à défaut de nom elle fait sa propre ligne. Le compteur de la carte est
 * la longueur de ce résultat — les deux chiffres coïncident par construction.
 */
import type { CagnotteFundableItem } from "@/modules/cagnotte/types";

/**
 * Une ligne de `allFunding`. Le repli `name`/`type` sur `financerName`/
 * `financerType` couvre les documents anciens, écrits avant que l'enrichissement
 * ne renomme ces champs (cf. `getUserFunding` dans `useCagnotteAdapter`).
 */
type LigneCofinancement = CagnotteFundableItem["allFunding"][number] & {
  name?: string;
  type?: string;
};

export interface CofinancerAggregate {
  /** Clé d'agrégation, stable et unique dans le résultat — sert de `key` React. */
  key: string;
  /** `null` quand la ligne ne désigne pas une entité (doublonnage, saisie libre). */
  financerId: string | null;
  /** `""` si aucune ligne ne porte de nom — l'UI met son libellé. */
  name: string;
  /** `""` si aucune ligne ne porte de type — l'UI met son libellé. */
  type: string;
  totalAmount: number;
}

const texte = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Agrège les financeurs des paliers OUVERTS (`status !== "close"`) — le même
 * périmètre que les totaux de la carte.
 */
export function aggregateCofinancers(items: CagnotteFundableItem[]): CofinancerAggregate[] {
  const lignes: LigneCofinancement[] = items
    .filter((item) => item?.status !== "close")
    .flatMap((item) => item?.allFunding ?? []);

  const parCle = new Map<string, CofinancerAggregate>();

  lignes.forEach((ligne, index) => {
    const financerId = texte(ligne?.financerId) || null;
    const name = texte(ligne?.financerName) || texte(ligne?.name);
    const type = texte(ligne?.financerType) || texte(ligne?.type);
    const amount = Number(ligne?.amount || 0);
    // Préfixes distincts : un id et un nom ne peuvent pas se télescoper.
    const key = financerId ? `id:${financerId}` : name ? `name:${name}` : `anonyme:${index}`;

    const existant = parCle.get(key);
    if (existant) {
      existant.totalAmount += amount;
      if (!existant.name && name) existant.name = name;
      if (!existant.type && type) existant.type = type;
      return;
    }
    parCle.set(key, { key, financerId, name, type, totalAmount: amount });
  });

  return Array.from(parCle.values());
}
