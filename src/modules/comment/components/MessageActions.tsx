import { useRef, useState } from "react";
import { Flag, Link2, MoreHorizontal, Pencil, Reply, SmilePlus, Trash2, Users } from "lucide-react";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReactionPicker } from "./ReactionPicker";

export interface MessageActionsProps {
  readonly canReply: boolean;
  readonly canReact: boolean;
  readonly canReport: boolean;
  /** Modifier et supprimer son propre message, ou modérer celui d'autrui. */
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly onReply?: () => void;
  /** La réaction déjà posée, pour que le sélecteur la marque. */
  readonly currentReaction?: string | null;
  readonly onPickReaction?: (reaction: string) => void;
  /**
   * Ouvre la liste des votants. Proposé dans le MENU, et pas seulement au clic droit sur une
   * pastille : un clic droit n'est ni découvrable ni atteignable au clavier.
   */
  readonly onShowVoters?: () => void;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
  readonly onReport?: () => void;
  readonly onCopyLink?: () => void;
  /**
   * Appelé quand le menu a FINI de se fermer après un « Modifier ».
   *
   * C'est le seul moment où l'on peut mettre le curseur dans le champ d'édition : tant que le
   * menu joue son animation de sortie, son `FocusScope` est encore piégé et **reprend** tout
   * focus posé au-dehors. Mesuré : le champ s'ouvrait, le focus lui était donné, le piège le
   * ramenait dans le menu, puis le menu disparaissait en laissant `<body>` focalisé.
   */
  readonly onEditFieldReady?: () => void;
  /**
   * Position de la barre dans l'ordre de tabulation — **0 sur le seul message actif**, −1
   * partout ailleurs. C'est le second niveau du roving tabindex : sans lui, un fil de douze
   * messages imposerait trente-six arrêts de tabulation avant d'atteindre le champ de saisie.
   */
  readonly tabIndex?: number;
}

/**
 * Les actions d'un message — UNE seule instance, deux présentations, choisies par le CSS.
 *
 * - **À la souris**, c'est la barre flottante de Discord : posée en haut à droite de la ligne,
 *   masquée par l'**opacité** et jamais par `display:none` — un `hidden` la sortirait de l'ordre
 *   de tabulation. Elle réapparaît au survol comme au `focus-within`.
 * - **Au doigt** (`(hover: none), (pointer: coarse)`), elle rentre DANS la ligne de service du
 *   message, visible en permanence, « Répondre » en toutes lettres (arbitré le 28/09). Elle
 *   flottait auparavant là aussi, une par message, par-dessus le texte : mesuré, 11 barres sur
 *   11 affichées d'un coup sur téléphone, qui recouvraient les citations.
 *
 * Une seule instance, et non deux rendues puis masquées tour à tour : deux boutons « Répondre »
 * dans le DOM, ce sont deux boutons pour un lecteur d'écran — et deux déclencheurs de menu.
 * C'est pour cela que le positionnement vit dans `styles.css`, sous media query, et plus dans
 * les classes : la même boîte se place autrement selon le pointeur.
 */
export function MessageActions({
  canReply,
  canReact,
  canReport,
  canEdit,
  canDelete,
  onReply,
  currentReaction = null,
  onPickReaction,
  onShowVoters,
  onEdit,
  onDelete,
  onReport,
  onCopyLink,
  onEditFieldReady,
  tabIndex = 0,
}: MessageActionsProps) {
  const t = useT("modules/comment");
  const [pickerOpen, setPickerOpen] = useState(false);
/**
   * « Modifier » ouvre un champ DANS la ligne. À la fermeture, Radix rend le focus à son
   * déclencheur (`onCloseAutoFocus` → `triggerRef.focus()`) : le curseur repartait donc sur
   * « … », et revenir au champ demandait plusieurs Maj+Tab.
   *
   * `composeEventHandlers` de Radix saute son propre gestionnaire si le nôtre a appelé
   * `preventDefault()` : c'est le seul point où l'on peut refuser cette restitution — et, dans
   * la foulée, désigner nous-mêmes le champ, puisque le menu est alors vraiment parti.
   */
  const versLeChamp = useRef(false);
  const hasMenu = canEdit || canDelete || canReport || Boolean(onCopyLink) || Boolean(onShowVoters);
  if (!canReply && !canReact && !hasMenu) return null;

  return (
    <div
      className="comment-actions flex items-center gap-0.5"
      data-comment-actions=""
      role="group"
      aria-label={String(t("a11y.messageActions"))}
    >
      {canReact ? (
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              data-action="react"
              tabIndex={tabIndex}
              aria-label={String(t("actions.react"))}
            >
              <SmilePlus className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <ReactionPicker
              current={currentReaction}
              onPick={reaction => {
                onPickReaction?.(reaction);
                setPickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      {canReply ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-full"
          data-action="reply"
          tabIndex={tabIndex}
          aria-label={String(t("actions.reply"))}
          onClick={onReply}
        >
          <Reply className="size-4" />
          {/* Le libellé n'est montré qu'au doigt (`styles.css`) ; à la souris, l'icône et
              l'infobulle suffisent, et la barre flottante doit rester compacte. */}
          <span className="comment-action-label" aria-hidden>{t("actions.reply")}</span>
        </Button>
      ) : null}

      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full"
              data-action="more"
              tabIndex={tabIndex}
              aria-label={String(t("actions.more"))}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onCloseAutoFocus={event => {
              if (!versLeChamp.current) return;
              versLeChamp.current = false;
              event.preventDefault();
              onEditFieldReady?.();
            }}
          >
            {onCopyLink ? (
              <DropdownMenuItem onClick={onCopyLink}>
                <Link2 />
                <span>{t("actions.copyLink")}</span>
              </DropdownMenuItem>
            ) : null}
            {onShowVoters ? (
              <DropdownMenuItem onClick={onShowVoters}>
                <Users />
                <span>{t("actions.showVoters")}</span>
              </DropdownMenuItem>
            ) : null}
            {canEdit ? (
              <DropdownMenuItem onClick={() => { versLeChamp.current = true; onEdit?.(); }}>
                <Pencil />
                <span>{t("actions.edit")}</span>
              </DropdownMenuItem>
            ) : null}
            {canReport ? (
              <DropdownMenuItem onClick={onReport}>
                <Flag />
                <span>{t("actions.report")}</span>
              </DropdownMenuItem>
            ) : null}
            {canDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 />
                  <span>{t("actions.delete")}</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
