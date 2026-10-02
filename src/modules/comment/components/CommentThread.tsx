import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, MessageSquareX } from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CommentComposer } from "./CommentComposer";
import { LoginToParticipate } from "./LoginToParticipate";
import { useCommentImages } from "../hooks/useCommentImages";
import { CommentRow } from "./CommentRow";
import { ReportCommentDialog } from "./ReportCommentDialog";
import { VotersDialog } from "./VotersDialog";
import { DateSeparator, UnreadSeparator } from "./ThreadSeparators";
import { useCommentsQuery } from "../hooks/useCommentsQuery";
import { useCommentMutations } from "../hooks/useCommentMutations";
import { useCommentPermissions } from "../hooks/useCommentPermissions";
import { useMarkThreadSeen } from "../hooks/useMarkThreadSeen";
import { flattenThread, shouldStayExpanded } from "../lib/flattenThread";
import { ancestorsOf, countNodes, findNode, unreadIds, withUnread } from "../lib/commentTree";
import { messageAnchorId, parseMessageFragment } from "../lib/filKey";
import { TargetNotFoundError } from "../lib/targetNotFound";
import { AUTO_COLLAPSE_MIN_REPLIES } from "../constants/display";
import type { CommentMention, CommentNode, CommentTarget } from "../types";
import "../styles.css";

export interface CommentThreadProps {
  /** L'entité porteuse, quand la page l'a déjà chargée — cas nominal. */
  readonly entity?: EntityTypes | null;
  /** La cible, quand on n'a qu'un couple (type, id) — cas du lien profond. */
  readonly target?: CommentTarget | null;
  /**
   * L'entité de CONTEXTE, quand elle diffère de la cible : la recherche de personnes à mentionner
   * s'y rapporte. Cas réel : le fil d'une **actualité** est porté par la news, mais on y mentionne
   * d'abord les gens de l'organisation qui l'héberge. Par défaut, la cible fait office de contexte.
   * Les droits, eux, ne dépendent d'aucune entité (`permissions/register.ts`).
   */
  readonly scopeEntity?: EntityTypes | null;
  /** `false` ferme le fil aux contributions sans le masquer. */
  readonly enabled?: boolean;
  /**
   * Variation du nombre de messages, pour que l'hôte tienne son propre compteur.
   * C'est ce qui remplace le couplage de l'ancienne implémentation, qui allait muter
   * directement le cache des actualités.
   */
  readonly onCountChange?: (delta: number) => void;
  readonly className?: string;
}

/**
 * Le fil de discussion, quelle que soit l'entité qui le porte.
 *
 * Il assemble trois pièces déjà éprouvées séparément : la requête générique, les mutations
 * au rollback immuable, et `flattenThread` — qui porte toute la grammaire (groupement,
 * séparateurs de jour, frontière des non-lus, retrait borné) dans une fonction **pure**.
 * Le composant ne décide donc d'aucune de ces règles : il les rend.
 */
export function CommentThread({
  entity = null,
  target = null,
  scopeEntity,
  enabled = true,
  onCountChange,
  className,
}: CommentThreadProps) {
  const t = useT("modules/comment");
  const { me } = useCocolight();
  const meId = (me as unknown as { id?: string } | null)?.id ?? null;

  const query = useCommentsQuery({ entity, target });
  /**
   * L'entité porteuse : celle que la page nous donne, sinon celle que la requête a résolue.
   *
   * Ce repli n'est pas cosmétique. Ouvert depuis le PANNEAU, un fil ne reçoit qu'une cible :
   * sans lui, poster un message racine lève « l'entité porteuse du fil n'est pas chargée », et
   * la recherche de mentions n'a plus de périmètre. Défaut vu au navigateur, invisible pour les
   * tests comme pour les gates.
   */
  const host = entity ?? query.host;
  const scope = scopeEntity ?? host;
  const permissions = useCommentPermissions(scope, enabled);
  /**
   * Le brouillon d'un envoi REFUSÉ, rendu au composer : l'ajout est annulé (le message quitte le
   * fil), mais le texte et ses mentions reviennent dans le champ, et le bandeau « réponse à »
   * avec eux. `version` remonte le composer sur ce brouillon.
   */
  const [brouillon, setBrouillon] = useState<{
    readonly texte: string; readonly mentions: readonly CommentMention[]; readonly version: number;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string } | null>(null);
  const mutations = useCommentMutations({
    target: query.target,
    entity: host,
    index: query.index,
    onCountChange,
    onSendFailed: draft => {
      setBrouillon(precedent => ({ texte: draft.text, mentions: draft.mentions, version: (precedent?.version ?? 0) + 1 }));
      const parent = draft.parentId ? findNode(query.nodes, draft.parentId) : null;
      if (parent) setReplyingTo({ id: parent.id, author: parent.author.name });
    },
  });
  /**
   * Un fil AFFICHÉ est un fil lu, où qu'il soit monté — et seulement ce qui a été affiché.
   *
   * - **Où qu'il soit monté** : le marquage vivait dans le panneau seul ; sous une actualité, rien
   *   n'écrivait jamais `views.<moi>`, et le non-lu comme le fond de mention y restaient.
   * - **Après le chargement** : parti à l'ouverture, il devançait la lecture des messages, le
   *   serveur les marquait lus AVANT de les renvoyer, et ni le point « nouveau » ni le fond de
   *   mention n'apparaissaient jamais (vu au navigateur le 28/09). Il attend donc des messages
   *   frais — chargés, et aucune relecture en cours.
   * - **D'après l'arbre affiché**, pas le compteur du panneau : celui-ci compte aussi un message
   *   arrivé depuis, que le fil n'a pas encore montré — on l'aurait marqué lu sans qu'il soit vu.
   *
   * Le fil n'est pas relu après coup : les repères restent pendant la lecture, et disparaissent
   * à la visite suivante (`useMarkThreadSeen`).
   */
  const affiche = query.isSuccess && !query.isFetching;
  // La vérité du SERVEUR (`query.nodes`), jamais les repères figés de la visite : c'est elle qui
  // dit ce qui reste à marquer.
  const idsNonLus = useMemo(() => unreadIds(query.nodes), [query.nodes]);
  useMarkThreadSeen(affiche ? query.target : null, idsNonLus);
  /**
   * Les non-lus de la VISITE, figés (revue du 29/09). Le marquage part dès l'affichage, et la
   * relecture suivante — réponse postée, retour sur l'onglet, temps réel — rendait tout « lu » :
   * repère « nouveau », fond de mention et repli d'office (qui garde ouverte une branche portant du
   * nouveau) changeaient sous les yeux de qui lisait, jusqu'à refermer la branche sur la réponse
   * qu'on venait d'écrire. Chaque lecture y verse ses non-lus ; ils ne s'éteignent qu'à la visite
   * suivante — ce que `useMarkThreadSeen` promettait sans le tenir.
   */
  const [nonLusDeLaVisite, setNonLusDeLaVisite] = useState<ReadonlySet<string>>(() => new Set());
  if (idsNonLus.some(id => !nonLusDeLaVisite.has(id))) {
    setNonLusDeLaVisite(precedent => new Set([...precedent, ...idsNonLus]));
  }
  const noeuds = useMemo(() => withUnread(query.nodes, nonLusDeLaVisite), [query.nodes, nonLusDeLaVisite]);
  // Les pièces jointes du message en cours d'écriture. Hors du composer à dessein : celui-ci
  // sera remplacé par un vrai éditeur (B11), pas cette mécanique-là.
  const jointes = useCommentImages();

  const [pendingDelete, setPendingDelete] = useState<CommentNode | null>(null);
  const [reporting, setReporting] = useState<CommentNode | null>(null);
  const [showingVoters, setShowingVoters] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Un seul composer, en bas, avec un bandeau « réponse à » — la disposition de Discord.
  // Ouvrir un champ sous chaque message ferait bouger tout le fil à chaque clic. (`replyingTo`
  // est déclaré plus haut : le brouillon d'un envoi refusé le rétablit.)
  // Décisions EXPLICITES de repli, par message. Elles priment sur le repli automatique et
  // survivent aux relectures du fil : sans cette séparation, chaque rafraîchissement refermerait
  // sous les doigts une branche qu'on vient d'ouvrir.
  const [collapseOverrides, setCollapseOverrides] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  /**
   * Le message qui porte le focus du fil. **Une intention, pas une vérité** : le message
   * désigné peut disparaître (suppression, branche repliée, relecture du fil), et c'est
   * `rovingId` qui tranche au rendu. Poser la correction dans un effet rouvrirait le défaut
   * du J7 — un état recalculé après coup, qui efface ce que l'utilisateur vient de faire.
   */
  const [activeId, setActiveId] = useState<string | null>(null);
  const hintId = useId();

  /**
   * Le message désigné par le LIEN ouvert (`#m-<id>`, « Copier le lien »). Le fragment n'était
   * jamais lu : le lien n'amenait qu'au fil (revue du 29/09). Lu APRÈS hydratation — le serveur ne
   * le voit jamais —, une fois par fil monté.
   */
  const [cibleDuLien, setCibleDuLien] = useState<string | null>(null);
  const [lienDeplie, setLienDeplie] = useState<string | null>(null);
  useEffect(() => {
    const id = parseMessageFragment(window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du fragment après hydratation : le rendu serveur ne le connaît pas
    if (id) setCibleDuLien(id);
  }, []);
  // Sa lignée se DÉPLIE, une fois, par des décisions de repli ordinaires : l'utilisateur peut
  // ensuite la replier comme n'importe quelle branche.
  if (cibleDuLien && cibleDuLien !== lienDeplie && findNode(noeuds, cibleDuLien)) {
    setLienDeplie(cibleDuLien);
    setCollapseOverrides(previous => {
      const ouvertes = new Map(previous);
      for (const ancetre of ancestorsOf(noeuds, cibleDuLien)) ouvertes.set(ancetre.id, false);
      return ouvertes;
    });
  }

  /**
   * Repli d'office : une branche de PLUS de cinq réponses, toutes lues — et aucune autre.
   *
   * Il se fondait sur la profondeur, et masquait ainsi la réponse qu'on venait d'écrire : son
   * propre message n'étant jamais « non lu », rien ne retenait la branche ouverte. Le nombre est
   * le bon critère — une branche courte n'encombre rien — et `shouldStayExpanded` garde ouverte
   * toute branche qui porte un non-lu (une mention pas encore vue en est un). Arbitré le 28/09.
   */
  const autoCollapsed = useMemo(() => {
    const ids = new Set<string>();
    const walk = (nodes: readonly CommentNode[]) => {
      for (const node of nodes) {
        if (countNodes(node.replies) > AUTO_COLLAPSE_MIN_REPLIES && !shouldStayExpanded(node)) {
          ids.add(node.id);
        }
        walk(node.replies);
      }
    };
    walk(noeuds);
    return ids;
  }, [noeuds]);

  const collapsed = useMemo(() => {
    const ids = new Set(autoCollapsed);
    for (const [id, isCollapsed] of collapseOverrides) {
      if (isCollapsed) ids.add(id);
      else ids.delete(id);
    }
    return ids;
  }, [autoCollapsed, collapseOverrides]);

  const toggleCollapse = useCallback((id: string, isCollapsed: boolean) => {
    setCollapseOverrides(previous => new Map(previous).set(id, !isCollapsed));
  }, []);

  /**
   * La STRUCTURE est la même à toutes les largeurs : seuls le retrait, les avatars et les marges
   * se resserrent, et c'est le CSS qui s'en charge, sur la largeur du fil. La profondeur passait
   * par `useIsMobile` — la largeur de l'ÉCRAN, fausse dans une colonne étroite, et fausse au
   * premier rendu, où tout téléphone recevait la version bureau avant de basculer.
   */
  const rows = useMemo(() => flattenThread(noeuds, { collapsed }), [noeuds, collapsed]);

  /**
   * Défiler jusqu'au message qu'on vient d'envoyer — seulement s'il n'est pas déjà visible.
   *
   * Le composer est désormais fixé en bas du fil : on peut donc écrire en étant remonté loin
   * dans la discussion, et sans cela l'envoi n'aurait aucun effet visible. `block: "nearest"`
   * est ce qui ne bouge rien quand le message est déjà sous les yeux. On déplace la VUE, pas
   * le focus : le curseur reste dans le champ, pour enchaîner — comme dans Discord ou Slack.
   *
   * Un effet, et c'est le bon outil : c'est une action sur le DOM, pas un état qu'on recopie.
   *
   * L'envoi est reconnu par son TEXTE et son auteur, pas par son identifiant : à la
   * confirmation, le message provisoire prend celui du serveur
   * (`settleOptimistic`). Et c'est justement à ce moment qu'il faut recaler la vue une seconde
   * fois — un message en cours d'envoi n'a pas de ligne d'actions ; confirmé, il en gagne une,
   * qui repoussait son bas sous le bord de la liste (vu au navigateur, au doigt : + 36 px).
   */
  const envoiSuivi = useRef<string | null>(null);
  useLayoutEffect(() => {
    const texte = envoiSuivi.current;
    if (texte === null) return;
    let cible: { id: string; enCours: boolean } | null = null;
    // Le plus récent d'abord. Pas de `findLast` : la cible TS du dépôt ne l'a pas.
    for (let i = rows.length - 1; i >= 0 && cible === null; i--) {
      const row = rows[i];
      if (row?.kind !== "message" || row.node.text !== texte) continue;
      if (row.node.pending === true || row.node.author.id === meId) {
        cible = { id: row.node.id, enCours: row.node.pending === true };
      }
    }
    if (cible === null) return;
    // Confirmé (ou tombé en échec) : c'est le dernier recalage.
    if (!cible.enCours) envoiSuivi.current = null;
    const reduit = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(messageAnchorId(cible.id))
      ?.scrollIntoView?.({ block: "nearest", behavior: reduit ? "auto" : "smooth" });
  }, [rows, meId]);

  /** L'ordre de parcours au clavier : les messages affichés, séparateurs exclus. */
  const messageIds = useMemo(
    () => rows.flatMap(row => (row.kind === "message" ? [row.node.id] : [])),
    [rows],
  );

  /**
   * Le message réellement dans l'ordre de tabulation. Dérivé, jamais stocké : si celui
   * qu'on visait n'est plus affiché, le premier reprend le privilège — le fil n'est donc
   * jamais sans porte d'entrée au clavier.
   */
  const rovingId = (activeId && messageIds.includes(activeId) ? activeId : messageIds[0]) ?? null;

  /** La part DOM seule : focus et défilement. Le focus d'une ligne pose `activeId` (`onFocusRow`). */
  const montrerMessage = useCallback((id: string, defiler: "non" | "proche" | "centre") => {
    const element = document.getElementById(messageAnchorId(id));
    if (!element) return;
    // `preventScroll` : c'est le défilement choisi ci-dessous qui s'applique, pas celui du focus.
    element.focus({ preventScroll: true });
    if (defiler === "proche") element.scrollIntoView?.({ block: "nearest" });
    else if (defiler === "centre") {
      // Le saut est animé, sauf pour qui a demandé moins de mouvement — comme le suivi d'envoi.
      const reduit = typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView?.({ behavior: reduit ? "auto" : "smooth", block: "center" });
    }
  }, []);
  /**
   * Déplace le privilège de tabulation ET le focus réel — les deux vont ensemble — et la VUE si
   * on le demande : `proche` au clavier (le message entre tout juste dans la vue, sans
   * animation qui traînerait derrière une touche maintenue), `centre` pour un saut vers un
   * message cité. Les flèches posaient le focus SANS défiler : on parcourait des messages hors
   * de vue (revue du 29/09).
   */
  const focusMessage = useCallback((id: string, defiler: "non" | "proche" | "centre" = "non") => {
    setActiveId(id);
    montrerMessage(id, defiler);
  }, [montrerMessage]);

  /**
   * Flèches, Home et Fin entre les messages.
   *
   * ⚠️ **Seulement depuis un message lui-même.** Depuis un contrôle interne — le champ
   * d'édition au premier chef — les flèches gardent leur sens propre : détourner la flèche
   * haut dans un textarea rendrait l'édition impraticable.
   */
  const onThreadKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const row = event.target as HTMLElement;
    if (!row.hasAttribute("data-comment-row")) return;
    // Un modificateur enfoncé : on laisse passer. Maj+Flèche étend une SÉLECTION de texte —
    // dans un fil fait pour être lu et cité, la détourner serait une régression du natif ;
    // Ctrl+Début doit toujours remonter en haut du document.
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

    const from = messageIds.indexOf(row.getAttribute("data-comment-id") ?? "");
    if (from < 0) return;

    const last = messageIds.length - 1;
    const to = event.key === "ArrowDown" ? Math.min(from + 1, last)
      : event.key === "ArrowUp" ? Math.max(from - 1, 0)
        : event.key === "Home" ? 0
          : event.key === "End" ? last
            : -1;
    if (to < 0) return;

    event.preventDefault();
    const target = messageIds[to];
    if (target) focusMessage(target, "proche");
  }, [messageIds, focusMessage]);

  /**
   * Rend le focus à un message après qu'un champ ou un dialogue monté DANS la ligne a disparu.
   *
   * Sans cela, le composer d'édition démonté emporte le focus avec lui : il retombe sur
   * `<body>`, la tabulation suivante repart du haut du document et le privilège de roving saute
   * au premier message du fil — qui peut être très loin. C'est le même défaut que celui corrigé
   * pour les colonnes du panneau, appliqué ici aux lignes.
   */
  const rendreLeFocus = useCallback((id: string) => {
    // Appelé AVANT le re-rendu qui démonte le champ : la ligne est encore là, et elle garde
    // le focus une fois son contenu remplacé.
    focusMessage(id);
  }, [focusMessage]);

  /**
   * Met le curseur dans le champ d'édition d'un message.
   *
   * Appelé à la FERMETURE du menu, jamais à l'ouverture du champ : tant que le menu s'anime,
   * son piège à focus ramène à lui tout focus posé au-dehors.
   */
  const focusChampEdition = useCallback((id: string) => {
    document.getElementById(messageAnchorId(id))?.querySelector("textarea")?.focus();
  }, []);

  /** Le message qui reprendra le focus quand celui-ci disparaît : son précédent, sinon son suivant. */
  const voisinDe = useCallback((id: string) => {
    const i = messageIds.indexOf(id);
    if (i < 0) return null;
    return messageIds[i - 1] ?? messageIds[i + 1] ?? null;
  }, [messageIds]);

  /** Illumine un message le temps d'être repéré. */
  const surligner = useCallback((id: string) => {
    const element = document.getElementById(messageAnchorId(id));
    if (!element) return;
    element.setAttribute("data-highlighted", "true");
    window.setTimeout(() => element.removeAttribute("data-highlighted"), 1600);
  }, []);
  /**
   * Remonte au message cité et l'illumine le temps d'être repéré.
   *
   * Le focus suit : sans cela, la vue sautait au parent pendant que le clavier restait sur
   * la citation, deux écrans plus bas.
   */
  const jumpTo = useCallback((id: string) => {
    focusMessage(id, "centre");
    surligner(id);
  }, [focusMessage, surligner]);

  /** Le saut vers le message du lien, une seule fois, dès qu'il est affiché. */
  const lienSuivi = useRef(false);
  useLayoutEffect(() => {
    if (lienSuivi.current || !cibleDuLien || !messageIds.includes(cibleDuLien)) return;
    lienSuivi.current = true;
    // Le DOM seul, aucun état posé ici : le focus de la ligne pose `activeId` par son `onFocus`.
    montrerMessage(cibleDuLien, "centre");
    surligner(cibleDuLien);
  }, [cibleDuLien, messageIds, montrerMessage, surligner]);

  const copyLink = useCallback((id: string) => {
    const url = new URL(window.location.href);
    url.hash = messageAnchorId(id);
    void navigator.clipboard?.writeText(url.toString()).then(
      () => { /* le retour visuel passe par le toast du menu, volontairement discret */ },
      () => { /* presse-papiers refusé : rien à annoncer, l'action est facultative */ },
    );
  }, []);

  if (query.isLoading) {
    return (
      <div className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        {t("thread.loading")}
      </div>
    );
  }

  /**
   * « Ce fil n'existe plus » et « ce fil est vide » se ressemblent à l'écran et n'ont rien à
   * voir : le premier est le lien partagé dont l'élément a été supprimé. Il passe AVANT
   * l'erreur générique, dont le bouton « Réessayer » ne ferait que répéter le même constat.
   */
  if (query.error instanceof TargetNotFoundError) {
    return (
      <div className={cn("flex flex-col items-center gap-1 py-8 text-center", className)}>
        <MessageSquareX className="size-6 text-muted-foreground/60" aria-hidden />
        <p className="text-sm font-medium text-foreground">{t("thread.gone")}</p>
        <p className="text-xs text-muted-foreground">{t("thread.goneHint")}</p>
      </div>
    );
  }

  // L'écran d'erreur seulement quand il n'y a RIEN à montrer. Une relecture qui échoue garde
  // les messages en cache (React Query ne les jette pas) : on les montre, avec un avertissement
  // discret, plutôt que de les remplacer par un écran vide (revue du 29/09).
  const relectureEchouee = query.isError && query.data !== undefined;
  if (query.isError && !relectureEchouee) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-6 text-sm", className)}>
        <p className="text-muted-foreground">{t("thread.loadError")}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t("thread.retry")}
        </Button>
      </div>
    );
  }

  return (
    /* Le fil DÉFILE, le composer RESTE : il défilait avec les messages, si bien qu'il fallait
       descendre tout en bas pour écrire — sur téléphone il n'était même pas visible. Dans une
       fiche (`NewsItem`), rien ne borne la hauteur : la liste s'étend et rien ne défile, la
       même mise en page vaut donc pour les deux hôtes. */
    <div className={cn("comment-thread flex min-h-0 flex-col", className)}>
      {relectureEchouee ? (
        <p role="status" data-thread-stale className="text-muted-foreground flex items-center justify-center gap-1 px-3 py-1.5 text-xs">
          {t("thread.staleError")}
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void query.refetch()}>
            {t("thread.retry")}
          </Button>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center gap-1 py-8 text-center">
          <MessageSquare className="size-6 text-muted-foreground/60" aria-hidden />
          <p className="text-sm font-medium text-foreground">{t("thread.empty")}</p>
          {/* L'invitation à se connecter vit sous le fil, à la place du composer : la répéter
              ici la faisait lire deux fois sur un fil vide. */}
          {permissions.canComment && (
            <p className="text-xs text-muted-foreground">{t("thread.emptyHint")}</p>
          )}
        </div>
      ) : (
        // `role="log"` annonce les arrivées sans relire tout le fil à chaque message.
        <div
          role="log"
          aria-live="polite"
          aria-label={String(t("a11y.thread"))}
          onKeyDown={onThreadKeyDown}
          className="comment-log min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {rows.map(row => {
            if (row.kind === "date") return <DateSeparator key={row.key} at={row.at} />;
            if (row.kind === "unread") return <UnreadSeparator key={row.key} count={row.count} />;

            return (
              <CommentRow
                key={row.key}
                row={row}
                meId={meId}
                permissions={permissions}
                onReply={() => setReplyingTo({ id: row.node.id, author: row.node.author.name })}
                onEdit={() => setEditingId(row.node.id)}
                onEditFieldReady={() => focusChampEdition(row.node.id)}
                onDelete={() => setPendingDelete(row.node)}
                onReport={() => setReporting(row.node)}
                onShowVoters={() => setShowingVoters(row.node.id)}
                onToggleReaction={reaction =>
                  mutations.react.mutate({ commentId: row.node.id, reaction })}
                onCopyLink={() => copyLink(row.node.id)}
                onJumpToParent={jumpTo}
                collapsed={collapsed.has(row.node.id)}
                onToggleCollapse={() => toggleCollapse(row.node.id, collapsed.has(row.node.id))}
                replyCount={countNodes(row.node.replies)}
                active={row.node.id === rovingId}
                onFocusRow={() => setActiveId(row.node.id)}
                // La description est portée par la ligne ACTIVE, pas par le conteneur `log` :
                // une description accessible n'est restituée qu'à la prise de focus, et le
                // conteneur n'en prend jamais.
                describedBy={row.node.id === rovingId ? hintId : undefined}
              >
                {editingId === row.node.id ? (
                  <CommentComposer
                    mode="edit"
                    autoFocus
                    entity={scope}
                    initialValue={row.node.text}
                    initialMentions={row.node.mentions}
                    submitting={mutations.edit.isPending}
                    onCancel={() => { setEditingId(null); rendreLeFocus(row.node.id); }}
                    onSubmit={(newText, newMentions) => {
                      mutations.edit.mutate({
                        commentId: row.node.id,
                        text: newText,
                        mentions: newMentions,
                        // Sans cela, corriger une faute de frappe effacerait les images du
                        // message : le backend retire `mediaImg` quand la requête l'omet.
                        imageDocIds: row.node.images.map(image => image.id),
                      });
                      setEditingId(null);
                      rendreLeFocus(row.node.id);
                    }}
                  />
                ) : undefined}
              </CommentRow>
            );
          })}
          {/* Dit une fois ce que les flèches font. Sans cette phrase, rien n'indique que le
              fil se parcourt autrement qu'en tabulant message par message. */}
          <p className="sr-only" id={hintId}>{t("a11y.threadHint")}</p>
        </div>
      )}

      {permissions.canComment ? (
        <div className="comment-composer-zone shrink-0">
          <CommentComposer
            key={brouillon?.version ?? 0}
            autoFocus={brouillon !== null}
            initialValue={brouillon?.texte}
            initialMentions={brouillon?.mentions}
            entity={scope}
            replyingTo={replyingTo}
            onStopReplying={() => setReplyingTo(null)}
            submitting={mutations.add.isPending || mutations.reply.isPending}
            images={jointes.supported ? jointes.items : undefined}
            onAddImages={jointes.supported ? jointes.add : undefined}
            onRemoveImage={jointes.supported ? jointes.remove : undefined}
            imagesFull={jointes.full}
            imagesBusy={jointes.busy}
            imageRejections={jointes.rejected}
            onSubmit={(value, mentioned) => {
              // Les identifiants sont lus AVANT d'écrire, et la liste vidée juste après : le
              // téléversement, lui, a déjà eu lieu au moment où l'image a été choisie.
              const imageDocIds = jointes.docIds;
              const imagePreviews = jointes.optimisticImages;
              envoiSuivi.current = value;
              if (replyingTo) {
                mutations.reply.mutate({
                  parentId: replyingTo.id, text: value, mentions: mentioned, imageDocIds, imagePreviews,
                });
                // Répondre à un message OUVRE ses réponses : sinon, sur une branche repliée
                // d'office, la réponse partirait se ranger derrière un repli, hors de vue.
                // Toute la LIGNÉE, pas le seul parent : sur une branche repliée plus haut, la
                // réponse resterait hors de vue.
                setCollapseOverrides(previous => {
                  const ouvertes = new Map(previous).set(replyingTo.id, false);
                  for (const ancetre of ancestorsOf(query.nodes, replyingTo.id)) ouvertes.set(ancetre.id, false);
                  return ouvertes;
                });
                setReplyingTo(null);
              } else {
                mutations.add.mutate({ text: value, mentions: mentioned, imageDocIds, imagePreviews });
              }
              jointes.reset();
            }}
          />
        </div>
      ) : !me?.isConnected && enabled ? <LoginToParticipate /> : null}

      <AlertDialog open={pendingDelete !== null} onOpenChange={open => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Supprimer un parent fait disparaître toute sa branche de l'affichage : le
                  dire quand il y a des réponses, plutôt que de le laisser découvrir après. */}
              {pendingDelete && pendingDelete.replies.length > 0
                ? t("deleteDialog.description")
                : t("deleteDialog.descriptionNoReplies")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const victim = pendingDelete && findNode(query.nodes, pendingDelete.id);
                // Le voisin est calculé AVANT la suppression : après, l'identifiant a disparu
                // de l'index et il n'y aurait plus rien à viser.
                const repli = victim ? voisinDe(victim.id) : null;
                if (victim) mutations.remove.mutate({ commentId: victim.id });
                setPendingDelete(null);
                // `AlertDialog` est monté sans déclencheur : à la fermeture, Radix rend le focus
                // à un élément déjà détaché, ce qui est un no-op et laisse `<body>` focalisé.
                if (repli) rendreLeFocus(repli);
              }}
            >
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Montés seulement à l'ouverture : un dialogue fermé ne doit rien instancier — et
          pour les votants, c'est ce montage qui déclenche la requête. */}
      {showingVoters ? (
        <VotersDialog
          commentId={showingVoters}
          instance={query.index?.get(showingVoters) ?? null}
          onOpenChange={open => !open && setShowingVoters(null)}
        />
      ) : null}

      {reporting ? (
        <ReportCommentDialog
          open
          onOpenChange={open => !open && setReporting(null)}
          submitting={mutations.report.isPending}
          // Fermé au SUCCÈS seulement : il se fermait (et se vidait) avant la réponse du serveur,
          // si bien qu'un échec passait inaperçu et qu'il fallait tout ressaisir (revue du 29/09).
          // En cas d'échec, le dialogue reste ouvert, rempli, et le toast dit pourquoi.
          onSubmit={(reason, details) => {
            mutations.report.mutate(
              { commentId: reporting.id, reason, details },
              { onSuccess: () => setReporting(null) },
            );
          }}
        />
      ) : null}
    </div>
  );
}
