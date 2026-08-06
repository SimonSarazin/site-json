/**
 * extractCriticalResources.ts
 *
 * Extrait les ressources critiques d'une config SiteForge pour le préchargement LCP.
 * - Images : header, footer, meta et sections "above the fold"
 * - Fonts : Google Fonts définies dans la config theme
 */

import type { SiteConfig } from '@/types/site-schema';

export interface CriticalImage {
  src: string;
  fetchpriority?: 'high' | 'low' | 'auto';
  type?: string; // ex: 'image/png', 'image/webp'
  /**
   * `true` si l'image est rendue via /img en srcSet responsive (descripteurs `w`),
   * ex. le `backgroundImage` du héro `hero-quick-access`. Le preload émettra alors
   * `imagesrcset`/`imagesizes` (mêmes URLs /img que l'<img>) au lieu d'un `href` vers
   * la source brute — sinon le navigateur télécharge LES DEUX (brute + optimisée).
   */
  responsive?: boolean;
}

/**
 * Types de section dont le `backgroundImage` plein cadre above-the-fold est rendu via
 * `<HeroBackgroundImage>` en srcSet responsive (/img `w`) → preload `imagesrcset`.
 * (`hero-search` exclu : image décorative en bas de section, non-LCP ;
 *  `hero-entity-banner` exclu : URL d'entité externe, rendue en `<img>` brut.)
 */
const RESPONSIVE_BG_SECTION_TYPES = new Set<string>([
  'hero-quick-access',
  'hero',
  'hero-parallax',
  'hero-tinted-overlay',
  'hero-carousel',
]);

/**
 * Types de section dont l'image LCP vit dans `props.slides[0].backgroundImage` et NON
 * dans `props.backgroundImage`. Sans cette seconde lecture, un type ajouté au Set
 * ci-dessus n'émettrait toujours AUCUN preload — le garde `typeof bg === 'string'`
 * (plus bas) coupant sur un `undefined`.
 *
 * ⚠ Le Set ci-dessus et celui-ci sont INDISSOCIABLES : ajouter un type à l'un sans
 * l'autre ne produit rien, en silence. `tests/preflight/lcp-preload.test.ts` garde
 * cette parité — écrit en même temps que `hero-carousel`, parce que RIEN dans `tests/`
 * ni `e2e/` ne couvrait cette chaîne jusque-là.
 *
 * On ne précharge QUE la diapositive 0 : `addImage` dédoublonne mais n'agrège pas, donc
 * n appels produiraient n balises `<link>` distinctes — ce qui viole le plafond de
 * priorité (« setting a high priority on more than one or two images makes priority
 * setting unhelpful »). Les diapositives suivantes portent `fetchpriority="low"` dans
 * le composant.
 */
const SLIDES_BG_SECTION_TYPES = new Set<string>([
  'hero-carousel',
]);

/**
 * Détecte le type MIME d'une image à partir de son extension
 */
function getImageType(src: string): string | undefined {
  const ext = src.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'avif': 'image/avif',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
  };
  return ext ? mimeTypes[ext] : undefined;
}

/**
 * Normalise le chemin d'une image (ajoute / si nécessaire)
 */
function normalizePath(src: string): string {
  if (!src) return '';
  // Si c'est une URL absolue, la retourner telle quelle
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return src;
  }
  // Ajouter / au début si manquant
  return src.startsWith('/') ? src : `/${src}`;
}

/**
 * Données du loader qui peuvent contenir des images à précharger
 */
export interface LoaderDataWithImages {
  preloadImages?: string[];
}

/**
 * Extrait toutes les images critiques d'une config en fonction de la page courante
 * @param config - Configuration du site
 * @param pathname - Chemin de la page courante
 * @param loaderData - Données optionnelles du loader React Router (peut contenir preloadImages)
 */
export function extractCriticalImages(
  config: SiteConfig,
  pathname: string,
  loaderData?: Record<string, LoaderDataWithImages | unknown>
): CriticalImage[] {
  const images: CriticalImage[] = [];
  const seen = new Set<string>();

  // Helper pour ajouter une image sans doublon (1ère occurrence gagne → on ajoute
  // le héro responsive AVANT le scan des sections pour qu'il reste `responsive`).
  const addImage = (src: string, fetchpriority?: CriticalImage['fetchpriority'], responsive?: boolean) => {
    const normalized = normalizePath(src);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      images.push({
        src: normalized,
        fetchpriority,
        // Une image responsive passe par /img → pas de `type` (format négocié par /img).
        type: responsive ? undefined : getImageType(normalized),
        responsive,
      });
    }
  };

  // 1. Logo du header : PAS de preload. Il est rendu via <OptimizedImage> (/img), or un
  //    preload brut `href` (source non optimisée) ne matche pas l'URL /img → double
  //    téléchargement, et en `fetchpriority=high` il concurrence le vrai LCP (le héro).
  //    L'<img> du logo est en haut du DOM → le preload-scanner le trouve sans aide.

  // 2. Favicon : PAS de preload `as=image` non plus — le navigateur le charge déjà via
  //    <link rel="icon">. Le précharger en image fait juste un fetch brut redondant
  //    (et, quand favicon === logo du header, donne l'impression d'un logo chargé 2×).

  // 3. Trouver la page courante
  const currentPage = config.pages.find((p) => p.path === pathname) || config.pages[0];

  if (currentPage) {
    // SEUL l'arrière-plan du 1er héro PLEIN CADRE above-the-fold est préchargé, et via
    // imagesrcset (mêmes URLs /img que <HeroBackgroundImage>) → match exact, zéro double
    // téléchargement. On NE précharge PAS :
    //  - l'image OG (jamais affichée, c'est pour les crawlers) ;
    //  - les autres images de section (cards, galerie, logos, bg décoratif d'un hero-search…) ;
    //  - le logo du footer (sous la ligne de flottaison).
    // Toutes sont rendues via /img DANS le markup → le preload-scanner les trouve déjà, et un
    // preload `href` BRUT ne matcherait pas leur URL /img (→ double téléchargement, le bug
    // qu'on corrige). cf. <OptimizedImage> / <HeroBackgroundImage>.
    const firstSection = currentPage.sections?.[0];
    if (firstSection && RESPONSIVE_BG_SECTION_TYPES.has(firstSection.type)) {
      const props = firstSection.props as
        | { backgroundImage?: string; slides?: { backgroundImage?: string }[] }
        | undefined;
      // Un héro à diapositives porte son image LCP dans slides[0], pas à la racine des
      // props : sans cette branche, le garde scalaire ci-dessous coupe sur `undefined`
      // et la page perd son preload SANS le moindre signal.
      const bg = SLIDES_BG_SECTION_TYPES.has(firstSection.type)
        ? props?.slides?.[0]?.backgroundImage
        : props?.backgroundImage;
      if (typeof bg === 'string') addImage(bg, 'high', true);
    }
  }

  // Images provenant des loaders (données dynamiques API, ex. avatar/bannière de profil)
  if (loaderData) {
    for (const routeId of Object.keys(loaderData)) {
      const data = loaderData[routeId] as LoaderDataWithImages | null;
      if (data?.preloadImages && Array.isArray(data.preloadImages)) {
        for (const img of data.preloadImages) {
          // Images de profil avec priorité haute (souvent LCP sur pages profil)
          addImage(img, 'high');
        }
      }
    }
  }

  return images;
}

/**
 * Interface pour les fonts critiques à précharger
 */
export interface CriticalFont {
  family: string;
  url: string;
}

/**
 * Extrait les noms de police depuis un tableau de familles CSS
 * Filtre les polices génériques (sans-serif, serif, etc.)
 */
function extractFontFamilies(families?: string[]): string[] {
  if (!families) return [];
  const genericFonts = ['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive', 'fantasy',
    'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded'];
  return families
    .map(f => f.trim().replace(/['"]/g, '').split(',')[0].trim())
    .filter(f => f && !genericFonts.includes(f.toLowerCase()));
}

/**
 * Construit l'URL Google Fonts pour une police
 */
function buildGoogleFontURL(font: string): string {
  const encoded = font.replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
}

/**
 * Extrait les Google Fonts de la config pour le préchargement
 */
export function extractCriticalFonts(config: SiteConfig): CriticalFont[] {
  const fontFamily = config.theme?.typography?.fontFamily;
  if (!fontFamily) return [];

  const fonts = new Set<string>();

  // Extraire les fonts de chaque catégorie
  extractFontFamilies(fontFamily.sans).forEach(f => fonts.add(f));
  extractFontFamilies(fontFamily.serif).forEach(f => fonts.add(f));
  extractFontFamilies(fontFamily.mono).forEach(f => fonts.add(f));

  return Array.from(fonts).map(family => ({
    family,
    url: buildGoogleFontURL(family),
  }));
}
