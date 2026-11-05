/**
 * Ordre CANONIQUE des cartes d'un board-lien Communecter (blueprint D16).
 *
 * Ordre PROPRE a co-kanban : dans une colonne, les actions se rangent par
 * priorite (urgent -> aucune), puis de la plus RECENTE a la plus ancienne. Ce
 * n'est PAS l'ordre de Kanban gestion, qui trie ses actions par `updated`
 * croissant, les reordonne selon sa liste chainee `lists`
 * (`Lists::arrange_action_by_status`), puis applique un tri stable par
 * priorite : a priorite egale, les deux interfaces montrent souvent un ordre
 * presque inverse. co-kanban ne reproduit pas cette liste parce qu'il n'ecrit
 * aucun ordre manuel (D16) — reprendre un ordre que l'on ne sait pas
 * maintenir le ferait diverger au premier glisser.
 *
 * Le serveur renvoie ce classement dans `rank`, et ce module en est le MIROIR
 * EXACT cote client : le placement optimiste d'un deplacement tombe deja la ou
 * le serveur va le confirmer (une carte qui saute a la reponse se lit comme un
 * bug).
 *
 * Rang ABSOLU, et non « position x 1000 » comme l'ecrivait d'abord le §11.4 —
 * ecart assume par le module PHP (`ActionCards::canonicalRank`, §11.9) et suivi
 * ici a l'identique. Un rang positionnel change pour TOUTES les cartes qui
 * suivent a chaque creation, deplacement ou changement de priorite, alors que
 * le journal ne transporte que la carte touchee : les autres clients
 * afficheraient des ex aequo jusqu'au rechargement. Ce rang-ci ne depend que de
 * la carte, et produit exactement le meme ordre :
 *
 *   tranche x 1e10 + (2100-01-01 - creation) + departage dans ]0, 1[
 *
 *  - tranche : urgent 0, high 1, medium 2, low 3, aucune 4 ;
 *  - 1e10 depasse le plus grand horodatage accepte (an 2100) : une carte d'une
 *    tranche ne passe jamais devant celle de la tranche precedente ;
 *  - departage : les 16 bits de POIDS FAIBLE du compteur de l'ObjectId, le plus
 *    grand d'abord — deux actions creees dans la meme seconde ne permutent pas.
 *    Seize bits et non les 24 du compteur : vers 4e10, un double ne distingue
 *    que des ecarts d'environ 1e-5 ; sur 24 bits, deux compteurs consecutifs
 *    (deux actions creees a la suite) tombaient sur le MEME rang. C'est la
 *    formule du serveur (`ActionCards::tieBreak`), suivie a l'identique.
 *
 * Pur, sans horloge ni cache : teste par `tests/unit/canonicalOrder.test.ts`.
 */
import { PRIORITY_ORDER } from '@/modules/kanban/lib/priority';
import type { Priority } from '@/modules/kanban/types';

/** Ecart entre deux tranches de priorite (`ActionCards::RANK_SPAN`). */
export const CANONICAL_RANK_SPAN = 10_000_000_000;

/** Plus grand horodatage accepte par le module, 2100-01-01 (`KanbanInput::MAX_TIMESTAMP`). */
export const MAX_TIMESTAMP = 4_102_444_800;

/** Bits du compteur d'ObjectId retenus pour le departage (`& 0xFFFF` cote PHP). */
const COUNTER_MASK = 0xffff;

/** Taille de l'espace retenu (2^16) + 2, pour rester dans ]0, 1[. */
const COUNTER_SPACE = 65_538;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Forme minimale d'une carte pour l'ordre canonique. */
export interface CanonicalCard {
  _id: string;
  rank: number;
  priority: Priority | null;
  created: number;
}

/** Tranche de priorite : urgent 0 … low 3, aucune 4 (la derniere). */
function bucketOf(priority: Priority | null): number {
  return priority === null ? PRIORITY_ORDER.length : PRIORITY_ORDER.indexOf(priority);
}

/**
 * Departage de deux cartes nees dans la meme seconde, dans ]0, 1[ : le
 * compteur de l'ObjectId (16 bits de poids faible), le plus grand d'abord. Un
 * identifiant provisoire (`tmp-3`) prend le milieu, comme cote PHP pour un
 * identifiant qui n'est pas un ObjectId.
 */
function tieBreak(id: string): number {
  if (!OBJECT_ID.test(id)) return 0.5;
  const counter = Number.parseInt(id.slice(18, 24), 16) & COUNTER_MASK;
  return 1 - (counter + 1) / COUNTER_SPACE;
}

/** Rang canonique d'une carte — croissant = plus haut dans sa colonne. */
export function canonicalRank(card: Omit<CanonicalCard, 'rank'>): number {
  const created = Math.max(0, Math.min(MAX_TIMESTAMP, card.created));
  return bucketOf(card.priority) * CANONICAL_RANK_SPAN + (MAX_TIMESTAMP - created) + tieBreak(card._id);
}

/** Comparateur D16 : rang croissant, `_id` decroissant en dernier recours (comme `sortCanonical`). */
export function compareCanonical(a: CanonicalCard, b: CanonicalCard): number {
  const left = canonicalRank(a);
  const right = canonicalRank(b);
  if (left !== right) return left - right;
  return a._id < b._id ? 1 : a._id > b._id ? -1 : 0;
}

/**
 * Recopie le rang canonique sur chaque carte.
 *
 * L'IDENTITE d'une carte deja a son rang est conservee : les cartes memoisees
 * du tableau ne se rerendent pas quand une seule de leurs voisines bouge.
 */
export function applyCanonicalRanks<T extends CanonicalCard>(cards: readonly T[]): T[] {
  return cards.map((card) => {
    const rank = canonicalRank(card);
    return rank === card.rank ? card : { ...card, rank };
  });
}
