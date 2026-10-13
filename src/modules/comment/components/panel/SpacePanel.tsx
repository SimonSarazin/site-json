import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, CircleHelp, Globe, Lock, MessageSquare, MessagesSquare, Plus, Receipt, ShieldCheck,
} from "lucide-react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { useCocolight } from "@/hooks/useCocolight";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NewDiscussionForm } from "./NewDiscussionForm";
import { PANEL_HEADING, PANEL_ONE_COLUMN_REM } from "./rowStyles";
import { ThreadColumn, type ThreadChip } from "./ThreadColumn";
import { CommentThread } from "../CommentThread";
import { LoginToParticipate } from "../LoginToParticipate";
import { useDiscussionSpaceQuery } from "../../hooks/useDiscussionSpaceQuery";
import { errorCodeOf, errorLabelKey, isRefusalCode } from "../../lib/discussions";
import { threadValue } from "../../lib/filKey";
import { spaceKey, visibleSpaceThreads } from "../../lib/space";
import type { CommentTarget, DiscussionThread, SpaceRef } from "../../types";
import "../../styles.css";

export interface SpacePanelProps {
  /** L'élément dont on ouvre l'espace — aujourd'hui un commun. */
  readonly space: SpaceRef;
  /** Le titre de l'élément tel que sa fiche l'a résolu. Il prime sur celui que le serveur connaît. */
  readonly title?: string | null;
  /** Le fil ouvert. L'adresse appartient à l'HÔTE (`useSpaceLauncher`) : le panneau ne la lit pas. */
  readonly target: CommentTarget | null;
  /** Changer de fil, ou revenir à la liste (`null`). Jamais fermer : c'est le verbe de l'hôte. */
  readonly onSelect: (target: CommentTarget | null) => void;
  /** L'entité qui cadre la recherche des personnes à mentionner — celle que l'hôte a sous la main. */
  readonly scopeEntity?: EntityTypes | null;
  /** Rendu en fin d'en-tête : la croix de la modale. */
  readonly headerEnd?: ReactNode;
  readonly className?: string;
}

/**
 * L'ESPACE de discussion d'un commun : ses fils · les messages du fil choisi.
 *
 * C'est le panneau « Discussions » cadré sur UN élément, donc sans rail : il n'y a qu'un espace,
 * celui de la fiche d'où l'on vient. Il réemploie tout le reste — la colonne des fils, le fil, et
 * la grammaire de colonnes de `styles.css` (mêmes attributs `data-panel-column` / `data-step`),
 * si bien qu'il se replie en une colonne sous 48 rem sans une ligne de style de plus.
 *
 * **Il se lit sans session** (arbitrage du 07/10, comme le legacy) ; le fil invite alors à se
 * connecter à la place du composer, et les emplacements vides ne sont pas proposés.
 *
 * **La liste du serveur fait autorité** : un fil n'est monté que s'il y figure. Une adresse qui
 * désigne une discussion réservée, ou disparue, n'affiche rien de son contenu. Ce qu'on PROPOSE
 * dans la colonne est une autre question (`visibleSpaceThreads`) : c'est de l'affichage, pas un droit.
 *
 * Les fils gardent l'ORDRE du serveur — fil général, discussions, puis les questions dans l'ordre
 * de l'appel, étape par étape. Un commun a une poignée de fils : un ordre qui ne bouge pas se lit
 * mieux qu'un tri par activité, et les non-lus se voient à leur barre.
 *
 * **Créer une discussion** : le « + » de l'en-tête n'existe que si le serveur annonce à ce lecteur
 * une audience qu'il peut donner (`creatableAudiences`). Le formulaire s'ouvre en tête de la
 * colonne, pas dans un dialogue de plus ; la discussion créée est ouverte aussitôt.
 */
export function SpacePanel({ space, title, target, onSelect, scopeEntity, headerEnd, className }: SpacePanelProps) {
  const t = useT("modules/comment");
  const { me } = useCocolight();
  const query = useDiscussionSpaceQuery(space, { live: true });

  const threads = useMemo(
    () => visibleSpaceThreads(query.threads, query.canComment),
    [query.threads, query.canComment],
  );
  // La clé d'un fil est la valeur qui l'écrit dans l'adresse : même formule que le serveur.
  const cleOuverte = target ? threadValue(target) : null;
  // Le fil ouvert se cherche dans la liste DU SERVEUR, pas dans celle qu'on propose : un visiteur
  // arrivé par un lien sur un emplacement encore vide y lit l'invitation à se connecter, là où
  // « introuvable » lui ferait croire que le lien est mort.
  const ouvert = cleOuverte === null ? null : query.threads.find(thread => thread.key === cleOuverte) ?? null;

  // Fonctions simples, sans mémo : `t` est recréé à chaque rendu (cf. `useT`), un mémo sur lui ne tiendrait rien.
  const chip = (thread: DiscussionThread): ThreadChip | null => {
    switch (thread.kind) {
      case "general":
        return { icon: MessagesSquare, label: String(t("space.kinds.general")) };
      case "discussion":
        if (thread.audience === "authorAll") return { icon: Globe, label: String(t("space.audiences.authorAll")) };
        if (thread.audience === "authorAdmin") return { icon: Lock, label: String(t("space.audiences.authorAdmin")) };
        // `private`, et toute audience que cet écran ne connaît pas : la plus fermée des étiquettes.
        return { icon: ShieldCheck, label: String(t("space.audiences.private")) };
      case "question":
        return { icon: CircleHelp, label: String(t("space.kinds.question")) };
      case "expense":
        return { icon: Receipt, label: String(t("space.kinds.expense")) };
      default:
        return { icon: MessageSquare, label: String(t("space.kinds.other")) };
    }
  };

  /** Le titre d'un fil que le serveur ne titre pas : c'est l'écran qui nomme, dans sa langue. */
  const titreDeRepli = (thread: DiscussionThread): string | null => {
    if (thread.kind === "general") return String(t("space.general"));
    if (thread.kind === "question") return String(t("space.questionUntitled"));
    if (thread.kind === "expense") return String(t("space.expenseUntitled"));
    return null;
  };

  /** L'étape de l'appel pour une question ; le fil général et les discussions ouvrent la liste. */
  const intertitre = (thread: DiscussionThread): string | null => {
    if (thread.kind === "question") return thread.group ?? String(t("space.groups.questions"));
    if (thread.kind === "expense") return String(t("space.groups.expenses"));
    if (thread.kind === "other") return String(t("space.groups.other"));
    return null;
  };

  const step: "threads" | "thread" = target ? "thread" : "threads";

  // Créer une discussion : un état d'écran, pas d'adresse — on ne partage pas un formulaire ouvert.
  const [creation, setCreation] = useState(false);
  const boutonCreer = useRef<HTMLButtonElement>(null);
  // La discussion qu'on vient de créer : son titre reçoit le focus quand elle s'ouvre. Le
  // formulaire qui le tenait a disparu — sans cela il retombait sur `<body>`.
  const creee = useRef<string | null>(null);
  const fermerLaCreation = () => {
    setCreation(false);
    boutonCreer.current?.focus();
  };

  // En mode une colonne, changer d'étape retire de l'écran celle d'où l'on vient : le focus est
  // rendu au titre de la colonne qui arrive, comme dans le panneau général.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const refDuTitre = (etape: typeof step) => (etape === step ? headingRef : undefined);
  const rootRef = useRef<HTMLElement | null>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const largeur = rootRef.current?.offsetWidth ?? 0;
    if (largeur > 0 && largeur < PANEL_ONE_COLUMN_REM * rem) headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (creee.current === null || creee.current !== cleOuverte) return;
    creee.current = null;
    headingRef.current?.focus();
  }, [cleOuverte]);

  const nom = title || query.title || String(t("space.title"));
  // Une erreur ne prend l'écran que s'il n'y a plus rien à montrer. `useDiscussionSpaceQuery` tient
  // la règle : une PANNE de relecture garde la dernière liste servie — fil ouvert et brouillon
  // compris —, un REFUS la retire.
  const code = query.isError ? errorCodeOf(query.error) : null;
  const erreur = code !== null && query.data === undefined ? code : null;
  const messageDErreur = erreur === null ? null
    : String(t(erreur === "hidden" ? "space.notFound" : errorLabelKey(erreur)));
  // Seule une panne mérite qu'on réessaie : un refus ne changera pas d'avis.
  const reessayable = erreur !== null && !isRefusalCode(erreur);
  /**
   * « Réessayer », posé dans les DEUX colonnes : sous 48 rem une seule est à l'écran, et un fil
   * ouvert montre la sienne — la panne s'y lisait sans issue, le bouton resté dans la liste (vu au
   * navigateur à 375 px, le 12/10). Celui du fil cède la place dès que les colonnes coexistent,
   * comme la croix de l'en-tête.
   */
  const reessayer = (className?: string) => (
    <Button variant="outline" size="sm" className={className} onClick={() => void query.refetch()}>
      {String(t("thread.retry"))}
    </Button>
  );
  // Le serveur a dit à ce lecteur ce qu'il peut créer. Refusé ou sans liste, l'espace n'annonce
  // aucune audience (`useDiscussionSpaceQuery`) : il n'y a alors rien où créer.
  const peutCreer = query.creatableAudiences.length > 0;
  // L'adresse désigne un fil que la liste ne porte pas : réservé, ou disparu (cf. la colonne du fil).
  const introuvable = target !== null && messageDErreur === null && !query.isLoading && ouvert === null;

  return (
    <section
      ref={rootRef}
      className={cn(
        "discussion-panel @container/panneau bg-background flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border",
        className,
      )}
      aria-label={nom}
      data-discussion-panel
      data-space-panel={spaceKey(space)}
      data-step={step}
    >
      {/* Ce qui arrive à l'espace se dit aussi à qui ne le voit pas : un refus, une panne, un fil
          introuvable. Une seule région, toujours là — les deux colonnes affichent la même phrase,
          et l'une des deux est hors écran en mode une colonne. */}
      <p role="status" className="sr-only" data-space-status>
        {messageDErreur ?? (introuvable ? String(t("panel.error.hidden")) : "")}
      </p>
      <div data-panel-columns className="flex min-h-0 w-full flex-1">
        {/* Colonne 1 — les fils de l'espace */}
        <div data-panel-column="threads" className="@container/fils flex min-h-0 w-full flex-col border-e">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <MessagesSquare className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <h2 ref={refDuTitre("threads")} tabIndex={-1} className={PANEL_HEADING} title={nom}>{nom}</h2>
            {peutCreer && (
              <Button
                ref={boutonCreer}
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                data-new-discussion-open
                aria-expanded={creation}
                aria-label={String(t("space.create.open"))}
                title={String(t("space.create.open"))}
                onClick={() => setCreation(ouverte => !ouverte)}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            )}
            {/* En mode une colonne, l'en-tête du fil n'est pas à l'écran : la croix se pose aussi
                ici, et cède la place dès que les deux colonnes coexistent. */}
            {headerEnd ? <span className="ms-auto shrink-0 @3xl/panneau:hidden">{headerEnd}</span> : null}
          </header>
          {peutCreer && creation && (
            <NewDiscussionForm
              space={space}
              audiences={query.creatableAudiences}
              onCancel={fermerLaCreation}
              onCreated={thread => {
                setCreation(false);
                creee.current = thread.key;
                onSelect(thread.target);
              }}
            />
          )}
          {messageDErreur
            ? (
              <div className="text-muted-foreground flex flex-col items-start gap-2 p-4 text-sm" data-space-error={erreur}>
                <p>{messageDErreur}</p>
                {reessayable && reessayer()}
              </div>
            )
            : (
              <ThreadColumn
                threads={threads}
                selected={cleOuverte}
                onSelect={thread => onSelect(thread.target)}
                isLoading={query.isLoading}
                truncated={query.truncated}
                chip={chip}
                titleFallback={titreDeRepli}
                groupLabel={intertitre}
                pinned={thread => thread.kind === "general"}
                startLabel={query.canComment ? undefined : null}
                className="min-h-0 flex-1"
              />
            )}
        </div>

        {/* Colonne 2 — le fil lui-même, rendu par le composant déjà éprouvé */}
        <div data-panel-column="thread" className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
            {target && (
              <Button
                variant="ghost"
                size="icon"
                data-panel-back
                onClick={() => onSelect(null)}
                aria-label={String(t("panel.backToThreads"))}
              >
                <ArrowLeft className="size-4" aria-hidden />
              </Button>
            )}
            <h3 ref={refDuTitre("thread")} tabIndex={-1} className={cn("px-1", PANEL_HEADING)}>
              {ouvert ? ouvert.title ?? titreDeRepli(ouvert) ?? String(t("panel.messages")) : String(t("panel.messages"))}
            </h3>
            {headerEnd ? <span className="ms-auto shrink-0">{headerEnd}</span> : null}
          </header>
          {!target
            ? <p className="text-muted-foreground p-4 text-sm">{String(t("panel.pickThread"))}</p>
            : messageDErreur
            ? (
              <div className="text-muted-foreground flex flex-col items-start gap-2 p-4 text-sm">
                <p>{messageDErreur}</p>
                {reessayable && reessayer("@3xl/panneau:hidden")}
              </div>
            )
            : query.isLoading
            ? <p className="text-muted-foreground p-4 text-sm" aria-busy="true">{String(t("thread.loading"))}</p>
            : !ouvert
            ? (
              <>
                <p className="text-muted-foreground p-4 text-sm" data-thread-hidden>{String(t("panel.error.hidden"))}</p>
                {/* Sans session, « réservé » a une issue : le dire. Le lien d'un fil réservé, ouvert
                    par quelqu'un qui n'est pas connecté, s'arrêtait sur un constat sans suite. */}
                {!me?.isConnected && (
                  <LoginToParticipate placement="block" message={String(t("space.loginIfReserved"))} />
                )}
              </>
            )
            : (
              <CommentThread
                // Remonter le fil à chaque cible : « Répondre à M » ne doit pas survivre au
                // passage d'un fil à l'autre (cf. `DiscussionPanel`).
                key={ouvert.key}
                target={ouvert.target}
                scopeEntity={scopeEntity}
                className="min-h-0 flex-1"
              />
            )}
        </div>
      </div>
    </section>
  );
}
