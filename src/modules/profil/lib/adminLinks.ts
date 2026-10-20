/**
 * Filtres SERVEUR « organisations dont `userId` est admin VALIDÉ » : un lien `isAdmin` qui n'est ni
 * en attente (`isAdminPending`), ni à valider (`toBeValidated`), ni une invitation (`isInviting`) —
 * la règle de `Authorisation::isElementAdmin` côté serveur, que le front doit refléter pour ne pas
 * proposer de gérer une structure que le serveur refusera. Partagé par l'onglet « Structures » du
 * profil et la cagnotte (`useUserAdminOrganizationsQuery`).
 */
export function validatedAdminLinkFilters(userId: string): Record<string, unknown> {
  const lien = `links.members.${userId}`;
  return {
    [lien]: { $exists: true },
    [`${lien}.isAdmin`]: true,
    [`${lien}.isAdminPending`]: { $exists: false },
    [`${lien}.toBeValidated`]: { $exists: false },
    [`${lien}.isInviting`]: { $exists: false },
  };
}
