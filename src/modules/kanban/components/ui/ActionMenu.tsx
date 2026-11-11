import { Fragment } from "react";
import { Check, MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  key: string;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  /** Geste destructeur : couleur d'alerte, et toujours dans son propre groupe. */
  danger?: boolean;
  /** Ce que l'on regarde déjà (vue courante) : coché, et dit au lecteur d'écran. */
  current?: boolean;
}

export interface ActionMenuSection {
  key: string;
  /** Intitulé du groupe (« Autres vues ») ; sans lui, un simple filet le sépare du précédent. */
  label?: string;
  items: readonly ActionMenuItem[];
}

export interface ActionMenuProps {
  /** Nom accessible du déclencheur « ⋯ » : il dit SUR QUOI le menu agit. */
  label: string;
  sections: readonly ActionMenuSection[];
  /** `sm` : dans une carte (32 px, 44 px au doigt) ; `md` : en-tête de colonne. */
  triggerSize?: "sm" | "md";
  /** `outline` : parmi les boutons d'une barre d'outils, où un « ⋯ » nu se perdrait. */
  triggerVariant?: "ghost" | "outline";
  className?: string;
}

/**
 * Menu « ⋯ » du kanban (carte, colonne), sur le `DropdownMenu` du site : navigation au clavier,
 * fermeture par Échap et retour du focus au déclencheur sont ceux de Radix.
 *
 * Même contrat que l'`ActionMenu` de co-kanban : des SECTIONS, séparées par un filet, dont les
 * vides disparaissent ; un menu sans aucun item ne se rend pas (un bouton mort). Le
 * déclencheur porte `aria-haspopup="menu"` (Radix), que `rolesFocus.ts` lit pour y rendre le
 * focus.
 */
export function ActionMenu({ label, sections, triggerSize = "md", triggerVariant = "ghost", className }: ActionMenuProps) {
  const filled = sections.filter((section) => section.items.length > 0);
  if (filled.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={triggerVariant}
          size={triggerSize === "sm" ? "icon-sm" : "icon"}
          aria-label={label}
          className={cn("shrink-0 text-muted-foreground pointer-coarse:size-11", className)}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {filled.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 && <DropdownMenuSeparator />}
            {/* Le groupe porte son intitulé pour le lecteur d'écran ; l'intitulé visible est masqué
                à celui-ci, qui l'entendrait sinon deux fois. */}
            <DropdownMenuGroup aria-label={section.label}>
              {section.label ? (
                <DropdownMenuLabel aria-hidden className="text-xs font-medium text-muted-foreground">
                  {section.label}
                </DropdownMenuLabel>
              ) : null}
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.key}
                    variant={item.danger ? "destructive" : "default"}
                    onSelect={item.onSelect}
                    aria-current={item.current ? "page" : undefined}
                    className="pointer-coarse:min-h-11"
                  >
                    <Icon aria-hidden />
                    {item.label}
                    {item.current ? <Check aria-hidden className="ml-auto" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
