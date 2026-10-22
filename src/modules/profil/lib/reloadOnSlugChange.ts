/**
 * Après l'édition d'une entité dont le `slug` a changé, l'URL courante (`/profil/<ancien slug>[/onglet]`)
 * ne mène plus nulle part : on la réécrit et on recharge. Source unique pour la modale de profil
 * standard (`editProfileConfig.afterSubmit`) et l'`afterSubmit:reloadOnSlugChange` des formulaires costum.
 */

/** Le chemin avec chaque SEGMENT égal à `oldSlug` remplacé par `newSlug` — jamais une sous-chaîne :
 *  `"/profil/pro".replace("pro", "prolo")` donnerait `/prolofil/pro`. */
export function replaceSlugSegment(pathname: string, oldSlug: string, newSlug: string): string {
  return pathname
    .split("/")
    .map((segment) => (segment === oldSlug ? newSlug : segment))
    .join("/");
}

/** Inerte si le slug n'a pas changé, s'il manque, ou hors navigateur. */
export function reloadOnSlugChange(oldSlug: string | null | undefined, newSlug: unknown): void {
  if (typeof window === "undefined") return;
  if (typeof newSlug !== "string" || !newSlug || !oldSlug || newSlug === oldSlug) return;
  window.history.replaceState(null, "", replaceSlugSegment(window.location.pathname, oldSlug, newSlug));
  window.location.reload();
}
