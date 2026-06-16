/**
 * generatePreloadTags.ts
 *
 * Génère les balises HTML <link rel="preload"> pour les ressources critiques.
 * - Images : logo, backgrounds, images de profil
 * - Fonts : Google Fonts
 */

import type { CriticalImage, CriticalFont } from './extractCriticalResources';
import { buildResponsiveSrcSet } from './imageUtils';

/**
 * Génère une balise <link rel="preload"> pour une image
 * Note: On n'ajoute pas crossorigin car le serveur d'images doit supporter CORS
 * Le preload fonctionne quand même en mode "no-cors" pour les images
 */
function generateImagePreloadTag(image: CriticalImage): string {
  const attrs: string[] = ['rel="preload"', 'as="image"'];

  if (image.responsive) {
    // Image rendue via /img en srcSet responsive (ex. héro hero-quick-access) :
    // on précharge le MÊME srcSet (imagesrcset/imagesizes) que l'<img> → le navigateur
    // dédoublonne et précharge la bonne taille, au lieu de télécharger la brute en plus.
    attrs.push(`imagesrcset="${buildResponsiveSrcSet(image.src)}"`, 'imagesizes="100vw"');
  } else {
    attrs.push(`href="${image.src}"`);
    if (image.type) attrs.push(`type="${image.type}"`);
  }

  if (image.fetchpriority) {
    attrs.push(`fetchpriority="${image.fetchpriority}"`);
  }

  return `<link ${attrs.join(' ')}>`;
}

/**
 * Génère les balises HTML de préchargement pour toutes les images critiques
 */
export function generateImagePreloadTags(images: CriticalImage[]): string {
  if (!images || images.length === 0) {
    return '';
  }

  return images
    .map(generateImagePreloadTag)
    .join('\n');
}

/**
 * Génère les balises de préchargement pour les Google Fonts
 * - preconnect pour établir la connexion tôt
 * - preload + stylesheet pour charger les fonts
 */
export function generateFontPreloadTags(fonts: CriticalFont[]): string {
  if (!fonts || fonts.length === 0) {
    return '';
  }

  const tags: string[] = [];

  // Preconnect aux domaines Google Fonts (une seule fois)
  tags.push('<link rel="preconnect" href="https://fonts.googleapis.com">');
  tags.push('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');

  // Preload et stylesheet pour chaque font
  for (const font of fonts) {
    tags.push(`<link rel="preload" as="style" href="${font.url}">`);
    tags.push(`<link rel="stylesheet" href="${font.url}">`);
  }

  return tags.join('\n');
}
