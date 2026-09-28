/**
 * Initiales d'un nom, pour un avatar de repli.
 *
 * ⚠️ Plusieurs composants (`AmpliUserCard`, `UserListItem`, `ProfileHeaderComplete`) affichent une
 * initiale UNIQUE calculée sur place. Ils ne sont pas migrés ici : leur repli tient en une lettre,
 * et en passer à deux changerait le rendu de sites qui n'ont rien demandé. `max` existe pour qu'ils
 * puissent le faire un jour sans nouvelle divergence — `initiales(nom, 1)` reproduit leur sortie.
 */
export function initiales(nom: string | null | undefined, max = 2): string {
  if (typeof nom !== "string") return "";
  return nom
    .split(/\s+/)
    .filter((mot) => mot !== "")
    .map((mot) => mot.charAt(0))
    .join("")
    .slice(0, max)
    .toUpperCase();
}
