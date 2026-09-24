import { useT } from "@/hooks/useT";
import type { LocalizedString } from "@/types/locale-schema";

/**
 * Titre d'un bloc de `list.layout: "grouped"`.
 *
 * Composant à part plutôt qu'un `useT` dans `SearchListView` : la traduction n'est nécessaire que
 * pour le libellé du bloc SANS valeur, et un hook posé au niveau de la liste imposait un
 * `LocalizationProvider` à TOUS ses rendus — grille, timeline, split — qui n'en avaient pas besoin.
 */
export default function GroupHeading({
  id,
  cle,
  emptyLabel,
}: {
  id: string;
  cle: string | null;
  emptyLabel?: LocalizedString;
}) {
  const t = useT("modules/search");
  return (
    <h3 id={id} className="mb-3 border-b border-border pb-2 text-xl font-semibold tabular-nums text-foreground">
      {cle ?? (emptyLabel ? t(emptyLabel) : t("resource.ungrouped"))}
    </h3>
  );
}
