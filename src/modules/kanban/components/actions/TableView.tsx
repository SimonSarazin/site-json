import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckSquare, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { actionCardPath } from "@/modules/kanban/lib/kanbanPaths";
import { useActionsOutlet } from "./actionsOutlet";
import { CardAssignees, DueDateLabel, PriorityLabel, SkeletonRows, StatusPill, VIEW_SURFACE_CLASS, ViewEmpty, ViewLoading } from "./ViewChrome";
import { memberNameMap, useActionsViewModel } from "./viewData";
import { shellSortKeyFor, sortCards, tableSortFromShell, type TableSortKey, type TableSortState } from "./viewHelpers";

/*
 * Paliers de visibilité, du plus important au plus accessoire : sous 1024 px, les colonnes
 * secondaires sont MASQUÉES, jamais écrasées (une colonne de 30 px qui affiche « Term… » ne rend
 * service à personne ; l'information reste dans la fiche). Classes complètes et non interpolées :
 * Tailwind ne génère que ce qu'il lit.
 */
const COLUMN_VISIBILITY: Partial<Record<TableSortKey, string>> = {
  // Sous 640 px, le statut rejoint la cellule du titre : trois colonnes ne tiennent pas à 375 px
  // sans écraser le titre, la seule information non redondante de la ligne.
  status: "hidden sm:table-cell",
  priority: "hidden sm:table-cell",
  assignees: "hidden md:table-cell",
  column: "hidden lg:table-cell",
  checklist: "hidden xl:table-cell",
  comments: "hidden xl:table-cell",
};

/**
 * Vue Table : un vrai tableau HTML, trié et triable. Reprise de co-kanban
 * (`pages/board/TableView.tsx`), sans la colonne « Liens » (une action Communecter n'en porte pas).
 *
 * SÉMANTIQUE d'abord : `<table>`, `<th scope="col">` et `aria-sort` sur la cellule d'en-tête. Une
 * grille de `<div>` ne dit ni combien il y a de colonnes, ni laquelle porte le tri.
 *
 * `export default` : chargée à la demande (`routes.tsx`).
 */
export default function TableView() {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const { search } = useActionsOutlet();
  const { snapshot, cards, columns, now, zone, isFiltered } = useActionsViewModel();

  /*
   * UN SEUL tri, deux commandes. Le « Trier » de la barre fait foi ; une préférence LOCALE prend
   * le relais dès qu'on trie sur une colonne qu'il ne connaît pas (assignés, checklist,
   * commentaires). Elle porte l'empreinte de l'état de la barre au moment où elle a été posée :
   * dès que la barre rebouge, l'empreinte ne correspond plus et la barre reprend la main, sans
   * effet de synchronisation (donc sans rendu intermédiaire qui ferait clignoter la table).
   */
  const { sortKey, sortDirection, setSort: setShellSort } = search;
  const shellSignature = `${sortKey}:${sortDirection}`;
  const [override, setOverride] = useState<{ sort: TableSortState; signature: string } | null>(null);
  const sort: TableSortState = override !== null && override.signature === shellSignature ? override.sort : tableSortFromShell(sortKey, sortDirection);

  const unknownMember = t("members.unknown");
  const sortContext = useMemo(
    () => ({ columnOrder: new Map(columns.map((entry, index) => [entry.column._id, index])), memberNames: memberNameMap(snapshot, unknownMember) }),
    [columns, snapshot, unknownMember],
  );
  const sorted = useMemo(() => sortCards(cards, sort, sortContext), [cards, sort, sortContext]);
  // Sans `useMemo` : une entrée par colonne, rien à épargner.
  const columnTitles = new Map(columns.map((entry) => [entry.column._id, resolveColumnTitle(entry.column, t)]));

  if (snapshot === undefined) {
    return (
      <ViewLoading>
        <Skeleton aria-hidden className="h-10 w-full rounded-lg motion-reduce:animate-none" />
        <SkeletonRows rows={8} />
      </ViewLoading>
    );
  }

  if (cards.length === 0) return <ViewEmpty filtered={isFiltered} />;

  function toggleSort(key: TableSortKey) {
    // Un changement de colonne repart en CROISSANT : le sens naturel de la donnée (l'échéance la
    // plus proche), qui ne dépend pas de la colonne que l'on quitte.
    const direction = sort.key === key && sort.direction === "asc" ? "desc" : "asc";
    const shellKey = shellSortKeyFor(key);
    if (shellKey === null) {
      setOverride({ sort: { key, direction }, signature: shellSignature });
      return;
    }
    setOverride(null);
    setShellSort(shellKey, direction);
  }

  const headers: { key: TableSortKey; label: string; alignRight?: boolean }[] = [
    { key: "title", label: t("myCards.columns.title") },
    { key: "status", label: t("card.statusLabel") },
    { key: "column", label: t("myCards.fields.column") },
    { key: "assignees", label: t("assignees.label") },
    { key: "dueDate", label: t("myCards.columns.due") },
    { key: "priority", label: t("myCards.columns.priority") },
    { key: "checklist", label: t("myCards.columns.progress"), alignRight: true },
    { key: "comments", label: t("comments.title"), alignRight: true },
  ];

  return (
    <div className="pb-4">
      <div className={cn(VIEW_SURFACE_CLASS, "overflow-hidden")}>
        {/* Zone de défilement PROPRE à la table : c'est elle qui rend l'en-tête collant fiable.
            `tabIndex` la rend atteignable au clavier, sans quoi son contenu serait inaccessible
            sans souris (WCAG 2.1.1). */}
        <div role="region" aria-label={t("views.table.region")} tabIndex={0} className="ck-scroll-x relative max-h-[70vh] overflow-y-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{t("views.table.caption")}</caption>
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                {headers.map((header) => (
                  <SortableHeader key={header.key} sortKey={header.key} label={header.label} sort={sort} onSort={toggleSort} alignRight={header.alignRight === true} className={COLUMN_VISIBILITY[header.key]} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((card) => (
                <tr key={card._id} className="transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted/60">
                  {/* `max-w-0 w-full` : le seul moyen de faire tronquer une cellule de tableau ;
                      sans largeur maximale, le contenu élargit la colonne et pousse le reste. */}
                  <td className="w-full max-w-0 px-4 py-2.5">
                    <Link
                      to={actionCardPath(card._id, "table")}
                      data-card-id={card._id}
                      className="block truncate rounded-sm text-sm font-medium text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {card.title}
                    </Link>
                    {/* Repli du statut sous 640 px. Les deux exemplaires ne sont JAMAIS affichés
                        ensemble (`display: none` les retire aussi de l'arbre d'accessibilité). */}
                    <span className="mt-1.5 flex sm:hidden">
                      <StatusPill status={card.status} />
                    </span>
                  </td>
                  <td className={cn("px-4 py-2.5", COLUMN_VISIBILITY.status)}>
                    <StatusPill status={card.status} />
                  </td>
                  <td className={cn("px-4 py-2.5 text-xs text-muted-foreground", COLUMN_VISIBILITY.column)}>
                    <span className="block max-w-36 truncate">{columnTitles.get(card.columnId) ?? t("card.noColumn")}</span>
                  </td>
                  <td className={cn("px-4 py-2.5", COLUMN_VISIBILITY.assignees)}>
                    {card.assignees.length === 0 ? <span className="text-xs text-muted-foreground">{t("myCards.noChecklist")}</span> : <CardAssignees assignees={card.assignees} members={snapshot.members} />}
                  </td>
                  <td className="px-4 py-2.5">
                    {card.dueDate === null ? (
                      <span className="text-xs whitespace-nowrap text-muted-foreground">{t("myCards.noDue")}</span>
                    ) : (
                      // `flex-nowrap` : une échéance en retard qui passe à la ligne donnerait une
                      // rangée plus haute que ses voisines.
                      <DueDateLabel card={card} now={now} zone={zone} locale={locale} className="flex-nowrap" />
                    )}
                  </td>
                  <td className={cn("px-4 py-2.5", COLUMN_VISIBILITY.priority)}>
                    <PriorityLabel priority={card.priority} />
                  </td>
                  <td className={cn("px-4 py-2.5 text-right", COLUMN_VISIBILITY.checklist)}>
                    {card.checklistTotal > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <CheckSquare aria-hidden className="size-3.5" />
                        {card.checklistDone}/{card.checklistTotal}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("myCards.noChecklist")}</span>
                    )}
                  </td>
                  <td className={cn("px-4 py-2.5 text-right", COLUMN_VISIBILITY.comments)}>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                      <MessageSquare aria-hidden className="size-3.5" />
                      {card.commentCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{t("boards.cardCount", { count: sorted.length })}</p>
      </div>
    </div>
  );
}

interface SortableHeaderProps {
  sortKey: TableSortKey;
  label: string;
  sort: TableSortState;
  onSort: (key: TableSortKey) => void;
  /** Colonne de nombres : le libellé se cale à droite, sur ses valeurs. */
  alignRight?: boolean;
  /** Classes du `<th>` SEULEMENT (paliers de visibilité) : `table-cell` écraserait le `flex` du bouton. */
  className?: string;
}

/**
 * En-tête de colonne triable. `aria-sort` est porté par le `<th>` : c'est LUI que la technologie
 * d'assistance interroge, pas le bouton qu'il contient. L'icône dit à l'œil ce que l'attribut dit
 * à l'oreille.
 */
function SortableHeader({ sortKey, label, sort, onSort, alignRight = false, className }: SortableHeaderProps) {
  const { t } = useTranslation("modules/kanban");
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th scope="col" aria-sort={ariaSort} className={cn("border-b border-border bg-card p-0 whitespace-nowrap", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={active ? t("myCards.sortToggle", { column: label }) : t("myCards.sortBy", { column: label })}
        className={cn(
          "flex min-h-10 w-full cursor-pointer items-center gap-1.5 px-4 py-2 text-xs font-semibold",
          "transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          active ? "text-foreground" : "text-muted-foreground",
          alignRight && "justify-end",
        )}
      >
        <span className="truncate">{label}</span>
        <Icon aria-hidden className="size-3.5 shrink-0" />
      </button>
    </th>
  );
}
