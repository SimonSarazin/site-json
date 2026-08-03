import type { Header } from "@/types/site-schema";

/**
 * Tailles de logo partagées par les headers (`header.logoSize`, défaut "sm" =
 * comportement historique). Deux formes selon la marque :
 * - carrée (`logoSquareClass`) : headers à logo-pastille (transparent-scroll,
 *   minimal, underline-nav) ;
 * - hauteur seule (`logoHeightClass`) : headers à logo large `w-auto`
 *   (standard, mega-menu, transparent-dark).
 * Toujours responsive : plus compact en mobile, taille pleine dès `sm:`.
 * NB : sur `standard`, un logo "lg" (48px) suppose `header.height: "md"|"lg"`
 * (la barre "sm" fait 48px). `LOGO_SIZE_PX` = hint pour l'optimiseur d'images.
 */
export type LogoSize = NonNullable<Header["logoSize"]>;

export const LOGO_SIZE_PX: Record<LogoSize, number> = { sm: 32, md: 40, lg: 48 };

const HEIGHT_CLASS: Record<LogoSize, string> = {
  sm: "h-8",
  md: "h-9 sm:h-10",
  lg: "h-10 sm:h-12",
};

const SQUARE_CLASS: Record<LogoSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9 sm:h-10 sm:w-10",
  lg: "h-10 w-10 sm:h-12 sm:w-12",
};

export const logoHeightClass = (size: LogoSize | undefined) => HEIGHT_CLASS[size ?? "sm"];
export const logoSquareClass = (size: LogoSize | undefined) => SQUARE_CLASS[size ?? "sm"];
export const logoSizePx = (size: LogoSize | undefined) => LOGO_SIZE_PX[size ?? "sm"];
