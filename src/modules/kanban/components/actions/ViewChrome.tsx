/**
 * Pièces communes aux vues Liste, Table, Chronologie et Vue d'ensemble. Reprises de co-kanban
 * (`pages/board/ViewChrome.tsx`), sur les jetons du site.
 *
 * Elles vivent ici parce qu'au moins deux vues les emploient : le même statut doit avoir la même
 * teinte et le même libellé dans la liste, la table et la chronologie.
 */
import type { ReactNode } from "react";
import { AlertTriangle, CalendarDays, Inbox, SearchX, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isCardOverdueAt } from "@/modules/kanban/components/board/cardMeta";
import { PriorityDot } from "@/modules/kanban/components/board/PriorityDot";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { Pill } from "@/modules/kanban/components/ui/Pill";
import { formatDate, formatLongDate, toDateInputValue, type DateLocale, type DateZone } from "@/modules/kanban/lib/dates";
import { memberDisplayName } from "@/modules/kanban/lib/memberName";
import type { Card, CardStatus, Member, Priority } from "@/modules/kanban/types";
import { STATUS_TONE } from "./viewHelpers";

/**
 * Surface des blocs de vue (groupe de la liste, table, chronologie, panneau de synthèse).
 * `relative` : bloc conteneur des textes `sr-only` (noms des assignés…), qui sinon échappent au
 * rognage et élargissent toute la page.
 */
export const VIEW_SURFACE_CLASS = "relative rounded-xl border border-border bg-card";

/* -------------------------------------------------------------------------- */
/*  Panneau de section                                                        */
/* -------------------------------------------------------------------------- */

export interface ViewPanelProps {
  title: string;
  /** Une phrase qui dit ce que la section mesure. */
  description?: string;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

/**
 * Bloc de contenu des vues. Le titre est un vrai `<h2>` : les vues sont rendues sous le `<h1>` de
 * la page, et une section sans titre disparaît du plan que parcourt un lecteur d'écran.
 */
export function ViewPanel({ title, description, icon: Icon, className, children }: ViewPanelProps) {
  return (
    <section className={cn(VIEW_SURFACE_CLASS, "p-5", className)}>
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        {Icon ? <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
        <span className="truncate">{title}</span>
      </h2>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Statut, priorité, colonne, échéance                                       */
/* -------------------------------------------------------------------------- */

/** Pastille de statut : la teinte double TOUJOURS un libellé écrit. */
export function StatusPill({ status, className }: { status: CardStatus; className?: string }) {
  const { t } = useTranslation("modules/kanban");
  return (
    <Pill tone={STATUS_TONE[status]} className={className}>
      {t(`card.status.${status}`)}
    </Pill>
  );
}

/**
 * Priorité en toutes lettres, précédée de la forme de la carte (`PriorityDot`). La forme porte le
 * nom accessible (« Priorité : Haute ») ; le libellé visible lui est donc caché, il serait lu deux
 * fois. Rien sans priorité : un « Aucune » sur la plupart des actions serait du bruit.
 */
export function PriorityLabel({ priority, className }: { priority: Priority | null; className?: string }) {
  const { t } = useTranslation("modules/kanban");
  if (priority === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-foreground", className)}>
      <PriorityDot priority={priority} />
      <span aria-hidden>{t(`priority.long.${priority}`)}</span>
    </span>
  );
}

/** Point devant un titre de colonne, à la teinte de la colonne (`columnToneClasses`). Décoratif. */
export function ColumnDot({ className }: { className: string | undefined }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", className ?? "bg-muted-foreground/40")} />;
}

export interface DueDateLabelProps {
  card: Pick<Card, "dueDate" | "completedAt" | "status">;
  now: number;
  zone: DateZone;
  locale: DateLocale;
  className?: string;
}

/**
 * Échéance d'une carte. Un retard n'est JAMAIS signalé par la seule couleur : l'icône change et
 * « En retard » est écrit. Rien sans échéance : c'est à l'appelant d'écrire « Sans échéance ».
 */
export function DueDateLabel({ card, now, zone, locale, className }: DueDateLabelProps) {
  const { t } = useTranslation("modules/kanban");
  if (card.dueDate === null) return null;
  // La règle de la carte du tableau : une carte close n'est jamais en retard.
  const late = isCardOverdueAt(card, now, zone);
  const Icon = late ? AlertTriangle : CalendarDays;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums", late ? "font-medium text-destructive" : "text-muted-foreground", className)}>
      {/* L'icône et la date forment UN bloc insécable ; seul « · En retard » peut passer à la ligne. */}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <time dateTime={toDateInputValue(card.dueDate, zone)} title={formatLongDate(card.dueDate, locale, zone)}>
          {formatDate(card.dueDate, locale, zone)}
        </time>
      </span>
      {late ? <span className="whitespace-nowrap">· {t("myCards.overdue")}</span> : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Assignés, métriques                                                       */
/* -------------------------------------------------------------------------- */

export interface CardAssigneesProps {
  assignees: readonly string[];
  members: readonly Member[];
  max?: number;
  className?: string;
}

/**
 * Portraits des assignés, puis « +N ». Les portraits sont décoratifs : les noms sont dits au
 * lecteur d'écran. Un identifiant qui n'est plus membre devient « Membre inconnu », jamais un
 * `ObjectId` brut.
 */
export function CardAssignees({ assignees, members, max = 3, className }: CardAssigneesProps) {
  const { t } = useTranslation("modules/kanban");
  if (assignees.length === 0) return null;
  const people = assignees.map((userId) => {
    const member = members.find((entry) => entry.userId === userId);
    return { userId, name: memberDisplayName(member?.profile, t("members.unknown")), src: member?.profile?.profilThumbImageUrl ?? null };
  });
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <span aria-hidden className="inline-flex items-center">
        {shown.map((person, index) => (
          <MemberAvatar key={person.userId} name={person.name} src={person.src} size="sm" className={cn("ring-2 ring-card", index > 0 && "-ml-1")} />
        ))}
        {hidden > 0 ? <span className="-ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-[0.625rem] font-medium text-muted-foreground tabular-nums ring-2 ring-card">+{hidden}</span> : null}
      </span>
      <span className="sr-only">
        {t("card.assignees")} {people.map((person) => person.name).join(", ")}
      </span>
    </span>
  );
}

export interface MetaCountProps {
  icon: LucideIcon;
  /** Libellé complet, lu par le lecteur d'écran (« 5 commentaires »). */
  label: string;
  value: ReactNode;
  className?: string;
}

/** Métrique d'une carte : icône et nombre à l'œil, phrase entière au lecteur d'écran. */
export function MetaCount({ icon: Icon, label, value, className }: MetaCountProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums", className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span aria-hidden>{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  États de vue                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Attente de l'instantané. Les `Skeleton` sont décoratifs : c'est le conteneur qui annonce
 * l'attente, faute de quoi un lecteur d'écran ne rencontre qu'un trou silencieux.
 */
export function ViewLoading({ children }: { children: ReactNode }) {
  const { t } = useTranslation("modules/kanban");
  return (
    <div aria-busy="true" className="flex flex-col gap-4 pb-4">
      <span className="sr-only">{t("common.loading")}</span>
      {children}
    </div>
  );
}

/** Bandeau de squelette de la hauteur d'une ligne dense. */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-lg motion-reduce:animate-none" />
      ))}
    </div>
  );
}

/**
 * Vide utile : « tableau vide » et « filtre trop étroit » n'appellent pas le même geste. Dans le
 * second cas, la sortie est de relâcher le filtre, pas de créer une carte.
 */
export function ViewEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation("modules/kanban");
  const Icon = filtered ? SearchX : Inbox;
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{filtered ? t("views.empty.filteredTitle") : t("views.empty.title")}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{filtered ? t("views.empty.filteredHint") : t("views.empty.hint")}</p>
    </div>
  );
}
