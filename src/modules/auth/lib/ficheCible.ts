import type { Api } from "@communecter/cocolight-api-client";

/** Chargeur SDK par type de cible d'invitation (`targetType` du lien de l'e-mail). */
const CHARGEURS = {
  organizations: "organization",
  projects: "project",
  events: "event",
  poi: "poi",
} as const satisfies Record<string, keyof Api>;

/** Méthode `Api` qui charge une fiche de ce type par son id — `null` pour un type sans fiche. */
export function chargeurDeFiche(targetType: string | undefined): (typeof CHARGEURS)[keyof typeof CHARGEURS] | null {
  return targetType && targetType in CHARGEURS ? CHARGEURS[targetType as keyof typeof CHARGEURS] : null;
}

/**
 * Chemin de la fiche de la cible (`/profil/<slug>`) — même destination que la redirection du backend
 * pour un costum `site-json`. Le lien de l'e-mail ne porte que l'id : le slug est relu sur la fiche.
 * `null` si le type n'a pas de fiche ou si elle n'a pas de slug.
 */
export async function cheminFicheCible(api: Api, targetType: string, targetId: string): Promise<string | null> {
  const chargeur = chargeurDeFiche(targetType);
  if (!chargeur) return null;
  const fiche = await api[chargeur]({ id: targetId });
  const slug = fiche?.slug;
  return slug ? `/profil/${encodeURIComponent(slug)}` : null;
}
