/**
 * Convertit une URL d'image absolue en chemin relatif (pour persistance robuste).
 *
 * Pourquoi : `profilThumbImageUrl` renvoyé par le backend Cocolight est une URL
 * absolue prête à mettre dans `<img src>` (ex: `https://api.communecter.org/upload/.../thumb.jpg`).
 * Stocker l'absolu en BDD est fragile :
 *   - migration env (staging → prod) → URL pointe vers le mauvais domaine
 *   - federation / partage inter-instances → impossibles à rebaser
 *
 * On stocke donc `pathname + search` (ex: `/upload/.../thumb.jpg?variant=medium`).
 * `FinderElementCard` le rebase à la lecture via la prop `baseUrl`.
 *
 * Si l'input est déjà relatif (`/img.jpg`), il est résolu contre `window.location.origin`
 * puis re-démonté ; le résultat est équivalent.
 *
 * @todo Le `+ url.search` est conservé pour ne pas régresser si certains backends
 *   ajoutent des params sémantiques (`?variant=medium`). À investiguer en runtime :
 *   si le backend signe ses URLs avec un token expirant, on stockerait un token mort.
 */
export function toRelativeImageUrl(absoluteOrRelative: string | undefined): string | undefined {
  if (!absoluteOrRelative) return undefined;
  try {
    const url = new URL(absoluteOrRelative, window.location.origin);
    return url.pathname + url.search;
  } catch {
    // `new URL(x, origin)` ne throw normalement jamais quand `origin` est valide.
    // Defensive fallback : on rend l'input tel quel.
    return absoluteOrRelative;
  }
}
