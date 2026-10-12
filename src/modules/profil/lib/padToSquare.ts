import { imageNaturalSize } from "./imageNaturalSize";

/** Côté du carré et position de l'image `width × height` centrée dedans, sans la réduire. */
export function squarePlacement(width: number, height: number): { size: number; x: number; y: number } {
  const size = Math.max(width, height);
  return { size, x: Math.round((size - width) / 2), y: Math.round((size - height) / 2) };
}

/**
 * Photo de profil non carrée → la MÊME image entière, centrée dans un carré transparent (PNG).
 *
 * Pourquoi : la photo de profil s'affiche en rond `object-cover` hors de l'en-tête (menu compte, cartes,
 * commentaires) et le backend en tire une miniature 50×50 recadrée au centre : une image large y perdrait
 * ses bords. Complétée en carré, elle reste entière partout. Un fichier déjà carré est rendu tel quel.
 */
export async function padFileToSquare(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const { width, height } = await imageNaturalSize(url);
    if (width === height) return file;
    const { size, x, y } = squarePlacement(width, height);
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    ctx.drawImage(image, x, y, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Export PNG impossible");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
