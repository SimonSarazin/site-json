/**
 * La grammaire commune aux deux premières colonnes du panneau.
 *
 * Elle est ici, et pas recopiée dans chaque colonne, parce que le grief d'ergonomie du 24/09
 * venait précisément de là : les colonnes 1 et 2 avaient été écrites comme deux listes
 * Tailwind génériques, sans grammaire partagée, alors que le fil en avait une complète.
 */

/** Une liste dense : des rangées pleine largeur séparées d'un filet, pas des pastilles. */
export const PANEL_LIST = "divide-border/60 flex flex-col divide-y";

/** La rangée elle-même — pleine largeur, cliquable sur toute sa surface. */
export const PANEL_ROW = [
  "group relative flex w-full px-3 py-2 text-start transition-colors",
  "hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset",
  "focus-visible:outline-none data-[selected=true]:bg-muted",
].join(" ");

/**
 * Le signal d'état est une barre verticale en `--primary`, jamais un fond seul.
 *
 * Sur une configuration pauvre, `--muted` et `--accent` tombent à ~3 % du fond : un état bâti
 * dessus y devient invisible. `--primary`, lui, est garanti par le schéma. Ni `--error`
 * (absent de 13 sites) ni `destructiveForeground` (absent du `:root`).
 */
export const PANEL_ROW_BAR = [
  "before:bg-primary before:absolute before:inset-y-1 before:start-0 before:w-[3px]",
  "before:rounded-e-full before:opacity-0 before:transition-opacity before:content-['']",
  "data-[unread=true]:before:opacity-40 data-[selected=true]:before:opacity-100",
].join(" ");

/**
 * Trois niveaux typographiques, pas plus : lu (grisé, comme les salons lus de Discord), non lu
 * (appuyé), sélectionné (lisible sans changer de poids — la sélection se lit à la barre).
 */
export const PANEL_NAME = [
  "text-muted-foreground text-sm font-medium",
  "group-data-[unread=true]:text-foreground group-data-[unread=true]:font-semibold",
  "group-data-[selected=true]:text-foreground",
  // Un emplacement vide n'est pas une discussion : il s'efface d'un cran de plus, pour que
  // la section dépliée ne vienne pas concurrencer les fils vivants au-dessus.
  "group-data-[empty=true]:font-normal group-data-[empty=true]:text-muted-foreground",
].join(" ");

/**
 * L'en-tête d'une section repliable — « Sans discussion (6) ».
 *
 * Il doit trancher NETTEMENT sur les rangées qu'il coiffe, sans quoi on le prend pour l'une
 * d'elles. D'où les capitales espacées en 11 px, qui le rangent visuellement du côté des
 * titres et non du contenu : c'est le même registre que le séparateur de date du fil.
 */
export const PANEL_GROUP_LABEL = [
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring flex w-full items-center",
  "gap-1.5 px-3 py-2 text-start text-[0.6875rem] font-semibold tracking-[0.06em] uppercase",
  "transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
].join(" ");
