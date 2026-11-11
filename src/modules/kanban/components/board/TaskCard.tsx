import { memo, Suspense, useCallback, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, Move, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ActionMenu } from "@/modules/kanban/components/ui/ActionMenu";
import type { DateZone } from "@/modules/kanban/lib/dates";
import { actionCardPath, type ActionsViewId } from "@/modules/kanban/lib/kanbanPaths";
// « Déplacer vers… » est chargée à la demande, à la première ouverture (`lazyDialogs`).
import { CardMoveDialog } from "@/modules/kanban/lazyDialogs";
import type { Card } from "@/modules/kanban/types";
import { CardPreview } from "./CardPreview";
import type { MoveColumn } from "./CardMoveDialog";
import { cardSortableId, splitDragListeners, type CardDragData, type CardLabel, type CardMember, type CardMoveRequest, type CardMoveTarget, type CardOrder } from "./kanbanDnd";

/** Enfants qui ont DÉJÀ leur action : un clic sur eux n'ouvre pas la carte. */
const INTERACTIVE_CHILD = 'a, button, [role="button"], input, select, textarea, label';

export interface TaskCardProps {
  card: Card;
  /** Colonne AFFICHÉE qui porte la carte. */
  columnId: string;
  /** Colonnes du tableau, pour « Déplacer vers… ». */
  columns: readonly MoveColumn[];
  /**
   * Lecture différée d'une carte du tableau (titres des voisines dans « Déplacer vers… »). Un
   * LECTEUR stable plutôt que l'index lui-même : l'index change à chaque rechargement du
   * tableau, et le passer en prop faisait se rendre de nouveau TOUTES les cartes — 1 009 sur le
   * plus gros projet.
   */
  getCard: (cardId: string) => Card | undefined;
  /** Lecture différée de l'ordre affiché : seul « Déplacer vers… » en a besoin, à l'ouverture. */
  getCardOrder: () => CardOrder;
  memberIndex: ReadonlyMap<string, CardMember>;
  labelIndex: ReadonlyMap<string, CardLabel>;
  nowSeconds: number;
  /** Fuseau du jour civil des échéances (`dateZoneFor` de la source). */
  dateZone?: DateZone;
  /** Capacité serveur. Sans elle : ni prise de glissement, ni menu de déplacement. */
  canEdit: boolean;
  onMove: (intent: CardMoveRequest) => void;
  /** La carte est dans la colonne de fin : titre barré, coche, bouton Archiver. */
  inDoneColumn?: boolean;
  /** Ordre CANONIQUE (tableau relié, D16) : « Déplacer vers… » ne propose que la colonne. */
  canonical?: boolean;
  /** Archivage (si `canArchiveCards`) : proposé seulement dans la colonne de fin. */
  onArchive?: (cardId: string) => void;
  /** Vue qui affiche la carte : sa fiche s'ouvre par-dessus elle (Tableau, ou vue Jalons). */
  view?: ActionsViewId;
  /** Ce que désignent les colonnes, pour les mots de « Déplacer vers… ». */
  moveTarget?: CardMoveTarget;
}

/**
 * Carte déplaçable (DESIGN §6.4 de co-kanban) : au pointeur, la fiche ENTIÈRE est la prise ; au
 * clavier, c'est sa poignée (cf. `splitDragListeners`).
 *
 * Mémoïsée : pendant un glisser, seules les colonnes touchées voient leur liste d'ids changer
 * de référence, les autres cartes ne se rendent pas.
 *
 * Un clic n'importe où sur la fiche ouvre la carte (sa route, `actionCardPath`) ; au clavier,
 * c'est le lien du titre, ou « Ouvrir la carte » dans le menu « ⋯ ».
 */
export const TaskCard = memo(function TaskCard({
  card,
  columnId,
  columns,
  getCard,
  getCardOrder,
  memberIndex,
  labelIndex,
  nowSeconds,
  dateZone = "utc",
  canEdit,
  onMove,
  inDoneColumn = false,
  canonical = false,
  onArchive,
  view = "kanban",
  moveTarget = "column",
}: TaskCardProps) {
  const { t } = useTranslation("modules/kanban");
  const [moveOpen, setMoveOpen] = useState(false);
  const itemRef = useRef<HTMLLIElement | null>(null);
  const navigate = useNavigate();
  const cardPath = actionCardPath(card._id, view);

  const dragData: CardDragData = useMemo(() => ({ type: "card", cardId: card._id, columnId }), [card._id, columnId]);

  const { attributes, listeners, setNodeRef: setSortableRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: cardSortableId(card._id),
    data: dragData,
    // Réellement désactivé, pas seulement masqué : sans cela, un lecteur pourrait encore saisir
    // la carte au clavier.
    disabled: !canEdit,
    attributes: { roleDescription: t("card.roleDescription") },
  });

  // `useCallback` : une ref neuve à chaque rendu détacherait puis rattacherait le nœud mesuré
  // par dnd-kit.
  const setNodeRef = useCallback(
    (node: HTMLLIElement | null) => {
      setSortableRef(node);
      itemRef.current = node;
    },
    [setSortableRef],
  );

  const style: CSSProperties = {
    // `Translate` et non `Transform` : une carte ne doit jamais être mise à l'échelle dans la
    // pile, seulement glissée. L'agrandissement est porté par l'aperçu du `DragOverlay`.
    transform: CSS.Translate.toString(transform),
    transition,
  };

  /*
   * CLIC = OUVRIR LA CARTE, depuis n'importe quel point de la fiche. Un `<Link>` enveloppant toute
   * la fiche était exclu : il aurait avalé les boutons (un bouton dans un lien n'est pas du HTML
   * valide) et imposé au lecteur d'écran un lien nommé par tout le contenu de la carte.
   */
  function handleClick(event: MouseEvent<HTMLElement>) {
    const { target, currentTarget } = event;
    if (!(target instanceof Element)) return;
    // L'enfant a déjà son action (lien du titre, boutons). La poignée fait exception : au
    // pointeur, elle EST la fiche.
    const interactive = target.closest(INTERACTIVE_CHILD);
    if (interactive !== null && interactive !== currentTarget && !interactive.hasAttribute("data-card-handle")) return;
    // Entrée ou Espace sur la poignée émet un clic SYNTHÉTIQUE (`detail === 0`) en plus de la
    // saisie de dnd-kit : il ne doit pas ouvrir une carte en cours de déplacement.
    if (event.detail === 0) return;
    void navigate(cardPath);
  }

  const archive = inDoneColumn && onArchive ? <ArchiveCardButton card={card} onArchive={onArchive} /> : null;

  /*
   * Le menu « ⋯ » porte « Déplacer vers… », l'ALTERNATIVE CLAVIER au glisser. Discret au repos,
   * révélé au survol de la carte, dès qu'il reçoit le focus ou s'ouvre, et toujours visible sur
   * écran tactile (`hover: none`), où il n'y a pas de survol. Il reste dans l'ordre de
   * tabulation dans tous les cas.
   */
  const menu = canEdit ? (
    <ActionMenu
      label={t("card.menu.label", { title: card.title })}
      triggerSize="sm"
      className={cn(
        "opacity-0 transition-opacity duration-[var(--ck-duration-out)] ease-in",
        "group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
      )}
      sections={[
        {
          key: "card",
          items: [
            { key: "open", icon: SquarePen, label: t("card.openAction"), onSelect: () => void navigate(cardPath) },
            { key: "move", icon: Move, label: t("card.moveAction", { title: card.title }), onSelect: () => setMoveOpen(true) },
          ],
        },
      ]}
    />
  ) : null;

  const { pointer: surfaceListeners, keyboard: handleListeners } = splitDragListeners(listeners);

  return (
    /*
     * Le `<li>` reste un vrai élément de liste : c'est lui que dnd-kit mesure et translate, mais
     * c'est la POIGNÉE de la fiche qui porte `role="button"`.
     */
    <li ref={setNodeRef} style={style} className={cn("list-none", isDragging && "opacity-40")}>
      <CardPreview
        card={card}
        memberIndex={memberIndex}
        labelIndex={labelIndex}
        nowSeconds={nowSeconds}
        dateZone={dateZone}
        inDoneColumn={inDoneColumn}
        to={cardPath}
        draggable={canEdit}
        actions={
          archive || menu ? (
            <>
              {archive}
              {menu}
            </>
          ) : undefined
        }
        /*
         * Conditionnées EN PLUS de `disabled` : un sortable désactivé rend quand même
         * `role="button"`, `tabIndex` et `aria-roledescription`. La poignée est l'ACTIVATEUR :
         * c'est à elle que dnd-kit rend le focus après un dépôt au clavier.
         */
        surfaceListeners={canEdit ? surfaceListeners : undefined}
        handleRef={canEdit ? setActivatorNodeRef : undefined}
        handleAttributes={canEdit ? attributes : undefined}
        handleListeners={canEdit ? handleListeners : undefined}
        onClick={handleClick}
        className={
          canEdit
            ? /*
               * La fiche entière s'attrape ; `touch-manipulation` retire le délai du double-tap
               * sans bloquer le défilement du doigt (le tactile passe par un appui long, cf. les
               * capteurs de `KanbanBoard`). Ni sélection ni « callout » : l'appui long est aussi
               * leur geste, et le navigateur le prenait à la carte.
               */
              "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] active:cursor-grabbing"
            : "cursor-pointer"
        }
      />

      {/* Monté seulement à l'ouverture : l'état repart de la position courante de la carte, et
          aucune boîte ne dort sous chaque carte. */}
      {moveOpen ? (
        // `fallback={null}` : la boîte est un sur-écran, rien à montrer le temps du chargement.
        <Suspense fallback={null}>
          <CardMoveDialog
          card={card}
          currentColumnId={columnId}
          columns={columns}
          getCard={getCard}
          cardOrder={getCardOrder()}
          canonical={canonical}
          moveTarget={moveTarget}
          onClose={() => setMoveOpen(false)}
          onMove={onMove}
          // La boîte s'ouvre depuis un item de menu, déjà retiré à la fermeture : Radix rendrait
          // le focus à `<body>`. Il revient au menu de la carte ; si la carte a changé de
          // colonne, c'est le tableau qui le pose sur elle à son arrivée (`KanbanBoard`).
          returnFocus={() => itemRef.current?.querySelector<HTMLElement>('button[aria-haspopup="menu"]') ?? null}
          />
        </Suspense>
      ) : null}
    </li>
  );
});

/**
 * Archiver depuis la colonne de fin, avec confirmation : la carte quitte le tableau (l'action
 * Communecter passe en `disabled`), et aucun écran ne la restaure. Un appui malheureux ne doit
 * pas suffire.
 */
function ArchiveCardButton({ card, onArchive }: { card: Card; onArchive: (cardId: string) => void }) {
  const { t } = useTranslation("modules/kanban");
  const [open, setOpen] = useState(false);
  const label = t("card.archiveLabel", { title: card.title });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} className="text-muted-foreground pointer-coarse:size-11">
          <Archive aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={label} className="w-64">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{t("card.confirmArchive")}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                // Le popover rend d'abord le focus à son bouton ; la carte part ensuite
                // (optimiste), et la colonne pose le focus sur la voisine (`KanbanColumn`).
                setOpen(false);
                onArchive(card._id);
              }}
            >
              <Archive aria-hidden />
              {t("card.confirmArchiveAction")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
