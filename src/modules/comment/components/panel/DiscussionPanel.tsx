import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CarrierRail } from "./CarrierRail";
import { ThreadColumn } from "./ThreadColumn";
import { DiscussionSearch } from "./DiscussionSearch";
import { PANEL_HEADING, PANEL_ONE_COLUMN_REM } from "./rowStyles";
import { CommentThread } from "../CommentThread";
import { LoginToParticipate } from "../LoginToParticipate";
import { useDiscussionsQuery } from "../../hooks/useDiscussionsQuery";
import { useDiscussionUrlState } from "../../hooks/useDiscussionUrlState";
import { useCarrierEntity } from "../../hooks/useCarrierEntity";
import { useRailCollapse } from "../../hooks/useRailCollapse";
import { CARRIER_NONE, carrierKey, errorCodeOf, errorLabelKey, isRefusalCode, sortThreads, threadsOfCarrier, type DiscussionErrorCode } from "../../lib/discussions";
import { threadValue } from "../../lib/filKey";
import { filtrerFils, filtrerPorteurs, motsDeRequete } from "../../lib/searchDiscussions";
import type {
  CarrierRef, CommentableType, CommentTarget, DiscussionCarrier, DiscussionThread,
} from "../../types";
import "../../styles.css";

export interface DiscussionPanelProps {
  /** Nom du paramètre d'URL. `discussion` par défaut. */
  readonly param?: string;
  /**
   * Rendu à la fin de l'en-tête de la colonne du fil.
   *
   * C'est là que la modale pose sa croix de fermeture, dans la barre de titre comme chez
   * Discord — et non en `absolute top-4 right-4`, où elle se superposerait à cet en-tête.
   */
  readonly headerEnd?: ReactNode;
  readonly className?: string;
}

/**
 * Le panneau « Discussions » : porteur → fils → messages.
 *
 * **Les trois colonnes ne se parlent pas.** Chacune lit l'URL et se recharge seule quand sa
 * clé de requête change. Il n'y a donc aucun état partagé à synchroniser, et une adresse
 * partagée rouvre exactement la même vue.
 *
 * **Le périmètre chargé suit la sélection**, jamais plus : sans sélection, seul le rail
 * (porteurs et compteurs, aucun titre) ; avec un porteur, ses fils ; avec un fil, ses
 * messages — ces derniers par `CommentThread`, qui a déjà son cache et ses mutations.
 *
 * **Lien profond** : quand l'URL désigne un fil dont on ignore le porteur (on arrive
 * directement dessus), une requête de périmètre `thread` apprend ce porteur — un appel de
 * plus, seulement à l'entrée, et jamais quand on navigue depuis le rail.
 *
 * **Le panneau ne se ferme jamais lui-même.** `close()` appartient à l'hôte (la modale, la
 * page) ; ici, revenir en arrière n'est qu'un changement de sélection. Les câbler ensemble
 * ferait fermer la modale sur un simple « retour aux espaces ».
 */
export function DiscussionPanel({ param, headerEnd, className }: DiscussionPanelProps) {
  const t = useT("modules/comment");
  const { me } = useCocolight();
  const { selection, isOpen, select } = useDiscussionUrlState({ param });
  const { collapsed, attribute, canToggle, toggle, measureRef } = useRailCollapse();

  const rail = useDiscussionsQuery({ kind: "rail" });

  // Le fil ouvert, tel que l'URL le désigne.
  const openTarget = selection.kind === "thread" ? selection.target : null;

  // Lien profond : on ne connaît pas encore le porteur de ce fil. Cette requête n'est lancée
  // QUE dans ce cas — depuis le rail, le porteur est déjà connu.
  const deepLink = useDiscussionsQuery(
    openTarget ? { kind: "thread", target: openTarget } : { kind: "rail" },
    { enabled: openTarget !== null && selection.kind === "thread" },
  );

  /**
   * Le dernier porteur que l'on a VU, retenu au moment du clic.
   *
   * Sans lui, cliquer un fil depuis la colonne du milieu faisait retomber le porteur à `null`
   * le temps que la requête de lien profond rattrape une information qu'on avait déjà sous la
   * main. La colonne des fils était alors remplacée par « Choisissez un espace », donc
   * DÉMONTÉE — et tout son état d'affichage perdu, à commencer par le pli de la section
   * « Sans discussion », qui se refermait à chaque clic.
   *
   * Un ÉTAT, et pas une ref : lire une ref pendant le rendu est précisément ce que la règle
   * `react-hooks/refs` interdit, et elle a raison — la valeur lue n'est pas garantie stable
   * en rendu concurrent. Il est posé dans un gestionnaire d'événement (jamais dans un effet),
   * et React le regroupe avec l'écriture de l'URL : un seul rendu pour les deux.
   *
   * **Trois valeurs, et pas deux.** `null` signifiait à la fois « je ne sais pas encore » et
   * « ce fil n'a pas de porteur », si bien qu'ouvrir un fil orphelin laissait en place le
   * porteur PRÉCÉDENT — l'ancien code s'en protégeait par un garde `if (thread.carrier)` qui
   * ne faisait que déplacer le problème. `"none"` dit l'absence pour de bon ; il en faut une
   * troisième parce que retomber sur `null` remplacerait la colonne des fils par « Choisissez
   * un espace », donc la DÉMONTERAIT — exactement ce que cet état sert à empêcher.
   */
  const [dernierPorteur, setDernierPorteur] = useState<CarrierRef | "none" | null>(null);

  /**
   * La recherche. Un seul état, et tout le reste en dérive au rendu — c'est la règle du
   * module : `data-search`, le dépli forcé des sections repliées, le libellé de la colonne
   * des fils et le périmètre chargé se lisent tous ici, aucun n'a d'état propre.
   *
   * Elle **ne va pas dans l'URL**, pour la raison déjà écrite pour le pli du rail : une
   * adresse partagée ne doit pas imposer un filtre à son destinataire. Corollaire utile, à ne
   * pas perdre de vue : un lien partagé ne transporte jamais de requête.
   */
  const [requete, setRequete] = useState("");
  const mots = useMemo(() => motsDeRequete(requete), [requete]);
  const rechercheActive = mots.length > 0;

  /**
   * Le porteur actif, DÉRIVÉ au rendu (jamais posé dans un effet — c'est ce qui a causé un
   * défaut au J7, une sélection manuelle perdue à chaque relecture).
   */
  const activeCarrier = useMemo<CarrierRef | null>(() => {
    if (selection.kind === "holder") return { type: selection.type, id: selection.id };
    if (selection.kind !== "thread") return null;
    // `"none"` est une réponse, pas une absence de réponse : le fil n'a PAS de porteur.
    return deepLink.threads[0]?.carrier ?? (dernierPorteur === "none" ? null : dernierPorteur);
  }, [selection, deepLink.threads, dernierPorteur]);

  const activeCarrierKey = useMemo(() => {
    if (selection.kind === "holder") return `${selection.type}:${selection.id}`;
    /**
     * `all` EST l'adresse du groupe « sans porteur ».
     *
     * N'ayant pas d'identifiant propre, ce groupe se sélectionne depuis le rail en écrivant
     * `?discussion=all` — c'est ce que fait `onSelectCarrier`. Sans cette ligne, la sélection
     * retombait dans le filet `!== "thread"` ci-dessous et rendait `null` : le groupe n'était
     * pas marqué sélectionné, le mode `all` n'était jamais activé, et la colonne annonçait
     * « aucun fil dans cet espace » sur un groupe qu'elle n'avait même pas demandé.
     */
    if (selection.kind === "all") return CARRIER_NONE;
    if (selection.kind !== "thread") return null;
    // Porteur déjà connu : on n'attend pas le lien profond pour le dire.
    if (activeCarrier !== null) return carrierKey(activeCarrier);
    // Orphelin AVÉRÉ (on vient de cliquer un fil qui n'a pas de porteur) : on le sait déjà,
    // il n'y a rien à attendre du lien profond.
    if (dernierPorteur === "none") return CARRIER_NONE;
    // Un fil dont la remontée a échoué appartient au groupe « sans porteur » : il faut qu'il
    // reste atteignable, sinon 52 % des fils de formulaire deviendraient invisibles.
    return deepLink.isSuccess ? carrierKey(null) : null;
  }, [selection, activeCarrier, dernierPorteur, deepLink.isSuccess]);

  const carrierQuery = useDiscussionsQuery(
    activeCarrier ? { kind: "carrier", carrier: activeCarrier } : { kind: "rail" },
    { enabled: activeCarrier !== null },
  );

  // L'entité porteuse, qui cadre la recherche des personnes à mentionner (`scopeEntity`) : on
  // mentionne d'abord les gens de l'espace. Les droits, eux, ne dépendent plus d'elle.
  const carrierEntity = useCarrierEntity(activeCarrier);

  // Les fils orphelins ne s'obtiennent pas par `carrier` (ils n'en ont pas) : ils viennent du
  // mode `all`, demandé uniquement quand ce groupe est ouvert — jamais implicitement.
  const orphansOpen = activeCarrierKey === CARRIER_NONE;
  /**
   * Le mode `all` — tous les fils du cadrage, titrés — sert désormais DEUX besoins : le groupe
   * orphelin, et la recherche transverse. Un seul appel pour les deux, même clé de cache.
   *
   * Il ne coûte **aucune requête Mongo de plus** que le mode `rail` déjà lancé : côté serveur,
   * l'agrégation, la remontée des fils directs et la résolution des porteurs s'exécutent dans
   * tous les modes ; seules la construction de la liste et la sortie diffèrent. Il reste
   * demandé nommément — ici, c'est l'utilisateur qui le demande en tapant.
   */
  const tousLesFils = useDiscussionsQuery(
    { kind: "all" },
    { enabled: orphansOpen || rechercheActive },
  );

  /**
   * Les fils DU PORTEUR sélectionné.
   *
   * ⚠️ À ne pas confondre avec ce que la colonne affiche : c'est cette liste-ci que lisent les
   * compteurs et le titre de la colonne du fil. Les brancher sur la liste AFFICHÉE ferait
   * retomber l'en-tête sur « Messages » et **arrêterait le marquage en lecture** dès la
   * première frappe, puisque le mode `all` ne contient ni fil vierge ni fil hors cadrage.
   */
  const filsDuPorteur = useMemo(() => {
    if (orphansOpen) return threadsOfCarrier(tousLesFils.threads, CARRIER_NONE);
    return threadsOfCarrier(carrierQuery.threads, null);
  }, [orphansOpen, tousLesFils.threads, carrierQuery.threads]);

  /**
   * Le libellé traduit d'un type, calculé ICI et passé au prédicat.
   *
   * Le filtre est une fonction pure : elle ne peut pas appeler un hook de traduction. Et le
   * type EST affiché sur une rangée de fil — le filtrer est donc cohérent avec ce qu'on voit.
   */
  const libelleType = useCallback(
    (type: CommentableType) => String(t(`contextTypes.${type}`)),
    [t],
  );

  /** Ce que la colonne des fils AFFICHE : les fils du porteur, ou les résultats transverses. */
  const filsAffiches = useMemo(() => {
    if (!rechercheActive) return filsDuPorteur;
    return sortThreads(filtrerFils(tousLesFils.threads, mots, libelleType));
  }, [rechercheActive, filsDuPorteur, tousLesFils.threads, mots, libelleType]);

  /** Les espaces affichés par le rail. Filtrés localement : le rail ne change jamais de requête. */
  const porteursAffiches = useMemo(
    () => filtrerPorteurs(rail.carriers, mots),
    [rail.carriers, mots],
  );

  /** Le nom d'un espace, pour l'afficher sous chaque résultat transverse. */
  const nomDePorteur = useCallback((ref: CarrierRef | null): string | null => {
    if (!ref) return null;
    const cle = carrierKey(ref);
    return rail.carriers.find(c => carrierKey(c) === cle)?.name ?? null;
  }, [rail.carriers]);

  const onSelectCarrier = (carrier: DiscussionCarrier) => {
    // Choisir un espace MET FIN à la recherche : sans cela la colonne des fils resterait en
    // mode transverse, où elle n'écoute pas le porteur — le clic paraîtrait sans effet.
    setRequete("");
    setDernierPorteur(carrier.type && carrier.id ? { type: carrier.type, id: carrier.id } : "none");
    if (carrier.type && carrier.id) select({ kind: "holder", type: carrier.type, id: carrier.id });
    // Le groupe « sans porteur » n'a pas d'adresse propre : on passe par `all`, qui EST la
    // demande explicite de tout charger — c'est le seul moment où elle est faite.
    else select({ kind: "all" });
  };



  const onSelectThread = (thread: DiscussionThread) => {
    // Choisir un fil met fin à la recherche, pour la même raison qu'un espace : la colonne
    // des fils doit redevenir celle du porteur qu'on vient d'ouvrir.
    setRequete("");
    // Le fil porte déjà son porteur : le retenir évite de redemander au serveur ce qu'on sait,
    // et surtout évite de démonter la colonne pendant qu'il répond. `"none"` quand il n'en a
    // pas — sans quoi le porteur PRÉCÉDENT resterait affiché comme étant le sien.
    setDernierPorteur(thread.carrier ?? "none");
    select({ kind: "thread", target: thread.target });
  };

  /**
   * Entrée dans le champ : valide l'unique résultat, s'il est vraiment unique.
   *
   * Le garde de chargement n'est pas décoratif — tant que le périmètre transverse charge, la
   * liste des fils est vide, si bien que « 1 espace + 0 fil » est un total de 1 transitoire et
   * FAUX. Sans lui, taper vite ouvrirait un espace qu'on n'a pas choisi.
   */
  const validerResultatUnique = () => {
    if (tousLesFils.isLoading) return;
    if (porteursAffiches.length + filsAffiches.length !== 1) return;
    if (porteursAffiches.length === 1) onSelectCarrier(porteursAffiches[0]);
    else onSelectThread(filsAffiches[0]);
  };

  /**
   * L'étape la plus profonde que l'URL désigne. Elle est TOUJOURS posée, et c'est le CSS qui
   * décide de s'en servir : au-delà de 48 rem de panneau les trois colonnes coexistent et
   * `data-step` n'a aucun effet. Les trois restent montées dans tous les cas — elles ne
   * coûtent aucune requête de plus, et rien ne clignote à l'hydratation.
   */
  const step: "carriers" | "threads" | "thread" =
    openTarget ? "thread" : activeCarrierKey || selection.kind === "all" ? "threads" : "carriers";

  /**
   * En mode une seule colonne, changer d'étape retire de l'écran celle d'où l'on vient : le
   * focus tomberait sur `<body>`, et la tabulation suivante repartirait du haut du document.
   * On le rend au titre de la colonne qui arrive.
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  /**
   * La ref n'est posée que sur la colonne de l'étape COURANTE. Les trois colonnes étant
   * montées en permanence, une ref unique branchée sur les trois titres finirait sur le
   * dernier rendu.
   */
  const refDuTitre = (etape: typeof step) => (etape === step ? headingRef : undefined);

  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((el: HTMLElement | null) => {
    rootRef.current = el;
    // Le hook de pli mesure la même racine ; on lui rend sa fonction de nettoyage.
    return measureRef(el);
  }, [measureRef]);

  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    // Le focus ne se déplace que si une colonne a réellement disparu. C'est la largeur du
    // PANNEAU qui en décide — lue sur le DOM, comme le style, et non sur un hook de media
    // query qui vaudrait `false` au premier rendu.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const largeur = rootRef.current?.offsetWidth ?? 0;
    if (largeur > 0 && largeur < PANEL_ONE_COLUMN_REM * rem) headingRef.current?.focus();
  }, [step]);

  /** Une erreur du panneau, traduite d'après son code — jamais le texte brut du serveur. */
  const messageDErreur = (code: DiscussionErrorCode) => String(t(errorLabelKey(code)));
  /**
   * Une erreur ne prend la colonne que s'il n'y a rien à montrer, ou que le serveur a dit NON.
   * Une PANNE de relecture garde la dernière liste servie, comme l'espace d'un commun : elle
   * remplaçait rail et fils valides pendant 30 s à 1 min, focus perdu et pli refermé (revue du
   * 16/10). Un REFUS, lui, retire la liste — la session a pu changer.
   */
  const erreurDe = (requete: { isError: boolean; error: unknown; data: unknown }): string | null => {
    if (!requete.isError) return null;
    const code = errorCodeOf(requete.error);
    return requete.data === undefined || isRefusalCode(code) ? messageDErreur(code) : null;
  };
  const railError = erreurDe(rail);

  /**
   * La requête qui alimente la colonne des fils, selon le mode en cours. La nommer une fois
   * évite de répéter le même ternaire à trois endroits — et d'en oublier un.
   */
  const filsQuery = rechercheActive || orphansOpen ? tousLesFils : carrierQuery;
  /**
   * ⚠️ Une erreur n'est pas une absence de résultat.
   *
   * Sans ce test, un refus du serveur — session expirée, réseau coupé — rendait une liste vide,
   * que la colonne présentait comme « aucun fil ne correspond ». L'écran affirmait alors le
   * contraire de la vérité : il y a peut-être tout ce qu'on cherche, on n'a simplement pas pu
   * le demander. Constaté au navigateur, en anonyme, sur le serveur de dev.
   */
  const filsError = erreurDe(filsQuery);

  /**
   * Un fil SENSIBLE ne se monte que sur l'accord du serveur (mode `fil`) : une actualité peut être
   * réservée aux membres de son espace, et certaines discussions de formulaire sont réservées.
   * Refusé, en échec ou encore en attente, il ne l'est pas — on n'affiche rien d'un fil tant que
   * le serveur n'a pas dit qu'il le montre. Ailleurs, les messages sont ceux que la fiche publique
   * montre déjà : le fil se monte aussitôt, en anonyme compris.
   */
  const cibleSensible = openTarget !== null
    && (openTarget.type === "news" || (openTarget.type === "forms" && !!openTarget.path));
  /**
   * Un fil que le serveur vient de LISTER pour moi est, par construction, un fil qu'il me montre :
   * attendre son accord une seconde fois chargerait les messages APRÈS lui au lieu d'en même
   * temps. Connecté seulement, et sur une liste à jour : une liste en erreur garde les données de
   * sa dernière réussite, peut-être celles d'une autre session.
   */
  const cleOuverte = openTarget ? threadValue(openTarget) : null;
  const dejaListe = cleOuverte !== null && !!me?.isConnected && (
    (carrierQuery.isSuccess && carrierQuery.threads.some(th => th.key === cleOuverte))
    || (tousLesFils.isSuccess && tousLesFils.threads.some(th => th.key === cleOuverte))
  );
  const codeDuLien = deepLink.isError ? errorCodeOf(deepLink.error) : null;
  // React Query garde la dernière réponse servie à travers une erreur : `data` dit qu'un accord
  // a déjà été reçu pour CE fil (la clé porte la cible).
  const accorde = deepLink.isSuccess || deepLink.data !== undefined;
  const vue = vueDuFil(cibleSensible, dejaListe, accorde, codeDuLien);

  return (
    <section
      ref={setRoot}
      className={cn(
        "discussion-panel @container/panneau bg-background flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border",
        className,
      )}
      aria-label={String(t("panel.title"))}
      data-discussion-panel
      data-step={step}
      data-rail={attribute}
      /**
       * `data-search` est ORTHOGONAL à `data-step` : il ne doit jamais entrer dans le calcul de
       * l'étape. Dériver l'étape de la requête déclencherait l'effet de focus ci-dessus à la
       * première frappe et volerait le focus du champ, en plein mode une colonne.
       */
      data-search={rechercheActive ? "on" : "off"}
    >
      <DiscussionSearch
        value={requete}
        onChange={setRequete}
        holders={porteursAffiches.length}
        threads={tousLesFils.isLoading ? null : filsAffiches.length}
        onSubmit={validerResultatUnique}
      />

      {/* La ligne des trois colonnes. La racine étant passée en colonne pour loger la barre,
          c'est ce conteneur qui porte désormais la disposition horizontale. */}
      <div data-panel-columns className="flex min-h-0 w-full flex-1">
      {/* Colonne 1 — les porteurs */}
      <div data-panel-column="carriers" className="flex min-h-0 w-full flex-col border-e">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Users data-rail-icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <h2 data-rail-title ref={refDuTitre("carriers")} tabIndex={-1} className={PANEL_HEADING}>
            {String(t("panel.holders"))}
          </h2>
          {/* Masqué par le CSS là où la largeur impose déjà le pli : un bouton sans effet. */}
          <button
            type="button"
            data-rail-toggle
            onClick={toggle}
            disabled={!canToggle}
            aria-expanded={!collapsed}
            aria-label={String(t(collapsed ? "panel.expandRail" : "panel.collapseRail"))}
            title={String(t(collapsed ? "panel.expandRail" : "panel.collapseRail"))}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring
                       ms-auto grid size-7 shrink-0 place-items-center rounded-md transition-colors
                       focus-visible:ring-2 focus-visible:outline-none"
          >
            {collapsed
              ? <PanelLeftOpen className="size-4" aria-hidden />
              : <PanelLeftClose className="size-4" aria-hidden />}
          </button>
        </header>
        {railError
          ? <p className="text-muted-foreground p-4 text-sm">{railError}</p>
          : (
            <CarrierRail
              carriers={porteursAffiches}
              selected={activeCarrierKey}
              onSelect={onSelectCarrier}
              isLoading={rail.isLoading}
              collapsed={collapsed}
              query={requete}
              truncated={rail.carriersTruncated}
              className="min-h-0 flex-1"
            />
          )}
      </div>

      {/* Colonne 2 — les fils du porteur */}
      <div
        data-panel-column="threads"
        className="@container/fils flex min-h-0 w-full flex-col border-e"
      >
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
          <Button
            variant="ghost"
            size="icon"
            data-panel-back
            onClick={() => select({ kind: "none" })}
            aria-label={String(t("panel.backToHolders"))}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Button>
          <h3 ref={refDuTitre("threads")} tabIndex={-1} className={cn("px-1", PANEL_HEADING)}>
            {String(t(rechercheActive ? "panel.searchThreads" : "panel.threads"))}
          </h3>
        </header>
        {/* Une recherche donne toujours quelque chose à montrer ici, même sans espace choisi :
            c'est tout l'objet du périmètre transverse. */}
        {filsError
          ? <p className="text-muted-foreground p-4 text-sm">{filsError}</p>
          : !rechercheActive && activeCarrierKey === null && selection.kind !== "all"
            ? <p className="text-muted-foreground p-4 text-sm">{String(t("panel.pickHolder"))}</p>
            : (
              <ThreadColumn
                threads={filsAffiches}
                selected={openTarget ? threadValue(openTarget) : null}
                onSelect={onSelectThread}
                isLoading={filsQuery.isLoading}
                /* Sous recherche, `scanTruncated` compte autant que `truncated` : le balayage
                   serveur a pu s'arrêter avant d'avoir vu ce qu'on cherche. */
                truncated={rechercheActive
                  ? filsQuery.truncated || filsQuery.scanTruncated
                  : filsQuery.truncated}
                query={requete}
                carrierName={nomDePorteur}
                className="min-h-0 flex-1"
              />
            )}
      </div>

      {/* Colonne 3 — le fil lui-même, rendu par le composant déjà éprouvé */}
      <div data-panel-column="thread" className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
          {openTarget && (
            <Button
              variant="ghost"
              size="icon"
              data-panel-back
              onClick={() => activeCarrier
                ? select({ kind: "holder", type: activeCarrier.type, id: activeCarrier.id })
                : select({ kind: "none" })}
              aria-label={String(t("panel.backToThreads"))}
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
          )}
          <h3 ref={refDuTitre("thread")} tabIndex={-1} className={cn("px-1", PANEL_HEADING)}>
            {/* `filsDuPorteur` : la liste AFFICHÉE peut être filtrée, et le titre du fil ouvert
                retomberait alors sur « Messages » alors qu'il est là, sous les yeux. */}
            {currentTitle(filsDuPorteur, openTarget) ?? String(t("panel.messages"))}
          </h3>
          {headerEnd ? <span className="ms-auto shrink-0">{headerEnd}</span> : null}
        </header>
        {!openTarget
          ? (
            <p className="text-muted-foreground p-4 text-sm">
              {String(t(isOpen ? "panel.pickThread" : "panel.pickHolder"))}
            </p>
          )
          : vue === "cache"
          ? <p className="text-muted-foreground p-4 text-sm" data-thread-hidden>{messageDErreur("hidden")}</p>
          : vue === "connexion"
          ? <LoginToParticipate placement="block" message={String(t("panel.loginToRead"))} />
          : vue === "echec"
          ? (
            <div className="text-muted-foreground flex flex-col items-start gap-2 p-4 text-sm" data-thread-error>
              <p>{messageDErreur(codeDuLien ?? "failed")}</p>
              {/* Seule une panne mérite qu'on réessaie : un refus ne changera pas d'avis. */}
              {!isRefusalCode(codeDuLien) && (
                <Button variant="outline" size="sm" onClick={() => void deepLink.refetch()}>
                  {String(t("thread.retry"))}
                </Button>
              )}
            </div>
          )
          : vue === "attente"
          ? <p className="text-muted-foreground p-4 text-sm" aria-busy="true">{String(t("thread.loading"))}</p>
          : (
            <CommentThread
              /**
               * Remonter le fil à chaque cible est INDISPENSABLE, pas une optimisation :
               * les trois colonnes restent montées, si bien que « Répondre à M » dans le
               * fil A survivait au passage au fil B — et l'envoi partait avec `parentId`
               * du fil A sur la cible du fil B. Le repli et l'édition en cours se
               * réinitialisent du même coup, ce qui est le comportement attendu.
               */
              key={threadValue(openTarget)}
              target={openTarget}
              scopeEntity={carrierEntity.entity}
              // Le fil gère lui-même son défilement : c'est la liste qui défile, le composer
              // reste en bas. Défiler tout le fil faisait défiler le composer avec lui.
              className="min-h-0 flex-1"
            />
          )}
      </div>
      </div>
    </section>
  );
}

/** Ce que montre la colonne du fil : le fil, ou ce qui en tient lieu. */
type VueDuFil = "fil" | "attente" | "cache" | "connexion" | "echec";

/**
 * La règle du montage, à part pour se lire d'un trait. Une cible sensible attend l'accord du
 * serveur ; une autre se monte aussitôt.
 */
function vueDuFil(
  sensible: boolean,
  dejaListe: boolean,
  accorde: boolean,
  code: DiscussionErrorCode | null,
): VueDuFil {
  // Un refus `hidden` l'emporte sur tout, liste comprise : refuser plus, jamais moins.
  if (code === "hidden") return "cache";
  if (!sensible || dejaListe) return "fil";
  // Un accord déjà reçu tient face à une panne passagère, réponse illisible comprise — sans quoi
  // une relecture périodique ratée démonterait le fil ouvert, brouillon compris. Seul un refus le
  // retire.
  if (accorde && !isRefusalCode(code)) return "fil";
  if (code === "login") return "connexion";
  return code !== null ? "echec" : "attente";
}

function currentTitle(threads: readonly DiscussionThread[], target: CommentTarget | null): string | null {
  if (!target) return null;
  const key = threadValue(target);
  return threads.find(th => th.key === key)?.title ?? null;
}
