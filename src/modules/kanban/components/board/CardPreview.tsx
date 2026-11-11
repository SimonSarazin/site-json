import { useId, type MouseEventHandler, type ReactNode, type Ref, type SyntheticEvent } from "react";
import { Link } from "react-router";
// Imports de TYPES uniquement : ils s'effacent à la compilation, la fiche reste un composant de
// rendu pur qui ne tire aucun code de dnd-kit.
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { CalendarClock, CircleCheck, Coins, GripVertical, Link2, ListChecks, MessageSquare, Timer, TriangleAlert, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/modules/kanban/components/ui/MemberAvatar";
import { stopTouchOnControls } from "@/modules/kanban/components/ui/touchControls";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import { formatLongDate, type DateZone } from "@/modules/kanban/lib/dates";
import { formatAmount, formatDuration } from "@/modules/kanban/lib/measures";
import type { Card } from "@/modules/kanban/types";
import { assigneeSummary, displayedCredits, displayedTimeSpent, isCardOverdueAt, shortDueLabel, unseenComments } from "./cardMeta";
import type { CardLabel, CardMember } from "./kanbanDnd";
import { PriorityDot } from "./PriorityDot";

export interface CardPreviewProps {
  card: Card;
  memberIndex: ReadonlyMap<string, CardMember>;
  /** Index des étiquettes du tableau : elles s'affichent en pastilles. */
  labelIndex: ReadonlyMap<string, CardLabel>;
  /**
   * Instant courant en secondes. `0` = inconnu : c'est la valeur du rendu serveur et du premier
   * rendu client, pour laquelle aucune échéance ne peut être « en retard » — sans quoi le HTML
   * différerait à l'hydratation.
   */
  nowSeconds: number;
  /** Fuseau du JOUR CIVIL des échéances (`dateZoneFor` de la source). */
  dateZone?: DateZone;
  /** La carte est dans la colonne de fin : titre barré et coche. */
  inDoneColumn?: boolean;
  /** Commandes de la carte (archiver, menu « ⋯ »), injectées par `TaskCard`. */
  actions?: ReactNode;
  /**
   * Adresse de la fiche de la carte : le titre devient un LIEN, l'arrêt clavier qui l'ouvre
   * (Entrée). Absente dans l'aperçu soulevé du `DragOverlay`, qui ne s'ouvre pas.
   */
  to?: string;
  /*
   * DEUX PRISES, posées par `TaskCard` (cf. `splitDragListeners`) :
   *  - au POINTEUR, toute la fiche se saisit (`surfaceListeners` sur l'`<article>`) ;
   *  - au CLAVIER et pour les technologies d'assistance, la prise est la POIGNÉE (`handle*`),
   *    un bouton SŒUR du contenu. Un `role="button"` posé sur toute la fiche englobait le menu
   *    et l'archivage : en ARIA, les enfants d'un bouton sont présentationnels.
   * Toutes optionnelles : le même composant sert d'aperçu au `DragOverlay`, ni saisissable ni
   * cliquable, et de fiche en lecture seule.
   */
  surfaceListeners?: DraggableSyntheticListeners;
  handleRef?: Ref<HTMLButtonElement>;
  handleAttributes?: Partial<DraggableAttributes>;
  handleListeners?: DraggableSyntheticListeners;
  onClick?: MouseEventHandler<HTMLElement>;
  /** La carte se déplace : la poignée se montre. */
  draggable?: boolean;
  /** Aperçu soulevé : la fiche quitte la pile, s'agrandit et prend l'ombre haute. */
  lifted?: boolean;
  className?: string;
}

/** Portraits de la ligne méta, à droite : deux, puis « +N ». */
const MAX_META_AVATARS = 2;

/*
 * Les commandes de la carte — et leurs panneaux — ne doivent pas amorcer un glisser (la fiche
 * entière est la prise) : leurs événements s'arrêtent à leur conteneur. Au doigt, seulement
 * quand il est vraiment dessus (`stopTouchOnControls`).
 */
function stopAtActions(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * Fiche de carte — l'anatomie de la maquette du tableau de co-kanban (DESIGN §6.4) :
 *
 *   ⠿  ● Titre (cinq lignes au plus, barré dans la colonne de fin)   ✓ 🗄 ⋯
 *        [étiquette] [étiquette]
 *        📅 22 oct.   👤 Elie Fidele   ☑ 2/4   💬 3 •1   ¤ 12   ⏱ 1 h      (◯)
 *
 * Rendu PUR : aucune logique de glisser-déposer ici, c'est `TaskCard` qui l'enveloppe. Le même
 * composant sert donc à la pile et à l'aperçu du `DragOverlay` : une carte soulevée est
 * exactement la carte saisie.
 *
 * La ligne méta ne montre QUE ce qui existe (ni « 0 commentaire » ni checklist vide). Le titre
 * est le lien de la fiche (`to`) ; le clic sur le reste de la carte est l'affaire de `TaskCard`.
 */
export function CardPreview({
  card,
  memberIndex,
  labelIndex,
  nowSeconds,
  dateZone = "utc",
  inDoneColumn = false,
  actions,
  to,
  surfaceListeners,
  handleRef,
  handleAttributes,
  handleListeners,
  onClick,
  draggable = false,
  lifted = false,
  className,
}: CardPreviewProps) {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const titleId = useId();

  // Même règle que le filtre « Échéance » (cf. `isCardOverdueAt`).
  const isOverdue = isCardOverdueAt(card, nowSeconds, dateZone);
  const hasHandle = handleAttributes !== undefined;

  const labels = card.labelIds.map((id) => labelIndex.get(id)).filter((label): label is CardLabel => label !== undefined);

  const lead = assigneeSummary(card.assignees, memberIndex);
  const people = card.assignees.map((userId) => memberIndex.get(userId)).filter((member): member is CardMember => member !== undefined);
  const hiddenPeople = people.length - MAX_META_AVATARS;

  const unseen = unseenComments(card);
  const credits = displayedCredits(card);
  const timeSpent = displayedTimeSpent(card);

  return (
    <article
      {...surfaceListeners}
      // Une fiche nommée par son titre : le lecteur d'écran annonce « article, <titre> » en y
      // entrant, sans relire tout le contenu.
      aria-labelledby={titleId}
      data-card-id={card._id}
      onClick={onClick}
      className={cn(
        "group/card relative flex gap-1.5 rounded-xl border border-border bg-card py-[var(--ck-card-padding)] pr-[var(--ck-card-padding)] pl-1.5 text-card-foreground",
        "transition-[box-shadow,border-color,transform] duration-[var(--ck-duration-out)] ease-in",
        // Au repos la fiche n'a que son filet : l'ombre est un retour de survol.
        lifted ? "scale-[1.02] shadow-[var(--ck-shadow-drag)]" : "hover:border-[var(--ck-border-strong)] hover:shadow-sm",
        // L'ANNEAU DE FOCUS entoure la fiche quand sa poignée a le focus : à l'œil, c'est la
        // carte qu'on tient.
        hasHandle && "has-[[data-card-handle]:focus-visible]:outline-2 has-[[data-card-handle]:focus-visible]:outline-offset-2 has-[[data-card-handle]:focus-visible]:outline-ring",
        className,
      )}
    >
      {hasHandle ? (
        /*
         * POIGNÉE = prise CLAVIER de la carte (Espace ou Entrée saisit, les flèches déplacent).
         * Nommée par le titre ; « carte déplaçable » et les instructions viennent des attributs
         * de dnd-kit. Au pointeur, elle se comporte comme le reste de la fiche.
         */
        <button
          ref={handleRef}
          type="button"
          {...handleAttributes}
          {...handleListeners}
          aria-label={card.title}
          data-card-handle=""
          className="flex w-4 shrink-0 cursor-grab items-center justify-center self-stretch rounded-sm text-muted-foreground focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>
      ) : (
        // Poignée DÉCORATIVE dans l'aperçu soulevé, invisible quand la carte ne se déplace pas.
        <span aria-hidden className={cn("flex w-4 shrink-0 items-center justify-center text-muted-foreground", !draggable && "invisible")}>
          <GripVertical className="size-3.5" />
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          {/* Le point s'aligne sur la première ligne du titre (interligne 20). */}
          <PriorityDot priority={card.priority} className="h-5" />
          {to ? (
            <Link
              id={titleId}
              to={to}
              title={card.title}
              // Un lien se glisse nativement (iPadOS le soulève à l'appui long) : sur une carte
              // déplaçable, ce glisser-là prenait le geste de la carte.
              draggable={draggable ? false : undefined}
              className={cn(
                "line-clamp-5 min-w-0 flex-1 rounded-sm text-sm font-medium break-words text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                /*
                 * Le soulignement de survol et le barré de la colonne de fin posent TOUS DEUX
                 * `text-decoration-line` : `hover:underline` effaçait le barré au survol, et une
                 * carte terminée ressemblait à une carte ouverte. Dans la colonne de fin, ils cumulent.
                 */
                inDoneColumn ? "line-through decoration-muted-foreground hover:[text-decoration-line:line-through_underline]" : "hover:underline",
              )}
            >
              {card.title}
            </Link>
          ) : (
            <p
              id={titleId}
              title={card.title}
              className={cn("line-clamp-5 min-w-0 flex-1 text-sm font-medium break-words text-foreground", inDoneColumn && "line-through decoration-muted-foreground")}
            >
              {card.title}
            </p>
          )}
          {inDoneColumn ? (
            <span role="img" aria-label={t("card.done")} title={t("card.done")} className="flex h-5 shrink-0 items-center">
              <CircleCheck aria-hidden className="size-4 text-[var(--ck-success-ink)]" />
            </span>
          ) : null}
          {actions ? (
            <div className="-my-1 -mr-1 flex shrink-0 items-center gap-0.5" onClick={stopAtActions} onMouseDown={stopAtActions} onPointerDown={stopAtActions} onTouchStart={stopTouchOnControls}>
              {actions}
            </div>
          ) : null}
        </div>

        {labels.length > 0 ? (
          // Pastilles sur la teinte de la couleur primaire du site, encre du site : le contraste
          // ne dépend pas de la couleur propre de l'étiquette, qui se lit dans le filtre.
          <ul className="flex flex-wrap gap-1" aria-label={t("labels.group")}>
            {labels.map((label) => (
              <li key={label.id} className="inline-flex h-5 max-w-full items-center rounded-full bg-primary/15 px-2 text-[0.6875rem] font-medium text-foreground">
                <span className="truncate">{label.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center gap-2">
          <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {card.dueDate !== null ? (
              <li className={cn("inline-flex items-center gap-1", isOverdue && "font-medium text-destructive")}>
                {/* Le retard n'est jamais porté par la couleur seule : icône d'alerte à la place
                    du calendrier, et le mot pour les lecteurs d'écran et l'infobulle. */}
                {isOverdue ? <TriangleAlert aria-hidden className="size-3.5 shrink-0" /> : <CalendarClock aria-hidden className="size-3.5 shrink-0" />}
                <time
                  dateTime={new Date(card.dueDate * 1000).toISOString()}
                  title={isOverdue ? `${formatLongDate(card.dueDate, locale, dateZone)} — ${t("card.overdue")}` : formatLongDate(card.dueDate, locale, dateZone)}
                  className="whitespace-nowrap"
                >
                  {shortDueLabel(card.dueDate, locale, nowSeconds, dateZone)}
                </time>
                <span className="sr-only">{isOverdue ? t("card.overdue") : t("dueDate.label")}</span>
              </li>
            ) : null}

            {lead ? (
              <li className="inline-flex min-w-0 items-center gap-1">
                <User aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{lead.others > 0 ? t("card.meta.assigneeAndOthers", { name: lead.lead.name, count: lead.others }) : lead.lead.name}</span>
              </li>
            ) : null}

            {card.checklistTotal > 0 ? (
              <li className="inline-flex items-center gap-1">
                <ListChecks aria-hidden className="size-3.5 shrink-0" />
                <span aria-hidden className="tabular-nums">{`${card.checklistDone}/${card.checklistTotal}`}</span>
                <span className="sr-only">{t("card.checklistSummary", { done: card.checklistDone, total: card.checklistTotal })}</span>
              </li>
            ) : null}

            {card.commentCount > 0 ? (
              <li className="inline-flex items-center gap-1">
                <MessageSquare aria-hidden className="size-3.5 shrink-0" />
                <span aria-hidden className="tabular-nums">{card.commentCount}</span>
                <span className="sr-only">{t("card.meta.comments", { count: card.commentCount })}</span>
                {unseen > 0 ? (
                  // Pastille de non-lus : chiffre écrit + libellé accessible, la couleur ne porte
                  // pas seule la nouveauté.
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] font-semibold text-primary-foreground">
                    <span aria-hidden className="tabular-nums">{unseen}</span>
                    <span className="sr-only">{t("card.meta.unseen", { count: unseen })}</span>
                  </span>
                ) : null}
              </li>
            ) : null}

            {card.linkCount > 0 ? (
              <li className="inline-flex items-center gap-1">
                <Link2 aria-hidden className="size-3.5 shrink-0" />
                <span aria-hidden className="tabular-nums">{card.linkCount}</span>
                <span className="sr-only">{t("card.meta.links", { count: card.linkCount })}</span>
              </li>
            ) : null}

            {credits !== null ? (
              <li className="inline-flex items-center gap-1">
                <Coins aria-hidden className="size-3.5 shrink-0" />
                <span aria-hidden className="tabular-nums">{formatAmount(credits, locale)}</span>
                <span className="sr-only">{t("card.meta.credits", { amount: formatAmount(credits, locale) })}</span>
              </li>
            ) : null}

            {timeSpent !== null ? (
              <li className="inline-flex items-center gap-1">
                <Timer aria-hidden className="size-3.5 shrink-0" />
                <span aria-hidden className="tabular-nums">{formatDuration(timeSpent)}</span>
                <span className="sr-only">{t("card.meta.timeSpent", { duration: formatDuration(timeSpent) })}</span>
              </li>
            ) : null}
          </ul>

          {people.length > 0 ? (
            // Pile DÉCORATIVE : le nom du premier assigné et « et N autres » sont écrits à gauche.
            <span aria-hidden className="inline-flex shrink-0 items-center self-end">
              {people.slice(0, MAX_META_AVATARS).map((member, index) => (
                <MemberAvatar key={member.userId} name={member.name} src={member.avatarUrl} size="sm" className={cn("ring-2 ring-card", index > 0 && "-ml-1")} />
              ))}
              {hiddenPeople > 0 ? (
                <span className="-ml-1 inline-flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[0.625rem] font-medium text-muted-foreground tabular-nums ring-2 ring-card">
                  +{hiddenPeople}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
