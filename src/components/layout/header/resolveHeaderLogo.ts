import type { Header } from "@/types/site-schema";

/**
 * Résultat de la résolution de l'IMAGE de logo d'un header selon le contexte.
 */
export interface ResolvedHeaderLogo {
  /** Source affichée par défaut (mode clair, ou image d'overlay). */
  src: string;
  /**
   * Source distincte pour le mode sombre. Présente uniquement quand `logoDark`
   * diffère de `logo` → le composant fait alors un swap via classes `dark:`.
   */
  srcDark?: string;
}

/** Sous-ensemble des champs de `Header` consommés par le resolver. */
type HeaderLogoFields = Pick<Header, "logo" | "logoDark" | "logoOverlay">;

/**
 * Choisit l'IMAGE de logo d'un header selon le contexte. Renvoie `null` quand
 * aucune image n'est fournie → l'appelant retombe sur `logoIcon`.
 *
 * Le mode clair/sombre n'est délibérément PAS résolu ici en JS : le thème n'est
 * pas connu au rendu SSR, un choix JS provoquerait un flash à l'hydratation. On
 * renvoie `src` (clair) et `srcDark` (sombre) et le composant fait le swap en
 * CSS (`dark:hidden` / `hidden dark:block`).
 *
 * Priorité : overlay > base. L'overlay (header transparent posé sur un héro)
 * n'a qu'une variante — sur une photo de héro, le mode sombre ne change pas le
 * fond, une seule image claire/monochrome suffit.
 */
export function resolveHeaderLogo(
  header: HeaderLogoFields,
  { isOverlay = false }: { isOverlay?: boolean } = {},
): ResolvedHeaderLogo | null {
  if (isOverlay && header.logoOverlay) {
    return { src: header.logoOverlay };
  }

  if (!header.logo) {
    // Pas de logo de base : on tolère un `logoOverlay` seul comme repli.
    return header.logoOverlay ? { src: header.logoOverlay } : null;
  }

  const srcDark =
    header.logoDark && header.logoDark !== header.logo ? header.logoDark : undefined;

  return { src: header.logo, srcDark };
}
