/**
 * Liste déroulante NATIVE à la géométrie du champ du site (`Input`) : la `Select` de shadcn est
 * un bouton Radix, sans la navigation au clavier ni l'annonce d'une liste native. Partagée par
 * « Déplacer vers… » et la fiche de carte.
 */
export const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none dark:bg-input/30 " +
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive " +
  "disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-11";
