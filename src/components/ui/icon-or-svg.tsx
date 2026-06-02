import { DynamicIcon, type IconName } from "lucide-react/dynamic";

interface IconOrSvgProps {
  /**
   * Soit un nom d'icône Lucide en kebab-case (ex: `"waves"`, `"piggy-bank"`),
   * soit un SVG inline (string commençant par `"<svg"`).
   *
   * Détection automatique au render :
   * - `value.trim().startsWith("<svg")` → SVG inline via `dangerouslySetInnerHTML`.
   * - sinon → `<DynamicIcon name={value} />` Lucide.
   *
   * Retourne `null` si la valeur est `undefined`, `null` ou vide.
   */
  value: string | undefined | null;
  /** Classes Tailwind appliquées sur l'élément rendu. */
  className?: string;
  "aria-label"?: string;
}

/**
 * Rend une icône qui peut provenir de deux formats :
 *
 * 1. **Nom Lucide** (kebab-case) → `<DynamicIcon />` chargé dynamiquement.
 * 2. **SVG inline** (`<svg ...>...</svg>`) → injecté via `dangerouslySetInnerHTML`.
 *
 * Convention SiteForge : les champs `logoIcon` / `icon` des configs JSON
 * acceptent les deux formats. Lucide pour les icônes standard, SVG inline
 * pour les cas custom non couverts par Lucide.
 *
 * Sécurité : le SVG inline vient des configs JSON versionnées dans le repo,
 * pas de user input. Pas de sanitization nécessaire.
 */
export function IconOrSvg({ value, className, "aria-label": ariaLabel }: IconOrSvgProps) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("<svg")) {
    // Le SVG inline garde ses attributs `width`/`height` natifs (souvent 24×24)
    // qui ne correspondent pas à `className="w-8 h-8"`. On force le SVG enfant
    // à remplir le span dimensionné par className via `[&>svg]:w-full [&>svg]:h-full`.
    return (
      <span
        className={`inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full ${className ?? ""}`}
        aria-label={ariaLabel}
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    );
  }

  return (
    <DynamicIcon
      name={trimmed as IconName}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
