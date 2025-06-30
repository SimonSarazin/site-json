import * as React from "react";
import { Link } from "react-router";

import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useLocalization } from "@/hooks/useLocalization";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type Direction = "top" | "right" | "bottom" | "left";

/**
 * Permet de forcer un type précis pour overflow
 *   • "auto" → overflow-y-auto | overflow-x-auto selon l'orientation
 *   • string → classe Tailwind ou utilitaire CSS personnalisé
 *   • boolean → false pour désactiver totalement l'overflow (aucune classe)
 */
export type OverflowType = "auto" | string | boolean;

export interface CustomDrawerProps {
  isOpenDrawer: boolean;
  openAndCloseDrawer: (open: boolean) => void;

  /** Titre du lien d'ouverture d'une page externe (optionnel) */
  openPageTitle?: string;

  /** Sens d'ouverture du drawer (top, right, bottom, left) – défaut: "right" */
  direction?: Direction;

  /** Contenu affiché dans le drawer */
  children: React.ReactNode;

  /** Affiche l'icône "arrow-up-right-from-square" à côté du bouton d'action */
  iconActionPage?: boolean;

  /** Gestion du débordement ("auto" ou classe utilitaire) – défaut: "auto" */
  overflowType?: OverflowType;

  /** Lien du bouton d'action (si fourni) */
  link?: string;
}

// ------------------------------------------------------------------
// Constantes
// ------------------------------------------------------------------

const SIZE_CLASSES = {
  horizontal: {
    auto: "w-auto sm:w-1/2 md:w-3/4 lg:w-1/3",
  },
  vertical: {
    auto: "h-auto sm:h-1/2 md:h-3/4 lg:h-1/3",
  },
} as const;

// ------------------------------------------------------------------
// Composant
// ------------------------------------------------------------------

export default function CustomDrawer({
  isOpenDrawer,
  openAndCloseDrawer,
  openPageTitle,
  direction = "right",
  children,
  iconActionPage,
  overflowType = "auto",
  link,
}: CustomDrawerProps) {
  const lastFocusRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const { t } = useLocalization();

  // ----------------------------------------------------------------
  // Effets
  // ----------------------------------------------------------------

  React.useEffect(() => {
    if (!isOpenDrawer && lastFocusRef.current) {
      lastFocusRef.current.focus();
    }
  }, [isOpenDrawer]);

  // ----------------------------------------------------------------
  // Classes dynamiques
  // ----------------------------------------------------------------

  const isHorizontal = direction === "left" || direction === "right";
  const sizeClass = isHorizontal
    ? SIZE_CLASSES.horizontal.auto
    : SIZE_CLASSES.vertical.auto;

  const positionClass: string =
    direction === "right"
      ? "inset-y-0 right-0"
      : direction === "left"
      ? "inset-y-0 left-0"
      : direction === "top"
      ? "inset-x-0 top-0"
      : /* bottom */ "inset-x-0 bottom-0";

  const overflowClass: string = (() => {
    if (overflowType === "auto") {
      return isHorizontal ? "overflow-y-auto" : "overflow-x-auto";
    }
    if (typeof overflowType === "string") return overflowType;
    return ""; // boolean false → aucune classe overflow ajoutée
  })();

  // ----------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------

  return (
    <Drawer open={isOpenDrawer} onOpenChange={openAndCloseDrawer} direction={direction}>
      <DrawerContent
        ref={contentRef}
        className={cn(
          "fixed z-[99999] flex flex-col bg-background text-foreground border border-border",
          "mt-0 left-auto",
          positionClass,
          sizeClass,
          overflowClass,
        )}
      >
        <DrawerHeader className="flex items-center justify-between mb-2 px-4 pt-4">
          <DrawerClose asChild>
            <button
              aria-label="Fermer"
              className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <i className="fa fa-close" />
            </button>
          </DrawerClose>

          <div className="space-y-0.5">
            <DrawerTitle className="text-lg font-medium">{t("Aperçu")}</DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground">
              {t("Aperçu du contenu")}
            </DrawerDescription>
          </div>

          {openPageTitle && link && (
            <Link to={link}>
              <button
                onClick={() => openAndCloseDrawer(false)}
                className="inline-flex h-8 items-center space-x-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span>{openPageTitle}</span>
                {iconActionPage !== false && (
                  <i className="fa-solid fa-arrow-up-right-from-square" />
                )}
              </button>
            </Link>
          )}
        </DrawerHeader>

        <div className="px-4 flex-1">{children}</div>

        {/* Focus trap */}
        <button
          className="sr-only"
          ref={lastFocusRef}
          onFocus={() => contentRef.current?.focus()}
        >
          {t("Retour en haut")}
        </button>
      </DrawerContent>
    </Drawer>
  );
}
