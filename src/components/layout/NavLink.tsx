import { Link } from "react-router";
import { forwardRef } from "react";
import type { AriaAttributes, HTMLAttributes, MouseEventHandler, ReactNode, Ref } from "react";

import { classifyHref } from "@/lib/linkKind";

type NavLinkProps = {
  to?: string | null;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  ariaCurrent?: AriaAttributes["aria-current"];
  /** Force le rendu en lien externe (sinon déduit par `classifyHref`). */
  external?: boolean;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "onClick" | "children">;

/**
 * Lien de navigation partagé (en-têtes ET pieds de page) — tranche les cas
 * qu'un lien de chrome doit gérer :
 * 1. `to` vide ou `"#"` → `<span>` inerte (placeholder, jamais cliquable) ;
 * 2. `mailto:` / `tel:` / `sms:` → `<a href>` simple (le handler OS intercepte ;
 *    pas de `target="_blank"`) ;
 * 3. `to` externe (`http(s)://`, ou `external` forcé) → `<a target="_blank"
 *    rel="noopener noreferrer">` ;
 * 4. sinon → `<Link>` React Router (navigation SPA).
 *
 * **Présentationnel** : il ne calcule PAS l'état actif. Chaque header garde
 * son `useNavItemActive`/className sur-mesure (couleurs + `<span>` souligné
 * frère) et passe la className résolue + un `ariaCurrent` optionnel.
 *
 * `forwardRef` + props résiduelles (`...rest`) pour être composable en
 * `asChild` d'un primitive Radix (ex. `DropdownMenuItem asChild` dans
 * `HeaderStandard`) : la ref et les attributs de menuitem (role, tabIndex,
 * data-attributes, onKeyDown) injectés par le `Slot` sont transmis à l'ancre.
 *
 * Auparavant redéclaré localement dans `HeaderMegaMenu` et recopié à la main
 * (souvent buggé : `#` cliquable, URL externe rendue via `<Link>`) dans les
 * autres headers — extrait ici pour un seul point de vérité, importé.
 *
 * SSR-safe : décision purement basée sur l'inspection de la chaîne `to`
 * (aucun hook, aucun accès `window`).
 */
const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { to, className, onClick, ariaCurrent, external, children, ...rest },
  ref,
) {
  // Contrat tranché par `classifyHref` (src/lib/linkKind.ts) — partagé avec CTASection et
  // CardsSection, qui rendaient les mêmes liens de config avec des règles divergentes.
  const kind = classifyHref(to);

  // `!to` d'abord : la garde de vérité narrow `to` en `string` pour la suite (classifyHref,
  // fonction, ne le fait pas). Les deux conditions couvrent exactement le même cas.
  if (!to || kind === "inert") {
    // Ref transmise aussi sur le placeholder : un `DropdownMenuItem asChild`
    // (Radix Slot) exige la ref pour le focus/typeahead même sur un libellé
    // non navigable (enfant de menu sans `path`/`href`).
    return (
      <span ref={ref as Ref<HTMLSpanElement>} className={className} {...rest}>
        {children}
      </span>
    );
  }

  // mailto: / tel: / sms: → ancre simple (handler OS), jamais un nouvel onglet.
  if (kind === "protocol") {
    return (
      <a ref={ref} href={to} className={className} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }

  if (external ?? kind === "external") {
    return (
      <a
        ref={ref}
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <Link ref={ref} to={to} className={className} onClick={onClick} aria-current={ariaCurrent} {...rest}>
      {children}
    </Link>
  );
});

export default NavLink;
