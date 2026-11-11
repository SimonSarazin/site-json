import type { UserProfile } from '@/modules/kanban/types';

/** Ce que la session du site sait de la personne connectée (champs de `me.serverData`). */
export interface SessionUserData {
  name?: string;
  username?: string;
  slug?: string;
  profilThumbImageUrl?: string;
}

/**
 * Profil de la personne connectée, sous la forme que le serveur projette pour un membre.
 *
 * Il sert de repli à l'affichage OPTIMISTE d'un commentaire (`useCardComments`), quand la
 * liste des membres du tableau n'a pas encore livré le profil projeté. Pure et testée.
 * Sans `slug`, le pseudo en tient lieu : la réponse du serveur le remplace dans la seconde.
 */
export function sessionProfile(userId: string | null, data: SessionUserData | null | undefined): UserProfile | null {
  if (userId === null || !data) return null;
  const username = data.username ?? '';
  return {
    _id: userId,
    name: data.name ?? username,
    username,
    slug: data.slug ?? username,
    profilThumbImageUrl: data.profilThumbImageUrl ?? null,
  };
}
