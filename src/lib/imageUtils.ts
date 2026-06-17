/**
 * Build an optimized image URL that goes through the /img middleware.
 * Bypasses SVGs and data URIs (returns src unchanged).
 */
export function buildOptimizedUrl(
  src: string,
  params: { w?: number; h?: number; q?: number; f?: string } = {},
): string {
  // Skip SVG and data URIs — no transformation needed
  if (!src || src.endsWith(".svg") || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  // Normalize relative paths to absolute so the middleware treats them as local
  let normalizedSrc = src;
  if (!src.startsWith("/") && !src.startsWith("http://") && !src.startsWith("https://")) {
    normalizedSrc = `/${src}`;
  }

  const searchParams = new URLSearchParams();
  searchParams.set("url", normalizedSrc);

  if (params.w) searchParams.set("w", String(params.w));
  if (params.h) searchParams.set("h", String(params.h));
  if (params.q) searchParams.set("q", String(params.q));
  if (params.f) searchParams.set("f", params.f);

  return `/img?${searchParams.toString()}`;
}

/** Largeurs du srcSet responsive pour les images full-bleed (héros, backgrounds). */
export const RESPONSIVE_IMAGE_WIDTHS = [480, 768, 1280, 1920];

/**
 * Construit un srcSet responsive en descripteurs de largeur (`w`) via /img.
 * Source UNIQUE de vérité partagée par les composants (ex. HeroQuickAccess) ET le
 * preload LCP SSR — pour que les URLs soient IDENTIQUES et que le navigateur
 * dédoublonne (sinon double téléchargement : la brute préchargée + l'optimisée).
 */
export function buildResponsiveSrcSet(
  src: string,
  widths: number[] = RESPONSIVE_IMAGE_WIDTHS,
  q = 80,
  f = "auto",
): string {
  return widths.map((w) => `${buildOptimizedUrl(src, { w, q, f })} ${w}w`).join(", ");
}

/**
 * URL d'un favicon / petite icône : optimise via /img (PNG redimensionné) UNIQUEMENT les
 * sources LOCALES raster (png/jpg/webp), où l'original 512px ≈ 70 Ko devient ≈ 3 Ko.
 * Laisse l'URL BRUTE pour :
 *  - `.ico` / `.svg` (sharp ne lit pas l'ICO ; le SVG est déjà scalable et léger) ;
 *  - les URLs externes `http(s)://` (hors domaine allowlisté → /img renverrait 403).
 * Renvoie `undefined` si `src` est absent (passe-plat pour les usages conditionnels).
 */
export function buildFaviconUrl(src: string | undefined, width = 64): string | undefined {
  if (!src) return src;
  if (/^https?:\/\//.test(src) || !/\.(png|jpe?g|webp)$/i.test(src)) return src;
  return buildOptimizedUrl(src, { w: width, f: "png" });
}
