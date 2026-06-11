import { Link } from "react-router";
import type { AriaAttributes, MouseEventHandler, ReactNode } from "react";

/**
 * Lien de navigation d'en-tête — tranche les 3 cas qu'un header doit gérer :
 * 1. `to` vide ou `"#"` → `<span>` inerte (placeholder, jamais cliquable) ;
 * 2. `to` externe (`http(s)://`, ou `external` forcé) → `<a target="_blank"
 *    rel="noopener noreferrer">` ;
 * 3. sinon → `<Link>` React Router (navigation SPA).
 *
 * **Présentationnel** : il ne calcule PAS l'état actif. Chaque header garde
 * son `useNavItemActive`/className sur-mesure (couleurs + `<span>` souligné
 * frère) et passe la className résolue + un `ariaCurrent` optionnel.
 *
 * Auparavant redéclaré localement dans `HeaderMegaMenu` et recopié à la main
 * (souvent buggé : `#` cliquable, URL externe rendue via `<Link>`) dans les
 * autres headers — extrait ici pour un seul point de vérité, importé.
 *
 * SSR-safe : décision purement basée sur l'inspection de la chaîne `to`
 * (aucun hook, aucun accès `window`).
 */
export default function NavLink({
  to,
  className,
  onClick,
  ariaCurrent,
  external,
  children,
}: {
  to?: string | null;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  ariaCurrent?: AriaAttributes["aria-current"];
  /** Force le rendu en lien externe (sinon déduit de `to.startsWith("http")`). */
  external?: boolean;
  children: ReactNode;
}) {
  if (!to || to === "#") {
    return <span className={className}>{children}</span>;
  }

  if (external ?? to.startsWith("http")) {
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className} onClick={onClick} aria-current={ariaCurrent}>
      {children}
    </Link>
  );
}
