import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";

interface LangSwitchProps {
  /** Tonalité du trigger : barre claire (`default`) ou sombre/onColor (texte blanc). */
  tone?: "default" | "onColor";
  /** Alignement du menu déroulant (défaut : `end` en `onColor`, sinon `start`). */
  align?: "start" | "center" | "end";
  /** Classes additionnelles sur le bouton trigger (taille / espacement / teinte propres au header). */
  triggerClassName?: string;
}

/**
 * Sélecteur de langue d'en-tête — `DropdownMenu` (icône `Globe` + locale
 * courante) listant les locales disponibles. **Self-contained** : lit
 * `useLocalization()` lui-même et **rend `null` s'il n'y a qu'une locale**
 * (le header se contente de `{header.utilities.langSwitch && <LangSwitch … />}`).
 *
 * Factorisé depuis 9 blocs recopiés à travers 6 headers (desktop + mobile) qui
 * divergeaient sur l'indicateur de locale active (4 variantes : `bg-accent`,
 * aucune, `bg-secondary/30`, `font-semibold bg-primary/10`) et sur le survol.
 * Le menu déroulant est désormais **normalisé** (locale active en
 * `font-semibold` + `bg-accent`, survol par défaut de `DropdownMenuItem`) ;
 * seul le trigger reste piloté par le header (`tone` / `triggerClassName`)
 * pour coller à sa charte (barre claire vs sombre).
 *
 * SSR-safe : `useLocalization` est déjà appelé par les headers en SSR ; le
 * repli `null` (locales ≤ 1) est déterministe (dérivé de la config).
 */
export default function LangSwitch({ tone = "default", align, triggerClassName }: LangSwitchProps) {
  const { currentLocale, setLocale, availableLocales } = useLocalization();

  if (availableLocales.length <= 1) return null;

  const resolvedAlign = align ?? (tone === "onColor" ? "end" : "start");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2",
            tone === "onColor" && "text-white/80 hover:text-white hover:bg-white/10",
            triggerClassName,
          )}
        >
          <Globe className="h-4 w-4" />
          {currentLocale.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={resolvedAlign}>
        {availableLocales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => setLocale(loc)}
            className={cn(loc === currentLocale && "font-semibold bg-accent text-accent-foreground")}
          >
            {loc.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
