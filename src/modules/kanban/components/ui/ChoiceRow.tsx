import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChoiceRowProps extends Omit<ComponentPropsWithoutRef<"input">, "type" | "className" | "children"> {
  checked: boolean;
  /** `radio` : un choix exclusif (« Grouper par »), groupé par `name`. */
  type?: "checkbox" | "radio";
  /** Repère DÉCORATIF entre la case et le libellé (portrait, pictogramme). */
  leading?: ReactNode;
  /** Colonne de droite, en texte secondaire à chiffres tabulaires (compteur). */
  trailing?: ReactNode;
  /** Classes de la LIGNE (le `<label>`), pas de la case. */
  className?: string;
  children: ReactNode;
}

/**
 * Ligne à cocher : une case (ou un bouton radio) NATIVE et son libellé dans un `<label>`. Rôle, état annoncé,
 * barre d'espace et clic sur toute la ligne sont fournis par le navigateur.
 *
 * Reprise de co-kanban (`ChoiceRow`), sans équivalent parmi les primitives du site : la
 * `Checkbox` de shadcn est un bouton Radix, pas une case native, et ne porte ni la ligne de
 * 44 px ni la teinte de la ligne cochée. L'anneau de focus est porté par la LIGNE, la case étant
 * trop petite pour le montrer ; la ligne cochée a une teinte ET sa case cochée (la couleur ne
 * porte jamais seule l'état).
 */
export function ChoiceRow({ checked, type = "checkbox", leading, trailing, className, children, ...inputProps }: ChoiceRowProps) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5",
        "transition-colors duration-150",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-[-2px] has-[input:focus-visible]:outline-ring",
        checked ? "bg-primary/10" : "hover:bg-muted",
        className,
      )}
    >
      <input
        {...inputProps}
        type={type}
        checked={checked}
        className="size-4 shrink-0 cursor-pointer accent-primary focus-visible:outline-none"
      />
      {leading}
      <span className="min-w-0 flex-1 text-sm text-foreground">{children}</span>
      {trailing !== undefined ? <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{trailing}</span> : null}
    </label>
  );
}
