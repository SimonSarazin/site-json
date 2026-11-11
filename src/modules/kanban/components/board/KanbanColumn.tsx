import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, type SortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronsDown, CircleCheck, Coins, Plus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ActionMenuItem } from "@/modules/kanban/components/ui/ActionMenu";
import { useInterfaceLanguage } from "@/modules/kanban/hooks/useInterfaceLanguage";
import type { DateZone } from "@/modules/kanban/lib/dates";
import type { ActionsViewId } from "@/modules/kanban/lib/kanbanPaths";
import { formatAmount } from "@/modules/kanban/lib/measures";
import type { Card, Column } from "@/modules/kanban/types";
import { CardComposer, type CardComposerSubmit, type CreateCardHandler } from "./CardComposer";
import { cardElementIn, cardFocusTargetIn } from "./cardFocus";
import { creditsTotal } from "./cardMeta";
import { ColumnMenu } from "./ColumnMenu";
import { CARD_WINDOW_SIZE, focusTargetAfterRemoval, scrollTopToReveal, showMoreCount, windowCardIds, windowLimitCovering } from "./columnView";
import { TaskCard } from "./TaskCard";
import {
  cardSortableId,
  columnSortableId,
  columnZoneId,
  resolveColumnTitle,
  type CardLabel,
  type CardMember,
  type CardMoveRequest,
  type CardMoveTarget,
  type CardOrder,
  type ColumnDragData,
} from "./kanbanDnd";

/**
 * Ce qu'une vue ajoute à l'en-tête d'une colonne. La vue Jalons y pose le drapeau du jalon, sa
 * période et « Clore le jalon » ; le Tableau n'en a pas besoin.
 */
export interface ColumnDecoration {
  /** Pictogramme devant le titre, décoratif (le titre dit déjà tout). */
  icon?: LucideIcon;
  /** Seconde ligne de l'en-tête. */
  subtitle?: string;
  /** Items propres à la vue, ajoutés au menu « ⋯ » de la colonne. */
  menuItems?: readonly ActionMenuItem[];
}

export interface KanbanColumnProps {
  column: Column;
  /** Ordre affiché COMPLET des cartes de cette colonne (aperçu de glisser compris). */
  cardIds: readonly string[];
  cardsById: ReadonlyMap<string, Card>;
  columns: readonly Column[];
  /** Lecteur stable d'une carte, pour « Déplacer vers… » (cf. `TaskCard`). */
  getCard: (cardId: string) => Card | undefined;
  getCardOrder: () => CardOrder;
  memberIndex: ReadonlyMap<string, CardMember>;
  labelIndex: ReadonlyMap<string, CardLabel>;
  nowSeconds: number;
  /** Fuseau du jour civil des échéances (`dateZoneFor` de la source). */
  dateZone?: DateZone;
  canEditCards: boolean;
  /** Changer l'ordre des colonnes (capacité serveur). */
  canReorderColumns: boolean;
  /** Un filtre est posé : une colonne vide veut alors dire « rien ne passe ». */
  isFiltered: boolean;
  /** Ordre CANONIQUE (tableau relié) : pas de réordonnancement dans la colonne. */
  canonical?: boolean;
  /** Tableau relié : afficher le total des montants au pied de la colonne. */
  showCreditsTotal?: boolean;
  /** Cartes rendues (fenêtre) ; au-delà, « Afficher N de plus » (cf. `columnView`). */
  visibleLimit?: number;
  /** Élargit la fenêtre de la colonne ; la limite vit dans le tableau, qui la lit au dépôt. */
  onLimitChange: (columnId: string, limit: number) => void;
  /** Carte tenue pendant un glisser : rendue même hors de la fenêtre. */
  pinnedCardId?: string | null;
  onMoveCard: (intent: CardMoveRequest) => void;
  /** Crée la carte saisie dans le composeur ; sa présence ouvre le pied « Ajouter une tâche ». */
  onCreateCard?: CreateCardHandler;
  /** Archive une carte de la colonne de fin (si `canArchiveCards`). */
  onArchiveCard?: (cardId: string) => void;
  /** Masque la colonne sur ce poste ; absent là où le masquage ne s'applique pas (vue Jalons). */
  onHide?: (columnId: string) => void;
  /** Ce que la vue ajoute à l'en-tête de cette colonne. */
  decoration?: ColumnDecoration;
  /** Ce que désignent les colonnes, pour les mots de « Déplacer vers… ». */
  moveTarget?: CardMoveTarget;
  /** Vue qui affiche le tableau : la fiche d'une carte s'ouvre par-dessus elle. */
  view?: ActionsViewId;
  /** Écrit dans la région vivante du tableau (cartes affichées, carte placée). */
  announce: (message: string) => void;
}

/*
 * Stratégie de tri NULLE pour un tableau relié (D16) : dans sa propre colonne, aucune voisine ne
 * s'écarte sous la carte glissée — elle reviendrait à sa place au dépôt, l'aperçu ne doit pas
 * promettre le contraire. Entre deux colonnes, c'est l'ordre affiché (rang canonique) qui place
 * la carte.
 */
const holdCanonicalOrder: SortingStrategy = () => null;

/**
 * Une colonne du tableau (DESIGN §6.3 de co-kanban) : en-tête (coche de la colonne de fin,
 * titre, compteur, menu « ⋯ »), pile de cartes qui DÉFILE EN INTERNE dès 768 px, pied
 * « Ajouter une tâche » et le total des montants.
 *
 * Réduite à un tableau relié, comme `ColumnMenu` : on n'y renomme, ne limite ni ne supprime une
 * colonne (ce sont les statuts de Communecter), et une carte n'y naît jamais « en tête ».
 *
 * Mémoïsée : pendant un glisser, seules les colonnes dont la liste d'ids change se rendent.
 */
export const KanbanColumn = memo(function KanbanColumn({
  column,
  cardIds,
  cardsById,
  columns,
  getCard,
  getCardOrder,
  memberIndex,
  labelIndex,
  nowSeconds,
  dateZone = "utc",
  canEditCards,
  canReorderColumns,
  isFiltered,
  canonical = false,
  showCreditsTotal = false,
  visibleLimit = CARD_WINDOW_SIZE,
  onLimitChange,
  pinnedCardId = null,
  onMoveCard,
  onCreateCard,
  onArchiveCard,
  onHide,
  decoration,
  moveTarget = "column",
  view = "kanban",
  announce,
}: KanbanColumnProps) {
  const { t } = useTranslation("modules/kanban");
  const locale = useInterfaceLanguage();
  const headingId = useId();

  const translate = useCallback((key: string, fallback: string) => t(key, fallback), [t]);
  const title = resolveColumnTitle(column, translate);

  const dragData: ColumnDragData = useMemo(() => ({ type: "column", columnId: column._id }), [column._id]);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: columnSortableId(column._id),
    data: dragData,
    disabled: !canReorderColumns,
    attributes: { roleDescription: t("column.roleDescription") },
  });

  /*
   * Zone de dépôt distincte du triable de la colonne : sans elle, une colonne VIDE n'offrirait
   * aucune cible et on ne pourrait jamais y déposer.
   */
  const { setNodeRef: setZoneRef, isOver } = useDroppable({ id: columnZoneId(column._id), data: dragData });
  const listRef = useRef<HTMLUListElement | null>(null);
  const setListRef = useCallback(
    (node: HTMLUListElement | null) => {
      setZoneRef(node);
      listRef.current = node;
    },
    [setZoneRef],
  );

  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };

  /*
   * FENÊTRE DE CARTES : seules les `visibleLimit` premières sont rendues (et triables). Le
   * compteur, le total et les annonces portent, eux, sur TOUTES les cartes de la colonne.
   */
  const visibleIds = useMemo(() => windowCardIds(cardIds, visibleLimit, pinnedCardId), [cardIds, visibleLimit, pinnedCardId]);
  const sortableItems = useMemo(() => visibleIds.map(cardSortableId), [visibleIds]);
  const moreCount = showMoreCount(cardIds.length, visibleLimit);
  const overLimit = column.wipLimit !== null && cardIds.length > column.wipLimit;

  /*
   * Total des montants des cartes AFFICHÉES (le compteur compte les mêmes). Recalculé seulement
   * quand la liste ou les cartes changent, pas à chaque survol d'un glisser qui ne touche pas
   * cette colonne.
   */
  const total = useMemo(() => {
    if (!showCreditsTotal) return null;
    return creditsTotal(cardIds.map((id) => cardsById.get(id)).filter((card): card is Card => card !== undefined));
  }, [showCreditsTotal, cardIds, cardsById]);

  const [composerOpen, setComposerOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const footerAddRef = useRef<HTMLButtonElement>(null);
  /** Le déclencheur du pied attend le focus après une fermeture du composeur. */
  const restoreFocusRef = useRef(false);
  /** Carte créée à montrer et annoncer dès qu'elle arrive (cf. `handleCreateCard`). */
  const revealRef = useRef<string | null>(null);

  // Sans `useCallback` : le composeur n'est pas mémoïsé, une identité stable n'y gagnerait rien.
  function closeComposer() {
    // Le déclencheur du pied est REMONTÉ à la fermeture : on note qu'il attend le focus et on
    // le pose au rendu suivant.
    restoreFocusRef.current = true;
    // Une carte créée que le filtre cache n'est plus attendue : sans cela, elle serait montrée
    // et annoncée bien plus tard, au retrait du filtre.
    revealRef.current = null;
    setComposerOpen(false);
  }

  /** Bouton « ⋯ » de l'en-tête : la commande de repli de la colonne. */
  const columnMenuTrigger = useCallback(() => headerRef.current?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]') ?? null, []);

  useEffect(() => {
    if (!restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    footerAddRef.current?.focus();
  }, [composerOpen]);

  /*
   * FOCUS APRÈS UN RETRAIT ou un ajout de cartes affichées. L'intention est notée au geste
   * (ref), puis exécutée au rendu où le DOM est prêt : la carte archivée disparaît par la
   * mutation optimiste, un rendu plus tard, et son bouton emportait le focus avec lui.
   */
  const pendingFocusRef = useRef<{ cardId: string | null; afterRemovalOf: string | null } | null>(null);
  const visibleIdsRef = useRef(visibleIds);
  useEffect(() => {
    visibleIdsRef.current = visibleIds;
  });

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    if (pending.afterRemovalOf !== null && cardIds.includes(pending.afterRemovalOf)) return;
    if (pending.cardId !== null && pending.afterRemovalOf === null && !visibleIds.includes(pending.cardId)) return;
    pendingFocusRef.current = null;
    // La carte (sa poignée), sinon le pied « Ajouter une tâche », sinon le menu de la colonne.
    const target = pending.cardId === null ? null : cardFocusTargetIn(listRef.current, pending.cardId);
    (target ?? footerAddRef.current ?? columnMenuTrigger())?.focus();
  }, [cardIds, visibleIds, columnMenuTrigger]);

  /*
   * Archiver depuis la colonne : le focus passera à la carte SUIVANTE (ou à la précédente) une
   * fois la carte retirée. `useCallback` + lecture par ref : la fonction descend jusqu'à chaque
   * carte mémoïsée.
   */
  const handleArchiveCard = useCallback(
    (cardId: string) => {
      pendingFocusRef.current = { cardId: focusTargetAfterRemoval(visibleIdsRef.current, cardId), afterRemovalOf: cardId };
      onArchiveCard?.(cardId);
    },
    [onArchiveCard],
  );

  function handleShowMore() {
    const added = showMoreCount(cardIds.length, visibleLimit);
    const nextLimit = visibleLimit + CARD_WINDOW_SIZE;
    // Dernière tranche : le bouton disparaît avec le focus qu'il porte ; le focus va alors à la
    // première carte révélée. Sinon il reste sur le bouton, qui descend sous les cartes ajoutées.
    if (nextLimit >= cardIds.length) {
      pendingFocusRef.current = { cardId: cardIds[visibleLimit] ?? null, afterRemovalOf: null };
    }
    onLimitChange(column._id, nextLimit);
    announce(t("column.showMoreDone", { count: added, title, shown: Math.min(nextLimit, cardIds.length), total: cardIds.length }));
  }

  /*
   * UNE CARTE CRÉÉE EST MONTRÉE ET ANNONCÉE : elle naît à SON rang canonique (priorité, puis
   * date de création), souvent loin du composeur. La fenêtre s'élargit jusqu'à elle, la liste
   * défile jusqu'à elle, la région vivante dit sa place ; le composeur garde le focus.
   */
  const [revealRequest, setRevealRequest] = useState(0);

  const handleCreateCard = useCallback(
    async (input: CardComposerSubmit) => {
      if (!onCreateCard) throw new Error("onCreateCard absent");
      const card = await onCreateCard(input);
      revealRef.current = card._id;
      setRevealRequest((count) => count + 1);
      return card;
    },
    [onCreateCard],
  );

  // `revealRequest` en dépendance : c'est lui qui relance l'effet quand une création aboutit ;
  // la carte à montrer, elle, est lue dans la ref.
  useEffect(() => {
    const cardId = revealRef.current;
    if (cardId === null) return;
    const index = cardIds.indexOf(cardId);
    // Pas encore dans la colonne (réponse en cours), ou écartée par le filtre.
    if (index === -1) return;
    if (index >= visibleLimit) {
      onLimitChange(column._id, windowLimitCovering(index, visibleLimit));
      return;
    }
    revealRef.current = null;
    const list = listRef.current;
    const item = cardElementIn(list, cardId);
    if (list && item && list.scrollHeight > list.clientHeight) {
      const top = scrollTopToReveal({
        itemTop: item.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop,
        itemHeight: item.offsetHeight,
        scrollTop: list.scrollTop,
        viewHeight: list.clientHeight,
      });
      if (top !== null) list.scrollTop = top;
    }
    /*
     * Sous 768 px, c'est la PAGE qui défile : les cartes rendues en plus poussent le pied vers le
     * bas, et le composeur qui garde le focus sortait de l'écran. On le ramène, sans animation.
     */
    const footer = footerRef.current;
    if (footer !== null && footer.contains(document.activeElement)) footer.scrollIntoView?.({ block: "nearest" });
    announce(
      // Tableau relié : la phrase dit aussi pourquoi la carte n'est pas près du composeur.
      t(canonical ? "column.composer.placedAt" : "column.composer.added", {
        // L'index des cartes REÇU en prop : le lecteur `getCard` du tableau n'est mis à jour que
        // par l'effet du parent, qui passe après celui-ci.
        title: cardsById.get(cardId)?.title ?? "",
        position: index + 1,
        total: cardIds.length,
        column: title,
      }),
    );
  }, [revealRequest, cardIds, cardsById, visibleLimit, column._id, onLimitChange, announce, t, title, canonical]);

  const canCreate = canEditCards && onCreateCard !== undefined;
  const DecorationIcon = decoration?.icon;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        // Sous 768 px la colonne occupe 84 vw et se cale au défilement par à-coups ; au-delà,
        // largeur fixe et hauteur BORNÉE par le tableau.
        "ck-snap-item flex w-[84vw] shrink-0 list-none md:max-h-full md:w-[var(--ck-column-width)]",
        isDragging && "opacity-50",
      )}
    >
      <section
        aria-labelledby={headingId}
        className={cn(
          // Remplissage TRANSLUCIDE : la surface du site transparaît. `relative` : bloc
          // conteneur des textes `sr-only` de l'en-tête et du pied.
          "relative flex min-h-32 w-full flex-col rounded-2xl border border-border bg-[var(--ck-column-fill)]",
          "transition-[background-color,border-color] duration-[var(--ck-duration-out)] ease-in",
          // La cible de dépôt se voit : sans retour visuel, on lâche à l'aveugle. En couleurs
          // forcées, la teinte disparaît : le filet passe à la couleur système de sélection.
          isOver && "border-primary bg-primary/10 forced-colors:border-[Highlight]",
        )}
      >
        <header
          ref={headerRef}
          className={cn(
            "flex shrink-0 items-center gap-2 pr-2 pl-[var(--ck-column-padding)]",
            // Une seconde ligne (période d'un jalon) : l'en-tête grandit au lieu de la rogner.
            decoration?.subtitle ? "min-h-[var(--ck-column-header)] py-1.5" : "h-[var(--ck-column-header)]",
          )}
        >
          {column.isDoneColumn ? (
            // La coche double le titre : la colonne de fin compte les cartes closes.
            <CircleCheck aria-hidden className="size-4 shrink-0 text-[var(--ck-success-ink)]" />
          ) : null}
          {DecorationIcon ? <DecorationIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}

          <div className="mr-auto min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 id={headingId} className="min-w-0 shrink">
                {/* LE TITRE EST LA POIGNÉE de la colonne : un activateur focalisable (donc le
                    déplacement au clavier) sans bouton de plus. */}
                {canReorderColumns ? (
                  <button
                    ref={setActivatorNodeRef}
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="block w-full cursor-grab touch-none truncate rounded-sm text-left text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
                  >
                    {title}
                  </button>
                ) : (
                  <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
                )}
              </h2>

              {/* Compteur en capsule ; teinte d'alerte et libellé quand la limite d'en-cours est
                  dépassée. */}
              <span
                className={cn(
                  "inline-flex h-5 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
                  overLimit ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-foreground",
                )}
                title={column.wipLimit !== null ? t("column.wipTitle", { limit: column.wipLimit }) : undefined}
              >
                <span aria-hidden>{cardIds.length}</span>
                <span className="sr-only">{t("column.cardCount", { count: cardIds.length })}</span>
              </span>
              {/* La couleur ne porte jamais seule l'alerte de limite. */}
              {overLimit ? <span className="sr-only">{t("column.ruler.exceeded")}</span> : null}
            </div>
            {decoration?.subtitle ? (
              <p className="truncate text-xs text-muted-foreground" title={decoration.subtitle}>
                {decoration.subtitle}
              </p>
            ) : null}
          </div>

          <ColumnMenu columnTitle={title} onHide={onHide ? () => onHide(column._id) : undefined} extraItems={decoration?.menuItems} />
        </header>

        <SortableContext items={sortableItems} strategy={canonical ? holdCanonicalOrder : verticalListSortingStrategy}>
          <ul
            ref={setListRef}
            aria-label={t("column.cards", { title })}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-[var(--ck-card-gap)] px-[var(--ck-column-padding)] pt-1 pb-2",
              // Défilement interne DÈS 768 PX seulement : en dessous, la page défile. Le haut
              // garde 4 px : l'anneau de focus de la première carte n'est pas rogné.
              "md:overflow-y-auto md:overscroll-contain [scrollbar-color:var(--ck-scrollbar)_transparent] [scrollbar-width:thin]",
            )}
          >
            {cardIds.length === 0 ? (
              <li className="list-none">
                {/* Un vide sans issue est un cul-de-sac : la colonne distingue « rien ici » de
                    « rien ne passe le filtre », deux situations qui n'appellent pas le même geste. */}
                <p className="rounded-xl border border-dashed border-[var(--ck-border-strong)] px-3 py-6 text-center text-xs text-muted-foreground">
                  {isFiltered ? t("column.emptyFiltered") : canEditCards ? t("column.emptyHint") : t("column.emptyViewer")}
                </p>
              </li>
            ) : (
              visibleIds.map((cardId) => {
                const card = cardsById.get(cardId);
                // Course possible avec une suppression distante entre deux synchronisations.
                if (!card) return null;
                return (
                  <TaskCard
                    key={cardId}
                    card={card}
                    columnId={column._id}
                    columns={columns}
                    getCard={getCard}
                    getCardOrder={getCardOrder}
                    memberIndex={memberIndex}
                    labelIndex={labelIndex}
                    nowSeconds={nowSeconds}
                    dateZone={dateZone}
                    canEdit={canEditCards}
                    onMove={onMoveCard}
                    inDoneColumn={column.isDoneColumn}
                    canonical={canonical}
                    onArchive={onArchiveCard ? handleArchiveCard : undefined}
                    view={view}
                    moveTarget={moveTarget}
                  />
                );
              })
            )}

            {moreCount > 0 ? (
              <li className="list-none">
                <button
                  type="button"
                  onClick={handleShowMore}
                  // Nom accessible = le texte visible PLUS la colonne : six « Afficher 50 de
                  // plus » identiques ne diraient pas où.
                  aria-label={[t("column.showMore", { count: moreCount }), t("column.showMoreIn", { title }), t("column.showMoreRemaining", { count: cardIds.length - visibleLimit })].join(" ")}
                  className={cn(
                    "flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-2 text-xs text-muted-foreground",
                    "transition-[background-color,color] duration-[var(--ck-duration-out)] ease-in pointer-coarse:min-h-11",
                    "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  )}
                >
                  <ChevronsDown aria-hidden className="size-3.5 shrink-0" />
                  <span>{t("column.showMore", { count: moreCount })}</span>
                  <span className="tabular-nums">{t("column.showMoreRemaining", { count: cardIds.length - visibleLimit })}</span>
                </button>
              </li>
            ) : null}
          </ul>
        </SortableContext>

        {canCreate || total !== null ? (
          <footer ref={footerRef} className="flex shrink-0 items-center gap-2 border-t border-border px-2 py-1.5">
            {canCreate && composerOpen ? (
              <div className="min-w-0 flex-1 px-1 pb-1">
                <CardComposer columnId={column._id} columnTitle={title} onSubmit={handleCreateCard} onClose={closeComposer} />
              </div>
            ) : canCreate ? (
              /*
               * TOUJOURS dans le flux, jamais monté au survol : une commande qui n'existe qu'au
               * passage de souris est introuvable au clavier et inatteignable au doigt. Le nom
               * accessible porte la colonne : six « Ajouter une tâche » ne disent pas où.
               */
              <button
                ref={footerAddRef}
                type="button"
                aria-label={t("column.addCardTo", { title })}
                onClick={() => setComposerOpen(true)}
                className={cn(
                  "flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-foreground",
                  "transition-[background-color,color] duration-[var(--ck-duration-out)] ease-in pointer-coarse:min-h-11",
                  "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                )}
              >
                <Plus aria-hidden className="size-4 shrink-0" />
                {t("column.addCard")}
              </button>
            ) : (
              <span className="flex-1" />
            )}

            {total !== null && !composerOpen ? (
              <span className="inline-flex shrink-0 items-center gap-1 px-1 text-xs text-muted-foreground tabular-nums">
                <Coins aria-hidden className="size-3.5" />
                <span aria-hidden>{formatAmount(total, locale)}</span>
                <span className="sr-only">{t("column.creditsTotal", { amount: formatAmount(total, locale) })}</span>
              </span>
            ) : null}
          </footer>
        ) : null}
      </section>
    </li>
  );
});
