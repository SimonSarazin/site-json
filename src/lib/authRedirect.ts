/**
 * Destination de retour après connexion — la moitié manquante de la garde de page.
 *
 * Jusqu'ici `usePageGuards` faisait un `navigate("/login")` NU : rien ne transportait la page
 * visée, et `LoginForm` ramenait sur `/` en dur. Un professionnel qui ouvrait `/espace-pro`
 * atterrissait donc sur l'accueil après s'être connecté, sans jamais voir la page demandée. Pire,
 * la redirection était un `push` : le bouton Retour renvoyait sur la page gardée, qui re-poussait
 * vers `/login` — l'utilisateur était piégé dans son onglet.
 *
 * La destination voyage dans le `state` de React Router (pas dans l'URL) : elle n'est donc pas
 * forgeable par un lien externe. `readReturnTo` valide quand même la valeur — une destination de
 * redirection non validée est le patron classique de l'open redirect, et cette fonction est le
 * seul endroit où la règle doit vivre.
 */

/** Route de connexion du module auth (`src/modules/auth/routes.tsx`). */
export const LOGIN_PATH = "/login";

/** Forme du `state` posé par la garde et lu par les formulaires d'auth. */
export interface AuthReturnState {
  from?: string;
}

/** Chemin courant, query comprise, tel qu'il doit être mémorisé avant d'envoyer vers le login. */
export function buildReturnTo(pathname: string, search = ""): string {
  return `${pathname}${search || ""}`;
}

/**
 * Destination de retour EXPLOITABLE, ou `null` si rien de sûr n'est mémorisé.
 * Refusé : ce qui n'est pas une chaîne, ce qui ne commence pas par `/` (URL absolue), ce qui
 * commence par `//` ou `/\` (URL protocole-relative → sortie du site), et la page de login
 * elle-même (boucle).
 */
export function readReturnTo(state: unknown): string | null {
  const from = (state as AuthReturnState | null | undefined)?.from;
  if (typeof from !== "string" || from.length === 0) return null;
  if (!from.startsWith("/")) return null;
  if (from.startsWith("//") || from.startsWith("/\\")) return null;
  const path = from.split(/[?#]/)[0];
  if (path === LOGIN_PATH) return null;
  return from;
}

/** Destination de retour, avec le repli historique sur l'accueil. */
export function returnToOrHome(state: unknown): string {
  return readReturnTo(state) ?? "/";
}
