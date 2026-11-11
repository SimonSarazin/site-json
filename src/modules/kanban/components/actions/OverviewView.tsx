import { useMemo, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, CircleDashed, History, Inbox, LayoutDashboard, TrendingUp, UserRound, Users, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { columnToneClasses } from "@/modules/kanban/components/board/columnTone";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { Pill } from "@/modules/kanban/components/ui/Pill";
import { useBoardActivity } from "@/modules/kanban/hooks/useBoardActivity";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { activityActorName, activityLabelKey } from "@/modules/kanban/lib/activityFeed";
import { boardStats, percentOf } from "@/modules/kanban/lib/boardStats";
import { formatDate, formatDateTime, toDate } from "@/modules/kanban/lib/dates";
import { memberDisplayName } from "@/modules/kanban/lib/memberName";
import type { CardStatus } from "@/modules/kanban/types";
import { useActionsOutlet } from "./actionsOutlet";
import { ColumnDot, StatusPill, VIEW_SURFACE_CLASS, ViewEmpty, ViewLoading, ViewPanel } from "./ViewChrome";
import { useActionsViewModel } from "./viewData";

/** Nombre d'activités montrées : de quoi voir « ce qui vient de se passer ». */
const ACTIVITY_LIMIT = 8;

/** Barre de la répartition par statut : la teinte de sa pastille, en plein. */
const STATUS_BAR: Readonly<Record<CardStatus, string>> = {
  not_started: "bg-muted-foreground/50",
  in_research: "bg-warning",
  on_track: "bg-primary",
  complete: "bg-[var(--ck-success-ink)]",
};

/**
 * Vue d'ensemble du tableau des actions. Reprise de co-kanban (`pages/board/OverviewView.tsx`).
 *
 * Rien n'est inventé ici : chaque nombre sort de `lib/boardStats.ts`, pur et testé. La vue ne
 * fait que choisir une forme (cartouche, barre, ligne) et garantir que l'information ne repose
 * jamais sur la seule couleur : toute barre a son libellé ET sa valeur écrite.
 *
 * Écart assumé : la répartition par colonne montre la PART des cartes de chaque colonne (à la
 * teinte de la colonne, comme le flux de `/kanban`), et non ses cartes terminées. Sur une action
 * Communecter, terminée veut dire « dans Terminé » : chaque colonne aurait dit 0 % ou 100 %.
 *
 * `export default` : chargée à la demande (`routes.tsx`).
 */
export default function OverviewView() {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const { boardId } = useActionsOutlet();
  // `ignoreFilter` : la barre de filtres est remplacée ici par la phrase « la vue d'ensemble
  // résume tout le tableau, sans filtre ».
  const { snapshot, cards, now } = useActionsViewModel({ ignoreFilter: true });
  const activity = useBoardActivity(boardId, snapshot?.board.rev ?? 0);

  const stats = useMemo(() => (snapshot ? boardStats(snapshot, now) : null), [snapshot, now]);
  // Sans `useMemo` : six colonnes, un calcul plus léger que sa mémoïsation.
  const tones = columnToneClasses(snapshot?.columns ?? []);

  if (snapshot === undefined || stats === null) {
    return (
      <ViewLoading>
        <div aria-hidden className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl motion-reduce:animate-none" />
          ))}
        </div>
        <div aria-hidden className="grid items-start gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl motion-reduce:animate-none" />
          <Skeleton className="h-64 w-full rounded-xl motion-reduce:animate-none" />
        </div>
      </ViewLoading>
    );
  }

  if (cards.length === 0) return <ViewEmpty filtered={false} />;

  const { progress, overdue, dueThisWeek, unassigned, byColumn, byStatus, byContributor } = stats;
  const recent = activity.activities.slice(0, ACTIVITY_LIMIT);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={TrendingUp} tone="brand" label={t("views.overview.progress")} value={`${progress.percent} %`} hint={t("boards.progressValue", { done: progress.done, total: progress.total, percent: progress.percent })}>
          <Progress value={progress.percent} aria-label={t("views.overview.progress")} className="mt-1 h-1.5" />
        </StatTile>
        <StatTile icon={AlertTriangle} tone="danger" label={t("views.overview.overdue")} value={overdue.length} hint={t("views.overview.overdueHint")} />
        <StatTile icon={CalendarClock} tone="warn" label={t("views.overview.dueThisWeek")} value={dueThisWeek.length} hint={t("views.overview.dueThisWeekHint")} />
        <StatTile icon={Inbox} tone="neutral" label={t("views.overview.unassigned")} value={unassigned.length} hint={t("views.overview.unassignedHint")} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ViewPanel icon={LayoutDashboard} title={t("views.overview.byColumn")} description={t("views.overview.byColumnHint")}>
          <ul className="flex flex-col divide-y divide-border">
            {byColumn.map((entry) => {
              const title = resolveColumnTitle(entry.column, t);
              const share = percentOf(entry.total, progress.total);
              return (
                <li key={entry.column._id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <ColumnDot className={tones.get(entry.column._id)} />
                    <span className="truncate text-sm font-semibold text-foreground">{title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t("boards.cardCount", { count: entry.total })} · {share} %
                    </span>
                  </div>
                  <Progress value={share} aria-label={t("views.overview.columnShare", { column: title })} className="h-1.5 bg-muted" indicatorClassName={tones.get(entry.column._id)} />
                </li>
              );
            })}
          </ul>
        </ViewPanel>

        <ViewPanel icon={CircleDashed} title={t("views.overview.byStatus")} description={t("views.overview.byStatusHint")}>
          <ul className="flex flex-col divide-y divide-border">
            {byStatus.map((entry) => (
              <li key={entry.status} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <StatusPill status={entry.status} />
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                    {t("boards.cardCount", { count: entry.total })} · {entry.percent} %
                  </span>
                </div>
                <Progress value={entry.percent} aria-label={t("views.overview.statusShare", { status: t(`card.status.${entry.status}`) })} className="h-1.5 bg-muted" indicatorClassName={STATUS_BAR[entry.status]} />
              </li>
            ))}
          </ul>
        </ViewPanel>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ViewPanel icon={Users} title={t("views.overview.contributors")} description={t("views.overview.contributorsHint")}>
          {byContributor.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("views.overview.noContributor")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {byContributor.map((entry) => {
                const name = memberDisplayName(entry.member?.profile, t("members.unknown"));
                return (
                  <li key={entry.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Nom écrit à côté : portrait décoratif. */}
                    <MemberAvatar name={name} src={entry.member?.profile?.profilThumbImageUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {/* « 0 terminées sur 0 » est exact mais absurde : un membre sans carte a sa phrase. */}
                        {entry.total === 0 ? t("views.overview.contributorIdle") : t("views.overview.contributorDone", { count: entry.done, total: entry.total })}
                      </p>
                    </div>
                    {entry.overdue > 0 ? (
                      <Pill tone="danger" icon={AlertTriangle} className="shrink-0">
                        {/* `overdue` et non `count` : `count` déclencherait les pluriels d'i18next
                            pour une phrase qui n'en a pas besoin. */}
                        {t("views.overview.contributorOverdue", { overdue: entry.overdue })}
                      </Pill>
                    ) : null}
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                      {entry.total}
                      <span className="sr-only"> {t("members.assignedCards", { count: entry.total })}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ViewPanel>

        <ViewPanel icon={History} title={t("activity.title")} description={t("views.overview.activityHint")}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {recent.map((entry) => {
                const actorName = activityActorName(entry.actorId, snapshot.members, { communecter: t("activity.communecterActor"), unknown: t("activity.unknownActor") });
                return (
                  <li key={entry._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserRound className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{t(activityLabelKey(entry))}</p>
                      <p className="truncate text-xs text-muted-foreground">{t("activity.by", { name: actorName })}</p>
                    </div>
                    {/* Jour et heure du LECTEUR une fois la page hydratée ; `dateTime` reste l'instant absolu. */}
                    <time dateTime={toDate(entry.at)?.toISOString()} title={formatDateTime(entry.at, locale, activity.zone)} className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatDate(entry.at, locale, activity.zone)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </ViewPanel>
      </div>
    </div>
  );
}

type TileTone = "brand" | "danger" | "warn" | "neutral";

/* Pastille de l'icône, en teinte. Décorative : le libellé dit ce que mesure le chiffre. */
const TILE_TONE_CLASSES: Readonly<Record<TileTone, string>> = {
  brand: "bg-primary/15 text-primary",
  danger: "bg-destructive/15 text-destructive",
  warn: "bg-warning/25 text-[var(--ck-warn-ink)]",
  neutral: "bg-muted text-muted-foreground",
};

interface StatTileProps {
  icon: LucideIcon;
  tone: TileTone;
  label: string;
  value: string | number;
  hint: string;
  children?: ReactNode;
}

/**
 * Cartouche de synthèse : un chiffre, ce qu'il mesure, et de quoi le relativiser. Le chiffre est
 * en chasse fixe : sans elle, passer de 9 à 10 décalerait la ligne sous les yeux.
 */
function StatTile({ icon: Icon, tone, label, value, hint, children }: StatTileProps) {
  return (
    <div className={cn(VIEW_SURFACE_CLASS, "flex flex-col gap-2 p-4")}>
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", TILE_TONE_CLASSES[tone])}>
          <Icon className="size-4" />
        </span>
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}
