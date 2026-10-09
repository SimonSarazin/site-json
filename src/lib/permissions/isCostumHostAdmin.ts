/**
 * L'utilisateur est-il ADMIN DU SITE (du costum) ? Le porteur (`useCocolight().entity`) est le host du
 * costum ; son `isAdmin()` est SYNCHRONE (lu sur `me.links`) et SANS hiérarchie — la même définition que le
 * `siteAdmin` canonique de l'admin et que l'`isCostumAdmin` du backend.
 *
 * Renvoie `false` hors session, hors costum, ou tant que le porteur n'est pas chargé : une dispense de
 * modération ne doit jamais être accordée par défaut.
 */
export function isCostumHostAdmin(carrier: unknown): boolean {
  const host = carrier as { isAdmin?: () => boolean } | null | undefined;
  return host?.isAdmin?.() ?? false;
}
