/**
 * Utilitaires pour chercher les projets de financement par slug de profil depuis l'URL
 */

export function getProfileSlugFromLocation(): string {
  if (typeof window === 'undefined') return '';

  const parts = window.location.pathname.split('/').filter(Boolean);
  const profileIndex = parts.indexOf('profil');
  if (profileIndex < 0 || profileIndex + 1 >= parts.length) return '';

  return parts[profileIndex + 1].trim();
}

export interface FundingProject {
  id: string;
  slug?: string;
  [key: string]: unknown;
}

/**
 * Cherche un projet de financement par slug de profil dans la liste de projets
 * @param projects Liste des projets de financement
 * @returns L'id du projet trouvé, ou empty string si non trouvé
 */
export function getSelectedProjectIdByProfileSlug(projects: FundingProject[]): string {
  if (!projects || projects.length === 0) return '';

  const slug = getProfileSlugFromLocation();
  if (!slug) return '';

  const project = projects.find((p) => p.slug === slug);
  return project?.id || '';
}

