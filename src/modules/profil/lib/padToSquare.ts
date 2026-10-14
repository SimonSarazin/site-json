/**
 * Côté plafond du carré, en px. Sans plafond, une photo 4000×3000 donnait un PNG 4000×4000 de
 * plusieurs dizaines de Mo (au-delà des 10 Mo de `DEFAULT_IMAGE_VALIDATION_CONFIG` et des limites
 * d'envoi) et un canvas au-delà de 16,7 Mpx, que Safari iOS refuse d'exporter.
 * Pourquoi 1024 et pas le 1920 de `compressImage` : le PNG (sans perte, requis pour la transparence)
 * d'un carré de 1920 px mesuré dans Chromium monte à 9,4 Mo pour une photo très texturée — à la
 * limite ; à 1024 px, 2,7 Mo dans ce pire cas, 0,3 Mo pour une image ordinaire. L'avatar s'affiche
 * au plus à 160 px et le backend n'en tire qu'une image de 400 px et une miniature de 50 px.
 */
export const MAX_SQUARE_SIDE = 1024;

/**
 * Carré qui contient l'image `width × height` ENTIÈRE : côté, puis taille et position de l'image
 * centrée dedans — réduite (proportions gardées) si son grand côté dépasse `maxSide`, jamais agrandie.
 */
export function squarePlacement(
  width: number,
  height: number,
  maxSide = MAX_SQUARE_SIDE,
): { size: number; x: number; y: number; width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const size = Math.max(w, h);
  return { size, x: Math.round((size - w) / 2), y: Math.round((size - h) / 2), width: w, height: h };
}

/**
 * Photo de profil non carrée → la MÊME image entière, centrée dans un carré transparent (PNG).
 *
 * Pourquoi : la photo de profil s'affiche en rond `object-cover` hors de l'en-tête (menu compte, cartes,
 * commentaires) et le backend en tire une miniature 50×50 recadrée au centre : une image large y perdrait
 * ses bords. Complétée en carré, elle reste entière partout. Un fichier déjà carré est rendu tel quel ;
 * le carré est plafonné à `MAX_SQUARE_SIDE` (cf. plus haut). Lève en cas d'échec (décodage, export) :
 * l'appelant décide du repli.
 */
export async function padFileToSquare(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    // Un seul décodage : l'image sert à la fois à lire ses dimensions et à dessiner le carré.
    const image = new Image();
    image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    if (width === height) return file;
    const place = squarePlacement(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = place.size;
    canvas.height = place.size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    ctx.drawImage(image, place.x, place.y, place.width, place.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Export PNG impossible");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
