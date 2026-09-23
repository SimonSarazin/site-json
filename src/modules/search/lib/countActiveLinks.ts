/**
 * Nombre de liens ACTIFS d'une section de `links` (`contributors`, `attendees`…).
 *
 * Une invitation en attente (`isInviting`) ou une demande non validée (`toBeValidated`) n'est pas
 * encore un lien : la compter afficherait « 2 participant·es » pour un événement où une seule
 * personne participe. Même règle que `getContributors(…, { toBeValidated: false, isInviting: false })`
 * côté AAC.
 */
export function countActiveLinks(section: unknown): number {
  if (!section || typeof section !== "object") return 0;
  return Object.values(section).filter((link) => {
    const l = link as { isInviting?: boolean; toBeValidated?: boolean } | null;
    return !l?.isInviting && !l?.toBeValidated;
  }).length;
}
