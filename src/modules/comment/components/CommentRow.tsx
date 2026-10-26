import { useId, type CSSProperties, type ReactNode } from "react";
import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CollapsibleMessage } from "./CollapsibleMessage";
import { CommentImages } from "./CommentImages";
import { CommentMarkdown } from "./CommentMarkdown";
import { ContextQuote } from "./ContextQuote";
import { MessageActions } from "./MessageActions";
import { ReactionPills } from "./ReactionPills";
import { initialesDe } from "../lib/initiales";
import { messageAnchorId } from "../lib/filKey";
import { branchAuthors, lastActivityAt } from "../lib/commentTree";
import { daySeparatorLabel, formatFullWhen, formatTimeOfDay, freshnessOf } from "../lib/formatWhen";
import type { ThreadRow } from "../lib/flattenThread";
import type { CommentPermissions } from "../permissions";

export type MessageRow = Extract<ThreadRow, { kind: "message" }>;

export interface CommentRowProps {
  readonly row: MessageRow;
  readonly meId: string | null;
  readonly permissions: CommentPermissions;
  readonly onReply?: () => void;
  readonly onEdit?: () => void;
  readonly onDelete?: () => void;
  readonly onReport?: () => void;
  readonly onCopyLink?: () => void;
  /** Le menu a fini de se fermer sur un « Modifier » : le champ peut enfin prendre le curseur. */
  readonly onEditFieldReady?: () => void;
  readonly onToggleReaction?: (reaction: string) => void;
  readonly onShowVoters?: () => void;
  /** Les réponses de ce message sont-elles repliées ? */
  readonly collapsed?: boolean;
  readonly onToggleCollapse?: () => void;
  /** Nombre total de messages dans la branche, réponses de réponses comprises. */
  readonly replyCount?: number;
  /** Remonte au message cité quand celui-ci dépasse le retrait maximal. */
  readonly onJumpToParent?: (id: string) => void;
  /**
   * Ce message est-il celui qui porte le focus du fil ?
   *
   * **Premier niveau du roving tabindex** : un seul message est dans l'ordre de tabulation, et
   * les flèches déplacent ce privilège. Les contrôles du message actif sont à 0 ; ceux de tous
   * les autres à −1, sinon un fil de douze messages ferait trente-six arrêts avant le champ
   * de saisie. Aucun contrôle n'est pour autant retiré du DOM : ils restent lisibles, et
   * atteignables dès que le message devient actif.
   */
  readonly active?: boolean;
  /** Le focus est arrivé sur ce message — le fil y déplace son roving tabindex. */
  readonly onFocusRow?: () => void;
  /**
   * Identifiant de l'aide au parcours clavier, posé sur la LIGNE et non sur le conteneur du
   * fil : une description accessible n'est restituée qu'à la prise de focus, et le conteneur
   * `role="log"` n'en prend jamais.
   */
  readonly describedBy?: string;
  /** Remplace le corps du message — c'est là que se monte le composer d'édition (J5). */
  readonly children?: ReactNode;
}

/**
 * Une ligne du fil : la grammaire visuelle du module.
 *
 * Densité de liste **sans bulles** : gouttière d'avatar fixe, messages consécutifs d'un même
 * auteur fondus en un bloc, barre d'actions flottante, pastilles de réaction. C'est l'inverse
 * du rendu en bulles grises de l'implémentation `news`, explicitement écarté.
 *
 * **Tous les états passent par des attributs `data-*` posés ici**, et par eux seuls. Le style
 * les lit (classes Tailwind `data-[…]` et `styles.css`), les tests les asservissent : il n'y a
 * qu'un point de vérité par état, au lieu d'un booléen recalculé dans chaque sous-composant.
 */
export function CommentRow({
  row,
  meId,
  permissions,
  onReply,
  onEdit,
  onDelete,
  onReport,
  onCopyLink,
  onEditFieldReady,
  onToggleReaction,
  onShowVoters,
  collapsed = false,
  onToggleCollapse,
  replyCount = 0,
  onJumpToParent,
  active = true,
  onFocusRow,
  describedBy,
  children,
}: CommentRowProps) {
  const t = useT("modules/comment");
  const { currentLocale } = useLocalization();
  const { node, grouped, depth, contextParent, dayShift } = row;

  const own = Boolean(meId) && node.author.id === meId;
  const mentioned = Boolean(meId) && node.mentions.some(m => m.id === meId);
  const when = { locale: currentLocale };
  const fullWhen = formatFullWhen(node.createdAt, when);
  // Le nom accessible de la ligne = « Message de X, quand » PUIS le texte. Un `aria-label`
  // remplaçait tout le contenu : le lecteur d'écran annonçait l'auteur et l'heure, jamais ce
  // qui était écrit (revue du 29/09).
  const idLibelle = useId();
  const idTexte = useId();

  /**
   * L'heure seule, ou la date ET l'heure quand aucun séparateur de jour ne précède la ligne.
   *
   * Le cas est celui d'une réponse écrite un autre jour que la racine qui la porte : elle reste
   * sous son parent, donc sous le séparateur du parent. « 11:08 » s'y lirait comme l'heure du
   * jour affiché plus haut. On répète donc le jour — le même libellé que le séparateur, pour
   * que les deux repères ne puissent pas diverger.
   */
  const jour = dayShift ? daySeparatorLabel(node.createdAt, when) : null;
  const heure = formatTimeOfDay(node.createdAt, when);
  const quand = jour === null
    ? heure
    : String(t("dates.at", undefined, {
      date: jour.key ? String(t(`dates.${jour.key}`)) : jour.text,
      time: heure,
    }));
  const authorName = node.author.name || String(t("thread.deleted"));
  // La liste des votants n'a de sens que s'il y a eu des réactions : sans cela, l'entrée de
  // menu ouvrirait un dialogue vide.
  const hasReactions = Object.keys(node.reactions).length > 0;

  const ouvert = replyCount > 0 && !collapsed;
  /**
   * Ce qu'une branche REPLIÉE dit d'elle-même : qui a répondu, et quand pour la dernière fois.
   * Rien de tout cela quand elle est ouverte — les réponses sont là, sous les yeux.
   */
  const repondants = collapsed && replyCount > 0 ? branchAuthors(node.replies) : [];
  const fraicheur = collapsed && replyCount > 0 ? freshnessOf(lastActivityAt(node.replies), when) : null;
  const derniere = fraicheur === null ? null
    : fraicheur.key === "onDate"
      ? String(t("dates.onDate", undefined, { date: fraicheur.date }))
      : String(t(`dates.${fraicheur.key}`, undefined, { time: fraicheur.time }));
  /** Un seul nombre pour tous les contrôles de la ligne — un seul point de vérité, comme pour les états. */
  const tab = active ? 0 : -1;

  return (
    <article
      id={messageAnchorId(node.id)}
      className={cn(
        // Marges, écart et retrait vivent dans `styles.css` : ils se règlent sur la largeur DU
        // FIL (container query), là où `px-2 sm:px-3` regardait l'écran.
        "comment-row group relative flex",
        // Anneau INTERNE : sur une ligne pleine largeur, un anneau externe déborderait sous
        // la ligne voisine. Même idiome que les cellules de `SimpleTableField`.
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
        // AUCUN fond d'état ici : survol, mention non lue, échec et surbrillance se peignent sur
        // la marque (`.comment-mark`, `styles.css`), qui part de la colonne du message. Posés
        // sur la ligne, ils partaient du BORD du fil et repeignaient les traits de l'arbre
        // (arbitré le 28/09, maquette `maquette-bandeau.html`).
        "data-[pending=true]:opacity-60",
      )}
      style={{ "--comment-depth": depth } as CSSProperties}
      tabIndex={tab}
      onFocus={onFocusRow}
      aria-describedby={describedBy}
      data-comment-row=""
      data-active={active}
      data-comment-id={node.id}
      data-depth={depth}
      data-real-depth={row.realDepth}
      data-grouped={grouped}
      /* Le parent dont les réponses sont ouvertes prolonge son trait jusqu'à elles. */
      data-open={ouvert ? "" : undefined}
      data-own={own}
      data-unread={node.unread}
      data-mentioned={mentioned}
      data-pending={node.pending === true}
      data-failed={node.failed === true}
      aria-labelledby={children ? idLibelle : `${idLibelle} ${idTexte}`}
    >
      {/* Le fond d'état, DERRIÈRE le contenu : la ligne s'isole (`isolation: isolate`), la
          marque s'y pose en `z-index: -1`. */}
      <span className="comment-mark" data-comment-mark="" aria-hidden />
      <span id={idLibelle} className="sr-only">
        {String(t("a11y.message", undefined, { author: authorName, when: fullWhen }))}
      </span>

      {/* Gouttière : l'avatar en tête de bloc, l'heure seule sur les lignes groupées. */}
      <div className="relative w-(--comment-gutter) shrink-0 pt-1">
        {grouped ? (
          <>
            <time
              className="comment-groupline-time block text-end text-[10px] leading-5 text-muted-foreground tabular-nums"
              dateTime={new Date(node.createdAt * 1000).toISOString()}
            >
              {heure}
            </time>
            {/* Une ligne groupée n'a pas d'en-tête : son « nouveau » est un point dans la
                gouttière, là où l'heure apparaît au survol — et il lui cède la place. */}
            {node.unread ? (
              <span className="comment-new comment-new-gutter" data-comment-new="">
                <span className="comment-new-label">{String(t("thread.newBadge"))}</span>
              </span>
            ) : null}
          </>
        ) : (
          // Centré dans une gouttière de largeur FIXE : c'est ce qui aligne les traits d'un
          // niveau à l'autre, quelle que soit la taille de l'avatar (dégressive, `styles.css`).
          <Avatar className="comment-avatar mx-auto bg-card">
            {node.author.avatarUrl ? (
              <AvatarImage src={node.author.avatarUrl} alt="" className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
              {initialesDe(authorName, 1)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="min-w-0 grow pb-1">
        {contextParent ? (
          <ContextQuote
            author={contextParent.author}
            excerpt={contextParent.excerpt}
            tabIndex={tab}
            onJump={onJumpToParent ? () => onJumpToParent(contextParent.id) : undefined}
          />
        ) : null}

        {!grouped ? (
          // `comment-header` est un conteneur : sous une certaine largeur, le mot « nouveau »
          // s'efface et seul le point reste (`styles.css`). Ordre de sacrifice, arbitré le 28/09 :
          // le mot d'abord, puis le nom, tronqué — jamais le point ni l'heure.
          <header className="comment-header flex min-w-0 items-baseline gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-foreground" title={authorName}>
              {authorName}
            </span>
            <time
              className="shrink-0 text-[11px] text-muted-foreground"
              dateTime={new Date(node.createdAt * 1000).toISOString()}
              title={fullWhen}
              data-day-shift={dayShift ? "" : undefined}
            >
              {quand}
            </time>
            {/* Le non-lu se lit à l'heure, sans fond : le fond est réservé à la mention. */}
            {node.unread ? (
              <span className="comment-new" data-comment-new="">
                <span className="comment-new-label">{String(t("thread.newBadge"))}</span>
              </span>
            ) : null}
          </header>
        ) : null}

        {children ?? (
          // Un récapitulatif de comité ne doit pas noyer le fil : au-delà d'une dizaine de
          // lignes, le message se replie — sans jamais sortir son texte du DOM.
          <CollapsibleMessage disabled={node.pending === true}>
            {/* Aucune marque « modifié » : le backend ne trace pas l'édition d'un message
                (mesuré — voir B10), et `updated` marque en réalité une RÉACTION. Afficher la
                marque sur cette base la posait sur des messages jamais modifiés. */}
            <div id={idTexte}>
              <CommentMarkdown text={node.text} mentions={node.mentions} meId={meId} />
            </div>
          </CollapsibleMessage>
        )}

        {/* Les images vivent SOUS le texte, hors du repli : un message replié doit rester
            reconnaissable, et une pièce jointe est justement ce qui le distingue. En édition
            (`children`), elles sont masquées — ce lot ne modifie pas les images d'un message
            déjà publié. */}
        {!children && node.images.length > 0 ? <CommentImages images={node.images} /> : null}

        {node.failed ? (
          <p className="flex items-center gap-1 pt-0.5 text-xs text-destructive">
            <AlertCircle className="size-3.5" aria-hidden />
            {t("thread.sendFailed")}
          </p>
        ) : null}

        {/* UNE ligne de service : réactions, actions, repli. Le repli et les pastilles vivaient
            sur deux lignes distinctes, sous chaque message qui en avait — c'est ce qui hachait
            le fil (mesuré : 5 messages sur 11 portaient l'un, 5 l'autre). */}
        <div className="comment-service" data-comment-service="">
          <ReactionPills
            reactions={node.reactions}
            myReaction={node.myReaction}
            canReact={permissions.canReact && !node.pending}
            tabIndex={tab}
            onToggle={onToggleReaction}
            onShowVoters={onShowVoters}
          />

          {/* Un message en cours d'envoi n'offre aucune action : il n'existe pas encore côté
              serveur. À la souris, la barre flotte en haut à droite de la ligne ; au doigt, elle
              reste ici, dans le flux (`styles.css`). */}
          {node.pending ? null : (
            <MessageActions
              canReply={permissions.canReply}
              canReact={permissions.canReact}
              canReport={permissions.canReport && !own}
              canEdit={own}
              canDelete={own || permissions.canModerate}
              tabIndex={tab}
              onEditFieldReady={onEditFieldReady}
              onReply={onReply}
              currentReaction={node.myReaction}
              onPickReaction={onToggleReaction}
              onShowVoters={hasReactions ? onShowVoters : undefined}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
              onCopyLink={onCopyLink}
            />
          )}

          {/* Le même libellé ouvert ou fermé — seul le chevron change. Fermé, il dit QUI a
              répondu et QUAND, pour qu'on sache s'il vaut la peine de déplier. */}
          {replyCount > 0 && onToggleCollapse ? (
            <button
              type="button"
              data-comment-collapse=""
              aria-expanded={!collapsed}
              tabIndex={tab}
              onClick={onToggleCollapse}
              className="comment-collapse text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring
                         inline-flex min-h-6 items-center gap-1.5 rounded-md px-1.5 text-xs
                         focus-visible:ring-2 focus-visible:outline-none"
            >
              {collapsed
                ? <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                : <ChevronDown className="size-3.5 shrink-0" aria-hidden />}
              {repondants.length > 0 ? (
                <span className="flex" aria-hidden>
                  {repondants.map(auteur => (
                    <Avatar key={auteur.id} className="border-background bg-card -ms-1.5 size-[18px] border-2 first:ms-0">
                      {auteur.avatarUrl ? <AvatarImage src={auteur.avatarUrl} alt="" className="object-cover" /> : null}
                      <AvatarFallback className="bg-muted text-muted-foreground text-[9px] font-semibold">
                        {initialesDe(auteur.name, 1)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </span>
              ) : null}
              <span className="text-foreground font-semibold whitespace-nowrap">
                {String(t("thread.replyCount", undefined, { count: replyCount }))}
              </span>
              {derniere ? (
                <span className="whitespace-nowrap">· {String(t("thread.lastReply", undefined, { when: derniere }))}</span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
