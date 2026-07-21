/**
 * Bits PARTAGÉS des composants « parole » (témoignage — POI `type=affiche`, costum parent62) :
 * card + preview. Évite la duplication du style de catégorie et de l'extraction audio.
 */

/** Catégorie de parole (Compliqué / Difficile / À changer) → classes tailwind du badge. */
export const PAROLE_CATEGORY_STYLE: Record<string, string> = {
  "Compliqué": "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  "Difficile": "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  "À changer": "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
};

/**
 * URL du 1er média audio d'un tableau `medias` (`[{type:"audio", url}]`), ou `null`.
 * L'`url` (docPath) est DÉJÀ absolue (posée par le backend `saveDocument` = publicBaseUrl+relPath) →
 * aucune re-normalisation à faire.
 */
export function paroleAudioUrl(medias: unknown): string | null {
  if (!Array.isArray(medias)) return null;
  const audio = medias.find(
    (m) => m && typeof m === "object" && (m as { type?: string }).type === "audio",
  ) as { url?: string } | undefined;
  return typeof audio?.url === "string" && audio.url ? audio.url : null;
}
