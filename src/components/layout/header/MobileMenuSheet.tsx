import { useState } from "react";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { cn } from "@/lib/utils";

type Breakpoint = "sm" | "md" | "lg" | "xl";

/** Classe Tailwind qui masque le burger à partir du breakpoint (statique pour le scan Tailwind). */
const HIDDEN_AT: Record<Breakpoint, string> = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
  xl: "xl:hidden",
};

interface MobileMenuSheetProps {
  /** Contenu du tiroir — reçoit `close()` à câbler sur chaque navigation/action (ferme le tiroir). */
  children: (close: () => void) => ReactNode;
  /** Breakpoint à partir duquel le burger disparaît (défaut `md` ; `xl` pour le méga-menu). */
  breakpoint?: Breakpoint;
  /** Côté d'ouverture du tiroir (défaut `right`). */
  side?: "left" | "right";
  /** Barre claire (`default`) ou sombre/onColor (burger en texte blanc). La surface du tiroir
   * reste pilotée par `contentClassName` (le header fournit sa teinte de marque). */
  tone?: "default" | "onColor";
  /** Classes additionnelles sur le bouton burger (teinte propre au header). */
  triggerClassName?: string;
  /** Classes additionnelles sur le panneau du tiroir (surface/bordure propres au header). */
  contentClassName?: string;
  /** Titre accessible (sr-only) du tiroir. Défaut : « Mobile Menu ». */
  title?: string;
}

/**
 * Conteneur de menu mobile d'en-tête — enveloppe le `Sheet` shadcn (Radix Dialog)
 * que `HeaderStandard` utilisait déjà, pour offrir **à tous les headers** le même
 * comportement modal : focus trap, verrou de scroll, overlay et fermeture par
 * Échap, gratuitement. Remplace 5 `<div>` faits-main qui rataient tous ces
 * garde-fous d'accessibilité.
 *
 * Le wrapper **standardise** : conteneur Sheet, trigger burger (Button + label
 * sr-only + `${breakpoint}:hidden`), titre accessible, côté, état ouvert/fermé.
 * Reste **par-header** (via la render-prop `children(close)`) : le contenu réel
 * du tiroir (nav, sous-menus, LangSwitch, AuthMenu, CTA) et son thème. Chaque
 * élément navigable câble `close()` pour refermer après navigation.
 *
 * SSR-safe : le Sheet ne rend que le trigger en SSR ; le contenu est porté côté
 * client à l'ouverture. `AuthMenu` conserve son `ClientOnly` interne (pas de
 * flash de contenu privé).
 */
export default function MobileMenuSheet({
  children,
  breakpoint = "md",
  side = "right",
  tone = "default",
  triggerClassName,
  contentClassName,
  title,
}: MobileMenuSheetProps) {
  useLoadNamespace("components/layout");
  const t = useT("components/layout");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            HIDDEN_AT[breakpoint],
            tone === "onColor" && "text-white/80 hover:text-white hover:bg-white/10",
            triggerClassName,
          )}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("Toggle menu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className={cn("w-72 gap-0 p-0", contentClassName)}>
        <SheetTitle className="sr-only">{title ?? t("Mobile Menu")}</SheetTitle>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 pt-12">
          {children(close)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
