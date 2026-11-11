import { useMemo, useState } from "react";
import { CheckSquare, ChevronDown, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { columnToneClasses } from "@/modules/kanban/components/board/columnTone";
import { resolveColumnTitle } from "@/modules/kanban/components/board/kanbanDnd";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { cardStatusesFor } from "@/modules/kanban/lib/boardSource";
import type { DateLocale, DateZone } from "@/modules/kanban/lib/dates";
import { actionCardPath } from "@/modules/kanban/lib/kanbanPaths";
import { memberDisplayName } from "@/modules/kanban/lib/memberName";
import type { Card, Member } from "@/modules/kanban/types";
import { useActionsOutlet } from "./actionsOutlet";
import { CardAssignees, ColumnDot, DueDateLabel, MetaCount, PriorityLabel, SkeletonRows, StatusPill, VIEW_SURFACE_CLASS, ViewEmpty, ViewLoading } from "./ViewChrome";
import { memberNameMap, useActionsViewModel } from "./viewData";
import { countDone, groupCards, orderCards, type CardGroup } from "./viewHelpers";

/**
 * Vue Liste : les cartes groupées, en lignes denses. Reprise de co-kanban (`pages/board/ListView.tsx`).
 *
 * C'est la vue qui répond à « qu'est-ce qu'il y a à faire, dans l'ordre ? ». Elle est la seule à
 * accepter les TROIS commandes de la barre (filtrer, grouper, trier) : une commande qui ne
 * changerait rien ici serait un bouton mort.
 *
 * `export default` : chargée à la demande (`routes.tsx`).
 */
export default function ListView() {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const { search } = useActionsOutlet();
  const { groupBy, sortKey, sortDirection } = search;
  const { snapshot, cards, columns, now, zone, isFiltered } = useActionsViewModel();

  const unknownMember = t("members.unknown");
  // `useMemo` : le tri en dépend, et il parcourt toutes les cartes.
  const sortContext = useMemo(
    () => ({ columnOrder: new Map(columns.map((entry, index) => [entry.column._id, index])), memberNames: memberNameMap(snapshot, unknownMember) }),
    [columns, snapshot, unknownMember],
  );

  const groups = useMemo(() => {
    const ordered = orderCards(cards, sortKey, sortDirection, sortContext);
    return groupCards(ordered, groupBy, {
      columnIds: columns.map((entry) => entry.column._id),
      memberIds: (snapshot?.members ?? []).map((member) => member.userId),
      statuses: snapshot ? cardStatusesFor(snapshot.capabilities.source) : [],
    });
  }, [cards, sortKey, sortDirection, sortContext, groupBy, columns, snapshot]);

  // Sans `useMemo` : six colonnes, un calcul plus léger que sa mémoïsation.
  const tones = columnToneClasses(snapshot?.columns ?? []);

  /*
   * On retient les groupes REPLIÉS, pas les dépliés : un groupe qui apparaît en cours de session
   * (statut nouvellement peuplé) s'affiche ouvert — un contenu nouveau ne doit pas naître caché.
   */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>());
  function toggleGroup(groupId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(groupId)) next.add(groupId);
      return next;
    });
  }

  if (snapshot === undefined) {
    return (
      <ViewLoading>
        <Skeleton aria-hidden className="h-9 w-56 rounded-lg motion-reduce:animate-none" />
        <SkeletonRows rows={6} />
      </ViewLoading>
    );
  }

  if (cards.length === 0) return <ViewEmpty filtered={isFiltered} />;

  return (
    <div className="flex flex-col gap-3 pb-4">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.id);
        const regionId = `liste-${group.id}`;
        return (
          <section key={group.id} className={cn(VIEW_SURFACE_CLASS, "overflow-hidden")}>
            <h2>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!isCollapsed}
                aria-controls={regionId}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
              >
                {/* Le chevron double `aria-expanded` : il dit à l'œil ce que l'attribut dit au lecteur d'écran. */}
                <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--ck-duration-out)] motion-reduce:transition-none", isCollapsed && "-rotate-90")} />
                <GroupLabel group={group} members={snapshot.members} columnTitle={columnTitleOf(group, snapshot.columns, t)} tone={group.kind === "column" ? tones.get(group.columnId) : undefined} />
                <span className="inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-semibold text-foreground tabular-nums">{group.cards.length}</span>
                <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">{t("views.doneOf", { done: countDone(group.cards), total: group.cards.length })}</span>
              </button>
            </h2>

            {isCollapsed ? null : (
              <div id={regionId} className="border-t border-border">
                {group.cards.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">{t("views.list.emptyGroup")}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {group.cards.map((card) => (
                      <li key={card._id}>
                        <CardRow card={card} members={snapshot.members} now={now} zone={zone} locale={locale} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Titre de la colonne d'un groupe « par colonne », `null` pour les autres axes. */
function columnTitleOf(group: CardGroup, columns: readonly { _id: string; title: string; titleKey: string | null }[], t: (key: string, fallback: string) => string): string | null {
  if (group.kind !== "column") return null;
  const column = columns.find((entry) => entry._id === group.columnId);
  return column ? resolveColumnTitle(column, t) : t("card.noColumn", "");
}

interface GroupLabelProps {
  group: CardGroup;
  members: readonly Member[];
  columnTitle: string | null;
  tone: string | undefined;
}

/**
 * En-tête d'un groupe, dans la forme de son axe : la pastille que l'utilisateur connaît déjà
 * (statut, priorité, teinte de colonne, portrait) plutôt qu'un simple texte gris.
 */
function GroupLabel({ group, members, columnTitle, tone }: GroupLabelProps) {
  const { t } = useTranslation("modules/kanban");
  const text = "truncate text-sm font-semibold text-foreground";

  if (group.kind === "status") return <StatusPill status={group.status} />;
  if (group.kind === "priority") {
    // `PriorityLabel` ne rend rien sans priorité : le groupe garde un intitulé.
    return group.priority === null ? <span className={text}>{t("priority.noneGroup")}</span> : <PriorityLabel priority={group.priority} className="text-sm font-semibold" />;
  }
  if (group.kind === "assignee") {
    if (group.userId === null) {
      return (
        <span className="flex min-w-0 items-center gap-2">
          <Inbox aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span className={text}>{t("views.list.unassignedGroup")}</span>
        </span>
      );
    }
    const member = members.find((entry) => entry.userId === group.userId);
    const name = memberDisplayName(member?.profile, t("members.unknown"));
    return (
      <span className="flex min-w-0 items-center gap-2">
        {/* Nom écrit à côté : portrait décoratif. */}
        <MemberAvatar name={name} src={member?.profile?.profilThumbImageUrl} size="sm" />
        <span className={text}>{name}</span>
      </span>
    );
  }
  if (group.kind === "none") return <span className={text}>{t("views.list.allCards")}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ColumnDot className={tone} />
      <span className={text}>{columnTitle}</span>
    </span>
  );
}

interface CardRowProps {
  card: Card;
  members: readonly Member[];
  now: number;
  zone: DateZone;
  locale: DateLocale;
}

/**
 * Ligne dense d'une carte. Toute la ligne est UN lien, pas une rangée de zones cliquables : une
 * ligne qui n'ouvre la carte que sur son titre oblige à viser.
 *
 * Les classes `order-*` réorganisent la ligne sous 640 px (le titre en tête, seul sur sa ligne,
 * le reste s'enroule dessous) sans dupliquer de nœud : un second jeu d'éléments « mobile » serait
 * lu deux fois par un lecteur d'écran.
 */
function CardRow({ card, members, now, zone, locale }: CardRowProps) {
  const { t } = useTranslation("modules/kanban");
  return (
    <Link
      to={actionCardPath(card._id, "list")}
      data-card-id={card._id}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors duration-[var(--ck-duration-out)] ease-in hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
    >
      {/* La largeur fixe est portée par le GABARIT, pas par la pastille : étirée, elle se lirait
          comme un bouton. */}
      <span className="order-2 shrink-0 sm:order-1 sm:w-24">
        <StatusPill status={card.status} />
      </span>

      <span className="order-1 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{card.title}</span>
        {card.description.trim() !== "" ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{card.description}</span> : null}
      </span>

      {/* Gabarits fixes : une carte sans checklist ou à un seul portrait ne décale pas les
          colonnes de la ligne voisine. 192 px = « 16 sept. 2026 · En retard ». */}
      <span className="order-3 flex shrink-0 justify-end sm:w-20">
        <CardAssignees assignees={card.assignees} members={members} />
      </span>
      <span className="order-4 shrink-0 sm:w-48">
        {card.dueDate === null ? <span className="text-xs text-muted-foreground">{t("myCards.noDue")}</span> : <DueDateLabel card={card} now={now} zone={zone} locale={locale} />}
      </span>
      <span className="order-5 shrink-0 sm:w-24">
        <PriorityLabel priority={card.priority} />
      </span>
      <span className="order-6 shrink-0 text-right sm:w-14">
        {card.checklistTotal > 0 ? (
          <MetaCount icon={CheckSquare} label={t("card.checklistSummary", { done: card.checklistDone, total: card.checklistTotal })} value={`${card.checklistDone}/${card.checklistTotal}`} />
        ) : null}
      </span>
    </Link>
  );
}
