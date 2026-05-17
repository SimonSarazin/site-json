/**
 * Helpers de filtrage côté client pour `MeeteemSection`.
 *
 * Extraits de `MeeteemSection.tsx` pour éviter l'inline logic et permettre
 * des tests unitaires futurs.
 */

import type { MeeteemCard } from "../types";

/** Collecte tous les tags uniques présents dans les cartes. */
export function collectAvailableTags(cards: MeeteemCard[]): string[] {
  return cards.reduce<string[]>((acc, { data }) => {
    data.tags?.forEach((tag) => {
      if (!acc.includes(tag)) acc.push(tag);
    });
    return acc;
  }, []);
}

/**
 * Filtre les cartes selon les tags actifs ET le filtre utilisateur.
 * Retourne toutes les cartes si aucun filtre n'est actif.
 */
export function filterCards(
  cards: MeeteemCard[],
  activeFilters: string[],
  userFilter: string | null,
): MeeteemCard[] {
  if (activeFilters.length === 0 && !userFilter) return cards;

  return cards.filter(({ data, user }) => {
    const matchesTag =
      activeFilters.length === 0 || data.tags?.some((tag) => activeFilters.includes(tag));
    const matchesUser = !userFilter || user?.name === userFilter;
    return Boolean(matchesTag && matchesUser);
  });
}
