/**
 * extractCriticalResources.ts
 *
 * Extrait les ressources critiques d'une config SiteForge pour le préchargement LCP.
 * - Images : header, footer, meta et sections "above the fold"
 * - Fonts : Google Fonts définies dans la config theme
 */

import type { SiteConfig, Page } from '@/types/site-schema';

export interface CriticalImage {
  src: string;
  fetchpriority?: 'high' | 'low' | 'auto';
  type?: string; // ex: 'image/png', 'image/webp'
}

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
 * Extrait les images des sections "above the fold" (2 premières sections)
 */
function extractSectionImages(sections: Page['sections'], maxSections = 2): string[] {
  const images: string[] = [];
  const sectionsToAnalyze = sections.slice(0, maxSections);

  for (const section of sectionsToAnalyze) {
    const props = section.props as Record<string, unknown>;

    // Background images (hero, cta, banner, etc.)
    if (props.backgroundImage && typeof props.backgroundImage === 'string') {
      images.push(props.backgroundImage);
    }

    // Images dans les cards
    if (props.items && Array.isArray(props.items)) {
      // Limiter aux 4 premiers items pour ne pas surcharger
      const items = props.items.slice(0, 4);
      for (const item of items) {
        if (item && typeof item === 'object') {
          const itemObj = item as Record<string, unknown>;
          if (itemObj.image && typeof itemObj.image === 'string') {
            images.push(itemObj.image);
          }
          if (itemObj.iconImage && typeof itemObj.iconImage === 'string') {
            images.push(itemObj.iconImage);
          }
          if (itemObj.avatar && typeof itemObj.avatar === 'string') {
            images.push(itemObj.avatar);
          }
          if (itemObj.featuredImage && typeof itemObj.featuredImage === 'string') {
            images.push(itemObj.featuredImage);
          }
        }
      }
    }

    // Images dans une galerie
    if (props.images && Array.isArray(props.images)) {
      const galleryImages = props.images.slice(0, 4);
      for (const img of galleryImages) {
        if (img && typeof img === 'object') {
          const imgObj = img as Record<string, unknown>;
          if (imgObj.src && typeof imgObj.src === 'string') {
            images.push(imgObj.src);
          }
        }
      }
    }

    // Logos dans logoCloud
    if (props.logos && Array.isArray(props.logos)) {
      const logos = props.logos.slice(0, 6);
      for (const logo of logos) {
        if (logo && typeof logo === 'object') {
          const logoObj = logo as Record<string, unknown>;
          if (logoObj.src && typeof logoObj.src === 'string') {
            images.push(logoObj.src);
          }
        }
      }
    }

    // Membres d'équipe
    if (props.members && Array.isArray(props.members)) {
      const members = props.members.slice(0, 4);
      for (const member of members) {
        if (member && typeof member === 'object') {
          const memberObj = member as Record<string, unknown>;
          if (memberObj.avatar && typeof memberObj.avatar === 'string') {
            images.push(memberObj.avatar);
          }
        }
      }
    }

    // Témoignages avec avatar
    if (section.type === 'testimonials' && props.items && Array.isArray(props.items)) {
      const testimonials = props.items.slice(0, 3);
      for (const testimonial of testimonials) {
        if (testimonial && typeof testimonial === 'object') {
          const testObj = testimonial as Record<string, unknown>;
          if (testObj.avatar && typeof testObj.avatar === 'string') {
            images.push(testObj.avatar);
          }
        }
      }
    }
  }

  return images;
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

  // Helper pour ajouter une image sans doublon
  const addImage = (src: string, fetchpriority?: CriticalImage['fetchpriority']) => {
    const normalized = normalizePath(src);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      images.push({
        src: normalized,
        fetchpriority,
        type: getImageType(normalized),
      });
    }
  };

  // 1. Logo du header (priorité haute - élément LCP principal)
  if (config.header?.logo) {
    addImage(config.header.logo, 'high');
  }

  // 2. Favicon (généralement petit, mais utile)
  if (config.meta?.favicon) {
    addImage(config.meta.favicon);
  }

  // 3. Trouver la page courante
  const currentPage = config.pages.find((p) => p.path === pathname) || config.pages[0];

  if (currentPage) {
    // 4. Image OG de la page (si présente)
    if (currentPage.seo?.ogImage) {
      addImage(currentPage.seo.ogImage);
    }

    // 5. Images des sections "above the fold"
    const sectionImages = extractSectionImages(currentPage.sections);
    for (const img of sectionImages) {
      addImage(img);
    }
  }

  // 6. Logo du footer (moins prioritaire, mais visible sur toutes les pages)
  if (config.footer?.logo) {
    addImage(config.footer.logo);
  }

  // 7. Images provenant des loaders (données dynamiques API)
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
  const genericFonts = ['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive', 'fantasy'];
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
