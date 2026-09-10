import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

/**
 * La pastille « … » qui remplace les tags tronqués d'un commun, cliquable pour
 * les révéler.
 *
 * Un `title` HTML ne suffisait pas : il n'apparaît qu'au survol prolongé et
 * n'existe pas au tactile — les tags cachés étaient donc inatteignables sur
 * mobile. D'où un popover, et non un dépliage sur place : la gouttière de tags
 * a une **hauteur fixe** (`h-14.5` sur la carte), qui tient le rythme vertical
 * de la grille. L'agrandir décalerait toutes les cartes voisines.
 *
 * Partagée par la carte et la ligne, dont seules les classes de la pastille
 * diffèrent — d'où `className`.
 */
export function AacHiddenTagsBadge({
  tags,
  className,
}: {
  tags: readonly string[];
  className?: string;
}) {
  const t = useT("modules/aac");
  const [open, setOpen] = useState(false);

  if (tags.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded-lg border border-accent bg-accent text-center text-accent-foreground transition-opacity hover:opacity-80",
            className
          )}
          // `count` NUMÉRIQUE : i18next désactive la résolution de pluriel dès
          // que `count` est une chaîne (`needsPluralHandling`). Passer `String()`
          // rendait « Voir les 1 mots-clés masqués » à un lecteur d'écran, et
          // ajouter les variantes `_one`/`_other` n'y aurait rien changé.
          aria-label={String(
            t("directory.card.showMoreTags", undefined, { count: tags.length })
          )}
        >
          …
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto max-w-64 p-2">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-lg border border-accent bg-accent px-1.5 py-px text-xs text-accent-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
