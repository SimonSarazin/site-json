import type { Header } from "@/types/site-schema";
import { LOGO_SIZE_PX } from "./logoSize";

/**
 * Hauteur, en px, que le header OCCUPE en haut du viewport en DESKTOP (≥ `lg`,
 * 1024px) — donc l'offset dont un élément `position: sticky` doit s'écarter
 * pour ne pas se coller SOUS la barre. Vaut **0** quand le header défile avec
 * la page : sans ce cas, un `top` de 80px creuserait un trou inutile.
 *
 * Pourquoi une table dérivée de la config plutôt qu'une mesure JS : la valeur
 * est nécessaire dès le PREMIER rendu (SSR) ; un `getBoundingClientRect`
 * n'existe qu'après hydratation et ferait sauter la mise en page.
 *
 * Deux pièges vérifiés dans le code des headers :
 * 1. `header.sticky` n'est lu QUE par `standard`/`default` (HeaderStandard.tsx:193)
 *    et `mega-menu` (HeaderMegaMenu.tsx:38). Les quatre autres sont
 *    `fixed top-0` INCONDITIONNELS : ils occupent le viewport même avec
 *    `sticky: false`.
 * 2. `header.height` n'est lu comme hauteur de BARRE que par HeaderStandard
 *    (HeaderStandard.tsx:186-190) ; ailleurs c'est une taille de logo
 *    (HeaderMegaMenu.tsx:27-31) ou rien du tout.
 *
 * La config JSON n'étant jamais parsée par Zod au runtime (cf. CLAUDE.md,
 * « Defaults Zod jamais appliqués »), `sticky`/`height` peuvent valoir
 * `undefined` malgré leur `.default()` — d'où les replis explicites.
 *
 * Si un header venait à RÉTRÉCIR au scroll (aucun ne le fait aujourd'hui :
 * `useScrollAware` ne pilote que des couleurs, useHeaderBehavior.ts:24-33),
 * renvoyer ici sa hauteur MAXIMALE : trop d'offset = un blanc temporaire,
 * pas assez = du contenu masqué en permanence.
 */

/** HeaderStandard.tsx:186-190 (`h-12`/`h-16`/`h-20`) + `border-b` (ligne 193). */
const BAR_HEIGHT_PX: Record<NonNullable<Header["height"]>, number> = {
  sm: 49,
  md: 65,
  lg: 81,
};

/** `<AnnouncementBanner>` rendu DANS le header collant (HeaderStandard.tsx:194) : `px-3 py-2` + `text-sm`. */
const ANNOUNCEMENT_PX = 36;

/** Plancher de la ligne flex des headers sans hauteur fixe : `h-10` du fallback AuthMenu (AuthMenu.tsx:118). */
const UTILITY_ROW_PX = 40;

export function headerStickyOffsetPx(header: Header | undefined): number {
  if (!header) return 0;

  // Headers sans classe de hauteur : la barre épouse son plus grand enfant.
  const contentPx = Math.max(LOGO_SIZE_PX[header.logoSize ?? "sm"], UTILITY_ROW_PX);

  switch (header.type) {
    // Barre `h-20` en dur, `fixed` inconditionnel.
    case "transparent-scroll": // HeaderTransparentScroll.tsx:108 + :116
    case "underline-nav": // HeaderUnderlineNav.tsx:38 + :40
      return 80;
    // `h-16 md:h-20` : au-dessus de `lg` on est toujours dans le `md:` → 80.
    case "transparent-dark": // HeaderTransparentDark.tsx:62 + :64
      return 80;
    // `fixed` inconditionnel ; hauteur = `py-5` (40) + contenu + `border-b` (1).
    case "minimal": // HeaderMinimal.tsx:37 + :38
      return 40 + contentPx + 1;
    // `sticky` honoré ; hauteur = `sm:py-4` (32) + contenu + `border-b` (1).
    case "mega-menu": // HeaderMegaMenu.tsx:38 + :39
      return header.sticky ? 32 + contentPx + 1 : 0;
    // `standard` + `default` (DefaultHeader délègue à HeaderStandard,
    // DefaultHeader.tsx:16-18) : `sticky` honoré, hauteur pilotée par `height`.
    default: // HeaderStandard.tsx:186-195
      if (!header.sticky) return 0;
      return (
        (BAR_HEIGHT_PX[header.height] ?? BAR_HEIGHT_PX.md) +
        // Bandeau refermable : après fermeture l'offset est trop grand de 36px
        // (un blanc), ce qui reste préférable à du contenu masqué.
        (header.announcement ? ANNOUNCEMENT_PX : 0)
      );
  }
}
