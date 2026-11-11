import { useMemo } from "react";
import { CalendarOff, GanttChart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { columnToneClasses } from "@/modules/kanban/components/board/columnTone";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { Pill } from "@/modules/kanban/components/ui/Pill";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { formatDate, formatLongDate, type DateLocale, type DateZone } from "@/modules/kanban/lib/dates";
import { actionCardPath } from "@/modules/kanban/lib/kanbanPaths";
import type { Card, Member } from "@/modules/kanban/types";
import { CardAssignees, ColumnDot, DueDateLabel, StatusPill, VIEW_SURFACE_CLASS, ViewEmpty, ViewLoading } from "./ViewChrome";
import { useActionsViewModel } from "./viewData";
import { buildWeekAxis, startOfWeek } from "./viewHelpers";

/** Largeurs de l'axe, en pixels : fixées pour que les pistes restent alignées. */
const TRACK_LABEL_WIDTH = 180;
const WEEK_WIDTH = 172;
const UNDATED_WIDTH = 200;

/** Filet du saut de semaines : épais ET pointillé, l'axe ne ment pas sur sa continuité. */
const GAP_EDGE = "border-l-2 border-l-dashed border-l-[var(--ck-border-strong)]";

/**
 * Vue Chronologie : l'axe des semaines, une piste par colonne. Reprise de co-kanban
 * (`pages/board/TimelineView.tsx`).
 *
 * Un TABLEAU au sens propre (pistes en lignes, semaines en colonnes), écrit comme tel :
 * `scope="col"` et `scope="row"` relient nativement une carte à sa colonne et à sa semaine. La
 * semaine courante est repérée par un MOT (« Aujourd'hui »), pas seulement par une teinte ; les
 * cartes sans échéance ont leur gouttière, étiquetée, à droite de l'axe.
 *
 * `export default` : chargée à la demande (`routes.tsx`).
 */
export default function TimelineView() {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const { snapshot, cards, cardsByColumn, columns, now, zone, isFiltered } = useActionsViewModel();

  const axis = useMemo(() => buildWeekAxis(cards.flatMap((card) => (card.dueDate === null ? [] : [card.dueDate])), now, zone), [cards, now, zone]);

  /*
   * Index carte → (colonne, semaine), calculé UNE fois : sans lui, chaque cellule refiltrerait les
   * cartes de sa colonne (des centaines de milliers de comparaisons par rendu sur un an d'échéances).
   */
  const byColumnWeek = useMemo(() => {
    const index = new Map<string, Map<number, Card[]>>();
    for (const card of cards) {
      if (card.dueDate === null) continue;
      const week = startOfWeek(card.dueDate, zone);
      const weeks = index.get(card.columnId) ?? new Map<number, Card[]>();
      index.set(card.columnId, weeks);
      weeks.set(week, [...(weeks.get(week) ?? []), card]);
    }
    return index;
  }, [cards, zone]);

  // Sans `useMemo` : six colonnes, un calcul plus léger que sa mémoïsation.
  const tones = columnToneClasses(snapshot?.columns ?? []);
  // `now === 0` avant hydratation : aucune semaine n'est marquée, le HTML serveur est identique.
  const currentWeek = now > 0 ? startOfWeek(now, zone) : null;

  if (snapshot === undefined) {
    return (
      <ViewLoading>
        <Skeleton aria-hidden className="h-12 w-full rounded-lg motion-reduce:animate-none" />
        <Skeleton aria-hidden className="h-40 w-full rounded-xl motion-reduce:animate-none" />
      </ViewLoading>
    );
  }

  if (cards.length === 0) return <ViewEmpty filtered={isFiltered} />;

  return (
    <div className="pb-4">
      <div className={cn(VIEW_SURFACE_CLASS, "overflow-hidden")}>
        <div role="region" aria-label={t("views.timeline.region")} tabIndex={0} className="ck-scroll-x relative max-h-[74vh] overflow-y-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset">
          {/* `border-separate` et non `collapse` : une cellule collante perd ses bordures en mode
              fusionné, et l'axe se retrouve sans filet. */}
          <table className="w-max border-separate border-spacing-0 text-left">
            <caption className="sr-only">{t("views.timeline.caption")}</caption>
            <colgroup>
              <col style={{ width: TRACK_LABEL_WIDTH }} />
              {axis.map((week) => (
                <col key={week.start} style={{ width: WEEK_WIDTH }} />
              ))}
              <col style={{ width: UNDATED_WIDTH }} />
            </colgroup>

            <thead>
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-30 border-b border-border bg-card px-4 py-2 align-bottom text-xs font-semibold text-muted-foreground">
                  {t("board.columns")}
                </th>
                {axis.map((week) => {
                  const isCurrent = currentWeek === week.start;
                  return (
                    <th
                      key={week.start}
                      scope="col"
                      title={week.gapBefore ? t("views.timeline.gap") : undefined}
                      className={cn("sticky top-0 z-20 border-b border-border px-3 py-2 align-bottom", isCurrent ? "bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))]" : "bg-card", week.gapBefore && GAP_EDGE)}
                    >
                      <span className="flex flex-col gap-1">
                        {/* L'axe se lit en UTC : `startOfWeek` exprime déjà le jour civil en minuit UTC. */}
                        <span className="text-xs font-semibold text-foreground tabular-nums">{t("views.timeline.week", { date: formatDate(week.start, locale) })}</span>
                        {isCurrent ? (
                          <Pill tone="brand" className="self-start">
                            {t("views.timeline.today")}
                          </Pill>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
                <th scope="col" className="sticky top-0 z-20 border-b border-l border-border bg-muted px-3 py-2 align-bottom">
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <CalendarOff aria-hidden className="size-3.5 shrink-0" />
                      {t("views.timeline.undated")}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">{t("views.timeline.undatedHint")}</span>
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {columns.map((entry) => {
                const column = entry.column;
                const columnCards = cardsByColumn.get(column._id) ?? [];
                const undated = columnCards.filter((card) => card.dueDate === null);
                return (
                  <tr key={column._id} className="align-top">
                    <th scope="row" className="sticky left-0 z-10 border-t border-border bg-card px-4 py-3 text-left">
                      <span className="flex items-center gap-2">
                        <ColumnDot className={tones.get(column._id)} />
                        <span className="truncate text-sm font-semibold text-foreground">{resolveColumnTitle(column, t)}</span>
                        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[0.6875rem] text-muted-foreground tabular-nums">{columnCards.length}</span>
                      </span>
                    </th>
                    {axis.map((week) => {
                      const weekCards = byColumnWeek.get(column._id)?.get(week.start) ?? [];
                      return (
                        <td key={week.start} className={cn("border-t border-border p-1.5", currentWeek === week.start && "bg-primary/5", week.gapBefore && GAP_EDGE)}>
                          <TimelineCards cards={weekCards} members={snapshot.members} now={now} zone={zone} locale={locale} />
                        </td>
                      );
                    })}
                    <td className="border-t border-l border-border bg-muted/50 p-1.5">
                      <TimelineCards cards={undated} members={snapshot.members} now={now} zone={zone} locale={locale} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {axis.length === 0 ? (
          <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <GanttChart aria-hidden className="size-3.5" />
            {t("views.timeline.noDated")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface TimelineCardsProps {
  cards: readonly Card[];
  members: readonly Member[];
  now: number;
  zone: DateZone;
  locale: DateLocale;
}

/**
 * Vignettes d'une cellule. Volontairement pauvres (statut, titre, échéance, assignés) : une
 * vignette de 172 px qui reprendrait toute l'anatomie de la carte ne donnerait que des lignes
 * tronquées.
 */
function TimelineCards({ cards, members, now, zone, locale }: TimelineCardsProps) {
  const { t } = useTranslation("modules/kanban");
  if (cards.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {cards.map((card) => (
        <li key={card._id}>
          <Link
            to={actionCardPath(card._id, "timeline")}
            data-card-id={card._id}
            title={card.dueDate === null ? card.title : t("views.timeline.cardAt", { title: card.title, date: formatLongDate(card.dueDate, locale, zone) })}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2",
              "transition-shadow duration-[var(--ck-duration-out)] ease-in hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <StatusPill status={card.status} className="self-start" />
            <span className="line-clamp-2 text-xs font-semibold text-foreground">{card.title}</span>
            <span className="flex items-center justify-between gap-1.5">
              {card.dueDate === null ? <span className="text-[0.6875rem] text-muted-foreground">{t("myCards.noDue")}</span> : <DueDateLabel card={card} now={now} zone={zone} locale={locale} className="text-[0.6875rem]" />}
              <CardAssignees assignees={card.assignees} members={members} max={2} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
