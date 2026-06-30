/**
 * Détection d'erreur par chemin dans l'arbre `formState.errors` de RHF.
 * RHF IMBRIQUE les erreurs des champs à nom pointé (`errors.preferences.isOpenData`),
 * donc un simple `name in errors` rate ces cas — d'où la traversée par segments.
 * Utilisé par le layout wizard pour badger le step fautif + sauter dessus au submit.
 */
export function hasErrorAt(errors: Record<string, unknown>, path: string): boolean {
  let node: unknown = errors;
  for (const seg of path.split(".")) {
    if (node == null || typeof node !== "object") return false;
    node = (node as Record<string, unknown>)[seg];
  }
  return node != null;
}
