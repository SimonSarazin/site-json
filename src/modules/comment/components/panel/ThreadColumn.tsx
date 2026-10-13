import { useMemo, useState } from "react";
import { ChevronRight, MessageSquare, PenLine, Users, type LucideIcon } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useLocalization } from "@/hooks/useLocalization";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { contextIcon } from "../../constants/contextIcons";
import { compactWhen } from "../../lib/formatWhen";
import { motsDeRequete } from "../../lib/searchDiscussions";
import { Surligne } from "./Surligne";
import { PANEL_GROUP_LABEL, PANEL_LIST, PANEL_NAME, PANEL_ROW, PANEL_ROW_BAR, PANEL_SECTION_LABEL } from "./rowStyles";
import type { CarrierRef, DiscussionThread } from "../../types";

export interface ThreadColumnProps {
  readonly threads: readonly DiscussionThread[];
  /** Clé du fil ouvert. */
  readonly selected: string | null;
  readonly onSelect: (thread: DiscussionThread) => void;
  readonly isLoading?: boolean;
  /** Le plafond a été atteint côté serveur : on le DIT, on ne le tait pas. */
  readonly truncated?: boolean;
  /**
   * La requête en cours. La colonne ne filtre pas — elle reçoit déjà la liste voulue — mais
   * elle marque les correspondances et dit ce qui ne correspond pas.
   */
  readonly query?: string;
  /**
   * Le nom de l'espace d'un fil, pour l'afficher sous son titre.
   *
   * Fourni uniquement en mode recherche : les résultats viennent alors de TOUS les espaces, et
   * un titre seul ne dit plus d'où il sort. Hors recherche, tous les fils partagent l'espace
   * nommé dans l'en-tête — le répéter à chaque ligne serait du bruit.
   */
  readonly carrierName?: (carrier: CarrierRef | null) => string | null;
  /**
   * L'étiquette d'une rangée, quand le TYPE du contexte ne dit pas ce qu'est le fil : dans l'espace
   * d'un commun, « Formulaire » ne distinguerait pas une question d'une discussion réservée.
   * `null` rend l'étiquette de type habituelle.
   */
  readonly chip?: (thread: DiscussionThread) => ThreadChip | null;
  /** Le titre d'un fil que le serveur ne titre pas — le fil général d'un espace, que l'écran nomme. */
  readonly titleFallback?: (thread: DiscussionThread) => string | null;
  /**
   * L'intertitre sous lequel ranger un fil. Fourni, la liste garde l'ORDRE REÇU et en pose un à
   * chaque changement : les questions d'un appel se lisent étape par étape.
   */
  readonly groupLabel?: (thread: DiscussionThread) => string | null;
  /** Un fil vierge qui reste dans la liste, au lieu de rejoindre « Sans discussion ». */
  readonly pinned?: (thread: DiscussionThread) => boolean;
  /**
   * Ce que dit un fil vierge à la place de son compteur. Par défaut l'invitation à le démarrer ;
   * `null` pour ne rien dire — le lecteur qui ne peut pas écrire n'a rien à démarrer.
   */
  readonly startLabel?: string | null;
  readonly className?: string;
}

/** L'étiquette d'une rangée : une icône, et le libellé qu'elle remplace sur une colonne étroite. */
export interface ThreadChip {
  readonly icon: LucideIcon;
  readonly label: string;
}

/** Les fils, regroupés par intertitre, dans l'ordre reçu — un groupe par suite d'intertitres égaux. */
function sectionsOf(
  threads: readonly DiscussionThread[],
  labelOf: (thread: DiscussionThread) => string | null,
): readonly { readonly label: string | null; readonly threads: readonly DiscussionThread[] }[] {
  const sections: { label: string | null; threads: DiscussionThread[] }[] = [];
  for (const thread of threads) {
    const label = labelOf(thread);
    const derniere = sections[sections.length - 1];
    if (derniere && derniere.label === label) derniere.threads.push(thread);
    else sections.push({ label, threads: [thread] });
  }
  return sections;
}

/**
 * Deuxième colonne : les fils d'un porteur, tous types confondus.
 *
 * C'est la différence avec le panneau legacy, câblé en dur sur « les actions d'un projet » :
 * ici une actualité, une action, une question de formulaire et l'entité elle-même se rangent
 * dans la même liste, chacune étiquetée par son type.
 *
 * Aucun texte de message n'y figure — le serveur n'en envoie pas. Ce que la colonne montre,
 * c'est le TITRE DU CONTEXTE, ses compteurs et sa dernière activité.
 *
 * Elle partage sa grammaire avec le rail (`rowStyles`) : même densité, même barre d'état,
 * même échelle typographique. C'est cette grammaire commune qui manquait au premier rendu.
 */
export function ThreadColumn({
  threads, selected, onSelect, isLoading, truncated, query, carrierName,
  chip, titleFallback, groupLabel, pinned, startLabel, className,
}: ThreadColumnProps) {
  const t = useT("modules/comment");
  // Les dates suivent la langue de l'interface — elles sortaient toujours en français.
  const { currentLocale } = useLocalization();
  const filtre = (query ?? "").trim() !== "";
  const mots = useMemo(() => motsDeRequete(query ?? ""), [query]);
  /**
   * Même règle que dans le rail : les fils où personne n'a encore écrit sont REPLIÉS.
   *
   * Les laisser dans le flux noierait les discussions vivantes sous les emplacements vides —
   * un porteur peut avoir trois fils actifs et quarante actions ouvertes. État de session,
   * volontairement non persisté : on déplie pour aller lancer une discussion, après quoi le
   * fil rejoint de lui-même la liste active.
   */
  const [emptyOpen, setEmptyOpen] = useState(false);

  /** Dérivé, comme dans le rail : un filtre déplie d'office, et `emptyOpen` garde sa valeur. */
  const ouvert = filtre || emptyOpen;

  if (isLoading) {
    // Calé sur les paddings réels de la rangée, sinon la liste saute au chargement.
    return (
      <div className={cn("flex flex-col", className)} aria-busy="true">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-1.5 px-3 py-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    // Sous filtre, il faut dire DEUX choses : que rien ne correspond, et surtout où la
    // recherche n'est jamais allée — le contenu des messages ne transite pas par l'endpoint,
    // et la base n'a aucun index texte. Sans cette phrase, l'absence de résultat se lit
    // comme « il n'y a rien », alors qu'elle veut dire « pas dans les titres ».
    if (filtre) {
      return (
        <div className={cn("text-muted-foreground space-y-1 p-4 text-sm", className)}>
          <p>{String(t("panel.noThreadMatch", undefined, { query }))}</p>
          <p data-search-hint className="text-xs">{String(t("panel.searchScopeHint"))}</p>
        </div>
      );
    }
    return <p className={cn("text-muted-foreground p-4 text-sm", className)}>{String(t("panel.noThread"))}</p>;
  }

  const rangee = (thread: DiscussionThread) => {
    const isSelected = thread.key === selected;
    const when = thread.last === null ? null : compactWhen(thread.last, { locale: currentLocale });
    const whenLabel = when === null ? null : when.key === null ? when.text : String(t(`dates.${when.key}`));
    const title = thread.title ?? titleFallback?.(thread) ?? String(t("panel.untitled"));
    const etiquette = chip?.(thread) ?? null;
    const typeLabel = etiquette?.label ?? String(t(`contextTypes.${thread.target.type}`));
    const countLabel = String(t("panel.messageCount", undefined, { count: thread.total }));
    const mineLabel = String(t("panel.mine"));
    const TypeIcon = etiquette?.icon ?? contextIcon(thread.target.type);
    const demarrer = startLabel === undefined ? String(t("panel.startThread")) : startLabel;
    const espace = carrierName ? carrierName(thread.carrier) : null;

    return (
      <li key={thread.key}>
        <button
          type="button"
          onClick={() => onSelect(thread)}
          aria-current={isSelected ? "true" : undefined}
          data-thread-row
          data-thread-key={thread.key}
          data-selected={isSelected}
          data-unread={thread.unread > 0}
          data-mine={thread.mine}
          data-empty={thread.virtual}
          className={cn(PANEL_ROW, PANEL_ROW_BAR, "flex-col gap-0.5")}
        >
          <span className="flex w-full items-start gap-2">
            {/* Deux lignes, pas une : nos titres sont des PHRASES, pas des noms de salon
                (pour un fil `news`, le titre EST le texte du message). Coupé à une ligne,
                « Critères d'éligibilité — questions des porteurs » perd ce qui le distingue
                de son voisin. */}
            <span className={cn("line-clamp-2 min-w-0 flex-1", PANEL_NAME)} title={title}>
              <Surligne texte={title} mots={mots} />
            </span>
            {thread.unread > 0 && (
              <span
                data-unread-badge
                className="bg-primary text-primary-foreground mt-0.5 min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[0.6875rem] leading-none font-semibold tabular-nums"
              >
                {/* Un `aria-label` sur un simple `span` n'est pas annoncé de façon fiable : le
                    nombre se lit à l'œil, la phrase au lecteur d'écran. */}
                <span aria-hidden="true">{thread.unread > 99 ? "99+" : thread.unread}</span>
                <span className="sr-only">{String(t("panel.unreadCount", undefined, { count: thread.unread }))}</span>
              </span>
            )}
          </span>

          {/* D'où sort ce résultat. En mode transverse, les fils viennent de TOUS les espaces :
              sans cette ligne, deux titres voisins peuvent appartenir à deux structures
              différentes sans que rien ne le dise. Le nom est repris de la réponse du rail,
              déjà chargée — aucune requête de plus. */}
          {espace && (
            <span
              data-thread-space
              className="text-muted-foreground flex w-full min-w-0 items-center gap-1 text-xs"
            >
              <Users className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">{String(t("panel.inSpace", undefined, { name: espace }))}</span>
              <span className="min-w-0 truncate font-medium" aria-hidden>
                <Surligne texte={espace} mots={mots} />
              </span>
            </span>
          )}

          {/* La rangée de métadonnées tient sur UNE ligne, quoi qu'il arrive : chaque segment
              est `shrink-0 whitespace-nowrap` et c'est le conteneur qui rogne. Sans cela le
              flex écrase chaque enfant à son `min-content` et « 1 message » se coupe en deux
              — le défaut relevé à l'écran le 24/09. `flex-wrap` serait le même défaut sous un
              autre nom.

              Ordre de sacrifice, mesuré sur le pire cas réel (« Organisation », le plus long
              des dix libellés en FR comme en EN, + « 128 messages » + « 17 sept. 25 », qui
              débordait de 17 px à 1280 et de 49 px à 1024) : seul le LIBELLÉ du type cède, et
              il cède en `sr-only` — masqué à l'œil, toujours lu à la voix. Le compteur et la
              date ne se compriment jamais. */}
          <span
            data-thread-meta
            className="text-muted-foreground flex w-full min-w-0 items-center gap-1.5 overflow-hidden text-xs [&>*]:shrink-0 [&>*]:whitespace-nowrap"
          >
            {/* La container query porte sur la COLONNE (`@container/fils`, posé par le
                panneau), jamais sur le panneau : en mode une seule colonne il reste 740 px de
                large, y masquer le libellé serait absurde. */}
            <span
              className="bg-muted flex items-center gap-1 rounded-full py-0.5 ps-1 pe-1.5 @max-[16rem]/fils:pe-1"
              title={typeLabel}
            >
              <TypeIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="max-w-24 min-w-0 truncate @max-[16rem]/fils:sr-only">
                <Surligne texte={typeLabel} mots={mots} />
              </span>
            </span>
            {/* Un fil FABRIQUÉ n'a ni compteur ni date à montrer : il n'existe pas encore.
                Afficher « 0 message » et une date vide laisserait croire à un fil dont on
                aurait tout effacé. */}
            {thread.virtual
              ? demarrer !== null && <span className="text-primary/80">{demarrer}</span>
              : (
                <>
                  <span className="flex items-center gap-1 tabular-nums" title={countLabel}>
                    <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                    <span aria-hidden>{thread.total}</span>
                    <span className="sr-only">{countLabel}</span>
                  </span>
                  {whenLabel && <span>· {whenLabel}</span>}
                </>
              )}
            {thread.mine && (
              <span className="text-primary/80" title={mineLabel}>
                <PenLine className="size-3" aria-hidden />
                <span className="sr-only">{mineLabel}</span>
              </span>
            )}
          </span>
        </button>
      </li>
    );
  };

  const epingle = (thread: DiscussionThread) => pinned?.(thread) === true;
  const actifs = threads.filter(th => !th.virtual || epingle(th));
  const vierges = threads.filter(th => th.virtual && !epingle(th));
  const sansDiscussion = String(t("panel.withoutThread", undefined, { count: vierges.length }));
  /**
   * Pli replié, le fil OUVERT ne disparaît pas avec les autres : il reste sous l'en-tête du pli,
   * surligné — on voit où l'on est, comme le salon actif d'une catégorie repliée. C'est le cas de
   * qui arrive par un lien, ou par le bouton d'un palier, sur un fil où personne n'a écrit.
   *
   * Il se rend SOUS l'en-tête, pas parmi les fils écrits : quand on le quitte, aucune rangée ne
   * remonte sous le pointeur. Et jamais deux fois : replié, il sort de la liste du pli ; déplié,
   * il y reprend sa place.
   */
  const ouvertReplie = ouvert ? null : vierges.find(th => th.key === selected) ?? null;
  const replies = ouvertReplie ? vierges.filter(th => th !== ouvertReplie) : vierges;

  /**
   * Des fils rangés par intertitre : chaque groupe est une liste à part, nommée par le sien, pour
   * que le lecteur d'écran annonce « Proposition, liste de 3 éléments » et non une seule liste
   * entrecoupée de titres qui n'en sont pas.
   *
   * La clé d'un groupe est son intertitre et son rang PARMI LES GROUPES DE CE NOM — ni son rang
   * dans la liste, ni son premier fil. Par le rang, un groupe qui apparaît au-dessus (une
   * discussion qu'on vous ouvre, une étape qui reçoit son premier message) décalait tous les
   * autres ; par le premier fil, il suffisait qu'un fil prenne la tête de son groupe (la première
   * question d'une étape reçoit son premier message). Dans les deux cas le groupe était remonté,
   * et la rangée qu'on tenait perdait le focus. L'intertitre seul ne suffirait pas : il peut
   * revenir deux fois.
   */
  const groupes = (liste: readonly DiscussionThread[], labelOf: (thread: DiscussionThread) => string | null, nomParDefaut: string) => {
    const rangs = new Map<string, number>();
    return sectionsOf(liste, labelOf).map((section, index) => {
      const nom = section.label ?? "";
      const rang = rangs.get(nom) ?? 0;
      rangs.set(nom, rang + 1);
      return (
        <div key={`${nom}#${rang}`} data-thread-group={nom} className={cn(index > 0 && "border-t")}>
          {section.label && <p className={PANEL_SECTION_LABEL} aria-hidden>{section.label}</p>}
          <ul className={PANEL_LIST} aria-label={section.label ?? nomParDefaut}>
            {section.threads.map(rangee)}
          </ul>
        </div>
      );
    });
  };

  return (
    <ScrollArea className={className}>
      {actifs.length > 0 && !groupLabel && (
        <ul className={PANEL_LIST} aria-label={String(t("panel.threads"))}>
          {actifs.map(rangee)}
        </ul>
      )}
      {actifs.length > 0 && groupLabel && groupes(actifs, groupLabel, String(t("panel.threads")))}

      {vierges.length > 0 && (
        <div data-empty-group data-open={ouvert} className={cn(actifs.length > 0 && "border-t")}>
          {/* Même règle que dans le rail : sous filtre, la section est dépliée d'office et
              son en-tête cesse d'être un bouton.

              ⚠️ En pratique cette branche ne se rencontre pas aujourd'hui : en mode recherche
              la colonne affiche les résultats du périmètre transverse, qui ne FABRIQUE aucun
              fil vierge. C'est une propriété du serveur, pas de ce composant — si elle change,
              la règle est déjà là. */}
          {filtre
            ? (
              <p className={PANEL_GROUP_LABEL}>
                <span className="truncate">{sansDiscussion}</span>
              </p>
            )
            : (
              <button
                type="button"
                aria-expanded={emptyOpen}
                onClick={() => setEmptyOpen(o => !o)}
                className={PANEL_GROUP_LABEL}
              >
                <ChevronRight
                  className={cn("size-3 shrink-0 transition-transform", emptyOpen && "rotate-90")}
                  aria-hidden
                />
                <span className="truncate">{sansDiscussion}</span>
              </button>
            )}
          {/* Le contenu reste MONTÉ : c'est ce qui permet d'animer sa hauteur. `inert` le
              rend alors réellement inerte quand il est replié — hors tabulation et hors
              arbre d'accessibilité — là où `visibility: hidden` seul ne le garantit qu'en
              présence du CSS. */}
          {/* Mêmes intertitres que plus haut quand il y en a : sans eux, les questions vierges de
              toutes les étapes se suivaient d'un trait, et deux questions de même libellé ne se
              distinguaient plus. */}
          {ouvertReplie && (
            <ul className={PANEL_LIST} aria-label={String(t("panel.openThread"))} data-empty-current>
              {rangee(ouvertReplie)}
            </ul>
          )}
          <div className="comment-collapsible" data-open={ouvert} inert={!ouvert}>
            <div>
              {groupLabel
                ? groupes(replies, groupLabel, sansDiscussion)
                : <ul className={PANEL_LIST} aria-label={sansDiscussion}>{replies.map(rangee)}</ul>}
            </div>
          </div>
        </div>
      )}

      {/* Hors filtre, « affinez le contexte » est le bon conseil. Sous filtre, il est absurde
          — c'est justement ce que l'utilisateur vient de faire — et l'information devient
          critique : sans elle, une recherche menée sur un parc coupé tairait les fils
          manquants au lieu de le dire. */}
      {truncated && (
        <p
          data-search-partial={filtre ? "" : undefined}
          className="text-muted-foreground border-t px-4 py-3 text-xs"
        >
          {String(t(filtre ? "panel.searchPartial" : "panel.truncated"))}
        </p>
      )}
    </ScrollArea>
  );
}
