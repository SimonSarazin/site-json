import type { ParentType, Role, UserProfile } from '@/modules/kanban/types';

/**
 * Nom affichable d'un membre — pur, partage par les composants du tableau, les
 * vues et le fil d'activite (qui vit dans `lib/`, d'ou ce module).
 *
 * Le profil peut arriver vide (citoyen supprime, projection partielle) : on ne
 * montre jamais un ObjectId brut a l'ecran, d'ou le repli traduit fourni par
 * l'appelant.
 */
export function memberDisplayName(
  // Seuls `name` et `username` sont lus : une projection partielle suffit.
  profile: Partial<Pick<UserProfile, 'name' | 'username'>> | null | undefined,
  fallbackLabel: string,
): string {
  const name = profile?.name;
  if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  const username = profile?.username;
  if (typeof username === 'string' && username.trim().length > 0) return username.trim();
  return fallbackLabel;
}

/**
 * Clé i18n du RÔLE d'un membre, déclinée par type d'élément (§12.4). Sur un tableau relié, c'est
 * le rôle EFFECTIF tenu sur l'élément Communecter : `editor` est un contributeur d'un PROJET mais
 * un MEMBRE d'une organisation, le mot de la plateforme (`links.members`). `owner` et `viewer`
 * gardent leur mot partout. Repris de co-kanban (`roles/roleLabels.ts`).
 */
export function memberRoleLabelKey(role: Role, linkType: ParentType | null): string {
  if (linkType !== null && role === 'editor') return `members.linkRoles.editor.${linkType}`;
  return `members.roles.${role}`;
}
