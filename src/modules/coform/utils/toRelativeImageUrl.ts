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

/**
 * Les champs que le SDK rend ABSOLUS à la lecture, où qu'ils soient dans le document : miroir de
 * `ApiClient._imageFields` (`cocolight-api-client`, normalisation `_normalizeRecursively` →
 * `_ensureFullURL`).
 */
const SDK_IMAGE_FIELDS = [
  "profilImageUrl",
  "profilThumbImageUrl",
  "profilMediumImageUrl",
  "profilMarkerImageUrl",
  "profilBannerUrl",
  "profilRealBannerUrl",
  "imagePath",
  "imageThumbPath",
  "docPath",
  "imageThumb",
  "imageMediumPath",
  "logo",
  "logoMin",
  "image",
] as const;

/**
 * Une entrée relue par le SDK, dont les champs image redeviennent relatifs, comme en base. Pour
 * toute écriture qui « conserve » une entrée existante — sans quoi l'URL absolue du backend part en
 * base, et le legacy, qui préfixe lui-même (`baseUrl + profilThumbImageUrl`), affiche une image
 * cassée. Seule cette normalisation est défaite : les autres (booléens, dates, identifiants) ne
 * touchent pas une entrée de lien `{ name, type, profilThumbImageUrl }`.
 */
export function withRelativeImageUrls<T extends Record<string, unknown>>(entry: T): T {
  const stored: Record<string, unknown> = { ...entry };
  for (const field of SDK_IMAGE_FIELDS) {
    const value = stored[field];
    if (typeof value === "string" && value !== "") stored[field] = toRelativeImageUrl(value) ?? value;
  }
  return stored as T;
}
