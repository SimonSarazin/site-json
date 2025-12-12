/**
 * generatePreloadTags.ts
 *
 * Génère les balises HTML <link rel="preload"> pour les images critiques.
 */

import type { CriticalImage } from './extractCriticalImages';

/**
 * Génère une balise <link rel="preload"> pour une image
 */
function generateImagePreloadTag(image: CriticalImage): string {
  const attrs: string[] = [
    'rel="preload"',
    'as="image"',
    `href="${image.src}"`,
  ];

  if (image.fetchpriority) {
    attrs.push(`fetchpriority="${image.fetchpriority}"`);
  }

  if (image.type) {
    attrs.push(`type="${image.type}"`);
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
